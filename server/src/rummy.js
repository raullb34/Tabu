import { getRoomOfSocket, broadcastRoomState } from './game.js';

/* ═══════════════════════════════════ Constantes ═══════════════════════════════════ */

const COLORS = ['red', 'blue', 'yellow', 'black'];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const TILES_PER_PLAYER = 14;
const INITIAL_MELD_MIN = 30;
const TURN_TIME_MS = 120_000;

/* ═══════════════════════════════════ Helpers ═══════════════════════════════════ */

function createPool() {
  const pool = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const color of COLORS) {
      for (const num of NUMBERS) {
        pool.push({ id: `${color}-${num}-${copy}`, color, number: num, isJoker: false });
      }
    }
  }
  pool.push({ id: 'joker-0', color: 'joker', number: 0, isJoker: true });
  pool.push({ id: 'joker-1', color: 'joker', number: 0, isJoker: true });
  return pool;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calculates the value of a group, assigning jokers the value of the
 * position they fill (in a run) or the same number as the set.
 */
function groupValue(tiles) {
  const arranged = arrangeGroupTiles(tiles);
  return arranged.reduce((sum, t) => sum + (t._resolvedNumber || t.number || 0), 0);
}

/**
 * Arranges tiles in a group so jokers fill the correct positions.
 * Returns a new array (shallow copies with _resolvedNumber on jokers).
 * - For a SET: jokers get the same number as the non-jokers.
 * - For a RUN: jokers fill the gaps in the consecutive sequence.
 * If the group is not valid, returns tiles sorted naively.
 */
function arrangeGroupTiles(tiles) {
  if (!tiles || tiles.length === 0) return [];
  const nonJokers = tiles.filter((t) => !t.isJoker);
  const jokers = tiles.filter((t) => t.isJoker);
  if (nonJokers.length === 0) return tiles.map((t) => ({ ...t, _resolvedNumber: 0 }));

  // Try SET: same number, different colors
  const num = nonJokers[0].number;
  if (nonJokers.every((t) => t.number === num) && tiles.length <= 4) {
    const colors = new Set(nonJokers.map((t) => t.color));
    if (colors.size === nonJokers.length) {
      // Valid set — jokers take the same number
      return [
        ...nonJokers,
        ...jokers.map((j) => ({ ...j, _resolvedNumber: num })),
      ];
    }
  }

  // Try RUN: consecutive, same color
  const color = nonJokers[0].color;
  if (nonJokers.every((t) => t.color === color)) {
    const sorted = [...nonJokers].sort((a, b) => a.number - b.number);
    const min = sorted[0].number;
    const max = sorted[sorted.length - 1].number;
    const totalLen = max - min + 1;

    if (totalLen === tiles.length) {
      // Build the full sequence, placing jokers in gaps
      const result = [];
      const numSet = new Set(sorted.map((t) => t.number));
      let jokerIdx = 0;
      for (let n = min; n <= max; n++) {
        const real = sorted.find((t) => t.number === n);
        if (real) {
          result.push(real);
        } else if (jokerIdx < jokers.length) {
          result.push({ ...jokers[jokerIdx], _resolvedNumber: n });
          jokerIdx++;
        }
      }
      // Any remaining jokers (shouldn't happen in valid group)
      while (jokerIdx < jokers.length) {
        result.push({ ...jokers[jokerIdx], _resolvedNumber: 0 });
        jokerIdx++;
      }
      return result;
    }

    // Run might extend beyond min..max with jokers at edges
    // Try placing jokers at the start or end
    const sortedNums = sorted.map((t) => t.number);
    const gaps = max - min + 1 - sorted.length;
    const jokersLeft = jokers.length;
    const edgeJokers = jokersLeft - gaps;

    if (edgeJokers >= 0 && tiles.length >= 3) {
      // Figure out best start: try to place edge jokers before or after
      let bestStart = min;
      // Try extending downward first
      const extendDown = Math.min(edgeJokers, min - 1);
      bestStart = min - extendDown;
      const bestEnd = bestStart + tiles.length - 1;

      if (bestEnd <= 13) {
        const result = [];
        let ji = 0;
        for (let n = bestStart; n <= bestEnd; n++) {
          const real = sorted.find((t) => t.number === n);
          if (real) {
            result.push(real);
          } else if (ji < jokers.length) {
            result.push({ ...jokers[ji], _resolvedNumber: n });
            ji++;
          }
        }
        return result;
      }
    }
  }

  // Fallback: not a clearly valid group, just put jokers at end
  return [
    ...nonJokers.sort((a, b) => a.number - b.number),
    ...jokers.map((j) => ({ ...j, _resolvedNumber: 0 })),
  ];
}

