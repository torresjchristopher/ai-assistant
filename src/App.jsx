import { useEffect, useRef, useState } from "react";

/**
 * Chat UI powered by your HF Space backend. Includes:
 * - Local history persistence (localStorage)
 * - Typing/streaming simulation
 * - Abort ongoing request
 *
 * NOTE on TRUE streaming:
 * Gradio's /run/predict typically returns a full JSON at once.
 * This code simulates token streaming. If you later expose an SSE/WebSocket
 * or chunked endpoint, wire it in `sendToBackend(true)` paths.
 */
export default function App() {
  const API_URL = "https://torresjchristopher-ai-assistant.hf.space/run/predict";
  const STORAGE_KEY = "ai-assistant-chat:v1";

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
  const [pendingText, setPendingText] = useState("");
  const abortRef = useRef(null);
  const chatRef = useRef(null);

  // persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    // keep scrolled to bottom
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function append(role, content) {
    setMessages((m) => [...m, { role, content, ts: Date.now() }]);
  }

  function replaceLastAssistant(newContent) {
    setMessages((m) => {
      const copy = [...m];
      // find last assistant message (typically the last one)
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") {
          copy[i] = { ...copy[i], content: newContent };
          break;
        }
      }
      return copy;
    });
  }

  function cancelCurrent() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTyping(false);
    setPendingText("");
  }

  async function sendToBackend(userText, simulateStreaming = true) {
    // Abort any prior
    cancelCurrent();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [userText] }),
        signal: controller.signal,
      });

      const payload = await res.json();
      const full = payload?.data?.[0] ?? "Sorry — no response was returned.";

      if (!simulateStreaming) {
        // instant message: no typing sim
        append("assistant", full);
        setIsTyping(false);
        return;
      }

      // typing/streaming simulation
      setIsTyping(true);
      append("assistant", ""); // create an empty assistant bubble
      await typeOut(full, 18, (chunk) => {
        replaceLastAssistant(chunk);
      });
      setIsTyping(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      append("assistant", "⚠️ Connection error.");
      setIsTyping(false);
    } finally {
      abortRef.current = null;
    }
  }

  // progressively writes out the text to simulate streaming
  function typeOut(fullText, cps = 18, onUpdate) {
    // cps ~ characters per 60ms chunk; adjust below
    const delay = 60; // ms
    return new Promise((resolve) => {
      let i = 0;
      let buffer = "";
      const timer = setInterval(() => {
        // add ~cps characters per tick
        buffer += fullText.slice(i, i + cps);
        i += cps;
        onUpdate(buffer);
        if (i >= fullText.length) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    append("user", content);
    setInput("");

    // Send with simulated streaming; flip to false if you want instant answers
    sendToBackend(content, true);
  }

  function clearChat() {
    cancelCurrent();
    setMessages([{ role: "assistant", content: "Chat cleared. How can I help?" }]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-semibold">AI Assistant</h1>
        <div className="flex gap-2">
          <button
            onClick={clearChat}
            className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Clear
          </button>
          <button
            onClick={cancelCurrent}
            className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Stop
          </button>
        </div>
      </header>

      {/* Messages */}
      <main
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-gray-900"
      >
        {messages.map((m, idx) => (
          <Message key={idx} role={m.role} content={m.content} />
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
