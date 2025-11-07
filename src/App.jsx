import { useEffect, useRef, useState } from "react";

/**
 * Chat UI wired to a Gradio v5 Space using event_id + streaming.
 * - POST /gradio_api/call/chat  → { event_id }
 * - GET  /gradio_api/stream/chat?event_id=...  (SSE via fetch/ReadableStream)
 * - No localStorage persistence.
 */

const HF_ROOT = "https://torresjchristopher-ai-assistant.hf.space/gradio_api";
const HF_FN = "chat";

// ---------------------- HF state between turns -------------------------------
function useHfState() {
  const ref = useRef(null); // Space "state" object
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

    // Chat-style shapes
    if (Array.isArray(resp.messages)) {
      const last = [...resp.messages].reverse().find((m) => m?.role === "assistant");
      if (last) {
        if (typeof last.content === "string") return last.content;
        if (last.content && typeof last.content.text === "string") return last.content.text;
      }
    }

    if (Array.isArray(resp)) {
      // Array of message objects
      const looksLikeMsgs = resp.every((m) => m && typeof m === "object" && "role" in m && "content" in m);
      if (looksLikeMsgs) {
        const last = [...resp].reverse().find((m) => m.role === "assistant");
        if (last) {
          if (typeof last.content === "string") return last.content;
          if (last.content && typeof last.content.text === "string") return last.content.text;
        }
      }
      // Pair format: ["role","content"]
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


// ------------------------ Streaming via fetch + SSE --------------------------
async function streamOrPollHf(message, hfState, { onChunk } = {}) {
  // 1) Request -> event_id
  const payload = {
    data: [message, hfState.get(), "You are a friendly Chatbot.", 512, 0.7, 0.95],
  };

  let callRes;
  try {
    callRes = await fetch(`${HF_ROOT}/call/${HF_FN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { finalText: null, raw: { error: "network_call", detail: String(e) } };
  }

  if (!callRes.ok && callRes.status === 503) {
    await new Promise((r) => setTimeout(r, 1200));
    return streamOrPollHf(message, hfState, { onChunk });
  }

  let callJson;
  try {
    callJson = await callRes.json();
  } catch {
    return { finalText: null, raw: { error: "parse_call", status: callRes.status } };
  }

  const eventId = callJson?.event_id;
  // Some Spaces return final data directly:
  if (!eventId) {
    const direct = callJson?.data;
    if (Array.isArray(direct) && direct.length) {
      const [resp, newState] = direct;
      if (newState !== undefined) hfState.set(newState);
      return { finalText: extractAssistantText(resp) ?? JSON.stringify(resp), raw: callJson };
    }
    return { finalText: null, raw: callJson };
  }

  // 2) Try streaming endpoints in order
  const streamUrls = [
    `${HF_ROOT}/stream/${HF_FN}?event_id=${encodeURIComponent(eventId)}`,
    `${HF_ROOT}/stream/${encodeURIComponent(eventId)}`, // alt pattern
  ];

  for (const url of streamUrls) {
    const streamed = await trySseFetch(url, hfState, onChunk);
    if (streamed?.ok) return { finalText: streamed.finalText ?? null, raw: { stream_url: url } };
    // if it failed with 405/404, we’ll fall through to results
  }

  // 3) Poll possible result endpoints
  const resultUrls = [
    `${HF_ROOT}/result/${encodeURIComponent(eventId)}`,
    `${HF_ROOT}/result/${HF_FN}/${encodeURIComponent(eventId)}`, // alt pattern
  ];

  const started = Date.now();
  const TIMEOUT_MS = 20_000;
  while (Date.now() - started < TIMEOUT_MS) {
    for (const rurl of resultUrls) {
      try {
        const r = await fetch(rurl);
        if (r.ok) {
          const j = await r.json();
          if (Array.isArray(j?.data)) {
            const [resp, newState] = j.data;
            if (newState !== undefined) hfState.set(newState);
            const text = extractAssistantText(resp) ?? JSON.stringify(resp);
            return { finalText: text, raw: { result_url: rurl } };
          }
        }
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  // 4) Nothing worked – surface the event_id for backend tuning
  return { finalText: null, raw: { error: "no_stream_or_result", event_id: eventId } };
}

// Helper: parse SSE via fetch + ReadableStream
async function trySseFetch(url, hfState, onChunk) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "text/event-stream" } });
  } catch (e) {
    return { ok: false, error: "stream_connect", detail: String(e) };
  }
  if (!res.ok) {
    return { ok: false, error: "stream_status", status: res.status };
  }

  const reader = res.body?.getReader();
  if (!reader) return { ok: false, error: "no_reader" };

  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  let newStateCaptured = undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const f of frames) {
        const dataLine = f.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const jsonStr = dataLine.replace(/^data:\s*/, "").trim();
        if (!jsonStr) continue;

        let obj;
        try { obj = JSON.parse(jsonStr); } catch { continue; }

        const delta = obj?.data?.delta ?? obj?.delta ?? obj?.chunk ?? obj?.token;
        if (typeof delta === "string" && delta) {
          finalText += delta;
          onChunk?.(finalText);
          continue;
        }
        if (Array.isArray(obj?.data)) {
          const [resp, newState] = obj.data;
          if (newState !== undefined) newStateCaptured = newState;
          const text = extractAssistantText(resp) ?? JSON.stringify(resp);
          if (text) {
            finalText = text;
            onChunk?.(finalText);
          }
        }
      }
    }
  } catch (e) {
    return { ok: false, error: "stream_read", detail: String(e) };
  }

  if (newStateCaptured !== undefined) hfState.set(newStateCaptured);
  return { ok: true, finalText };
}

// ------------------------------- UI -----------------------------------------
export default function App() {
  const hfState = useHfState();

  // No persistence: fresh greeting on load/reload
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi there 👋 How can I help you today?" },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
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

append("assistant", "");

try {
  setIsTyping(true);
  const { finalText, raw } = await streamOrPollHf(text, hfState, {
    onChunk: (chunk) => replaceLastAssistant(chunk),
  });
  if (!finalText) {
    replaceLastAssistant(`🔎 Debug: ${JSON.stringify(raw, null, 2)}`);
  }
} catch (err) {
  console.error(err);
  replaceLastAssistant("⚠️ Connection error.");
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
