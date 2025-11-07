import { useEffect, useRef, useState } from "react";

const HF_ROOT = "https://torresjchristopher-ai-assistant.hf.space/gradio_api";
const HF_FN = "chat";
const STORAGE_KEY = "ai-assistant-chat:v1";

function useHfState() {
  const ref = useRef(null);
  return {
    get: () => ref.current,
    set: (v) => (ref.current = v),
  };
}

function extractAssistantText(resp) {
  if (resp == null) return null;
  if (typeof resp === "string") return resp;

  if (typeof resp === "object") {
    if (typeof resp.text === "string") return resp.text;
    if (typeof resp.answer === "string") return resp.answer;
    if (typeof resp.message === "string") return resp.message;
    if (typeof resp.assistant === "string") return resp.assistant;

    if (Array.isArray(resp.messages)) {
      const last = [...resp.messages].reverse().find(m => m?.role === "assistant");
      if (last) {
        if (typeof last.content === "string") return last.content;
        if (last.content && typeof last.content.text === "string") return last.content.text;
      }
    }

    if (Array.isArray(resp)) {
      const looksLikeMsgs = resp.every(
        m => m && typeof m === "object" && "role" in m && "content" in m
      );
      if (looksLikeMsgs) {
        const last = [...resp].reverse().find(m => m.role === "assistant");
        if (last) {
          if (typeof last.content === "string") return last.content;
          if (last.content && typeof last.content.text === "string") return last.content.text;
        }
      }
      const lastPair = resp[resp.length - 1];
      if (Array.isArray(lastPair) && typeof lastPair[1] === "string") return lastPair[1];
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

  return null;
}

async function callHuggingFace(message, hfState) {
  const payload = {
    data: [
      message,
      hfState.get(),
      "You are a friendly Chatbot.",
      512,
      0.7,
      0.95
    ],
  };

  let res = await fetch(`${HF_ROOT}/call/${HF_FN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok && res.status === 503) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(`${HF_ROOT}/call/${HF_FN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  const json = await res.json();
  const [resp, newState] = json?.data ?? [];
  if (newState !== undefined) hfState.set(newState);

  const text = extractAssistantText(resp);
  return { text: text ?? null, raw: resp };
}

function typeOut(fullText, cps = 18, onUpdate) {
  const delay = 60;
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
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved
        ? JSON.parse(saved)
        : [{ role: "assistant", content: "Hi there 👋 How can I help you today?" }];
    } catch {
      return [{ role: "assistant", content: "Hi there 👋 How can I help you today?" }];
    }
  });

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
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
      const { text: respText, raw } = await callHuggingFace(text, hfState);
      const finalText =
        respText ?? `🔎 Debug payload (copy this to me):\n${JSON.stringify(raw, null, 2)}`;

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

  function clearChat() {
    setMessages([{ role: "assistant", content: "Chat cleared. How can I help?" }]);
    localStorage.removeItem(STORAGE_KEY);
    hfState.set(null);
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-semibold">AI Assistant</h1>
        <button
          onClick={clearChat}
          className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm"
        >
          Clear
        </button>
      </header>

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