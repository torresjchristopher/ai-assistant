import { motion } from "framer-motion";

export default function InputArea({ input, setInput, onSend, loading }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-white/5 backdrop-blur-xl bg-black/40 sticky bottom-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="relative">
          {/* Input Container */}
          <div className="relative rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 focus-within:border-violet-500/50 transition-all duration-200 shadow-2xl backdrop-blur-xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Yukora..."
              disabled={loading}
              rows={1}
              className="w-full bg-transparent text-white placeholder-white/40 px-6 py-4 pr-24 resize-none focus:outline-none disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{
                minHeight: "56px",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.2) transparent",
              }}
            />

            {/* Send Button */}
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSend}
                disabled={!input.trim() || loading}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  input.trim() && !loading
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25"
                    : "bg-white/10 opacity-50 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </motion.button>
            </div>
          </div>

          {/* Footer Text */}
          <p className="text-center text-xs text-white/30 mt-3">
            Yukora can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}