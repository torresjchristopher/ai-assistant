import React, { useState } from "react";
import axios from "axios";

const API_URL = "https://ai-assistant-backend-576t.onrender.com/api/chat";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage = { user: input, bot: "..." };
    const history = [...messages, newMessage];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(API_URL, {
        message: input,
        history: messages,
      });

      setMessages([
        ...history.slice(0, -1),
        { user: input, bot: res.data.response },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...history.slice(0, -1),
        { user: input, bot: "⚠️ Error: could not connect." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-4">AI Assistant</h1>
      <div className="w-full max-w-2xl bg-gray-800 p-4 rounded-lg shadow-lg h-[70vh] overflow-y-auto mb-4">
        {messages.map((msg, i) => (
          <div key={i} className="mb-3">
            <div className="font-semibold text-blue-400">You:</div>
            <div className="ml-2">{msg.user}</div>
            <div className="font-semibold text-green-400 mt-2">AI:</div>
            <div className="ml-2 whitespace-pre-wrap">{msg.bot}</div>
          </div>
        ))}
        {loading && <p className="text-sm text-gray-400">Thinking...</p>}
      </div>
      <form
        onSubmit={sendMessage}
        className="w-full max-w-2xl flex gap-2 items-center"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-3 rounded-lg bg-gray-700 text-gray-100 outline-none"
          placeholder="Type your message..."
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={loading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