function isValidSet(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const nonJokers = tiles.filter((t) => !t.isJoker);
  if (nonJokers.length === 0) return false;
  const num = nonJokers[0].number;
  if (!nonJokers.every((t) => t.number === num)) return false;
  const colors = new Set(nonJokers.map((t) => t.color));
  if (colors.size !== nonJokers.length) return false;
  return true;
}

/**
 * Validates a RUN: 3+ consecutive numbers, ALL SAME COLOR.
 * Jokers can fill internal gaps AND extend at the edges.
 */
function isValidRun(tiles) {
  if (tiles.length < 3) return false;
  const nonJokers = tiles.filter((t) => !t.isJoker);
  const jokerCount = tiles.length - nonJokers.length;
  if (nonJokers.length === 0) return false;

  // ALL non-joker tiles must be the SAME COLOR
  const color = nonJokers[0].color;
  if (!nonJokers.every((t) => t.color === color)) return false;

  const sorted = nonJokers.map((t) => t.number).sort((a, b) => a - b);

  // No duplicate numbers
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) return false;
  }

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const span = max - min + 1;

  // Span of non-jokers can't exceed total length
  if (span > tiles.length) return false;

  // Internal gaps need jokers
  const internalGaps = span - sorted.length;
  if (internalGaps > jokerCount) return false;

  // Remaining jokers extend at edges — verify the run fits within 1-13
  const edgeJokers = jokerCount - internalGaps;
  const maxExtendLeft = min - 1;
  const maxExtendRight = 13 - max;
  if (maxExtendLeft + maxExtendRight < edgeJokers) return false;

  return true;
}

function isValidGroup(tiles) {
  return isValidSet(tiles) || isValidRun(tiles);
}

function sortHand(hand) {
  hand.sort((a, b) => {
    if (a.isJoker && !b.isJoker) return 1;
    if (!a.isJoker && b.isJoker) return -1;
    if (a.isJoker && b.isJoker) return 0;
    const colorDiff = COLORS.indexOf(a.color) - COLORS.indexOf(b.color);
    if (colorDiff !== 0) return colorDiff;
    return a.number - b.number;
  });
}

/* ═══════════════════════════════════ Estado ═══════════════════════════════════ */

export function createRummyState() {
  return {
    pool: [],
    hands: {},           // socketId -> tile[]
    tableGroups: [],     // { id, tiles[] }  — committed groups on the table
    tableGroupIdCounter: 0,
    currentTurn: null,
    turnOrder: [],
    turnIndex: 0,
    turnTimer: null,
    turnEndTime: null,
    turnSnapshot: null,  // snapshot of hand + tableGroups at turn start
    hasOpened: {},        // socketId -> bool
    gameStarted: false,
    gameOver: false,
    winner: null,
  };
}

/* ═══════════════════════════════════ Game logic ═══════════════════════════════════ */

function dealTiles(room) {
  const pool = shuffle(createPool());
  room.pool = pool;
  room.hands = {};
  room.tableGroups = [];
  room.tableGroupIdCounter = 0;
  room.gameOver = false;
  room.winner = null;
  room.hasOpened = {};
  room.turnSnapshot = null;

  room.turnOrder = room.players.map((p) => p.socketId);
  room.turnIndex = 0;
  room.currentTurn = room.turnOrder[0];

  for (const p of room.players) {
    room.hands[p.socketId] = [];
    room.hasOpened[p.socketId] = false;
    for (let i = 0; i < TILES_PER_PLAYER; i++) {
      room.hands[p.socketId].push(room.pool.pop());
    }
    sortHand(room.hands[p.socketId]);
  }
  room.gameStarted = true;
}

