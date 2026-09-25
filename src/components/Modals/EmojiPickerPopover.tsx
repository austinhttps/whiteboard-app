import React, { useRef, useEffect } from 'react';
import { ThemeMode } from '../../types/whiteboard';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  position?: { x: number; y: number };
  theme: ThemeMode;
}

export const POPULAR_REACTIONS = [
  '👍', '❤️', '🔥', '🚀', '🎉',
  '👀', '💡', '👏', '🎯', '🤩',
  '💯', '⚡', '❓', '🎨', '📌',
  '🤯', '🙌', '✨', '🤔', '🤝'
];

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  position,
  theme,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: `${Math.min(window.innerHeight - 180, Math.max(10, position.y))}px`,
        left: `${Math.min(window.innerWidth - 240, Math.max(10, position.x))}px`,
      }
    : {};

  return (
    <div
      ref={popoverRef}
      style={style}
      className={`z-50 p-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none ${
        isDark
          ? 'bg-slate-900/95 border-slate-700/80 text-white'
          : 'bg-white/95 border-slate-200 text-slate-800'
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
        Reactions
      </div>
      <div className="grid grid-cols-5 gap-1.5 w-48">
        {POPULAR_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelectEmoji(emoji);
              onClose();
            }}
            className={`w-8 h-8 flex items-center justify-center text-lg rounded-xl transition-all hover:scale-125 ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
