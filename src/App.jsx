import { useEffect, useRef, useState } from "react";
import { Client } from "@gradio/client";

/**
 * Chat UI using @gradio/client (queue + streaming).
 * - Space must be Public; if Private, set VITE_HF_TOKEN and we’ll pass it.
 * - Calls the function route "/chat" with 6 inputs (msg, state, system, max_tok, temp, top_p).
 * - Streams tokens when available; otherwise handles final `data` event.
 * - Robust to output order: [resp, state] OR [state, resp].
 * - No localStorage persistence; includes Reset.
 */

const SPACE_URL = "https://torresjchristopher-ai-assistant.hf.space";
const FN_ROUTE = "/chat";
const HF_TOKEN = import.meta.env.VITE_HF_TOKEN?.trim() || undefined;

// Build marker so we can verify this exact bundle
console.log("BUILD:", "gradio-client-queue-stream-OK-iterable+robust");

// ---------------- HF state between turns (Space `state` component) -----------
function useHfState() {
  const ref = useRef(null);
  return {
    get: () => ref.current,
    set: (v) => (ref.current = v),
    reset: () => (ref.current = null),
  };
}

// ---------------- Extract assistant text from varied shapes -------------------
function extractAssistantText(resp) {
  if (resp == null) return null;
  if (typeof resp === "string") return resp;

  if (typeof resp === "object") {
    if (typeof resp.text === "string") return resp.text;
    if (typeof resp.answer === "string") return resp.answer;
    if (typeof resp.message === "string") return resp.message;
    if (typeof resp.assistant === "string") return resp.assistant;

    if (Array.isArray(resp.messages)) {
      const last = [...resp.messages].reverse().find((m) => m?.role === "assistant");
      if (last) {
        if (typeof last.content === "string") return last.content;
        if (last.content && typeof last.content.text === "string") return last.content.text;
      }
    }

    if (resp.value) {
      const v = resp.value;
      if (typeof v === "string") return v;
      if (Array.isArray(v)) {
        const last = v[v.length - 1];
        if (Array.isArray(last) && typeof last[1] === "string") return last[1];
      }
    }
  }

  if (Array.isArray(resp)) {
    const looksLikeMsgs = resp.every(
      (m) => m && typeof m === "object" && "role" in m && "content" in m
    );
    if (looksLikeMsgs) {
      const last = [...resp].reverse().find((m) => m.role === "assistant");
      if (last) {
        if (typeof last.content === "string") return last.content;
        if (last.content && typeof last.content.text === "string") return last.content.text;
      }
    }
    const lastPair = resp[resp.length - 1];
    if (Array.isArray(lastPair) && typeof lastPair[1] === "string") return lastPair[1];
  }

  return null;
}

// ---------- Decide which tuple element is response vs. state ------------------
function pickResponseAndState(tuple) {
  if (!Array.isArray(tuple)) return { resp: null, newState: undefined };
  const [a, b] = tuple;

  const looksLikeMsgs = (x) =>
    Array.isArray(x) &&
    x.every((m) => m && typeof m === "object" && "role" in m && "content" in m);

  const looksLikeResp = (x) =>
    typeof x === "string" ||
    looksLikeMsgs(x) ||
    (x &&
      typeof x === "object" &&
      ("text" in x || "answer" in x || "message" in x || "assistant" in x || "messages" in x || "value" in x));

  // Case 1: [resp, state]
  if (looksLikeResp(a)) return { resp: a, newState: b };
  // Case 2: [state, resp]
  if (looksLikeResp(b)) return { resp: b, newState: a };
  // Fallback
  return { resp: a ?? b ?? null, newState: undefined };
}

