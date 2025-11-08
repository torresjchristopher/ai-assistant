import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import ChatMessage from "./components/ChatMessage";
import InputArea from "./components/InputArea";
import WelcomeScreen from "./components/WelcomeScreen";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const API_BASE = "https://ai-assistant-backend-576t.onrender.com";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Add placeholder for assistant message
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await axios.post(
        `${API_BASE}/api/chat-stream`,
        {
          message: userMsg.content,
          history: newMessages.filter((m) => m.content),
        },
        { responseType: "text" }
      );

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
              if (last.role === "assistant") {
                last.content = acc;
              }
              return copy;
            });
          }
        } catch (e) {
          console.warn("Failed to parse line:", line);
        }
      }

      if (!acc) {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") {
            last.content = "⚠️ No response received from server.";
          }
          return copy;
        });
      }
    } catch (err) {
      console.error("API Error:", err);
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last.role === "assistant") {
          last.content = `⚠️ Connection error: ${err.message}`;
        }
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-xl bg-black/40 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Yukora
              </span>
            </div>
            <button className="text-sm text-white/60 hover:text-white/90 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              New chat
            </button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-4xl mx-auto py-8">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <WelcomeScreen onSuggestionClick={setInput} />
            ) : (
              messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  isLatest={i === messages.length - 1}
                  isStreaming={loading && i === messages.length - 1}
                />
              ))
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <InputArea
        input={input}
        setInput={setInput}
        onSend={handleSend}
        loading={loading}
      />
    </div>
  );
}