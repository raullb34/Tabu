import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import socket from '../socket';
import Chat from './Chat';
import PlayerList from './PlayerList';
import RummyTile from './RummyTile';
import Timer from './Timer';

/* ────────────────────────── helpers ────────────────────────── */

let nextLocalGroupId = 9000;
function localGroupId() { return nextLocalGroupId++; }

function deepCloneGroups(groups) {
  return groups.map((g) => ({ id: g.id, tiles: g.tiles.map((t) => ({ ...t })) }));
}

/**
 * Arrange tiles in a group so jokers fill correct positions.
 * Mirrors server-side arrangeGroupTiles logic.
 * Returns a new array with jokers having a `resolvedNumber` field.
 */
function arrangeGroupTiles(tiles) {
  if (!tiles || tiles.length === 0) return [];
  const nonJokers = tiles.filter((t) => !t.isJoker);
  const jokers = tiles.filter((t) => t.isJoker);
  if (nonJokers.length === 0) return tiles.map((t) => ({ ...t, resolvedNumber: 0 }));

  // SET: same number, different colors
  const num = nonJokers[0].number;
  if (nonJokers.every((t) => t.number === num) && tiles.length <= 4) {
    const colors = new Set(nonJokers.map((t) => t.color));
    if (colors.size === nonJokers.length) {
      return [
        ...nonJokers,
        ...jokers.map((j) => ({ ...j, resolvedNumber: num })),
      ];
    }
  }

  // RUN: consecutive, same color
  const color = nonJokers[0].color;
  if (nonJokers.every((t) => t.color === color)) {
    const sorted = [...nonJokers].sort((a, b) => a.number - b.number);
    const min = sorted[0].number;
    const max = sorted[sorted.length - 1].number;
    const totalLen = max - min + 1;

    if (totalLen === tiles.length) {
      const result = [];
      let ji = 0;
      for (let n = min; n <= max; n++) {
        const real = sorted.find((t) => t.number === n);
        if (real) {
          result.push(real);
        } else if (ji < jokers.length) {
          result.push({ ...jokers[ji], resolvedNumber: n });
          ji++;
        }
      }
      while (ji < jokers.length) {
        result.push({ ...jokers[ji], resolvedNumber: 0 });
        ji++;
      }
      return result;
    }

    // Edge jokers
    const gaps = max - min + 1 - sorted.length;
    const edgeJokers = jokers.length - gaps;
    if (edgeJokers >= 0 && tiles.length >= 3) {
      const extendDown = Math.min(edgeJokers, min - 1);
      const bestStart = min - extendDown;
      const bestEnd = bestStart + tiles.length - 1;
      if (bestEnd <= 13) {
        const result = [];
        let ji = 0;
        for (let n = bestStart; n <= bestEnd; n++) {
          const real = sorted.find((t) => t.number === n);
          if (real) {
            result.push(real);
          } else if (ji < jokers.length) {
            result.push({ ...jokers[ji], resolvedNumber: n });
            ji++;
          }
        }
        return result;
      }
    }
  }

  // Fallback
  return [
    ...nonJokers.sort((a, b) => a.number - b.number),
    ...jokers.map((j) => ({ ...j, resolvedNumber: 0 })),
  ];
}

/* ────────────────────────── component ────────────────────────── */

