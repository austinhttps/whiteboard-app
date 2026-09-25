import { useState, useRef, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { useWhiteboard } from './hooks/useWhiteboard';
import { Whiteboard } from './components/Canvas/Whiteboard';
import { MainToolbar } from './components/Toolbar/MainToolbar';
import { PropertyBar } from './components/Toolbar/PropertyBar';
import { Header } from './components/Header/Header';
import { ShortcutsModal } from './components/Modals/ShortcutsModal';
import { ToolType, ToolProperties, GridType, CanvasElement } from './types/whiteboard';

/**
 * CollabBoard Root Application Component
 * 
 * Manages active canvas tools, contextual property bar options,
 * selection states, and binds UI interactions to the Yjs CRDT store.
 */
export function App() {
  const {
    boardId,
    elements,
    isLoaded,
    canUndo,
    canRedo,
    createNewBoard,
    setElement,
    setBatchElements,
    deleteElement,
    deleteElements,
    clearAll,
    undo,
    redo,
    getNextZIndex,
  } = useWhiteboard();

  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gridType, setGridType] = useState<GridType>('dots');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  const [toolProperties, setToolProperties] = useState<ToolProperties>({
    strokeColor: '#6366f1',
    fillColor: 'transparent',
    strokeWidth: 4,
    fontSize: 20,
    stickyColor: 'yellow',
  });

  const stageRef = useRef<Konva.Stage | null>(null);

  // Setup initial welcome content if empty board
  useEffect(() => {
    if (isLoaded && elements.length === 0) {
      const initialElements: CanvasElement[] = [
        {
          id: 'welcome-sticky',
          type: 'sticky',
          x: window.innerWidth / 2 - 180,
          y: window.innerHeight / 2 - 140,
          width: 220,
          height: 180,
          text: '✨ Welcome to CollabBoard!\n\n• Space+Drag to Pan\n• Scroll to Zoom\n• Double-click to edit\n• Drag images here',
          color: 'yellow',
          fontSize: 17,
          zIndex: 1,
          updatedAt: Date.now(),
        },
        {
          id: 'welcome-shape',
          type: 'rect',
          x: window.innerWidth / 2 + 80,
          y: window.innerHeight / 2 - 140,
          width: 140,
          height: 100,
          fill: '#312e81',
          stroke: '#818cf8',
          strokeWidth: 3,
          cornerRadius: 12,
          zIndex: 2,
          updatedAt: Date.now(),
        },
        {
          id: 'welcome-arrow',
          type: 'arrow',
          points: [
            window.innerWidth / 2 + 45,
            window.innerHeight / 2 - 50,
            window.innerWidth / 2 + 80,
            window.innerHeight / 2 - 70,
          ],
          color: '#a5b4fc',
          strokeWidth: 3,
          x: 0,
          y: 0,
          zIndex: 3,
          updatedAt: Date.now(),
        },
      ];
      setBatchElements(initialElements);
    }
  }, [isLoaded, elements.length, setBatchElements]);

  // Global hotkeys for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Tool selection shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          setCurrentTool('select');
          break;
        case 'h':
          setCurrentTool('pan');
          break;
        case 'p':
          setCurrentTool('pen');
          break;
        case 'r':
          setCurrentTool('rect');
          break;
        case 'c':
          setCurrentTool('circle');
          break;
        case 'a':
          setCurrentTool('arrow');
          break;
        case 'l':
          setCurrentTool('line');
          break;
        case 's':
          setCurrentTool('sticky');
          break;
        case 't':
          setCurrentTool('text');
          break;
        case 'e':
          setCurrentTool('eraser');
          break;
        case '?':
          setIsShortcutsOpen((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Handle image upload from file picker
  const handleUploadImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result as string;
        const img = new window.Image();
        img.src = src;
        img.onload = () => {
          const stage = stageRef.current;
          const stageX = stage ? (-stage.x() + stage.width() / 2) / stage.scaleX() : 200;
          const stageY = stage ? (-stage.y() + stage.height() / 2) / stage.scaleY() : 200;

          const maxDim = 320;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = width * ratio;
            height = height * ratio;
          }

          const newEl: CanvasElement = {
            id: crypto.randomUUID(),
            type: 'image',
            src,
            x: stageX - width / 2,
            y: stageY - height / 2,
            width,
            height,
            zIndex: getNextZIndex(),
            updatedAt: Date.now(),
          };

          setElement(newEl);
          setSelectedIds([newEl.id]);
          setCurrentTool('select');
        };
      };
      reader.readAsDataURL(file);
    },
    [getNextZIndex, setElement]
  );

  // Selected elements list
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

  // Update selected element attributes
  const handleUpdateSelected = useCallback(
    (attrs: Partial<CanvasElement>) => {
      selectedElements.forEach((el) => {
        setElement({
          ...el,
          ...attrs,
          updatedAt: Date.now(),
        } as CanvasElement);
      });
    },
    [selectedElements, setElement]
  );

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      deleteElements(selectedIds);
      setSelectedIds([]);
    }
  }, [selectedIds, deleteElements]);

  // Duplicate selected
  const handleDuplicateSelected = useCallback(() => {
    const duplicates: CanvasElement[] = [];
    const newIds: string[] = [];

    selectedElements.forEach((el) => {
      const newId = crypto.randomUUID();
      newIds.push(newId);
      duplicates.push({
        ...el,
        id: newId,
        x: el.x + 30,
        y: el.y + 30,
        zIndex: getNextZIndex(),
        updatedAt: Date.now(),
      });
    });

    duplicates.forEach((dup) => setElement(dup));
    setSelectedIds(newIds);
  }, [selectedElements, getNextZIndex, setElement]);

  // Reorder layer
  const handleReorderSelected = useCallback(
    (direction: 'up' | 'down') => {
      selectedElements.forEach((el) => {
        const currentZ = el.zIndex ?? 0;
        const newZ = direction === 'up' ? currentZ + 2 : Math.max(0, currentZ - 2);
        setElement({
          ...el,
          zIndex: newZ,
          updatedAt: Date.now(),
        });
      });
    },
    [selectedElements, setElement]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Header */}
      <Header
        boardId={boardId}
        isLoaded={isLoaded}
        canUndo={canUndo}
        canRedo={canRedo}
        gridType={gridType}
        onSetGridType={setGridType}
        onUndo={undo}
        onRedo={redo}
        onNewBoard={createNewBoard}
        onClearAll={clearAll}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        stageRef={stageRef}
        elements={elements}
        onImportElements={(imported) => setBatchElements(imported)}
      />

      {/* Property Bar for Contextual Styling */}
      <PropertyBar
        currentTool={currentTool}
        toolProperties={toolProperties}
        onUpdateProperties={(props) => setToolProperties((prev) => ({ ...prev, ...props }))}
        selectedElements={selectedElements}
        onUpdateSelected={handleUpdateSelected}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onReorderSelected={handleReorderSelected}
      />

      {/* Main Interactive Canvas */}
      <Whiteboard
        elements={elements}
        currentTool={currentTool}
        toolProperties={toolProperties}
        gridType={gridType}
        onSetTool={setCurrentTool}
        onSetElement={setElement}
        onSetBatchElements={setBatchElements}
        onDeleteElement={deleteElement}
        onDeleteElements={deleteElements}
        getNextZIndex={getNextZIndex}
        stageRef={stageRef}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />

      {/* Main Toolbar */}
      <MainToolbar
        currentTool={currentTool}
        onSelectTool={setCurrentTool}
        onUploadImage={handleUploadImage}
      />

      {/* Shortcuts & Gestures Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}

export default App;
