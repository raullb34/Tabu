import { useTheme } from '../ThemeContext';

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={`
        relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none
        ${dark
          ? 'bg-hacker-orange/20 border border-hacker-orange/50'
          : 'bg-paper-sepia/20 border-2 border-paper-ink/20'
        }
      `}
      aria-label="Cambiar tema"
    >
      <span
        className={`
          absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300
          flex items-center justify-center text-xs
          ${dark
            ? 'left-0.5 bg-hacker-orange text-hacker-bg'
            : 'left-7 bg-paper-ink text-paper-bg'
          }
        `}
      >
        {dark ? '🖥' : '📜'}
      </span>
    </button>
  );
}
