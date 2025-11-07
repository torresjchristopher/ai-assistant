import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ChatBubble from "./components/ChatBubble.jsx";

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "👋 Hi there! What would you like to explore today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState(".");
  const chatEndRef = useRef(null);

  const API_BASE = "https://ai-assistant-backend-576t.onrender.com";

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length < 3 ? prev + "." : "."));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/api/chat-stream`, {
        message: userMsg.content,
        history: messages,
      }, { responseType: "text" });

      let acc = "";
      const lines = res.data.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.delta) {
            acc += json.delta;
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last.role === "assistant") last.content = acc;
              else copy.push({ role: "assistant", content: acc });
              return copy;
            });
          }
        } catch {}
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Connection error." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="backdrop-blur-xl bg-white/60 border-b border-gray-200 shadow-sm p-5 text-center font-semibold text-lg">
        Yukora AI Assistant
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-3">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm ml-2">
            <span className="animate-pulse">Thinking{dots}</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <footer className="border-t border-gray-200 backdrop-blur-xl bg-white/70 p-4 flex items-center space-x-2">
        <input
          type="text"
          placeholder="Type something..."
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring focus:ring-blue-200"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </footer>
    </div>
  );
}

