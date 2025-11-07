import { useEffect, useRef, useState } from "react";
import { Client } from "@gradio/client";

/**
 * Chat UI using @gradio/client queue/stream flow (async-iterable Job).
 * - Space must be Public (no token). For Private: Client.connect(url, { hf_token: "hf_..." }).
 * - Calls function route "/chat".
 * - Uses submit() and `for await (const ev of job)` to handle status/token/data events.
 * - No localStorage persistence; includes Reset.
 */

const SPACE_URL = "https://torresjchristopher-ai-assistant.hf.space";
const FN_ROUTE = "/chat";

// Build marker: verify this exact bundle is running in Console
console.log("BUILD:", "gradio-client-queue-stream-OK-iterable");

// ---------------------- HF state between turns -------------------------------
function useHfState() {
  const ref = useRef(null); // Space "state" component value
  return {
    get: () => ref.current,
    set: (v) => (ref.current = v),
    reset: () => (ref.current = null),
  };
}

// ------------------------- Extractor for common shapes -----------------------
function extractAssistantText(resp) {
  if (resp == null) return null;
  if (typeof resp === "string") return resp;

  if (typeof resp === "object") {
    if (typeof resp.text === "string") return resp.text;
    if (typeof resp.answer === "string") return resp.answer;
    if (typeof resp.message === "string") return resp.message;
    if (typeof resp.assistant === "string") return resp.assistant;

    // { messages: [{role, content}, ...] }
    if (Array.isArray(resp.messages)) {
      const last = [...resp.messages].reverse().find((m) => m?.role === "assistant");
      if (last) {
        if (typeof last.content === "string") return last.content;
        if (last.content && typeof last.content.text === "string") return last.content.text;
      }
    }

    // Array of message objects or [["user","..."],["assistant","..."]]
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

    // ComponentMessage { value: ... }
    if (resp.value) {
      const v = resp.value;
      if (typeof v === "string") return v;
      if (Array.isArray(v)) {
        const last = v[v.length - 1];
        if (Array.isArray(last) && typeof last[1] === "string") return last[1];
      }
    }
  }
  return null;
}

// ------------------------ Queue/stream call via @gradio/client ---------------
async function callSpaceStreaming(message, hfState, onChunk) {
  // If Private Space: const app = await Client.connect(SPACE_URL, { hf_token: "hf_..." });
  const app = await Client.connect(SPACE_URL);

  // Submit job to the queue
  const job = await app.submit(FN_ROUTE, [
    message,                       // textbox
    hfState.get(),                 // state (null first call)
    "You are a friendly Chatbot.", // system message
    512,                           // max new tokens
    0.7,                           // temperature
    0.95,                          // top-p
  ]);

  let finalText = "";
  let nextState;

  // IMPORTANT: the job itself is async iterable — no .events()
  for await (const ev of job) {
    // Types: "status", "token", "data", "log", "error"
    if (ev.type === "token") {
      if (typeof ev.data === "string") {
        finalText += ev.data;
        onChunk?.(finalText);
      }
    } else if (ev.type === "data") {
      // Final payload for this run: { data: [resp, state] }
      const [resp, newState] = ev.data ?? [];
      if (newState !== undefined) nextState = newState;
      const text = extractAssistantText(resp) ?? JSON.stringify(resp);
      finalText = text || finalText;
      onChunk?.(finalText);
    } else if (ev.type === "error") {
      throw new Error(ev.data || "Gradio error");
    } else {
      // status/log -> optional to display; you can show a spinner if desired
      // console.debug("gradio event:", ev);
    }
  }

  if (nextState !== undefined) hfState.set(nextState);
  return finalText || null;
}

// --------------------------------- UI ----------------------------------------
export default function App() {
  const hfState = useHfState();

  // No persistence: fresh greeting on load
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi there 👋 How can I help you today?" },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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

    // Start an empty assistant bubble immediately
    append("assistant", "");

    try {
      setIsTyping(true);
      const final = await callSpaceStreaming(text, hfState, (partial) => {
        replaceLastAssistant(partial);
      });
      if (!final) {
        replaceLastAssistant("⚠️ No text returned.");
      }
    } catch (err) {
      console.error(err);
      replaceLastAssistant("⚠️ Connection error (see Console).");
    } finally {
      setIsTyping(false);
    }
  }

  function resetConversation() {
    setMessages([{ role: "assistant", content: "New chat started. How can I help?" }]);
    hfState.reset();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
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

      {/* Messages */}
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

      {/* Input */}
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
