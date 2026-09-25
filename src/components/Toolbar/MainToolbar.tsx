import React, { useRef } from 'react';
import {
  MousePointer,
  Hand,
  Pencil,
  Square,
  Circle,
  ArrowUpRight,
  Minus,
  StickyNote,
  Type,
  Eraser,
  Image as ImageIcon,
} from 'lucide-react';
import { ToolType } from '../../types/whiteboard';

interface MainToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onUploadImage: (file: File) => void;
}

export const MainToolbar: React.FC<MainToolbarProps> = ({
  currentTool,
  onSelectTool,
  onUploadImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Select & Move', icon: <MousePointer className="w-5 h-5" />, shortcut: 'V' },
    { id: 'pan', label: 'Hand / Pan', icon: <Hand className="w-5 h-5" />, shortcut: 'H' },
    { id: 'pen', label: 'Freehand Pen', icon: <Pencil className="w-5 h-5" />, shortcut: 'P' },
    { id: 'rect', label: 'Rectangle', icon: <Square className="w-5 h-5" />, shortcut: 'R' },
    { id: 'circle', label: 'Circle / Ellipse', icon: <Circle className="w-5 h-5" />, shortcut: 'C' },
    { id: 'arrow', label: 'Arrow', icon: <ArrowUpRight className="w-5 h-5" />, shortcut: 'A' },
    { id: 'line', label: 'Straight Line', icon: <Minus className="w-5 h-5" />, shortcut: 'L' },
    { id: 'sticky', label: 'Sticky Note', icon: <StickyNote className="w-5 h-5" />, shortcut: 'S' },
    { id: 'text', label: 'Text', icon: <Type className="w-5 h-5" />, shortcut: 'T' },
    { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-5 h-5" />, shortcut: 'E' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-1.5 rounded-2xl shadow-2xl transition-all">
      {tools.map((tool) => {
        const isActive = currentTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tool.icon}
            <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-slate-200 text-xs font-medium px-2 py-1 rounded shadow-lg border border-slate-700 pointer-events-none whitespace-nowrap">
              {tool.label} <kbd className="ml-1 text-[10px] text-slate-400 bg-slate-800 px-1 py-0.5 rounded">{tool.shortcut}</kbd>
            </span>
          </button>
        );
      })}

      <div className="w-[1px] h-6 bg-slate-700/60 mx-1" />

      {/* Image Upload Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Upload Image"
        className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
      >
        <ImageIcon className="w-5 h-5" />
        <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-slate-200 text-xs font-medium px-2 py-1 rounded shadow-lg border border-slate-700 pointer-events-none whitespace-nowrap">
          Insert Image
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
