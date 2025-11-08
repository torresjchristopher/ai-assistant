import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function ChatMessage({ role, content, isLatest, isStreaming }) {
  const isUser = role === "user";
  const [displayedContent, setDisplayedContent] = useState("");

  useEffect(() => {
    setDisplayedContent(content);
  }, [content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`group mb-8 ${isUser ? "flex justify-end" : ""}`}
    >
      <div className={`flex gap-4 max-w-full ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-semibold">
              U
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white/90">
              {isUser ? "You" : "Yukora"}
            </span>
            {isStreaming && !isUser && (
              <div className="flex gap-1">
                <motion.div
                  className="w-1 h-1 rounded-full bg-violet-500"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-1 h-1 rounded-full bg-violet-500"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-1 h-1 rounded-full bg-violet-500"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            )}
          </div>
          
          <div
            className={`prose prose-invert max-w-none ${
              isUser
                ? "inline-block px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg"
                : "text-white/90 leading-relaxed"
            }`}
          >
            {displayedContent || (
              <span className="text-white/40 italic">Thinking...</span>
            )}
          </div>

          {/* Action Buttons (only for assistant messages) */}
          {!isUser && content && (
            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded hover:bg-white/5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded hover:bg-white/5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}