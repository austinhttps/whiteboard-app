import React from 'react';
import {
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  CanvasElement,
  ToolType,
  ToolProperties,
  StickyColor,
} from '../../types/whiteboard';

interface PropertyBarProps {
  currentTool: ToolType;
  toolProperties: ToolProperties;
  onUpdateProperties: (props: Partial<ToolProperties>) => void;
  selectedElements: CanvasElement[];
  onUpdateSelected: (attrs: Partial<CanvasElement>) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onReorderSelected: (direction: 'up' | 'down') => void;
}

const STROKE_COLORS = [
  '#ffffff',
  '#94a3b8',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

const FILL_COLORS = [
  'transparent',
  '#1e293b',
  '#7f1d1d',
  '#78350f',
  '#713f12',
  '#14532d',
  '#164e63',
  '#1e3a8a',
  '#312e81',
  '#581c87',
  '#831843',
];

const STICKY_COLORS: { id: StickyColor; name: string; bg: string; border: string }[] = [
  { id: 'yellow', name: 'Yellow', bg: '#fef08a', border: '#facc15' },
  { id: 'pink', name: 'Pink', bg: '#fbcfe8', border: '#f472b6' },
  { id: 'blue', name: 'Blue', bg: '#bae6fd', border: '#38bdf8' },
  { id: 'green', name: 'Green', bg: '#bbf7d0', border: '#4ade80' },
  { id: 'purple', name: 'Purple', bg: '#e9d5ff', border: '#c084fc' },
  { id: 'orange', name: 'Orange', bg: '#fed7aa', border: '#fb923c' },
];

const STROKE_WIDTHS = [2, 4, 8, 14];
const FONT_SIZES = [14, 18, 24, 32, 48];

export const PropertyBar: React.FC<PropertyBarProps> = ({
  currentTool,
  toolProperties,
  onUpdateProperties,
  selectedElements,
  onUpdateSelected,
  onDeleteSelected,
  onDuplicateSelected,
  onReorderSelected,
}) => {
  const hasSelection = selectedElements.length > 0;
  const primarySelected = selectedElements[0];

  // Determine what controls to show
  const showStickyColors = currentTool === 'sticky' || (hasSelection && primarySelected?.type === 'sticky');
  const showTextControls = currentTool === 'text' || (hasSelection && primarySelected?.type === 'text');
  const showShapeControls =
    ['rect', 'circle'].includes(currentTool) ||
    (hasSelection && ['rect', 'circle'].includes(primarySelected?.type || ''));
  const showLineControls =
    ['pen', 'arrow', 'line'].includes(currentTool) ||
    (hasSelection && ['pen', 'arrow', 'line'].includes(primarySelected?.type || ''));

  if (!hasSelection && currentTool === 'select') {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 px-4 py-2 rounded-2xl shadow-xl transition-all">
      {/* Selection Action Controls */}
      {hasSelection && (
        <div className="flex items-center gap-1.5 border-r border-slate-700/60 pr-3">
          <button
            onClick={onDuplicateSelected}
            title="Duplicate (Ctrl+D)"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            onClick={() => onReorderSelected('up')}
            title="Bring Forward"
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onReorderSelected('down')}
            title="Send Backward"
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteSelected}
            title="Delete (Del)"
            className="p-1 text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 rounded-lg transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sticky Note Colors */}
      {showStickyColors && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400">Color:</span>
          {STICKY_COLORS.map((c) => {
            const isSelected = hasSelection
              ? primarySelected?.type === 'sticky' && primarySelected.color === c.id
              : toolProperties.stickyColor === c.id;

            return (
              <button
                key={c.id}
                onClick={() => {
                  onUpdateProperties({ stickyColor: c.id });
                  if (hasSelection) onUpdateSelected({ color: c.id } as any);
                }}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  isSelected ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.bg, borderColor: isSelected ? '#ffffff' : c.border }}
                title={c.name}
              />
            );
          })}
        </div>
      )}

      {/* Stroke Color Palette */}
      {(showLineControls || showShapeControls || showTextControls) && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400">
            {showTextControls ? 'Text Color:' : 'Stroke:'}
          </span>
          <div className="flex items-center gap-1">
            {STROKE_COLORS.map((color) => {
              const activeColor = hasSelection
                ? (primarySelected as any)?.stroke || (primarySelected as any)?.color || (primarySelected as any)?.fill
                : toolProperties.strokeColor;
              const isSelected = activeColor === color;

              return (
                <button
                  key={color}
                  onClick={() => {
                    onUpdateProperties({ strokeColor: color });
                    if (hasSelection) {
                      if (primarySelected.type === 'pen' || primarySelected.type === 'arrow' || primarySelected.type === 'line') {
                        onUpdateSelected({ color } as any);
                      } else if (primarySelected.type === 'text') {
                        onUpdateSelected({ fill: color } as any);
                      } else {
                        onUpdateSelected({ stroke: color } as any);
                      }
                    }
                  }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    isSelected ? 'scale-125 border-white ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900' : 'border-slate-600 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Fill Color for Shapes */}
      {showShapeControls && (
        <div className="flex items-center gap-1.5 border-l border-slate-700/60 pl-3">
          <span className="text-xs font-semibold text-slate-400">Fill:</span>
          <div className="flex items-center gap-1">
            {FILL_COLORS.map((fill) => {
              const activeFill = hasSelection
                ? (primarySelected as any)?.fill
                : toolProperties.fillColor;
              const isSelected = activeFill === fill;

              return (
                <button
                  key={fill}
                  onClick={() => {
                    onUpdateProperties({ fillColor: fill });
                    if (hasSelection) onUpdateSelected({ fill } as any);
                  }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    isSelected ? 'scale-125 border-white ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900' : 'border-slate-600 hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: fill === 'transparent' ? '#334155' : fill,
                    backgroundImage: fill === 'transparent' ? 'linear-gradient(45deg, transparent 40%, red 45%, red 55%, transparent 60%)' : 'none',
                  }}
                  title={fill === 'transparent' ? 'Transparent' : fill}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Stroke Width Selector */}
      {(showLineControls || showShapeControls) && (
        <div className="flex items-center gap-1.5 border-l border-slate-700/60 pl-3">
          <span className="text-xs font-semibold text-slate-400">Width:</span>
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
            {STROKE_WIDTHS.map((width) => {
              const activeWidth = hasSelection
                ? (primarySelected as any)?.strokeWidth || 2
                : toolProperties.strokeWidth;
              const isSelected = activeWidth === width;

              return (
                <button
                  key={width}
                  onClick={() => {
                    onUpdateProperties({ strokeWidth: width });
                    if (hasSelection) onUpdateSelected({ strokeWidth: width } as any);
                  }}
                  className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                    isSelected ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {width}px
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Font Size Selector */}
      {showTextControls && (
        <div className="flex items-center gap-1.5 border-l border-slate-700/60 pl-3">
          <span className="text-xs font-semibold text-slate-400">Size:</span>
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
            {FONT_SIZES.map((size) => {
              const activeSize = hasSelection
                ? (primarySelected as any)?.fontSize || 20
                : toolProperties.fontSize;
              const isSelected = activeSize === size;

              return (
                <button
                  key={size}
                  onClick={() => {
                    onUpdateProperties({ fontSize: size });
                    if (hasSelection) onUpdateSelected({ fontSize: size } as any);
                  }}
                  className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                    isSelected ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