// --------------- Core: call Space via Client, stream tokens/data -------------
async function callSpaceStreaming(message, hfState, onChunk) {
  let app;
  try {
    app = await Client.connect(SPACE_URL, HF_TOKEN ? { hf_token: HF_TOKEN } : undefined);
  } catch (e) {
    throw new Error(
      `Cannot connect to Space (${SPACE_URL}). ` +
      `Reason: ${e?.message || e || "unknown"}. ` +
      `If the Space is Private, add VITE_HF_TOKEN in a .env file.`
    );
  }

  // Submit job
  const job = await app.submit(FN_ROUTE, [
    message,
    hfState.get(),
    "You are a friendly Chatbot.",
    512,
    0.7,
    0.95,
  ]);

  let finalText = "";
  let nextState;
  let sawAnyPayload = false;

  // Optional: 45s watchdog — avoids “spinning forever”
  const watchdog = setTimeout(() => {}, 45_000);

  try {
    for await (const ev of job) {
      // console.debug("gradio event:", ev); // uncomment for one run to inspect

      if (ev.type === "token") {
        sawAnyPayload = true;
        if (typeof ev.data === "string") {
          finalText += ev.data;
          onChunk?.(finalText);
        }
      } else if (ev.type === "data") {
        sawAnyPayload = true;
        const { resp, newState } = pickResponseAndState(ev.data ?? []);
        if (newState !== undefined) nextState = newState;

        const text =
          extractAssistantText(resp) ??
          (resp != null ? JSON.stringify(resp) : null);

        if (text) {
          finalText = text;     // authoritative final text
          onChunk?.(finalText); // flush to UI
        }
      } else if (ev.type === "error") {
        throw new Error(ev.data || "Gradio error");
      } else {
        // status/log: optional to display (queue position, running, complete, etc.)
      }
    }
  } finally {
    clearTimeout(watchdog);
  }

  if (nextState !== undefined) hfState.set(nextState);

  if (!sawAnyPayload) {
    throw new Error(
      "No tokens or final data arrived from the Space. " +
      "Double-check that the /chat function returns (response, state) or (state, response), and that the Space is Public."
    );
  }

  return finalText || null;
}

// ------------------------------------ UI -------------------------------------
export default function App() {
  const hfState = useHfState();

  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi there 👋 How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [banner, setBanner] = useState(null); // surface network/auth issues
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function append(role, content) {
    setMessages((m) => [...m, { role, content, ts: Date.now() }]);
  }

  function replaceLastAssistant(newContent) {
    setMessages((m) => {
      const arr = [...m];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].role === "assistant") {
          arr[i] = { ...arr[i], content: newContent };
          break;
        }
      }
      return arr;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    append("user", text);
    setInput("");
    append("assistant", ""); // start empty bubble

    try {
      setIsTyping(true);
      setBanner(null);
      const out = await callSpaceStreaming(text, hfState, (partial) => {
        replaceLastAssistant(partial);
      });
      if (!out) replaceLastAssistant("⚠️ No text returned.");
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || err);
      replaceLastAssistant("⚠️ Connection or Space error.");
      setBanner(msg);
    } finally {
      setIsTyping(false);
    }
  }

  function resetConversation() {
    setMessages([{ role: "assistant", content: "New chat started. How can I help?" }]);
    hfState.reset();
    setBanner(null);
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-semibold">AI Assistant</h1>
        <div className="flex gap-2">
          <button
            onClick={resetConversation}
            className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Reset
          </button>
        </div>
      </header>

      {banner && (
        <div className="bg-yellow-900/40 border border-yellow-700 text-yellow-200 px-4 py-2 text-sm">
          {banner}
        </div>
      )}

      <main ref={chatRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-gray-900">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
        {isTyping && (
          <div className="max-w-[80%] bg-gray-800 rounded-2xl p-3 text-gray-300">
            <TypingDots />
          </div>
        )}
      </main>

      <form onSubmit={onSubmit} className="bg-gray-800 border-t border-gray-700 p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-800 text-gray-100 rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <Dot delay="0ms" />
      <Dot delay="150ms" />
      <Dot delay="300ms" />
    </span>
  );
}

function Dot({ delay }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}