function saveTurnSnapshot(room) {
  const sid = room.currentTurn;
  room.turnSnapshot = {
    hand: room.hands[sid].map((t) => ({ ...t })),
    tableGroups: room.tableGroups.map((g) => ({
      id: g.id,
      tiles: g.tiles.map((t) => ({ ...t })),
    })),
  };
}

function revertTurn(room) {
  if (!room.turnSnapshot) return;
  const sid = room.currentTurn;
  room.hands[sid] = room.turnSnapshot.hand;
  room.tableGroups = room.turnSnapshot.tableGroups;
  room.turnSnapshot = null;
}

function startTurnTimer(io, room) {
  clearTurnTimer(room);
  room.turnEndTime = Date.now() + TURN_TIME_MS;
  io.to(room.id).emit('rummy:timer', { endsAt: room.turnEndTime });
  room.turnTimer = setTimeout(() => {
    handleTurnTimeout(io, room);
  }, TURN_TIME_MS);
}

function clearTurnTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndTime = null;
  }
}

function handleTurnTimeout(io, room) {
  if (!room.gameStarted || room.gameOver) return;
  revertTurn(room);
  const player = room.players.find((p) => p.socketId === room.currentTurn);
  if (room.pool.length > 0) {
    room.hands[room.currentTurn].push(room.pool.pop());
    sortHand(room.hands[room.currentTurn]);
  }
  io.to(room.id).emit('chat:message', {
    system: true,
    text: `⏱️ Se acabó el tiempo de ${player?.name}. Roba 1 ficha.`,
  });
  advanceTurn(io, room);
}

function advanceTurn(io, room) {
  room.turnOrder = room.turnOrder.filter((sid) =>
    room.players.some((p) => p.socketId === sid)
  );
  if (room.turnOrder.length === 0) return;
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
  room.currentTurn = room.turnOrder[room.turnIndex];

  saveTurnSnapshot(room);
  startTurnTimer(io, room);
  emitRummyState(io, room);
  broadcastRoomState(io, room);
}

function checkWin(io, room, socketId) {
  if (room.hands[socketId].length === 0) {
    finishGame(io, room, socketId);
    return true;
  }
  return false;
}

function emitRummyState(io, room) {
  // Arrange table group tiles so jokers are in correct positions
  for (const g of room.tableGroups) {
    g.tiles = arrangeGroupTiles(g.tiles).map((t) => {
      if (t._resolvedNumber !== undefined) {
        return { ...t, resolvedNumber: t._resolvedNumber };
      }
      return t;
    });
  }

  for (const p of room.players) {
    io.to(p.socketId).emit('rummy:state', {
      hand: room.hands[p.socketId] || [],
      handCounts: Object.fromEntries(
        room.players.map((pl) => [pl.name, (room.hands[pl.socketId] || []).length])
      ),
      tableGroups: room.tableGroups.map((g) => ({
        id: g.id,
        tiles: g.tiles,
      })),
      poolCount: room.pool.length,
      currentTurn: room.currentTurn,
      currentTurnName: room.players.find((pl) => pl.socketId === room.currentTurn)?.name || '?',
      isMyTurn: room.currentTurn === p.socketId,
      hasOpened: room.hasOpened[p.socketId] || false,
      gameStarted: room.gameStarted,
      gameOver: room.gameOver,
      winner: room.winner,
    });
  }
}

/**
 * Validates the complete board state submitted by a player at end of turn.
 * 
 * The client sends:
 *   - tableGroups: the new layout of groups on the table
 *   - hand: the player's remaining hand
 * 
 * The server checks:
 *   1. No tiles were created or duplicated (tile conservation)
 *   2. All groups on the table are valid (sets or runs)
 *   3. If player hasn't opened yet: new tiles from hand placed on table must sum ≥ 30
 *      (the player may only use their own tiles, NOT rearrange existing table tiles)
 *   4. If player HAS opened: they can freely rearrange everything
 *   5. The player actually played at least one tile from hand (or it's a "draw" turn)
 */
