export default function TabooCard({ word, taboo, dark, onSkip }) {
  const btn = dark ? 'btn-hacker' : 'btn-paper';

  return (
    <div
      className={`animate-fade-in rounded-lg overflow-hidden ${
        dark
          ? 'border-2 border-hacker-orange shadow-neon'
          : 'border-3 border-paper-ink/40 shadow-paper'
      }`}
    >
      {/* Header - Secret word */}
      <div
        className={`p-4 text-center ${
          dark
            ? 'bg-hacker-orange/10 border-b border-hacker-orange/40'
            : 'bg-paper-bg-dark border-b-2 border-paper-ink/20'
        }`}
      >
        <p className={`text-xs mb-1 ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch'}`}>
          {dark ? 'PALABRA SECRETA:' : 'Palabra secreta:'}
        </p>
        <p
          className={`text-3xl font-bold tracking-wider ${
            dark
              ? 'text-hacker-orange font-mono drop-shadow-[0_0_10px_rgba(255,136,0,0.5)]'
              : 'text-paper-ink font-sketch text-4xl'
          }`}
        >
          {word}
        </p>
      </div>

      {/* Body - Taboo words */}
      <div className={`p-4 ${dark ? 'bg-hacker-bg' : 'bg-paper-bg'}`}>
        <p className={`text-xs mb-3 text-center ${dark ? 'text-red-500 font-mono' : 'text-red-700 font-sketch text-sm'}`}>
          {dark ? '⛔ PALABRAS PROHIBIDAS:' : '⛔ Palabras prohibidas:'}
        </p>
        <div className="flex flex-col gap-2">
          {taboo.map((t, i) => (
            <div
              key={i}
              className={`text-center py-2 rounded ${
                dark
                  ? 'bg-red-900/20 border border-red-500/30 text-red-400 font-mono text-sm'
                  : 'bg-red-50 border-2 border-red-300/50 text-red-700 font-sketch text-lg'
              }`}
            >
              {t}
            </div>
          ))}
        </div>

        <button
          onClick={onSkip}
          className={`${btn} w-full mt-4 text-xs ${
            dark ? 'text-red-500 border-red-500/50 hover:bg-red-900/20' : 'text-red-700 border-red-300'
          }`}
        >
          {dark ? '>> SALTAR (-1 pt)' : 'Saltar palabra (-1 pt)'}
        </button>
      </div>
    </div>
  );
}
