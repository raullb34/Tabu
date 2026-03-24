import { useTheme } from '../ThemeContext';

const COLOR_MAP = {
  red:    { text: '#E63946', border: '#E63946' },
  blue:   { text: '#457B9D', border: '#457B9D' },
  yellow: { text: '#E9C46A', border: '#DAA520' },
  black:  { text: '#264653', border: '#264653' },
};

const DARK_COLOR_MAP = {
  red:    { text: '#FF6B6B', border: '#FF6B6B' },
  blue:   { text: '#74C0FC', border: '#74C0FC' },
  yellow: { text: '#FFD43B', border: '#FFD43B' },
  black:  { text: '#CED4DA', border: '#CED4DA' },
};

const SIZES = {
  sm: { w: 'w-9', h: 'h-12', text: 'text-sm', joker: 'text-lg' },
  md: { w: 'w-11', h: 'h-14', text: 'text-base', joker: 'text-xl' },
  lg: { w: 'w-14', h: 'h-[4.5rem]', text: 'text-xl', joker: 'text-2xl' },
};

export default function RummyTile({ tile, dark, size = 'md', selected, onClick, interactive }) {
  const s = SIZES[size] || SIZES.md;
  const colors = dark ? DARK_COLOR_MAP : COLOR_MAP;
  const c = tile.isJoker ? null : colors[tile.color];

  const base = [
    s.w, s.h,
    'rounded-lg flex flex-col items-center justify-center',
    'select-none transition-all duration-150',
    'border-2',
  ];

  if (dark) {
    base.push('bg-[#1a1a2e]');
    if (selected) {
      base.push('border-hacker-orange shadow-[0_0_10px_rgba(255,136,0,0.5)] -translate-y-2');
    } else {
      base.push(c ? `border-[${c.border}]/30` : 'border-purple-500/30');
    }
  } else {
    base.push('bg-[#FFF8EE]');
    if (selected) {
      base.push('border-paper-ink shadow-md -translate-y-2');
    } else {
      base.push(c ? `border-[${c.border}]/20` : 'border-purple-400/20');
    }
  }

  if (interactive) {
    base.push('cursor-pointer hover:-translate-y-1');
  }

  const tileStyle = {};
  if (c) {
    tileStyle.color = c.text;
    if (!selected) {
      tileStyle.borderColor = c.border + '4D'; // 30% opacity
    }
  }

  return (
    <div className={base.join(' ')} style={tileStyle} onClick={onClick}>
      {tile.isJoker ? (
        <div className="flex flex-col items-center">
          <span className={`${s.joker} leading-none`} style={{
            background: 'linear-gradient(135deg, #E63946, #457B9D, #E9C46A, #264653)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ☆
          </span>
          {tile.resolvedNumber > 0 && (
            <span className="text-[9px] leading-none mt-0.5 opacity-60" style={{
              background: 'linear-gradient(135deg, #E63946, #457B9D)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {tile.resolvedNumber}
            </span>
          )}
        </div>
      ) : (
        <>
          <span className={`${s.text} font-bold leading-none`}>{tile.number}</span>
          <span className="w-3/4 h-0.5 rounded-full mt-0.5" style={{ backgroundColor: c?.text + '40' }} />
        </>
      )}
    </div>
  );
}
