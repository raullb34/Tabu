import { v4 as uuidv4 } from 'uuid';
import { generateTabooSet } from './llm.js';
import { registerRummyHandlers, createRummyState, handleRummyDisconnect } from './rummy.js';

/* ═══════════════════════════════════ Estado Global ═══════════════════════════════════ */

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @type {Map<string, string>} socketId → roomId */
const playerRoomMap = new Map();

/* ═══════════════════════════ Exports para otros módulos ═══════════════════════════ */
export { rooms, playerRoomMap, getRoom, getRoomOfSocket, sanitize, broadcastRoomState };

/* ═══════════════════════════════════ Helpers ═══════════════════════════════════ */

function createRoom(name, difficulty, gameType = 'taboo') {
  const id = uuidv4().slice(0, 6).toUpperCase();
  const base = {
    id,
    name,
    gameType,
    difficulty,
    players: [],          // { id, socketId, name, score }
    messages: [],
  };

  if (gameType === 'taboo') {
    return {
      ...base,
      giverIndex: 0,
      currentWord: null,
      tabooWords: [],
      usedWords: new Set(),
      roundActive: false,
      roundTimer: null,
      roundEndTime: null,
      roundNumber: 0,
      maxRounds: 0,
    };
  }

  if (gameType === 'rummy') {
    return {
      ...base,
      ...createRummyState(),
    };
  }

  return base;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function getRoomOfSocket(socketId) {
  const roomId = playerRoomMap.get(socketId);
  return roomId ? rooms.get(roomId) : null;
}

function sanitize(str) {
  return str.replace(/[<>&"']/g, '').trim().slice(0, 30);
}

/* ═══════════════════════════ Lógica de Ronda ═══════════════════════════ */

async function startRound(io, room) {
  if (room.players.length < 2) return;

  room.roundActive = true;
  room.roundNumber += 1;

  const giver = room.players[room.giverIndex % room.players.length];

  // Generar palabras con el LLM (excluyendo las ya usadas)
  const tabooSet = await generateTabooSet(room.difficulty, room.usedWords);
  room.currentWord = tabooSet.word;
  room.tabooWords = tabooSet.taboo;
  room.usedWords.add(tabooSet.word.toUpperCase());

  // Al dador: palabra + prohibidas
  io.to(giver.socketId).emit('round:start-giver', {
    word: room.currentWord,
    taboo: room.tabooWords,
    round: room.roundNumber,
  });

  // A los adivinadores: solo info de la ronda
  room.players.forEach((p) => {
    if (p.socketId !== giver.socketId) {
      io.to(p.socketId).emit('round:start-guesser', {
        giverName: giver.name,
        round: room.roundNumber,
      });
    }
  });

  // Notificar estado de sala actualizado
  broadcastRoomState(io, room);

  // Timer de 90 segundos
  room.roundEndTime = Date.now() + 90_000;
  io.to(room.id).emit('round:timer', { endsAt: room.roundEndTime });

  room.roundTimer = setTimeout(() => {
    endRound(io, room, null, 'timeout');
  }, 90_000);
}

function endRound(io, room, winnerId, reason) {
  if (!room.roundActive) return;
  room.roundActive = false;

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  const giver = room.players[room.giverIndex % room.players.length];

  io.to(room.id).emit('round:end', {
    word: room.currentWord,
    taboo: room.tabooWords,
    reason,
    winnerName: winnerId
      ? room.players.find((p) => p.socketId === winnerId)?.name
      : null,
    giverName: giver?.name,
  });

  // Avanzar al siguiente dador
  room.giverIndex = (room.giverIndex + 1) % room.players.length;
  room.currentWord = null;
  room.tabooWords = [];

  broadcastRoomState(io, room);
}

function containsTabooWord(message, tabooWords, secretWord) {
  const normalized = message
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const allForbidden = [secretWord, ...tabooWords];

  for (const word of allForbidden) {
    const normWord = word
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(normWord)) {
      return word;
    }
  }
  return null;
}

function broadcastRoomState(io, room) {
  const base = {
    id: room.id,
    name: room.name,
    gameType: room.gameType,
    difficulty: room.difficulty,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
    })),
  };

  if (room.gameType === 'taboo') {
    const giver = room.players[room.giverIndex % room.players.length];
    io.to(room.id).emit('room:state', {
      ...base,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isGiver: p.socketId === giver?.socketId,
      })),
      roundActive: room.roundActive,
      roundNumber: room.roundNumber,
      giverName: giver?.name,
    });
  } else {
    io.to(room.id).emit('room:state', base);
  }
}

/* ═══════════════════════════ Handlers de Socket ═══════════════════════════ */

