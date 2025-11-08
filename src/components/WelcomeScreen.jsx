import { motion } from "framer-motion";

export default function WelcomeScreen({ onSuggestionClick }) {
  const suggestions = [
    {
      icon: "💡",
      title: "Explain a concept",
      prompt: "Explain quantum computing in simple terms",
    },
    {
      icon: "✍️",
      title: "Help me write",
      prompt: "Help me write a professional email",
    },
    {
      icon: "🎨",
      title: "Get creative",
      prompt: "Give me ideas for a creative project",
    },
    {
      icon: "📊",
      title: "Analyze data",
      prompt: "Help me understand this data pattern",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mb-8"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-violet-500/25 mb-6">
          <svg
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      </motion.div>

      {/* Welcome Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-12"
      >
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
          Welcome to Yukora
        </h1>
        <p className="text-lg text-white/50 max-w-md mx-auto">
          Your intelligent assistant for answers, ideas, and insights
        </p>
      </motion.div>

      {/* Suggestions Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl"
      >
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className="group relative p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-white/10 transition-all duration-200 text-left overflow-hidden"
          >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            
            <div className="relative">
              <div className="text-2xl mb-2">{suggestion.icon}</div>
              <div className="font-medium text-white/90 mb-1">
                {suggestion.title}
              </div>
              <div className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
                {suggestion.prompt}
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Additional Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-12 flex gap-6 text-sm text-white/30"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Fast responses</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Secure & private</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <span>Always learning</span>
        </div>
      </motion.div>
    </motion.div>
  );
}