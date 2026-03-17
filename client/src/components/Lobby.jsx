import { useState } from 'react';
import { useTheme } from '../ThemeContext';
import socket from '../socket';

export default function Lobby({ onJoined }) {
  const { dark } = useTheme();
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [difficulty, setDifficulty] = useState('Medio');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const card = dark ? 'card-hacker' : 'card-paper';
  const btn = dark ? 'btn-hacker' : 'btn-paper';
  const input = dark ? 'input-hacker' : 'input-paper';
  const activeTab = dark
    ? 'border-b-2 border-hacker-orange text-hacker-orange'
    : 'border-b-2 border-paper-ink text-paper-ink';
  const inactiveTab = dark
    ? 'text-hacker-orange/40 hover:text-hacker-orange/70'
    : 'text-paper-sepia/50 hover:text-paper-sepia';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const name = playerName.trim();
    if (!name) {
      setError('Ingresa tu nombre');
      return;
    }

    setLoading(true);

    if (!socket.connected) {
      socket.connect();
    }

    // Esperar a que la conexión se establezca
    const onConnect = () => {
      socket.off('connect', onConnect);

      if (tab === 'create') {
        socket.emit(
          'room:create',
          { playerName: name, roomName: roomName.trim() || 'Sala Tabú', difficulty },
          (res) => {
            setLoading(false);
            if (res.ok) {
              onJoined({ roomId: res.roomId, playerId: res.playerId, playerName: name });
            } else {
              setError(res.error || 'Error al crear sala');
            }
          }
        );
      } else {
        const code = roomCode.trim().toUpperCase();
        if (!code) {
          setLoading(false);
          setError('Ingresa el código de sala');
          return;
        }
        socket.emit(
          'room:join',
          { playerName: name, roomId: code },
          (res) => {
            setLoading(false);
            if (res.ok) {
              onJoined({ roomId: res.roomId, playerId: res.playerId, playerName: name });
            } else {
              setError(res.error || 'Error al unirse');
            }
          }
        );
      }
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.on('connect', onConnect);
    }
  };

  return (
    <div className={`${card} p-6 w-full max-w-md animate-fade-in`}>
      {/* Logo */}
      <div className="text-center mb-6">
        <h2
          className={`text-4xl font-bold mb-2 ${
            dark ? 'text-hacker-orange drop-shadow-[0_0_10px_rgba(255,136,0,0.5)]' : 'text-paper-ink'
          }`}
        >
          TABÚ
        </h2>
        <p className={`text-sm ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-base'}`}>
          {dark ? '> Juego de palabras prohibidas_' : '~ Juego de palabras prohibidas ~'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-current/10 pb-0">
        <button
          onClick={() => setTab('create')}
          className={`pb-2 text-sm font-bold transition-colors ${
            tab === 'create' ? activeTab : inactiveTab
          } ${dark ? 'font-mono' : 'font-sketch text-lg'}`}
        >
          {dark ? '[ CREAR ]' : 'Crear Sala'}
        </button>
        <button
          onClick={() => setTab('join')}
          className={`pb-2 text-sm font-bold transition-colors ${
            tab === 'join' ? activeTab : inactiveTab
          } ${dark ? 'font-mono' : 'font-sketch text-lg'}`}
        >
          {dark ? '[ UNIRSE ]' : 'Unirse'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre del jugador */}
        <div>
          <label className={`block text-xs mb-1 ${dark ? 'text-hacker-orange/60 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
            {dark ? 'NOMBRE:' : 'Tu nombre'}
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={dark ? 'agent_007' : 'Tu nombre...'}
            className={`${input} w-full`}
            maxLength={20}
          />
        </div>

        {tab === 'create' && (
          <>
            <div>
              <label className={`block text-xs mb-1 ${dark ? 'text-hacker-orange/60 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
                {dark ? 'SALA:' : 'Nombre de la sala'}
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={dark ? 'room_name' : 'Nombre de la sala...'}
                className={`${input} w-full`}
                maxLength={20}
              />
            </div>

            <div>
              <label className={`block text-xs mb-1 ${dark ? 'text-hacker-orange/60 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
                {dark ? 'DIFICULTAD:' : 'Dificultad'}
              </label>
              <div className="flex gap-2">
                {['Fácil', 'Medio', 'Difícil'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-1.5 rounded text-xs transition-all ${
                      dark ? 'font-mono' : 'font-sketch text-sm'
                    } ${
                      difficulty === d
                        ? dark
                          ? 'bg-hacker-orange text-hacker-bg shadow-neon-sm'
                          : 'bg-paper-ink text-paper-bg shadow-paper-sm'
                        : dark
                          ? 'border border-hacker-orange/30 text-hacker-orange/50 hover:text-hacker-orange'
                          : 'border-2 border-paper-ink/20 text-paper-sepia hover:text-paper-ink'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'join' && (
          <div>
            <label className={`block text-xs mb-1 ${dark ? 'text-hacker-orange/60 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
              {dark ? 'CÓDIGO:' : 'Código de sala'}
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder={dark ? 'ABC123' : 'Ingresa el código...'}
              className={`${input} w-full tracking-[0.3em] text-center uppercase`}
              maxLength={6}
            />
          </div>
        )}

        {error && (
          <p className={`text-xs ${dark ? 'text-red-500 font-mono' : 'text-red-700 font-sketch'}`}>
            {dark ? `[ERROR] ${error}` : error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${btn} w-full ${loading ? 'animate-pulse' : ''}`}
        >
          {loading
            ? dark ? '>> CONECTANDO...' : 'Conectando...'
            : tab === 'create'
              ? dark ? '>> CREAR SALA' : 'Crear Sala'
              : dark ? '>> UNIRSE' : 'Unirse'
          }
        </button>
      </form>
    </div>
  );
}
