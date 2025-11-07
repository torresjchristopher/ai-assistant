import { useEffect, useRef, useState } from "react";

// --- Hugging Face / Gradio v5 wiring ---------------------------------------
const HF_ROOT = "https://torresjchristopher-ai-assistant.hf.space/gradio_api";
const HF_FN = "chat";

// ---- Streaming helpers -----------------------------------------------------
// Try true SSE streaming first, fall back to a result endpoint if needed.
async function streamHuggingFace(message, hfState, { onChunk } = {}) {
  // 1) Kick off the job -> event_id
  const payload = {
    data: [
      message,
      hfState.get(),
      "You are a friendly Chatbot.",
      512,
      0.7,
      0.95,
    ],
  };

  const callRes = await fetch(`${HF_ROOT}/call/${HF_FN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!callRes.ok && callRes.status === 503) {
    await new Promise((r) => setTimeout(r, 1200));
    return streamHuggingFace(message, hfState, { onChunk });
  }
  const callJson = await callRes.json();
  const eventId = callJson?.event_id;
  if (!eventId) {
    // Some Spaces still return data directly (rare). Handle that too.
    const direct = callJson?.data;
    if (Array.isArray(direct) && direct.length) {
      const [resp, newState] = direct;
      if (newState !== undefined) hfState.set(newState);
      return { finalText: extractAssistantText(resp) ?? JSON.stringify(resp), raw: callJson };
    }
    return { finalText: null, raw: callJson };
  }

  // 2) Try EventSource streaming
  let buffer = "";
  let resolved = false;

  const result = await new Promise((resolve) => {
    let es;
    try {
      es = new EventSource(`${HF_ROOT}/stream/${HF_FN}?event_id=${encodeURIComponent(eventId)}`);
    } catch (e) {
      resolve(null);
      return;
    }

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // Common patterns:
        // - { data: [resp, new_state] } (final)
        // - { data: { delta: "text" } } (chunk)
        // - { delta: "text" } or { chunk: "text" } (chunk)
        // - { type: "complete" } (done)
        if (Array.isArray(data?.data)) {
          const [resp, newState] = data.data;
          if (newState !== undefined) hfState.set(newState);
          const text = extractAssistantText(resp) ?? JSON.stringify(resp);
          buffer = text; // ensure we have the final
          return; // keep listening for a completion signal
        }
        const delta = data?.data?.delta ?? data?.delta ?? data?.chunk ?? data?.token;
        if (typeof delta === "string" && delta) {
          buffer += delta;
          onChunk?.(buffer);
        }
        if (data?.type === "complete" || data?.event === "end" || data?.done === true) {
          if (!resolved) {
            resolved = true;
            es.close();
            resolve({ finalText: buffer || null, raw: data });
          }
        }
      } catch (_) {
        // Non-JSON keep-alives; ignore
      }
    };

    es.onerror = () => {
      if (!resolved) {
        es.close();
        resolve(null); // fall back to /result
      }
    };
  });

  if (result) return result;

  // 3) Fallback: poll a likely result endpoint
  try {
    const res2 = await fetch(`${HF_ROOT}/result/${eventId}`);
    if (res2.ok) {
      const j = await res2.json();
      const [resp, newState] = j?.data ?? [];
      if (newState !== undefined) hfState.set(newState);
      return { finalText: extractAssistantText(resp) ?? JSON.stringify(resp), raw: j };
    }
  } catch (_) {}

  // 4) Last resort: return the event id for debugging
  return { finalText: null, raw: { event_id: eventId } };
}

// Robust extractor for common Gradio response shapes.
function extractAssistantText(resp)(resp) {
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
      // Pair format: ["role", "content"]
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

async function callHuggingFace(message, hfState) {
  const payload = {
    data: [
      message, // textbox
      hfState.get(), // state (null on first call)
      "You are a friendly Chatbot.", // system prompt
      512, // max new tokens
      0.7, // temperature
      0.95, // top-p
    ],
  };

  let res;
  let json;
  try {
    res = await fetch(`${HF_ROOT}/call/${HF_FN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    return { text: null, raw: { error: "network", detail: String(networkErr) } };
  }

  // Cold start retry
  if (!res.ok && res.status === 503) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(`${HF_ROOT}/call/${HF_FN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  try {
    json = await res.json();
  } catch (parseErr) {
    return { text: null, raw: { error: "parse", status: res.status, statusText: res.statusText } };
  }

  const data = json?.data;
  if (!Array.isArray(data) || data.length < 1) {
    return { text: null, raw: { error: "shape", status: res.status, body: json } };
  }

  const [resp, newState] = data;
  if (newState !== undefined) hfState.set(newState);

  const text = extractAssistantText(resp);
  return { text: text ?? null, raw: resp, full: json };
}

function typeOut(fullText, cps = 18, onUpdate) {
  const delay = 60; // ms
  return new Promise((resolve) => {
    let i = 0;
    let buf = "";
    const t = setInterval(() => {
      buf += fullText.slice(i, i + cps);
      i += cps;
      onUpdate(buf);
      if (i >= fullText.length) {
        clearInterval(t);
        resolve();
      }
    }, delay);
  });
}

export default function App() {
  const hfState = useHfState();

  // No persistence: initialize with a single assistant greeting
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

    try {
      const { text: respText, raw, full } = await callHuggingFace(text, hfState);
      const finalText =
        respText ?? `🔎 Debug (status unknown):
${JSON.stringify(full ?? raw, null, 2)}`;

      setIsTyping(true);
      append("assistant", "");
      await typeOut(finalText, 18, (chunk) => replaceLastAssistant(chunk));
    } catch (err) {
      console.error(err);
      append("assistant", "⚠️ Connection error.");
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
          <button type="submit" className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold">
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
          isUser ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-800 text-gray-100 rounded-bl-sm"
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
  return <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: delay }} />;
}
