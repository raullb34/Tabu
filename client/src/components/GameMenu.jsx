import { useTheme } from '../ThemeContext';

const GAMES = [
  {
    id: 'taboo',
    name: 'Tabú',
    emoji: '🚫',
    description: 'Describe la palabra sin usar las prohibidas',
    minPlayers: 2,
    maxPlayers: 10,
    color: 'orange',
  },
  {
    id: 'rummy',
    name: 'Rummikub',
    emoji: '🎲',
    description: 'Forma combinaciones con fichas numeradas',
    minPlayers: 2,
    maxPlayers: 4,
    color: 'green',
  },
];

export default function GameMenu({ onSelectGame }) {
  const { dark } = useTheme();
  const card = dark ? 'card-hacker' : 'card-paper';
  const btn = dark ? 'btn-hacker' : 'btn-paper';

  return (
    <div className={`${card} p-8 w-full max-w-lg animate-fade-in`}>
      <div className="text-center mb-8">
        <h2
          className={`text-4xl font-bold mb-2 ${
            dark
              ? 'text-hacker-orange drop-shadow-[0_0_10px_rgba(255,136,0,0.5)]'
              : 'text-paper-ink'
          }`}
        >
          {dark ? '<JUEGOS/>' : '~ Juegos ~'}
        </h2>
        <p
          className={`text-sm ${
            dark
              ? 'text-hacker-orange/50 font-mono'
              : 'text-paper-sepia font-sketch text-base'
          }`}
        >
          {dark ? '> Elige un juego para empezar_' : 'Elige un juego para empezar'}
        </p>
      </div>

      <div className="grid gap-4">
        {GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className={`text-left p-5 rounded-lg transition-all duration-200 group ${
              dark
                ? 'border border-hacker-orange/30 hover:border-hacker-orange hover:bg-hacker-orange/5 hover:shadow-neon-sm'
                : 'border-2 border-paper-ink/15 hover:border-paper-ink/40 hover:bg-white/40 hover:shadow-paper'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{game.emoji}</span>
              <div className="flex-1">
                <h3
                  className={`text-xl font-bold mb-1 ${
                    dark
                      ? 'text-hacker-orange font-mono group-hover:drop-shadow-[0_0_6px_rgba(255,136,0,0.4)]'
                      : 'text-paper-ink font-sketch text-2xl'
                  }`}
                >
                  {game.name}
                </h3>
                <p
                  className={`text-sm ${
                    dark
                      ? 'text-hacker-orange/50 font-mono'
                      : 'text-paper-sepia font-sketch'
                  }`}
                >
                  {game.description}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    dark
                      ? 'text-hacker-orange/30 font-mono'
                      : 'text-paper-sepia/50 font-sketch'
                  }`}
                >
                  {game.minPlayers}-{game.maxPlayers} jugadores
                </p>
              </div>
              <span
                className={`text-lg transition-transform group-hover:translate-x-1 ${
                  dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/40'
                }`}
              >
                {dark ? '>>' : '→'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
