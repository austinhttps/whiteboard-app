import React, { useState, useRef } from 'react';
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  Plus,
  Trash,
  HelpCircle,
  Check,
  Grid,
  FileJson,
  Upload,
  Layers,
  User,
  Radio,
} from 'lucide-react';
import Konva from 'konva';
import { GridType, CanvasElement, Collaborator } from '../../types/whiteboard';
import { exportStageToPNG, exportBoardToJson, importBoardFromJson } from '../../utils/exportUtils';

interface HeaderProps {
  boardId: string;
  isLoaded: boolean;
  isConnected: boolean;
  collaborators: Collaborator[];
  localUser: { name: string; color: string };
  onUpdateUserName: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  gridType: GridType;
  onSetGridType: (type: GridType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewBoard: () => void;
  onClearAll: () => void;
  onOpenShortcuts: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  elements: CanvasElement[];
  onImportElements: (elements: CanvasElement[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  boardId,
  isLoaded: _isLoaded,
  isConnected,
  collaborators,
  localUser,
  onUpdateUserName,
  canUndo,
  canRedo,
  gridType,
  onSetGridType,
  onUndo,
  onRedo,
  onNewBoard,
  onClearAll,
  onOpenShortcuts,
  stageRef,
  elements,
  onImportElements,
}) => {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [tempUserName, setTempUserName] = useState(localUser.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportPNG = (pixelRatio: number, scope: 'viewport' | 'all') => {
    if (!stageRef.current) return;
    exportStageToPNG(stageRef.current, {
      pixelRatio,
      scope,
      fileName: `board-${boardId.slice(0, 8)}-${scope}-${pixelRatio}x.png`,
    });
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportBoardToJson(elements, boardId);
    setShowExportMenu(false);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imported = await importBoardFromJson(file);
        onImportElements(imported);
      } catch (err: any) {
        alert(err.message || 'Failed to import JSON file');
      }
      e.target.value = '';
      setShowExportMenu(false);
    }
  };

  const totalUsersOnline = collaborators.length + 1;

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      {/* Left: Brand & Board Management */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              CollabBoard
              <span className="text-[10px] uppercase tracking-wider bg-indigo-500/20 text-indigo-300 font-semibold px-1.5 py-0.5 rounded border border-indigo-500/30">
                Live CRDT
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Real-time Marketing & School Studio</p>
          </div>
        </div>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Board ID & Share Link */}
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2.5 py-1">
          <span className="text-xs font-mono text-slate-400">
            Board: <span className="text-slate-200">{boardId.slice(0, 8)}...</span>
          </span>
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600/80 hover:bg-indigo-600 text-white shadow-sm'
            }`}
            title="Copy board URL to share and collaborate live"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Link Copied!
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> Share Board
              </>
            )}
          </button>
        </div>

        {/* New Board Button */}
        <button
          onClick={onNewBoard}
          className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-xl border border-slate-700/60 transition-all shadow-sm"
          title="Create a fresh whiteboard with a new unique URL"
        >
          <Plus className="w-3.5 h-3.5" /> New Board
        </button>

        {/* Live WebRTC Sync Status & Collaborators */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Live Status Indicator */}
          <span
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
              isConnected
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                : 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60'
            }`}
            title="Real-time WebRTC Peer-to-Peer CRDT Sync is active"
          >
            <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-indigo-400'}`} />
            {isConnected ? `Live Sync (${totalUsersOnline} Online)` : 'Connecting P2P...'}
          </span>

          {/* User & Peer Avatars */}
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {/* Self Avatar */}
            <button
              onClick={() => {
                setTempUserName(localUser.name);
                setShowUserModal(true);
              }}
              className="relative group w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-900 shadow-sm transition-transform hover:scale-110"
              style={{ backgroundColor: localUser.color }}
              title={`You: ${localUser.name} (Click to change)`}
            >
              {localUser.name.charAt(0).toUpperCase()}
            </button>

            {/* Remote Collaborators Avatars */}
            {collaborators.map((collab) => (
              <div
                key={collab.clientId}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-900 shadow-sm"
                style={{ backgroundColor: collab.color }}
                title={`${collab.name} (Online)`}
              >
                {collab.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: History, Grid, Export & Help */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-all ${
              canUndo ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-all ${
              canRedo ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Grid Type Selector */}
        <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-0.5">
          {(['dots', 'grid', 'none'] as GridType[]).map((type) => (
            <button
              key={type}
              onClick={() => onSetGridType(type)}
              className={`px-2 py-1 text-xs font-medium rounded-lg capitalize transition-all ${
                gridType === type
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type === 'dots' ? <Grid className="w-3.5 h-3.5 inline mr-1" /> : null}
              {type}
            </button>
          ))}
        </div>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Image Exports
              </div>
              <button
                onClick={() => handleExportPNG(1, 'viewport')}
                className="flex items-center justify-between px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl transition-all text-left"
              >
                <span>Export Viewport</span>
                <span className="text-[10px] text-slate-400">1x PNG</span>
              </button>
              <button
                onClick={() => handleExportPNG(2, 'all')}
                className="flex items-center justify-between px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl transition-all text-left"
              >
                <span className="font-semibold text-indigo-300">Export All (High-Res)</span>
                <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded">2x HD</span>
              </button>
              <button
                onClick={() => handleExportPNG(3, 'all')}
                className="flex items-center justify-between px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl transition-all text-left"
              >
                <span>Print Ready (Ultra HD)</span>
                <span className="text-[10px] text-slate-400">3x UHD</span>
              </button>

              <div className="w-full h-[1px] bg-slate-800 my-1" />

              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Data & Backup
              </div>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl transition-all text-left"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-400" /> Save Backup (.json)
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl transition-all text-left"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" /> Import Backup (.json)
              </button>
            </div>
          )}
        </div>

        {/* Hidden JSON File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          className="hidden"
        />

        {/* Clear Board */}
        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 transition-all"
          title="Clear Board"
        >
          <Trash className="w-4 h-4" />
        </button>

        {/* Shortcuts Help Modal Button */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition-all"
          title="Keyboard Shortcuts & Gestures"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Clear Entire Whiteboard?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This will remove all shapes, notes, and drawings on this board for everyone. You can still undo this action.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-600/20"
              >
                Clear Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Nickname Change Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: localUser.color }}
              >
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Your Display Profile</h3>
                <p className="text-xs text-slate-400">Shown to other collaborators in real-time</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Collaborator Nickname</label>
              <input
                type="text"
                value={tempUserName}
                onChange={(e) => setTempUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                maxLength={30}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (tempUserName.trim()) {
                    onUpdateUserName(tempUserName.trim());
                  }
                  setShowUserModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
