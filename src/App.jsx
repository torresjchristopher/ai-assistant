import React, { useState } from "react";
import { Client } from "@gradio/client";

function App() {
  const [messages, setMessages] = useState([
    { sender: "assistant", text: "Hi there 👋 How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const app = await Client.connect(
        "https://torresjchristopher-ai-assistant-yukora.hf.space"
      );

      const response = await app.predict("/chat", [input, null]);
      const botReply =
        response?.data?.[0]?.[1] ?? "⚠️ No response from backend.";

      setMessages([...newMessages, { sender: "assistant", text: botReply }]);
    } catch (err) {
      console.error("Error:", err);
      setMessages([
        ...newMessages,
        { sender: "assistant", text: "⚠️ Connection error." },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-xl p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-4 text-center">AI Assistant</h1>
        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl max-w-[80%] ${
                m.sender === "user"
                  ? "bg-indigo-600 self-end ml-auto"
                  : "bg-gray-700 self-start"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex space-x-2">
          <input
            className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-white font-semibold"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
