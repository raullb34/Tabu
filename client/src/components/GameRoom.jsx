import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import socket from '../socket';
import TabooCard from './TabooCard';
import Chat from './Chat';
import PlayerList from './PlayerList';
import Timer from './Timer';

export default function GameRoom({ roomId, playerId, playerName, onLeave }) {
  const { dark } = useTheme();
  const [roomState, setRoomState] = useState(null);
  const [role, setRole] = useState(null);          // 'giver' | 'guesser' | null
  const [secretWord, setSecretWord] = useState('');
  const [tabooWords, setTabooWords] = useState([]);
  const [giverName, setGiverName] = useState('');
  const [roundNum, setRoundNum] = useState(0);
  const [roundEndTime, setRoundEndTime] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roundResult, setRoundResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const card = dark ? 'card-hacker' : 'card-paper';
  const btn = dark ? 'btn-hacker' : 'btn-paper';

  // ─── Socket Listeners ───
  useEffect(() => {
    function onRoomState(state) {
      setRoomState(state);
    }

    function onStartGiver({ word, taboo, round }) {
      setRole('giver');
      setSecretWord(word);
      setTabooWords(taboo);
      setRoundNum(round);
      setRoundResult(null);
      setLoading(false);
    }

    function onStartGuesser({ giverName: gn, round }) {
      setRole('guesser');
      setSecretWord('');
      setTabooWords([]);
      setGiverName(gn);
      setRoundNum(round);
      setRoundResult(null);
      setLoading(false);
    }

    function onTimer({ endsAt }) {
      setRoundEndTime(endsAt);
    }

    function onRoundEnd(data) {
      setRoundResult(data);
      setRole(null);
      setRoundEndTime(null);
    }

    function onChatMessage(msg) {
      setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
    }

    function onErrorMessage(text) {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(''), 4000);
    }

    socket.on('room:state', onRoomState);
    socket.on('round:start-giver', onStartGiver);
    socket.on('round:start-guesser', onStartGuesser);
    socket.on('round:timer', onTimer);
    socket.on('round:end', onRoundEnd);
    socket.on('chat:message', onChatMessage);
    socket.on('error:message', onErrorMessage);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('round:start-giver', onStartGiver);
      socket.off('round:start-guesser', onStartGuesser);
      socket.off('round:timer', onTimer);
      socket.off('round:end', onRoundEnd);
      socket.off('chat:message', onChatMessage);
      socket.off('error:message', onErrorMessage);
    };
  }, []);

  const handleStartRound = useCallback(() => {
    setLoading(true);
    socket.emit('round:start');
  }, []);

  const handleSkip = useCallback(() => {
    socket.emit('round:skip');
  }, []);

  const handleSend = useCallback((text) => {
    socket.emit('chat:send', { text });
  }, []);

  const handleChangeDifficulty = useCallback((difficulty) => {
    socket.emit('room:difficulty', { difficulty });
  }, []);

  const isGiver = role === 'giver';
  const isRoundActive = roomState?.roundActive;

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in flex flex-col gap-4">
      {/* ── Top bar ── */}
      <div className={`${card} p-3 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
            {dark ? `SALA:` : 'Sala:'}{' '}
            <span className={`font-bold ${dark ? 'text-hacker-orange' : 'text-paper-ink'}`}>
              {roomState?.name || '...'}{' '}
            </span>
            <span className={`${dark ? 'text-hacker-orange/70' : 'text-paper-sepia'}`}>
              [{roomId}]
            </span>
          </span>
          <span className={`text-xs ${dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/60 font-sketch text-sm'}`}>
            |
          </span>
          <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
            {dark ? `DIFICULTAD: ${roomState?.difficulty || '...'}` : `Dificultad: ${roomState?.difficulty || '...'}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isRoundActive && (
            <div className="flex gap-1">
              {['Fácil', 'Medio', 'Difícil'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleChangeDifficulty(d)}
                  className={`px-2 py-0.5 rounded text-xs transition-all ${
                    dark ? 'font-mono' : 'font-sketch text-sm'
                  } ${
                    roomState?.difficulty === d
                      ? dark
                        ? 'bg-hacker-orange text-hacker-bg'
                        : 'bg-paper-ink text-paper-bg'
                      : dark
                        ? 'text-hacker-orange/40 hover:text-hacker-orange'
                        : 'text-paper-sepia/50 hover:text-paper-ink'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <button onClick={onLeave} className={`${btn} text-xs py-1 px-3`}>
            {dark ? '[ SALIR ]' : 'Salir'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {errorMsg && (
        <div className={`text-center text-sm py-2 rounded ${
          dark ? 'bg-red-900/30 text-red-400 font-mono border border-red-500/30' : 'bg-red-100 text-red-700 font-sketch border border-red-300'
        }`}>
          {errorMsg}
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left: Game area */}
        <div className="flex flex-col gap-4">
          {/* Timer + Round info */}
          {isRoundActive && (
            <div className={`${card} p-4 flex items-center justify-between`}>
              <div>
                <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
                  {dark ? `RONDA #${roundNum}` : `Ronda ${roundNum}`}
                </span>
                <p className={`text-sm mt-1 ${dark ? 'text-hacker-orange/70 font-mono' : 'text-paper-ink/70 font-sketch'}`}>
                  {isGiver
                    ? dark ? '> Tú das las pistas' : 'Tú das las pistas'
                    : dark ? `> ${giverName} da las pistas` : `${giverName} da las pistas`
                  }
                </p>
              </div>
              <Timer endsAt={roundEndTime} dark={dark} />
            </div>
          )}

          {/* Taboo card (for giver) */}
          {isRoundActive && isGiver && (
            <TabooCard
              word={secretWord}
              taboo={tabooWords}
              dark={dark}
              onSkip={handleSkip}
            />
          )}

          {/* Waiting for guesser */}
          {isRoundActive && !isGiver && (
            <div className={`${card} p-8 text-center`}>
              <p className={`text-xl font-bold mb-2 ${dark ? 'text-hacker-orange font-mono' : 'text-paper-ink font-sketch text-2xl'}`}>
                {dark ? '> ¡Adivina la palabra!' : '¡Adivina la palabra!'}
              </p>
              <p className={`text-sm ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch'}`}>
                {dark
                  ? `Escucha las pistas de ${giverName} y escribe tu respuesta en el chat`
                  : `Escucha las pistas de ${giverName} y escribe tu respuesta en el chat`
                }
              </p>
            </div>
          )}

          {/* Round result */}
          {roundResult && (
            <RoundResult result={roundResult} dark={dark} />
          )}

          {/* Waiting / Start */}
          {!isRoundActive && !roundResult && (
            <div className={`${card} p-8 text-center`}>
              <p className={`text-lg mb-4 ${dark ? 'text-hacker-orange/70 font-mono' : 'text-paper-sepia font-sketch text-xl'}`}>
                {roomState && roomState.players.length < 2
                  ? dark
                    ? '> Esperando más jugadores...'
                    : 'Esperando más jugadores...'
                  : dark
                    ? '> Listos para jugar'
                    : 'Listos para jugar'
                }
              </p>
              <button
                onClick={handleStartRound}
                disabled={loading || (roomState && roomState.players.length < 2)}
                className={`${btn} text-lg px-8 py-3 ${loading ? 'animate-pulse' : ''} ${
                  dark ? 'hover:shadow-neon hover:animate-pulse-neon' : ''
                }`}
              >
                {loading
                  ? dark ? '>> GENERANDO...' : 'Generando...'
                  : dark ? '>> INICIAR RONDA' : 'Iniciar Ronda'
                }
              </button>
            </div>
          )}

          {/* Start next after result */}
          {roundResult && !isRoundActive && (
            <div className="text-center">
              <button
                onClick={handleStartRound}
                disabled={loading}
                className={`${btn} px-6 py-2 ${loading ? 'animate-pulse' : ''}`}
              >
                {loading
                  ? dark ? '>> GENERANDO...' : 'Generando...'
                  : dark ? '>> SIGUIENTE RONDA' : 'Siguiente Ronda'
                }
              </button>
            </div>
          )}

          {/* Chat */}
          <Chat
            messages={messages}
            onSend={handleSend}
            dark={dark}
            disabled={isRoundActive && isGiver === false && false}
            playerName={playerName}
          />
        </div>

        {/* Right sidebar: Players */}
        <PlayerList
          players={roomState?.players || []}
          dark={dark}
          playerName={playerName}
          roomCode={roomId}
        />
      </div>
    </div>
  );
}

/* ═══════════ Round Result Panel ═══════════ */
function RoundResult({ result, dark }) {
  const { word, taboo, reason, winnerName, giverName } = result;

  const reasonText = {
    guessed: `¡${winnerName} adivinó la palabra!`,
    timeout: 'Se acabó el tiempo',
    'taboo-violation': `${giverName} dijo una palabra prohibida`,
    skipped: `${giverName} saltó la palabra`,
    'giver-left': 'El dador abandonó la sala',
  };

  const isWin = reason === 'guessed';

  return (
    <div
      className={`p-5 rounded-lg text-center animate-fade-in ${
        dark
          ? `border ${isWin ? 'border-green-500/50 bg-green-900/10' : 'border-red-500/50 bg-red-900/10'}`
          : `border-2 ${isWin ? 'border-green-600/30 bg-green-50' : 'border-red-600/30 bg-red-50'}`
      }`}
    >
      <p className={`text-sm mb-2 ${dark ? 'font-mono' : 'font-sketch text-base'} ${
        isWin
          ? dark ? 'text-green-400' : 'text-green-700'
          : dark ? 'text-red-400' : 'text-red-700'
      }`}>
        {reasonText[reason] || reason}
      </p>
      <p className={`text-2xl font-bold mb-2 ${dark ? 'text-hacker-orange font-mono' : 'text-paper-ink font-sketch text-3xl'}`}>
        {word}
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {taboo?.map((t, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded text-xs ${
              dark
                ? 'bg-red-900/30 text-red-400 border border-red-500/30 font-mono'
                : 'bg-red-100 text-red-700 border border-red-300 font-sketch text-sm'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