export function registerGameHandlers(io, socket) {
  // ─── Crear sala ───
  socket.on('room:create', ({ playerName, roomName, difficulty, gameType }, cb) => {
    const safeName = sanitize(playerName || 'Jugador');
    const safeRoom = sanitize(roomName || 'Sala');
    const validGameType = ['taboo', 'rummy'].includes(gameType) ? gameType : 'taboo';
    const room = createRoom(safeRoom, difficulty || 'Medio', validGameType);

    const player = {
      id: uuidv4(),
      socketId: socket.id,
      name: safeName,
      score: 0,
    };
    room.players.push(player);
    rooms.set(room.id, room);
    playerRoomMap.set(socket.id, room.id);

    socket.join(room.id);
    broadcastRoomState(io, room);

    if (typeof cb === 'function') {
      cb({ ok: true, roomId: room.id, playerId: player.id, gameType: validGameType });
    }
  });

  // ─── Unirse a sala ───
  socket.on('room:join', ({ playerName, roomId }, cb) => {
    const room = getRoom(roomId?.toUpperCase());
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, error: 'Sala no encontrada' });
      return;
    }
    if (room.players.length >= 10) {
      if (typeof cb === 'function') cb({ ok: false, error: 'Sala llena (máx. 10)' });
      return;
    }

    const safeName = sanitize(playerName || 'Jugador');
    const player = {
      id: uuidv4(),
      socketId: socket.id,
      name: safeName,
      score: 0,
    };
    room.players.push(player);
    playerRoomMap.set(socket.id, room.id);
    socket.join(room.id);

    broadcastRoomState(io, room);
    io.to(room.id).emit('chat:message', {
      system: true,
      text: `${safeName} se ha unido a la sala.`,
    });

    if (typeof cb === 'function') {
      cb({ ok: true, roomId: room.id, playerId: player.id, gameType: room.gameType });
    }
  });

  // ─── Iniciar ronda (Tabú) ───
  socket.on('round:start', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'taboo' || room.roundActive) return;
    if (room.players.length < 2) {
      socket.emit('error:message', 'Se necesitan al menos 2 jugadores.');
      return;
    }
    startRound(io, room);
  });

  // ─── Chat / Adivinanza (solo Tabú) ───
  socket.on('chat:send', ({ text }) => {
    const room = getRoomOfSocket(socket.id);
    if (!room) return;
    if (room.gameType !== 'taboo') return; // Rummy tiene su propio chat

    const safeText = (text || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!safeText) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    const giver = room.players[room.giverIndex % room.players.length];
    const isGiver = player.socketId === giver.socketId;

    if (room.roundActive && isGiver) {
      // Validar que el dador no diga palabras prohibidas
      const forbidden = containsTabooWord(safeText, room.tabooWords, room.currentWord);
      if (forbidden) {
        io.to(room.id).emit('chat:message', {
          system: true,
          text: `¡FALTA! ${player.name} dijo una palabra prohibida: "${forbidden}". Ronda terminada.`,
        });
        player.score = Math.max(0, player.score - 1);
        endRound(io, room, null, 'taboo-violation');
        return;
      }

      // Mensaje válido del dador (pista)
      io.to(room.id).emit('chat:message', {
        sender: player.name,
        text: safeText,
        isClue: true,
      });
      return;
    }

    if (room.roundActive && !isGiver) {
      // Intento de adivinanza
      const guess = safeText
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const word = room.currentWord
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      io.to(room.id).emit('chat:message', {
        sender: player.name,
        text: safeText,
        isGuess: true,
      });

      if (guess.includes(word) || word.includes(guess)) {
        // ¡Correcto!
        player.score += 2;
        giver.score += 1;
        io.to(room.id).emit('chat:message', {
          system: true,
          text: `🎉 ¡${player.name} adivinó la palabra! (+2 pts adivinador, +1 pt dador)`,
        });
        endRound(io, room, player.socketId, 'guessed');
      }
      return;
    }

    // Chat libre fuera de ronda
    io.to(room.id).emit('chat:message', {
      sender: player.name,
      text: safeText,
    });
  });

  // ─── Saltar ronda (Tabú) ───
  socket.on('round:skip', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'taboo' || !room.roundActive) return;
    const giver = room.players[room.giverIndex % room.players.length];
    if (socket.id !== giver.socketId) return;

    giver.score = Math.max(0, giver.score - 1);
    io.to(room.id).emit('chat:message', {
      system: true,
      text: `${giver.name} ha saltado la palabra. (-1 pt)`,
    });
    endRound(io, room, null, 'skipped');
  });

  // ─── Cambiar dificultad (Tabú) ───
  socket.on('room:difficulty', ({ difficulty }) => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'taboo' || room.roundActive) return;
    if (['Fácil', 'Medio', 'Difícil'].includes(difficulty)) {
      room.difficulty = difficulty;
      broadcastRoomState(io, room);
    }
  });

  // ─── Listar salas ───
  socket.on('rooms:list', ({ gameType } = {}, cb) => {
    // Support old format: rooms:list(_, cb)
    const callback = typeof gameType === 'function' ? gameType : cb;
    const filter = typeof gameType === 'string' ? gameType : null;

    const list = [];
    rooms.forEach((room) => {
      if (filter && room.gameType !== filter) return;
      list.push({
        id: room.id,
        name: room.name,
        gameType: room.gameType,
        players: room.players.length,
        difficulty: room.difficulty,
        roundActive: room.roundActive,
      });
    });
    if (typeof callback === 'function') callback(list);
  });

  // ─── Registrar handlers de Rummy ───
  registerRummyHandlers(io, socket);

  // ─── Desconexión ───
  socket.on('disconnect', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room) return;

    const idx = room.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) return;

    const player = room.players[idx];
    room.players.splice(idx, 1);
    playerRoomMap.delete(socket.id);

    if (room.gameType === 'taboo') {
      // Si era el dador activo, terminar ronda
      if (room.roundActive) {
        const giverIdx = room.giverIndex % (room.players.length + 1);
        if (idx === giverIdx) {
          endRound(io, room, null, 'giver-left');
        }
        if (room.giverIndex > 0 && idx < room.giverIndex) {
          room.giverIndex -= 1;
        }
      }
    } else if (room.gameType === 'rummy') {
      handleRummyDisconnect(io, room, socket.id);
    }

    if (room.players.length === 0) {
      if (room.roundTimer) clearTimeout(room.roundTimer);
      rooms.delete(room.id);
    } else {
      io.to(room.id).emit('chat:message', {
        system: true,
        text: `${player.name} abandonó la sala.`,
      });
      broadcastRoomState(io, room);
    }
  });
}
