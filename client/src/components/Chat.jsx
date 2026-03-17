import { useState, useRef, useEffect } from 'react';

export default function Chat({ messages, onSend, dark, playerName }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const input = dark ? 'input-hacker' : 'input-paper';
  const btn = dark ? 'btn-hacker' : 'btn-paper';
  const card = dark ? 'card-hacker' : 'card-paper';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className={`${card} flex flex-col`}>
      <div className={`px-3 py-2 border-b ${dark ? 'border-hacker-orange/20' : 'border-paper-ink/10'}`}>
        <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
          {dark ? '> CHAT' : 'Chat'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[300px]"
      >
        {messages.length === 0 && (
          <p className={`text-center text-xs py-8 ${dark ? 'text-hacker-orange/20 font-mono' : 'text-paper-sepia/40 font-sketch text-sm'}`}>
            {dark ? '// sin mensajes' : 'Sin mensajes aún...'}
          </p>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} dark={dark} isOwn={msg.sender === playerName} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className={`flex gap-2 p-3 border-t ${dark ? 'border-hacker-orange/20' : 'border-paper-ink/10'}`}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={dark ? 'escribe aquí...' : 'Escribe aquí...'}
          className={`${input} flex-1`}
          maxLength={200}
        />
        <button type="submit" className={`${btn} px-4`}>
          {dark ? '>>' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ msg, dark, isOwn }) {
  if (msg.system) {
    return (
      <div className={`text-center text-xs py-1 ${
        dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/60 font-sketch text-sm'
      }`}>
        {msg.text}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <span className={`text-xs mb-0.5 ${
        dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/50 font-sketch'
      }`}>
        {msg.sender}
      </span>
      <div
        className={`px-3 py-1.5 rounded-lg max-w-[80%] break-words text-sm ${
          msg.isClue
            ? dark
              ? 'bg-hacker-orange/10 border border-hacker-orange/30 text-hacker-orange font-mono'
              : 'bg-yellow-50 border-2 border-yellow-600/30 text-yellow-900 font-sketch text-base'
            : msg.isGuess
              ? dark
                ? 'bg-blue-900/20 border border-blue-500/30 text-blue-400 font-mono'
                : 'bg-blue-50 border-2 border-blue-400/30 text-blue-800 font-sketch text-base'
              : isOwn
                ? dark
                  ? 'bg-hacker-orange/5 border border-hacker-orange/20 text-hacker-orange font-mono'
                  : 'bg-paper-bg-dark border-2 border-paper-ink/15 text-paper-ink font-sketch text-base'
                : dark
                  ? 'bg-white/5 border border-white/10 text-hacker-orange/80 font-mono'
                  : 'bg-white/50 border-2 border-paper-ink/10 text-paper-ink font-sketch text-base'
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}
