import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Transformer, Rect as KonvaRect, Line as KonvaLine, Circle as KonvaCircle, Arrow as KonvaArrow } from 'react-konva';
import Konva from 'konva';
import { CanvasElement, ToolType, ToolProperties, GridType, StickyColor } from '../../types/whiteboard';
import { ElementRenderer } from './ElementRenderer';
import { GridBackground } from './GridBackground';

interface WhiteboardProps {
  elements: CanvasElement[];
  currentTool: ToolType;
  toolProperties: ToolProperties;
  gridType: GridType;
  onSetTool: (tool: ToolType) => void;
  onSetElement: (element: CanvasElement) => void;
  onSetBatchElements: (elements: CanvasElement[]) => void;
  onDeleteElement: (id: string) => void;
  onDeleteElements: (ids: string[]) => void;
  getNextZIndex: () => number;
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}

interface InlineEditingState {
  id: string;
  type: 'sticky' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color?: StickyColor;
  fill?: string;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  elements,
  currentTool,
  toolProperties,
  gridType,
  onSetTool,
  onSetElement,
  onSetBatchElements: _onSetBatchElements,
  onDeleteElement,
  onDeleteElements,
  getNextZIndex,
  stageRef,
  selectedIds,
  setSelectedIds,
}) => {
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState<number>(1);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drawing state
  const isDrawing = useRef<boolean>(false);
  const [newShape, setNewShape] = useState<CanvasElement | null>(null);

  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Inline editing overlay
  const [editingItem, setEditingItem] = useState<InlineEditingState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update Transformer attached nodes
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;

    if (selectedIds.length === 0 || currentTool !== 'select') {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedIds
      .map((id) => layerRef.current?.findOne(`#${id}`))
      .filter((node): node is Konva.Node => !!node);

    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, elements, currentTool]);

  // Spacebar panning listener & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea or input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space' && !e.repeat && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      // Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        onDeleteElements(selectedIds);
        setSelectedIds([]);
      }

      // Escape
      if (e.key === 'Escape') {
        setSelectedIds([]);
        if (editingItem) {
          commitInlineEdit();
        }
        onSetTool('select');
      }

      // Select all (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
        onSetTool('select');
      }

      // Duplicate (Ctrl+D / Cmd+D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        const duplicates: CanvasElement[] = [];
        const newIds: string[] = [];

        selectedIds.forEach((id) => {
          const el = elements.find((item) => item.id === id);
          if (el) {
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
          }
        });

        duplicates.forEach((dup) => onSetElement(dup));
        setSelectedIds(newIds);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed, selectedIds, elements, editingItem, onSetTool, onDeleteElements, getNextZIndex, onSetElement]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingItem && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingItem]);

  // Helper: Convert screen/viewport pointer to stage canvas coordinate
  const getCanvasPoint = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  }, []);

  // Zoom with mouse wheel centered at pointer
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.08;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Normalize wheel direction
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.1, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageScale(newScale);
    setStagePos(newPos);
  };

  // Mouse Down / Touch Start
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Check if clicked inside inline textarea or if we need to commit
    if (editingItem) {
      commitInlineEdit();
    }

    // Spacebar Pan or Hand Tool Pan
    if (isSpacePressed || currentTool === 'pan' || (e.evt as MouseEvent).button === 1) {
      setIsPanning(true);
      const pointer = stage.getPointerPosition();
      if (pointer) {
        setPanStart({ x: pointer.x - stage.x(), y: pointer.y - stage.y() });
      }
      return;
    }

    const point = getCanvasPoint(stage);
    const clickedOnEmpty = e.target === stage || e.target.name() === 'background-rect';

    if (currentTool === 'select') {
      if (clickedOnEmpty) {
        // Deselect or start selection box
        setSelectedIds([]);
        setSelectionBox({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
      return;
    }

    if (currentTool === 'eraser') {
      if (!clickedOnEmpty && e.target.id()) {
        onDeleteElement(e.target.id());
      }
      return;
    }

    // Instant placement tools
    if (currentTool === 'sticky') {
      const newSticky: CanvasElement = {
        id: crypto.randomUUID(),
        type: 'sticky',
        x: point.x - 80,
        y: point.y - 80,
        width: 170,
        height: 170,
        text: 'New Note',
        color: toolProperties.stickyColor,
        fontSize: 18,
        zIndex: getNextZIndex(),
        updatedAt: Date.now(),
      };
      onSetElement(newSticky);
      setSelectedIds([newSticky.id]);
      onSetTool('select');
      return;
    }

    if (currentTool === 'text') {
      const newText: CanvasElement = {
        id: crypto.randomUUID(),
        type: 'text',
        x: point.x,
        y: point.y,
        text: 'Type text here...',
        fontSize: toolProperties.fontSize || 22,
        fontFamily: 'Inter, sans-serif',
        fill: toolProperties.strokeColor,
        zIndex: getNextZIndex(),
        updatedAt: Date.now(),
      };
      onSetElement(newText);
      setSelectedIds([newText.id]);
      onSetTool('select');
      return;
    }

    // Drag-to-create shape tools
    isDrawing.current = true;
    const nextZ = getNextZIndex();

    if (currentTool === 'pen') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'pen',
        points: [point.x, point.y],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'rect') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'rect',
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        cornerRadius: 4,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'circle') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'circle',
        x: point.x,
        y: point.y,
        radiusX: 1,
        radiusY: 1,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'arrow') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'arrow',
        points: [point.x, point.y, point.x, point.y],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'line') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'line',
        points: [point.x, point.y, point.x, point.y],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    }
  };

  // Mouse Move / Touch Move
  const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (isPanning) {
      const pointer = stage.getPointerPosition();
      if (pointer) {
        setStagePos({
          x: pointer.x - panStart.x,
          y: pointer.y - panStart.y,
        });
      }
      return;
    }

    const point = getCanvasPoint(stage);

    // Selection box dragging
    if (selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, x2: point.x, y2: point.y } : null));
      return;
    }

    if (!isDrawing.current || !newShape) return;

    if (newShape.type === 'pen') {
      setNewShape({
        ...newShape,
        points: [...newShape.points, point.x, point.y],
      });
    } else if (newShape.type === 'rect') {
      const width = point.x - newShape.x;
      const height = point.y - newShape.y;
      setNewShape({
        ...newShape,
        width,
        height,
      });
    } else if (newShape.type === 'circle') {
      const rx = Math.abs(point.x - newShape.x);
      const ry = Math.abs(point.y - newShape.y);
      setNewShape({
        ...newShape,
        radiusX: Math.max(2, rx),
        radiusY: Math.max(2, ry),
      });
    } else if (newShape.type === 'arrow' || newShape.type === 'line') {
      setNewShape({
        ...newShape,
        points: [newShape.points[0], newShape.points[1], point.x, point.y],
      });
    }
  };

  // Mouse Up / Touch End
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Process selection box
    if (selectionBox) {
      const x1 = Math.min(selectionBox.x1, selectionBox.x2);
      const y1 = Math.min(selectionBox.y1, selectionBox.y2);
      const x2 = Math.max(selectionBox.x1, selectionBox.x2);
      const y2 = Math.max(selectionBox.y1, selectionBox.y2);

      const matchedIds: string[] = [];
      elements.forEach((el) => {
        if (el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2) {
          matchedIds.push(el.id);
        }
      });

      setSelectedIds(matchedIds);
      setSelectionBox(null);
      return;
    }

    if (!isDrawing.current || !newShape) return;
    isDrawing.current = false;

    // Normalize rect with negative width/height
    let finalShape = newShape;
    if (finalShape.type === 'rect') {
      let x = finalShape.x;
      let y = finalShape.y;
      let w = finalShape.width;
      let h = finalShape.height;

      if (w < 0) {
        x += w;
        w = Math.abs(w);
      }
      if (h < 0) {
        y += h;
        h = Math.abs(h);
      }

      if (w < 4 && h < 4) {
        setNewShape(null);
        return;
      }

      finalShape = {
        ...finalShape,
        x,
        y,
        width: w,
        height: h,
      };
    } else if (finalShape.type === 'pen' && finalShape.points.length < 4) {
      setNewShape(null);
      return;
    }

    onSetElement(finalShape);
    setSelectedIds([finalShape.id]);
    setNewShape(null);
    onSetTool('select');
  };

  // Element selection handler
  const handleSelectElement = (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (currentTool === 'eraser') {
      onDeleteElement(id);
      return;
    }

    if (currentTool !== 'select') return;

    const isShiftOrMeta = e.evt.shiftKey || (e.evt as MouseEvent).metaKey || (e.evt as MouseEvent).ctrlKey;

    if (isShiftOrMeta) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  // Element attribute update (drag/transform)
  const handleElementChange = (id: string, newAttrs: Partial<CanvasElement>) => {
    const existing = elements.find((el) => el.id === id);
    if (!existing) return;

    onSetElement({
      ...existing,
      ...newAttrs,
      updatedAt: Date.now(),
    } as CanvasElement);
  };

  // Inline editing initiation
  const handleStartEditing = (id: string, box: any) => {
    const el = elements.find((item) => item.id === id);
    if (!el) return;

    if (el.type === 'sticky') {
      setEditingItem({
        id: el.id,
        type: 'sticky',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: el.text,
        fontSize: el.fontSize,
        color: el.color,
      });
    } else if (el.type === 'text') {
      setEditingItem({
        id: el.id,
        type: 'text',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: el.text,
        fontSize: el.fontSize,
        fill: el.fill,
      });
    }
  };

  const commitInlineEdit = () => {
    if (!editingItem) return;

    const existing = elements.find((item) => item.id === editingItem.id);
    if (existing) {
      if (existing.type === 'sticky') {
        onSetElement({
          ...existing,
          text: editingItem.text,
        });
      } else if (existing.type === 'text') {
        onSetElement({
          ...existing,
          text: editingItem.text || 'Text',
        });
      }
    }
    setEditingItem(null);
  };

  // Drag & Drop image onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    stage.setPointersPositions(e);
    const point = getCanvasPoint(stage);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result as string;
        const img = new window.Image();
        img.src = src;
        img.onload = () => {
          const maxDim = 320;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = width * ratio;
            height = height * ratio;
          }

          const newImageEl: CanvasElement = {
            id: crypto.randomUUID(),
            type: 'image',
            src,
            x: point.x - width / 2,
            y: point.y - height / 2,
            width,
            height,
            zIndex: getNextZIndex(),
            updatedAt: Date.now(),
          };

          onSetElement(newImageEl);
          setSelectedIds([newImageEl.id]);
          onSetTool('select');
        };
      };
      reader.readAsDataURL(file);
    });
  };

  // Clipboard paste image / text
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const src = event.target?.result as string;
            const stage = stageRef.current;
            const stageX = stage ? (-stage.x() + stage.width() / 2) / stage.scaleX() : 200;
            const stageY = stage ? (-stage.y() + stage.height() / 2) / stage.scaleY() : 200;

            const img = new window.Image();
            img.src = src;
            img.onload = () => {
              const maxDim = 300;
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

              onSetElement(newEl);
              setSelectedIds([newEl.id]);
            };
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [stageRef, getNextZIndex, onSetElement, setSelectedIds]);

  // Cursor style
  let cursorStyle = 'default';
  if (isSpacePressed || currentTool === 'pan') {
    cursorStyle = isPanning ? 'grabbing' : 'grab';
  } else if (currentTool === 'pen') {
    cursorStyle = 'crosshair';
  } else if (['rect', 'circle', 'arrow', 'line'].includes(currentTool)) {
    cursorStyle = 'crosshair';
  } else if (currentTool === 'sticky' || currentTool === 'text') {
    cursorStyle = 'text';
  } else if (currentTool === 'eraser') {
    cursorStyle = 'cell';
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-slate-950"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer ref={layerRef}>
          {/* Background Grid */}
          <GridBackground
            width={stageSize.width}
            height={stageSize.height}
            scale={stageScale}
            stageX={stagePos.x}
            stageY={stagePos.y}
            gridType={gridType}
          />

          {/* Render All Yjs Canvas Elements */}
          {elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              onSelect={handleSelectElement}
              onChange={handleElementChange}
              onStartEditing={handleStartEditing}
              isEditing={editingItem?.id === el.id}
            />
          ))}

          {/* Active drawing shape preview */}
          {newShape && (
            <>
              {newShape.type === 'pen' && (
                <KonvaLine
                  points={newShape.points}
                  stroke={newShape.color}
                  strokeWidth={newShape.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              {newShape.type === 'rect' && (
                <KonvaRect
                  x={newShape.x}
                  y={newShape.y}
                  width={newShape.width}
                  height={newShape.height}
                  fill={newShape.fill}
                  stroke={newShape.stroke}
                  strokeWidth={newShape.strokeWidth}
                  cornerRadius={4}
                />
              )}
              {newShape.type === 'circle' && (
                <KonvaCircle
                  x={newShape.x}
                  y={newShape.y}
                  radiusX={newShape.radiusX}
                  radiusY={newShape.radiusY}
                  fill={newShape.fill}
                  stroke={newShape.stroke}
                  strokeWidth={newShape.strokeWidth}
                />
              )}
              {newShape.type === 'arrow' && (
                <KonvaArrow
                  points={newShape.points}
                  stroke={newShape.color}
                  fill={newShape.color}
                  strokeWidth={newShape.strokeWidth}
                  pointerLength={10}
                  pointerWidth={10}
                />
              )}
              {newShape.type === 'line' && (
                <KonvaLine
                  points={newShape.points}
                  stroke={newShape.color}
                  strokeWidth={newShape.strokeWidth}
                  lineCap="round"
                />
              )}
            </>
          )}

          {/* Drag Selection Box */}
          {selectionBox && (
            <KonvaRect
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(99, 102, 241, 0.15)"
              stroke="#6366f1"
              strokeWidth={1 / stageScale}
              dash={[4 / stageScale, 4 / stageScale]}
            />
          )}

          {/* Konva Transformer */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
                return oldBox;
              }
              return newBox;
            }}
            rotateEnabled={true}
            enabledAnchors={[
              'top-left',
              'top-center',
              'top-right',
              'middle-right',
              'middle-left',
              'bottom-left',
              'bottom-center',
              'bottom-right',
            ]}
            anchorSize={9}
            anchorCornerRadius={3}
            anchorStroke="#6366f1"
            anchorFill="#ffffff"
            borderStroke="#6366f1"
            borderDash={[4, 4]}
          />
        </Layer>
      </Stage>

      {/* Floating HTML Overlay for Double-Click Inline Text Editing */}
      {editingItem && (
        <div
          className="absolute z-40 pointer-events-auto"
          style={{
            left: `${editingItem.x}px`,
            top: `${editingItem.y}px`,
            width: `${editingItem.width}px`,
            height: `${editingItem.height}px`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={editingItem.text}
            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                commitInlineEdit();
              }
              // For Text element, Enter commits unless Shift+Enter
              if (editingItem.type === 'text' && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitInlineEdit();
              }
            }}
            onBlur={commitInlineEdit}
            className={`w-full h-full resize-none outline-none border-2 border-indigo-500 rounded p-2 bg-transparent leading-relaxed ${
              editingItem.type === 'sticky'
                ? "font-['Caveat'] font-semibold text-slate-900"
                : 'font-sans font-medium text-slate-100'
            }`}
            style={{
              fontSize: `${Math.max(12, editingItem.fontSize)}px`,
              color: editingItem.type === 'sticky' ? '#0f172a' : editingItem.fill || '#f8fafc',
            }}
          />
        </div>
      )}
    </div>
  );
};
