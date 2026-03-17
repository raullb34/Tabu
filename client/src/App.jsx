import { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import socket from './socket';

export default function App() {
  const [screen, setScreen] = useState('lobby'); // 'lobby' | 'game'
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');

  const handleJoinedRoom = ({ roomId, playerId, playerName: name }) => {
    setRoomId(roomId);
    setPlayerId(playerId);
    setPlayerName(name);
    setScreen('game');
  };

  const handleLeave = () => {
    socket.disconnect();
    setScreen('lobby');
    setRoomId(null);
    setPlayerId(null);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-hacker-orange/20 dark:border-hacker-orange/20 border-paper-ink/10">
          <h1 className="text-2xl font-bold dark:text-hacker-orange text-paper-ink font-mono dark:font-mono font-sketch tracking-wider">
            {'<'}TABÚ{'>'}
          </h1>
          <ThemeToggle />
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          {screen === 'lobby' && (
            <Lobby onJoined={handleJoinedRoom} />
          )}
          {screen === 'game' && (
            <GameRoom
              roomId={roomId}
              playerId={playerId}
              playerName={playerName}
              onLeave={handleLeave}
            />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}
