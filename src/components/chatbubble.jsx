export default function ChatBubble({ role, content }) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 transition-all`}
    >
      <div
        className={`px-4 py-3 max-w-[75%] rounded-2xl shadow-sm
          ${isUser
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            : "bg-white/60 backdrop-blur-md border border-gray-200 text-gray-900"}
        `}
      >
        <p className="whitespace-pre-line leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