function validateEndTurn(room, socketId, submittedGroups, submittedHand) {
  const snapshot = room.turnSnapshot;
  if (!snapshot) return { valid: false, error: 'No hay snapshot del turno.' };

  // Build tile sets for conservation check
  const snapshotTileIds = new Set();
  for (const t of snapshot.hand) snapshotTileIds.add(t.id);
  for (const g of snapshot.tableGroups) {
    for (const t of g.tiles) snapshotTileIds.add(t.id);
  }

  const submittedTileIds = new Set();
  for (const t of submittedHand) {
    if (submittedTileIds.has(t.id)) return { valid: false, error: 'Ficha duplicada detectada.' };
    submittedTileIds.add(t.id);
  }
  for (const g of submittedGroups) {
    for (const t of g.tiles) {
      if (submittedTileIds.has(t.id)) return { valid: false, error: 'Ficha duplicada detectada.' };
      submittedTileIds.add(t.id);
    }
  }

  // Conservation: same tiles in, same tiles out
  if (snapshotTileIds.size !== submittedTileIds.size) {
    return { valid: false, error: 'La cantidad de fichas no coincide.' };
  }
  for (const id of snapshotTileIds) {
    if (!submittedTileIds.has(id)) {
      return { valid: false, error: `Ficha ${id} desaparecida.` };
    }
  }

  // All submitted groups must be valid
  for (const g of submittedGroups) {
    if (!g.tiles || g.tiles.length === 0) continue; // skip empties (shouldn't happen)
    if (!isValidGroup(g.tiles)) {
      return { valid: false, error: 'Hay grupos inválidos en la mesa. Todos deben ser sets o escaleras válidas.' };
    }
  }

  // No loose tiles on table (all must be in groups of 3+)
  for (const g of submittedGroups) {
    if (g.tiles.length > 0 && g.tiles.length < 3) {
      return { valid: false, error: 'Todos los grupos en la mesa deben tener al menos 3 fichas.' };
    }
  }

  // Determine which tiles moved from hand to table
  const snapshotHandIds = new Set(snapshot.hand.map((t) => t.id));
  const snapshotTableIds = new Set();
  for (const g of snapshot.tableGroups) {
    for (const t of g.tiles) snapshotTableIds.add(t.id);
  }

  const submittedHandIds = new Set(submittedHand.map((t) => t.id));

  // Tiles that were in hand and are now on table
  const newlyPlacedIds = new Set();
  for (const id of snapshotHandIds) {
    if (!submittedHandIds.has(id)) newlyPlacedIds.add(id);
  }

  // Tiles taken from table back to hand (not allowed for non-opened players)
  const takenFromTable = new Set();
  for (const id of snapshotTableIds) {
    if (submittedHandIds.has(id)) takenFromTable.add(id);
  }

  const hasOpened = room.hasOpened[socketId];
  const placedCount = newlyPlacedIds.size;

  if (!hasOpened) {
    // Player hasn't opened yet
    if (takenFromTable.size > 0) {
      return { valid: false, error: 'No puedes tomar fichas de la mesa hasta que hayas abierto (≥ 30 pts).' };
    }

    // Table groups from snapshot must remain unchanged
    const snapshotGroupMap = new Map();
    for (const g of snapshot.tableGroups) {
      snapshotGroupMap.set(g.id, new Set(g.tiles.map((t) => t.id)));
    }

    // Check that no existing table groups were rearranged
    for (const g of submittedGroups) {
      const onlyTableTiles = g.tiles.filter((t) => snapshotTableIds.has(t.id));
      const onlyNewTiles = g.tiles.filter((t) => newlyPlacedIds.has(t.id));
      
      // If a group has only table tiles, it must match an original group exactly
      if (onlyNewTiles.length === 0 && onlyTableTiles.length > 0) {
        const matchedOriginal = snapshot.tableGroups.find((og) => {
          if (og.tiles.length !== g.tiles.length) return false;
          const ogIds = new Set(og.tiles.map((t) => t.id));
          return g.tiles.every((t) => ogIds.has(t.id));
        });
        if (!matchedOriginal) {
          return { valid: false, error: 'No puedes reorganizar fichas de la mesa hasta que hayas abierto.' };
        }
      }
      
      // If a group mixes table and new tiles, can't do that before opening
      if (onlyTableTiles.length > 0 && onlyNewTiles.length > 0) {
        return { valid: false, error: 'No puedes mezclar fichas de la mesa con las tuyas antes de abrir.' };
      }
    }

    if (placedCount > 0) {
      // Calculate total value of new groups formed only from hand tiles
      let totalNewValue = 0;
      for (const g of submittedGroups) {
        const allNew = g.tiles.every((t) => newlyPlacedIds.has(t.id));
        if (allNew) {
          totalNewValue += groupValue(g.tiles);
        }
      }
      if (totalNewValue < INITIAL_MELD_MIN) {
        return {
          valid: false,
          error: `Tu primera jugada debe sumar al menos ${INITIAL_MELD_MIN} puntos (tienes ${totalNewValue}). Puedes usar varios grupos.`,
        };
      }
    }
  }

  return { valid: true, placedCount, newlyPlacedIds };
}

