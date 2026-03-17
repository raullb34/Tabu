import { useState, useEffect } from 'react';

export default function Timer({ endsAt, dark }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setSeconds(0);
      return;
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSeconds(remaining);
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const isLow = seconds <= 15;
  const isCritical = seconds <= 5;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        dark
          ? `border font-mono ${
              isCritical
                ? 'border-red-500 bg-red-900/20 text-red-400 animate-pulse'
                : isLow
                  ? 'border-yellow-500/50 bg-yellow-900/10 text-yellow-400'
                  : 'border-hacker-orange/30 text-hacker-orange'
            }`
          : `border-2 font-sketch ${
              isCritical
                ? 'border-red-500 bg-red-50 text-red-700 animate-pulse'
                : isLow
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  : 'border-paper-ink/20 text-paper-ink'
            }`
      }`}
    >
      <span className={`text-xs ${dark ? 'opacity-50' : 'opacity-60'}`}>
        {dark ? 'TIEMPO:' : 'Tiempo:'}
      </span>
      <span className={`text-2xl font-bold tabular-nums ${dark ? '' : 'text-3xl'}`}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </div>
  );
}