export default function RummyRoom({ roomId, playerId, playerName, onLeave }) {
  const { dark } = useTheme();
  const [roomState, setRoomState] = useState(null);
  const [rState, setRState] = useState(null);            // last server state
  const [messages, setMessages] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameOverData, setGameOverData] = useState(null);
  const [turnEndTime, setTurnEndTime] = useState(null);

  // ─ Local workspace state (what the user manipulates during their turn) ─
  const [localHand, setLocalHand] = useState([]);         // tiles in player hand
  const [localGroups, setLocalGroups] = useState([]);      // groups on the table
  const [selectedHand, setSelectedHand] = useState(new Set());   // selected tile ids in hand
  const [selectedTable, setSelectedTable] = useState(new Map()); // groupId -> Set of tileIds
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Snapshot for local revert (what server sent at turn start)
  const serverSnapshot = useRef({ hand: [], groups: [] });

  const card = dark ? 'card-hacker' : 'card-paper';
  const btn = dark ? 'btn-hacker' : 'btn-paper';

  /* ────────────────────────── socket listeners ────────────────────────── */

  useEffect(() => {
    function onRoomState(state) { setRoomState(state); }

    function onRummyState(state) {
      setRState(state);
      // When it's my turn or state resets, sync local state
      if (state.isMyTurn) {
        setLocalHand(state.hand.map((t) => ({ ...t })));
        setLocalGroups(deepCloneGroups(state.tableGroups));
        serverSnapshot.current = {
          hand: state.hand.map((t) => ({ ...t })),
          groups: deepCloneGroups(state.tableGroups),
        };
        setHasLocalChanges(false);
      } else {
        // Not my turn — just show server state
        setLocalHand(state.hand.map((t) => ({ ...t })));
        setLocalGroups(deepCloneGroups(state.tableGroups));
        setHasLocalChanges(false);
      }
      setSelectedHand(new Set());
      setSelectedTable(new Map());
    }

    function onChatMessage(msg) {
      setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
    }
    function onError(text) {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(''), 5000);
    }
    function onGameOver(data) {
      setGameOverData(data);
      setSelectedHand(new Set());
      setSelectedTable(new Map());
      setTurnEndTime(null);
    }
    function onTimer({ endsAt }) { setTurnEndTime(endsAt); }

    socket.on('room:state', onRoomState);
    socket.on('rummy:state', onRummyState);
    socket.on('chat:message', onChatMessage);
    socket.on('error:message', onError);
    socket.on('rummy:gameover', onGameOver);
    socket.on('rummy:timer', onTimer);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('rummy:state', onRummyState);
      socket.off('chat:message', onChatMessage);
      socket.off('error:message', onError);
      socket.off('rummy:gameover', onGameOver);
      socket.off('rummy:timer', onTimer);
    };
  }, []);

  /* ────────────────────────── selection helpers ────────────────────────── */

  const toggleHandSelect = (tileId) => {
    setSelectedHand((prev) => {
      const next = new Set(prev);
      if (next.has(tileId)) next.delete(tileId); else next.add(tileId);
      return next;
    });
  };

  const toggleTableSelect = (groupId, tileId) => {
    setSelectedTable((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(groupId) || []);
      if (set.has(tileId)) set.delete(tileId); else set.add(tileId);
      if (set.size === 0) next.delete(groupId); else next.set(groupId, set);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedHand(new Set());
    setSelectedTable(new Map());
  };

  const totalSelected = selectedHand.size + [...selectedTable.values()].reduce((s, set) => s + set.size, 0);

  /* ────────────────────────── local manipulation actions ────────────────────────── */

  // Collect all selected tiles (from hand + table), remove them from their sources, return array
  const extractSelectedTiles = useCallback(() => {
    const tiles = [];
    let newHand = [...localHand];
    let newGroups = deepCloneGroups(localGroups);

    // From hand
    if (selectedHand.size > 0) {
      for (const id of selectedHand) {
        const idx = newHand.findIndex((t) => t.id === id);
        if (idx !== -1) {
          tiles.push(newHand[idx]);
          newHand.splice(idx, 1);
        }
      }
    }

    // From table groups
    for (const [groupId, tileIdSet] of selectedTable) {
      const group = newGroups.find((g) => g.id === groupId);
      if (!group) continue;
      for (const tid of tileIdSet) {
        const idx = group.tiles.findIndex((t) => t.id === tid);
        if (idx !== -1) {
          tiles.push(group.tiles[idx]);
          group.tiles.splice(idx, 1);
        }
      }
    }

    // Remove empty groups
    newGroups = newGroups.filter((g) => g.tiles.length > 0);

    return { tiles, newHand, newGroups };
  }, [localHand, localGroups, selectedHand, selectedTable]);

  // Place selected tiles as a NEW group on the table
  const handleNewGroup = useCallback(() => {
    if (totalSelected === 0) return;
    const { tiles, newHand, newGroups } = extractSelectedTiles();
    if (tiles.length === 0) return;
    newGroups.push({ id: localGroupId(), tiles: arrangeGroupTiles(tiles) });
    setLocalHand(newHand);
    setLocalGroups(newGroups);
    setHasLocalChanges(true);
    clearSelection();
  }, [totalSelected, extractSelectedTiles]);

  // Add selected tiles to an EXISTING group on the table
  const handleAddToGroup = useCallback((targetGroupId) => {
    if (totalSelected === 0) return;
    const { tiles, newHand, newGroups } = extractSelectedTiles();
    if (tiles.length === 0) return;
    const target = newGroups.find((g) => g.id === targetGroupId);
    if (target) {
      target.tiles = arrangeGroupTiles([...target.tiles, ...tiles]);
    } else {
      newGroups.push({ id: targetGroupId, tiles: arrangeGroupTiles(tiles) });
    }
    setLocalHand(newHand);
    setLocalGroups(newGroups);
    setHasLocalChanges(true);
    clearSelection();
  }, [totalSelected, extractSelectedTiles]);

  // Move selected tiles BACK to hand
  const handleReturnToHand = useCallback(() => {
    if (totalSelected === 0) return;
    const { tiles, newHand, newGroups } = extractSelectedTiles();
    newHand.push(...tiles);
    setLocalHand(newHand);
    setLocalGroups(newGroups);
    setHasLocalChanges(true);
    clearSelection();
  }, [totalSelected, extractSelectedTiles]);

  // Split: take selected tiles out of a group and make a new group
  // (same as handleNewGroup but explicitly from table)

  /* ────────────────────────── server actions ────────────────────────── */

  const handleStart = useCallback(() => {
    socket.emit('rummy:start');
    setGameOverData(null);
    setSelectedHand(new Set());
    setSelectedTable(new Map());
  }, []);

  const handleEndTurn = useCallback(() => {
    // Send full workspace state to server for validation
    socket.emit('rummy:end-turn', {
      tableGroups: localGroups.map((g) => ({
        id: g.id,
        tiles: g.tiles.map((t) => ({ id: t.id })),
      })),
      hand: localHand.map((t) => ({ id: t.id })),
    });
    clearSelection();
  }, [localGroups, localHand]);

  const handleDraw = useCallback(() => {
    socket.emit('rummy:draw');
    clearSelection();
  }, []);

  const handleRevert = useCallback(() => {
    // Local revert first (instant)
    setLocalHand(serverSnapshot.current.hand.map((t) => ({ ...t })));
    setLocalGroups(deepCloneGroups(serverSnapshot.current.groups));
    setHasLocalChanges(false);
    clearSelection();
    // Also tell server
    socket.emit('rummy:revert');
  }, []);

  const handleSortHand = useCallback(() => {
    const sorted = [...localHand].sort((a, b) => {
      if (a.isJoker && !b.isJoker) return 1;
      if (!a.isJoker && b.isJoker) return -1;
      if (a.isJoker && b.isJoker) return 0;
      const colors = ['red', 'blue', 'yellow', 'black'];
      const colorDiff = colors.indexOf(a.color) - colors.indexOf(b.color);
      if (colorDiff !== 0) return colorDiff;
      return a.number - b.number;
    });
    setLocalHand(sorted);
  }, [localHand]);

  const handleSend = useCallback((text) => {
    socket.emit('rummy:chat', { text });
  }, []);

  /* ────────────────────────── derived state ────────────────────────── */

  const isMyTurn = rState?.isMyTurn;
  const gameStarted = rState?.gameStarted;
  const gameOver = rState?.gameOver;
  const hasOpened = rState?.hasOpened;
  const hand = isMyTurn ? localHand : (rState?.hand || []);
  const groups = isMyTurn ? localGroups : (rState?.tableGroups || []);

  /* ────────────────────────── group validity helper ────────────────────────── */

  function isLocalGroupValid(tiles) {
    if (!tiles || tiles.length < 3) return false;
    const nonJokers = tiles.filter((t) => !t.isJoker);
    if (nonJokers.length === 0) return false;

    // SET: 3-4 tiles, SAME number, DIFFERENT colors
    if (tiles.length >= 3 && tiles.length <= 4) {
      const num = nonJokers[0].number;
      if (nonJokers.every((t) => t.number === num)) {
        const colors = new Set(nonJokers.map((t) => t.color));
        if (colors.size === nonJokers.length) return true;
      }
    }

    // RUN: 3+ consecutive, ALL SAME COLOR (jokers fill gaps + edges)
    const jokerCount = tiles.length - nonJokers.length;
    const color = nonJokers[0].color;
    if (nonJokers.every((t) => t.color === color)) {
      const sorted = nonJokers.map((t) => t.number).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1]) return false; // no duplicates
      }
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const span = max - min + 1;
      if (span > tiles.length) return false;
      const internalGaps = span - sorted.length;
      if (internalGaps > jokerCount) return false;
      const edgeJokers = jokerCount - internalGaps;
      const maxLeft = min - 1;
      const maxRight = 13 - max;
      if (maxLeft + maxRight >= edgeJokers) return true;
    }

    return false;
  }

  /* ────────────────────────── render ────────────────────────── */

  const groupBorder = (tiles) => {
    if (!isMyTurn) return dark ? 'border-green-500/20' : 'border-green-300/30';
    const valid = isLocalGroupValid(tiles);
    return valid
      ? dark ? 'border-green-500/40' : 'border-green-400/50'
      : dark ? 'border-red-500/40' : 'border-red-400/50';
  };

  const groupBg = (tiles) => {
    if (!isMyTurn) return dark ? 'bg-green-900/10' : 'bg-green-50/50';
    const valid = isLocalGroupValid(tiles);
    return valid
      ? dark ? 'bg-green-900/10' : 'bg-green-50/50'
      : dark ? 'bg-red-900/10' : 'bg-red-50/50';
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in flex flex-col gap-4">
      {/* Top bar */}
      <div className={`${card} p-3 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
            {dark ? 'SALA:' : 'Sala:'}{' '}
            <span className={`font-bold ${dark ? 'text-hacker-orange' : 'text-paper-ink'}`}>
              {roomState?.name || '...'}{' '}
            </span>
            <span className={`${dark ? 'text-hacker-orange/70' : 'text-paper-sepia'}`}>[{roomId}]</span>
          </span>
          <span className={`text-xs ${dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/60 font-sketch text-sm'}`}>|</span>
          <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
            🎲 Rummikub
          </span>
          {gameStarted && !gameOver && (
            <>
              <span className={`text-xs ${dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/60 font-sketch text-sm'}`}>|</span>
              <span className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
                Pozo: {rState?.poolCount || 0}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {gameStarted && !gameOver && (
            <Timer endsAt={turnEndTime} dark={dark} />
          )}
          <button onClick={onLeave} className={`${btn} text-xs py-1 px-3`}>
            {dark ? '[ SALIR ]' : 'Salir'}
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className={`text-center text-sm py-2 px-3 rounded ${
          dark ? 'bg-red-900/30 text-red-400 font-mono border border-red-500/30' : 'bg-red-100 text-red-700 font-sketch border border-red-300'
        }`}>
          {errorMsg}
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="flex flex-col gap-4">

          {/* Turn info + actions bar */}
          {gameStarted && !gameOver && (
            <div className={`${card} p-4`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className={`text-sm font-bold ${
                    isMyTurn
                      ? dark ? 'text-green-400 font-mono' : 'text-green-700 font-sketch text-base'
                      : dark ? 'text-hacker-orange/70 font-mono' : 'text-paper-ink/70 font-sketch'
                  }`}>
                    {isMyTurn
                      ? dark ? '> TU TURNO' : '¡Tu turno!'
                      : dark ? `> Turno de ${rState?.currentTurnName}` : `Turno de ${rState?.currentTurnName}`
                    }
                  </span>
                  {isMyTurn && !hasOpened && (
                    <p className={`text-xs mt-1 ${dark ? 'text-yellow-500/70 font-mono' : 'text-yellow-700 font-sketch'}`}>
                      ⚠ Primera jugada: baja uno o más grupos que sumen ≥ 30 puntos
                    </p>
                  )}
                  {isMyTurn && hasOpened && (
                    <p className={`text-xs mt-1 ${dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/60 font-sketch'}`}>
                      Mueve las fichas libremente. Al terminar todo debe ser válido.
                    </p>
                  )}
                </div>

                {isMyTurn && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* New group from selection */}
                    {totalSelected > 0 && (
                      <button onClick={handleNewGroup} className={`${btn} text-xs py-1 px-3`}>
                        {dark ? '>> NUEVO GRUPO' : 'Nuevo grupo'}
                      </button>
                    )}

                    {/* Return to hand */}
                    {[...selectedTable.values()].some((s) => s.size > 0) && (
                      <button onClick={handleReturnToHand}
                        className={`text-xs px-3 py-1 rounded transition-all ${
                          dark ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30 hover:bg-purple-900/50'
                               : 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100'
                        }`}
                      >
                        {dark ? '↩ A MANO' : '↩ A la mano'}
                      </button>
                    )}

                    {/* Draw */}
                    {!hasLocalChanges && (
                      <button onClick={handleDraw}
                        className={`text-xs px-3 py-1 rounded transition-all ${
                          dark ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30 hover:bg-blue-900/50'
                               : 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        {dark ? '>> ROBAR' : 'Robar ficha'}
                      </button>
                    )}

                    {/* End turn */}
                    <button onClick={handleEndTurn} className={`${btn} text-xs py-1 px-3`}>
                      {dark ? '>> TERMINAR TURNO' : 'Terminar turno'}
                    </button>

                    {/* Revert */}
                    {hasLocalChanges && (
                      <button onClick={handleRevert}
                        className={`text-xs px-3 py-1 rounded transition-all ${
                          dark ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-900/50'
                               : 'bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100'
                        }`}
                      >
                        {dark ? '↩ REVERTIR' : '↩ Revertir'}
                      </button>
                    )}

                    {/* Sort */}
                    <button onClick={handleSortHand}
                      className={`text-xs px-2 py-1 rounded ${
                        dark ? 'text-hacker-orange/40 hover:text-hacker-orange font-mono'
                             : 'text-paper-sepia/50 hover:text-paper-ink font-sketch'
                      }`}
                    >
                      {dark ? '⇅ ORDENAR' : '⇅ Ordenar'}
                    </button>

                    {/* Clear selection */}
                    {totalSelected > 0 && (
                      <button onClick={clearSelection}
                        className={`text-xs px-2 py-1 rounded ${
                          dark ? 'text-hacker-orange/30 hover:text-hacker-orange/60 font-mono'
                               : 'text-paper-sepia/40 hover:text-paper-ink/60 font-sketch'
                        }`}
                      >
                        ✕ ({totalSelected})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TABLE / WORKSPACE ═══ */}
          {gameStarted && !gameOver && (
            <div className={`${card} p-4 min-h-[160px]`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
                  {dark ? '> MESA' : 'Mesa'}
                  {groups.length === 0 && (
                    <span className={`ml-2 ${dark ? 'text-hacker-orange/20' : 'text-paper-sepia/30'}`}>(vacía)</span>
                  )}
                </p>
                {isMyTurn && groups.length > 0 && (
                  <span className={`text-xs ${dark ? 'text-hacker-orange/30 font-mono' : 'text-paper-sepia/40 font-sketch'}`}>
                    Haz clic en fichas de la mesa para seleccionarlas
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {groups.map((group) => {
                  const selSet = selectedTable.get(group.id) || new Set();
                  return (
                    <div key={group.id}
                      className={`flex items-center gap-1 p-2 rounded-lg border transition-all ${
                        groupBg(group.tiles)
                      } ${groupBorder(group.tiles)}`}
                    >
                      {group.tiles.map((t) => (
                        <RummyTile
                          key={t.id}
                          tile={t}
                          dark={dark}
                          size="sm"
                          selected={selSet.has(t.id)}
                          onClick={() => isMyTurn && (hasOpened || false) && toggleTableSelect(group.id, t.id)}
                          interactive={isMyTurn && (hasOpened || false)}
                        />
                      ))}
                      {/* "Add to this group" button when hand tiles are selected */}
                      {isMyTurn && selectedHand.size > 0 && (
                        <button
                          onClick={() => handleAddToGroup(group.id)}
                          className={`ml-1 text-xs px-2 py-1 rounded transition-all ${
                            dark ? 'bg-green-900/30 text-green-400 border border-green-500/30 hover:bg-green-900/50'
                                 : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                          }`}
                        >
                          +
                        </button>
                      )}
                      {/* "Add to this group" button when table tiles are selected (merging) */}
                      {isMyTurn && selectedHand.size === 0 && [...selectedTable.values()].some((s) => s.size > 0) && !selSet.size && (
                        <button
                          onClick={() => handleAddToGroup(group.id)}
                          className={`ml-1 text-xs px-2 py-1 rounded transition-all ${
                            dark ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900/50'
                                 : 'bg-cyan-50 text-cyan-700 border border-cyan-300 hover:bg-cyan-100'
                          }`}
                        >
                          ←
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ HAND / ATRIL ═══ */}
          {gameStarted && !gameOver && (
            <div className={`${card} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs ${dark ? 'text-hacker-orange/50 font-mono' : 'text-paper-sepia font-sketch text-sm'}`}>
                  {dark ? `> TU ATRIL (${hand.length} fichas)` : `Tu atril (${hand.length} fichas)`}
                </p>
                {selectedHand.size > 0 && (
                  <button onClick={() => setSelectedHand(new Set())}
                    className={`text-xs ${dark ? 'text-hacker-orange/40 hover:text-hacker-orange font-mono'
                                               : 'text-paper-sepia/50 hover:text-paper-ink font-sketch'}`}
                  >
                    Deseleccionar ({selectedHand.size})
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {hand.map((t) => (
                  <RummyTile
                    key={t.id}
                    tile={t}
                    dark={dark}
                    size="lg"
                    selected={selectedHand.has(t.id)}
                    onClick={() => isMyTurn && toggleHandSelect(t.id)}
                    interactive={isMyTurn}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other players' tile counts */}
          {gameStarted && !gameOver && rState?.handCounts && (
            <div className={`${card} p-3`}>
              <div className="flex flex-wrap gap-3">
                {Object.entries(rState.handCounts)
                  .filter(([name]) => name !== playerName)
                  .map(([name, count]) => (
                    <span key={name} className={`text-xs px-2 py-1 rounded ${
                      dark ? 'bg-hacker-orange/10 text-hacker-orange/70 font-mono'
                           : 'bg-paper-bg-dark text-paper-ink/70 font-sketch'
                    }`}>
                      {name}: {count} fichas
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Game Over */}
          {gameOverData && (
            <div className={`p-5 rounded-lg text-center animate-fade-in ${
              dark ? 'border border-green-500/50 bg-green-900/10' : 'border-2 border-green-600/30 bg-green-50'
            }`}>
              <p className={`text-2xl font-bold mb-3 ${dark ? 'text-hacker-orange font-mono' : 'text-paper-ink font-sketch text-3xl'}`}>
                🏆 ¡{gameOverData.winner} gana!
              </p>
              <div className="space-y-1 mb-4">
                {gameOverData.scores.map((s, i) => (
                  <div key={i} className={`text-sm ${dark ? 'text-hacker-orange/70 font-mono' : 'text-paper-ink/70 font-sketch'}`}>
                    {s.name}: {s.penalty > 0 ? `${s.penalty} pts penalización (${s.tilesLeft} fichas)` : '¡Sin fichas!'}
                  </div>
                ))}
              </div>
              <button onClick={handleStart} className={`${btn} px-6 py-2`}>
                {dark ? '>> NUEVA PARTIDA' : 'Nueva partida'}
              </button>
            </div>
          )}

          {/* Waiting / Start */}
          {(!gameStarted || gameOver) && !gameOverData && (
            <div className={`${card} p-8 text-center`}>
              <div className="text-6xl mb-4">🎲</div>
              <p className={`text-lg mb-4 ${dark ? 'text-hacker-orange/70 font-mono' : 'text-paper-sepia font-sketch text-xl'}`}>
                {roomState && roomState.players.length < 2
                  ? dark ? '> Esperando más jugadores...' : 'Esperando más jugadores...'
                  : dark ? '> Listos para jugar Rummikub' : '¡Listos para jugar Rummikub!'
                }
              </p>
              <p className={`text-xs mb-4 ${dark ? 'text-hacker-orange/40 font-mono' : 'text-paper-sepia/50 font-sketch'}`}>
                2-4 jugadores | 14 fichas cada uno | Primera jugada ≥ 30 pts (uno o varios grupos)
              </p>
              <button
                onClick={handleStart}
                disabled={roomState && roomState.players.length < 2}
                className={`${btn} text-lg px-8 py-3 ${dark ? 'hover:shadow-neon hover:animate-pulse-neon' : ''}`}
              >
                {dark ? '>> REPARTIR FICHAS' : 'Repartir fichas'}
              </button>
            </div>
          )}

          {/* Chat */}
          <Chat messages={messages} onSend={handleSend} dark={dark} playerName={playerName} />
        </div>

        {/* Sidebar */}
        <PlayerList players={roomState?.players || []} dark={dark} playerName={playerName} roomCode={roomId} />
      </div>
    </div>
  );
}
