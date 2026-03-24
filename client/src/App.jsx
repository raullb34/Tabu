import { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import GameMenu from './components/GameMenu';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import RummyRoom from './components/RummyRoom';
import socket from './socket';

export default function App() {
  const [screen, setScreen] = useState('menu'); // 'menu' | 'lobby' | 'game'
  const [gameType, setGameType] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');

  const handleSelectGame = (type) => {
    setGameType(type);
    setScreen('lobby');
  };

  const handleJoinedRoom = ({ roomId, playerId, playerName: name, gameType: gt }) => {
    setRoomId(roomId);
    setPlayerId(playerId);
    setPlayerName(name);
    if (gt) setGameType(gt);
    setScreen('game');
  };

  const handleLeave = () => {
    socket.disconnect();
    setScreen('menu');
    setRoomId(null);
    setPlayerId(null);
    setGameType(null);
  };

  const handleBackToMenu = () => {
    setScreen('menu');
    setGameType(null);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-hacker-orange/20 dark:border-hacker-orange/20 border-paper-ink/10">
          <h1
            className="text-2xl font-bold dark:text-hacker-orange text-paper-ink font-mono dark:font-mono font-sketch tracking-wider cursor-pointer"
            onClick={() => screen !== 'game' && handleBackToMenu()}
          >
            {'<'}JUEGOS{'>'}
          </h1>
          <ThemeToggle />
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          {screen === 'menu' && (
            <GameMenu onSelectGame={handleSelectGame} />
          )}
          {screen === 'lobby' && (
            <Lobby
              onJoined={handleJoinedRoom}
              gameType={gameType}
              onBack={handleBackToMenu}
            />
          )}
          {screen === 'game' && gameType === 'taboo' && (
            <GameRoom
              roomId={roomId}
              playerId={playerId}
              playerName={playerName}
              onLeave={handleLeave}
            />
          )}
          {screen === 'game' && gameType === 'rummy' && (
            <RummyRoom
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
