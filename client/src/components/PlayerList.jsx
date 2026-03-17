export default function PlayerList({ players, dark, playerName, roomCode }) {
  const card = dark ? 'card-hacker' : 'card-paper';

  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={`${card} h-fit`}>
      <div className={`px-4 py-3 border-b ${dark ? 'border-hacker-orange/20' : 'border-paper-ink/10'}`}>
        <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
          {dark ? `> JUGADORES (${players.length})` : `Jugadores (${players.length})`}
        </span>
      </div>

      <div className="p-3 space-y-2">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 rounded transition-colors ${
              dark
                ? `border border-hacker-orange/10 ${p.isGiver ? 'bg-hacker-orange/10 border-hacker-orange/30' : 'hover:bg-white/5'}`
                : `border-2 border-paper-ink/5 ${p.isGiver ? 'bg-yellow-50 border-yellow-600/20' : 'hover:bg-white/30'}`
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs w-5 text-center ${dark ? 'text-hacker-orange/30 font-mono' : 'text-paper-sepia/40 font-sketch'}`}>
                {i === 0 && players.length > 1 ? '👑' : `${i + 1}.`}
              </span>
              <span className={`text-sm ${
                dark ? 'text-hacker-orange font-mono' : 'text-paper-ink font-sketch text-base'
              } ${p.name === playerName ? 'font-bold' : ''}`}>
                {p.name}
                {p.name === playerName && (
                  <span className={`text-xs ml-1 ${dark ? 'text-hacker-orange/30' : 'text-paper-sepia/40'}`}>
                    (tú)
                  </span>
                )}
              </span>
              {p.isGiver && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  dark
                    ? 'bg-hacker-orange/20 text-hacker-orange font-mono'
                    : 'bg-yellow-100 text-yellow-800 font-sketch'
                }`}>
                  {dark ? 'DADOR' : 'Dador'}
                </span>
              )}
            </div>
            <span className={`text-sm font-bold ${dark ? 'text-hacker-orange font-mono' : 'text-paper-ink font-sketch text-base'}`}>
              {p.score} pts
            </span>
          </div>
        ))}
      </div>

      {/* Room code */}
      <div className={`px-4 py-3 border-t ${dark ? 'border-hacker-orange/20' : 'border-paper-ink/10'} text-center`}>
        <p className={`text-xs mb-1 ${dark ? 'text-hacker-orange/30 font-mono' : 'text-paper-sepia/50 font-sketch'}`}>
          {dark ? 'CÓDIGO DE SALA:' : 'Código de sala:'}
        </p>
        <p className={`text-2xl font-bold tracking-[0.3em] ${
          dark ? 'text-hacker-orange font-mono' : 'text-paper-ink font-sketch text-3xl'
        }`}>
          {roomCode}
        </p>
      </div>
    </div>
  );
}