/* ═══════════════════════════════════ Tile registry ═══════════════════════════════════ */

// Build a map id -> tile from the authoritative server state, so the client can't
// forge tile data (color, number, etc). We only trust tile IDs from the client.
function buildTileRegistry(room, socketId) {
  const registry = new Map();
  for (const t of room.hands[socketId] || []) registry.set(t.id, t);
  for (const g of room.tableGroups) {
    for (const t of g.tiles) registry.set(t.id, t);
  }
  return registry;
}

function resolveClientTiles(clientTiles, registry) {
  const resolved = [];
  for (const ct of clientTiles) {
    const real = registry.get(ct.id);
    if (!real) return null; // unknown tile
    resolved.push({ ...real });
  }
  return resolved;
}

/* ═══════════════════════════════════ Socket Handlers ═══════════════════════════════════ */

export function registerRummyHandlers(io, socket) {

  // ─── Iniciar partida ───
  socket.on('rummy:start', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'rummy') return;
    if (room.gameStarted && !room.gameOver) return;
    if (room.players.length < 2) {
      socket.emit('error:message', 'Se necesitan al menos 2 jugadores.');
      return;
    }
    if (room.players.length > 4) {
      socket.emit('error:message', 'Máximo 4 jugadores para Rummikub.');
      return;
    }

    if (room.gameOver) {
      room.players.forEach((p) => { p.score = 0; });
    }

    dealTiles(room);
    saveTurnSnapshot(room);
    startTurnTimer(io, room);

    io.to(room.id).emit('chat:message', {
      system: true,
      text: '🎲 ¡Comienza la partida de Rummikub!',
    });

    emitRummyState(io, room);
    broadcastRoomState(io, room);
  });

  // ─── Terminar turno: enviar todo el estado de la mesa ───
  // El cliente envía tableGroups + hand — el servidor valida la integridad.
  socket.on('rummy:end-turn', ({ tableGroups: clientGroups, hand: clientHand }) => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'rummy' || !room.gameStarted || room.gameOver) return;
    if (room.currentTurn !== socket.id) return;

    // Resolve tile data from server registry (don't trust client tile data)
    const registry = buildTileRegistry(room, socket.id);

    const resolvedGroups = [];
    if (Array.isArray(clientGroups)) {
      for (const cg of clientGroups) {
        if (!Array.isArray(cg.tiles) || cg.tiles.length === 0) continue;
        const tiles = resolveClientTiles(cg.tiles, registry);
        if (!tiles) {
          socket.emit('error:message', 'Ficha desconocida en la mesa.');
          return;
        }
        resolvedGroups.push({ id: cg.id, tiles });
      }
    }

    const resolvedHand = resolveClientTiles(
      Array.isArray(clientHand) ? clientHand : [],
      registry
    );
    if (!resolvedHand) {
      socket.emit('error:message', 'Ficha desconocida en la mano.');
      return;
    }

    const result = validateEndTurn(room, socket.id, resolvedGroups, resolvedHand);
    if (!result.valid) {
      socket.emit('error:message', result.error);
      return;
    }

    const placedCount = result.placedCount;

    // Apply the validated state
    room.hands[socket.id] = resolvedHand;
    
    // Reassign group IDs
    room.tableGroups = resolvedGroups.map((g) => {
      room.tableGroupIdCounter++;
      return { id: room.tableGroupIdCounter, tiles: g.tiles };
    });

    // Mark as opened if they placed tiles for the first time
    if (!room.hasOpened[socket.id] && placedCount > 0) {
      room.hasOpened[socket.id] = true;
      const player = room.players.find((p) => p.socketId === socket.id);
      io.to(room.id).emit('chat:message', {
        system: true,
        text: `🎉 ¡${player?.name} abre con su primera jugada!`,
      });
    }

    // If nothing was placed, draw from pool
    if (placedCount === 0) {
      if (room.pool.length > 0) {
        room.hands[socket.id].push(room.pool.pop());
        sortHand(room.hands[socket.id]);
        const player = room.players.find((p) => p.socketId === socket.id);
        io.to(room.id).emit('chat:message', {
          system: true,
          text: `${player?.name} no jugó fichas y roba del pozo.`,
        });
      }
    } else {
      sortHand(room.hands[socket.id]);
    }

    if (checkWin(io, room, socket.id)) return;

    room.turnSnapshot = null;
    clearTurnTimer(room);
    advanceTurn(io, room);
  });

  // ─── Robar ficha (pasar turno sin jugar) ───
  socket.on('rummy:draw', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'rummy' || !room.gameStarted || room.gameOver) return;
    if (room.currentTurn !== socket.id) return;

    revertTurn(room);

    if (room.pool.length > 0) {
      room.hands[socket.id].push(room.pool.pop());
      sortHand(room.hands[socket.id]);
    } else {
      socket.emit('error:message', 'No quedan fichas en el pozo.');
    }

    const player = room.players.find((p) => p.socketId === socket.id);
    io.to(room.id).emit('chat:message', {
      system: true,
      text: `${player?.name} roba una ficha del pozo.`,
    });

    clearTurnTimer(room);
    advanceTurn(io, room);
  });

  // ─── Revertir turno (server-side revert, resets to snapshot) ───
  socket.on('rummy:revert', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'rummy' || !room.gameStarted || room.gameOver) return;
    if (room.currentTurn !== socket.id) return;

    revertTurn(room);
    saveTurnSnapshot(room);
    emitRummyState(io, room);
  });

  // ─── Ordenar mano ───
  socket.on('rummy:sort-hand', () => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'rummy') return;
    if (room.hands[socket.id]) {
      sortHand(room.hands[socket.id]);
      emitRummyState(io, room);
    }
  });

  // ─── Chat ───
  socket.on('rummy:chat', ({ text }) => {
    const room = getRoomOfSocket(socket.id);
    if (!room || room.gameType !== 'rummy') return;
    const safeText = (text || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!safeText) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    io.to(room.id).emit('chat:message', {
      sender: player.name,
      text: safeText,
    });
  });
}

