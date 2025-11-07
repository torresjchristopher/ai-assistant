import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi there 👋 How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const API_BASE = "https://ai-assistant-backend-576t.onrender.com";

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/api/chat-stream`, {
        message: input,
        history: messages,
      }, { responseType: "text" });

      let accumulated = "";
      const reader = res.data.split("\n");

      for (const chunk of reader) {
        if (chunk.trim() === "") continue;
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.delta) {
            accumulated += parsed.delta;
            setMessages((m) => {
              const newMsgs = [...m];
              const last = newMsgs[newMsgs.length - 1];
              if (last.role === "assistant") last.content = accumulated;
              else newMsgs.push({ role: "assistant", content: accumulated });
              return newMsgs;
            });
          }
        } catch {}
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ Connection error." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="p-4 text-center font-semibold text-xl bg-white shadow-sm">
        AI Assistant
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 max-w-[80%] rounded-2xl ${
              msg.role === "user"
                ? "bg-blue-600 text-white self-end ml-auto"
                : "bg-gray-200 text-gray-800 self-start"
            }`}
          >
            {msg.content}
          </div>
        ))}
        <div ref={chatEndRef} />
      </main>

      <footer className="p-4 bg-white flex items-center space-x-2 shadow-inner">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type your message..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring focus:ring-blue-200"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </footer>
    </div>
  );
}