function finishGame(io, room, winnerSocketId) {
  room.gameOver = true;
  clearTurnTimer(room);
  const winner = room.players.find((p) => p.socketId === winnerSocketId);
  room.winner = winner?.name || '?';

  const scores = [];
  for (const p of room.players) {
    const hand = room.hands[p.socketId] || [];
    const penalty = hand.reduce((sum, t) => sum + (t.isJoker ? 30 : t.number), 0);
    if (p.socketId === winnerSocketId) {
      p.score = 0;
    } else {
      p.score += penalty;
    }
    scores.push({
      name: p.name,
      score: p.score,
      tilesLeft: hand.length,
      penalty: p.socketId === winnerSocketId ? 0 : penalty,
    });
  }

  io.to(room.id).emit('chat:message', {
    system: true,
    text: `🏆 ¡${winner?.name} ganó la partida de Rummikub!`,
  });

  io.to(room.id).emit('rummy:gameover', { winner: winner?.name, scores });
  emitRummyState(io, room);
  broadcastRoomState(io, room);
}

export function handleRummyDisconnect(io, room, socketId) {
  if (!room.gameStarted || room.gameOver) return;
  clearTurnTimer(room);

  if (room.currentTurn === socketId) {
    revertTurn(room);
  }

  const hand = room.hands[socketId];
  if (hand) {
    room.pool.push(...hand);
    shuffle(room.pool);
    delete room.hands[socketId];
  }
  delete room.hasOpened[socketId];

  const remaining = room.players.filter((p) => p.socketId !== socketId);
  if (remaining.length === 1 && room.gameStarted) {
    finishGame(io, room, remaining[0].socketId);
  } else if (remaining.length > 1) {
    if (room.currentTurn === socketId) {
      advanceTurn(io, room);
    } else {
      emitRummyState(io, room);
    }
  }
}
