import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Transformer, Rect as KonvaRect, Line as KonvaLine, Circle as KonvaCircle, Arrow as KonvaArrow } from 'react-konva';
import Konva from 'konva';
import { CanvasElement, ToolType, ToolProperties, GridType, StickyColor, Collaborator, ThemeMode, ConnectorPoint, CommentThread } from '../../types/whiteboard';
import { ElementRenderer } from './ElementRenderer';
import { GridBackground } from './GridBackground';
import { PeerCursors } from './PeerCursors';
import { ConnectorAnchors } from './ConnectorAnchors';
import { ObjectOverlayBadges } from './ObjectOverlayBadges';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { exportStageToPNG } from '../../utils/exportUtils';
import {
  getAllConnectorPoints,
  findNearestConnectorPoint,
  updateAttachedConnectors,
} from '../../utils/connectorUtils';

interface WhiteboardProps {
  elements: CanvasElement[];
  comments: CommentThread[];
  localUser: { name: string; color: string; id: string };
  currentTool: ToolType;
  toolProperties: ToolProperties;
  gridType: GridType;
  theme: ThemeMode;
  onSetTool: (tool: ToolType) => void;
  onSetElement: (element: CanvasElement) => void;
  onSetBatchElements: (elements: CanvasElement[]) => void;
  onDeleteElement: (id: string) => void;
  onDeleteElements: (ids: string[]) => void;
  getNextZIndex: () => number;
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  onUploadImagePrompt: () => void;
  clipboard: CanvasElement[];
  onCopyElements: () => void;
  onCutElements: () => void;
  onPasteElements: (point?: { x: number; y: number }) => void;
  collaborators: Collaborator[];
  onUpdateCursor: (pos: { x: number; y: number } | null) => void;
  onToggleReaction: (elementId: string, emoji: string) => void;
  onOpenEmojiPicker: (elementId: string, position: { x: number; y: number }) => void;
  onOpenComments: (elementId: string) => void;
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

function getElementBounds(el: CanvasElement): { minX: number; minY: number; maxX: number; maxY: number } {
  if (el.type === 'rect' || el.type === 'sticky' || el.type === 'image') {
    const width = el.width || 120;
    const height = el.height || 80;
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + width,
      maxY: el.y + height,
    };
  }
  if (el.type === 'circle') {
    const rx = el.radiusX || 30;
    const ry = el.radiusY || 30;
    return {
      minX: el.x - rx,
      minY: el.y - ry,
      maxX: el.x + rx,
      maxY: el.y + ry,
    };
  }
  if (el.type === 'text') {
    const fontSize = el.fontSize || 20;
    const textLen = Math.max((el.text || '').length, 1);
    const width = Math.max(textLen * fontSize * 0.6, 60);
    const height = fontSize * 1.4;
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + width,
      maxY: el.y + height,
    };
  }
  if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
    const pts = el.points || [];
    if (pts.length === 0) return { minX: el.x, minY: el.y, maxX: el.x + 10, maxY: el.y + 10 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i] + (el.x || 0);
      const py = pts[i + 1] + (el.y || 0);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return { minX, minY, maxX, maxY };
  }
  return { minX: (el as any).x || 0, minY: (el as any).y || 0, maxX: ((el as any).x || 0) + 50, maxY: ((el as any).y || 0) + 50 };
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  elements,
  comments,
  localUser,
  currentTool,
  toolProperties,
  gridType,
  theme,
  onSetTool,
  onSetElement,
  onSetBatchElements,
  onDeleteElement,
  onDeleteElements,
  getNextZIndex,
  stageRef,
  selectedIds,
  setSelectedIds,
  onUploadImagePrompt,
  clipboard,
  onCopyElements,
  onCutElements,
  onPasteElements,
  collaborators,
  onUpdateCursor,
  onToggleReaction,
  onOpenEmojiPicker,
  onOpenComments,
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

  // Active connector snap target
  const [activeSnapAnchor, setActiveSnapAnchor] = useState<ConnectorPoint | null>(null);

  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Inline editing overlay
  const [editingItem, setEditingItem] = useState<InlineEditingState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasPoint: { x: number; y: number };
    targetElement: CanvasElement | null;
  } | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Calculate connector anchors
  const allConnectorAnchors = useMemo(() => {
    return getAllConnectorPoints(elements);
  }, [elements]);

  const showConnectorAnchors =
    currentTool === 'arrow' || currentTool === 'line' || isDrawing.current;

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
      // Don't trigger if user is typing in textarea, input, or inline editing
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || editingItem) {
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
        setContextMenu(null);
        onSetTool('select');
      }

      // Select all (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
        onSetTool('select');
      }

      // Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        onCopyElements();
      }

      // Cut (Ctrl+X / Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedIds.length > 0) {
        e.preventDefault();
        onCutElements();
      }

      // Layer ordering shortcuts: [ and ]
      if (e.key === ']' && selectedIds.length > 0) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleBringToFront();
        } else {
          handleBringForward();
        }
      }
      if (e.key === '[' && selectedIds.length > 0) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleSendToBack();
        } else {
          handleSendBackward();
        }
      }

      // Duplicate (Ctrl+D / Cmd+D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        handleDuplicate();
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
  });

  // Focus and select textarea only once when starting to edit a new item
  const prevEditingId = useRef<string | null>(null);
  useEffect(() => {
    if (editingItem && editingItem.id !== prevEditingId.current && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      prevEditingId.current = editingItem.id;
    } else if (!editingItem) {
      prevEditingId.current = null;
    }
  }, [editingItem?.id]);

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

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement> | Konva.KonvaEventObject<PointerEvent>) => {
    if ('evt' in e) {
      e.evt.preventDefault();
    } else {
      e.preventDefault();
    }

    const stage = stageRef.current;
    if (!stage) return;

    const point = getCanvasPoint(stage);

    let clientX = 0;
    let clientY = 0;

    if ('evt' in e) {
      clientX = (e.evt as MouseEvent).clientX;
      clientY = (e.evt as MouseEvent).clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Check if right-clicked on an existing canvas node
    let targetEl: CanvasElement | null = null;
    const targetNode = 'target' in e ? (e.target as any) : null;
    if (targetNode && typeof targetNode.id === 'function' && targetNode !== stage && targetNode.name?.() !== 'background-rect') {
      const id = targetNode.id();
      if (id) {
        targetEl = elements.find((el) => el.id === id) || null;
        if (targetEl && !selectedIds.includes(targetEl.id)) {
          setSelectedIds([targetEl.id]);
        }
      }
    }

    // If already has selection and right-clicked on empty space, keep selection target
    if (!targetEl && selectedIds.length > 0) {
      targetEl = elements.find((el) => el.id === selectedIds[0]) || null;
    }

    setContextMenu({
      x: clientX,
      y: clientY,
      canvasPoint: point,
      targetElement: targetEl,
    });
  };

  // Mouse Down / Touch Start
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // If right click, let context menu handle it
    if ((e.evt as MouseEvent).button === 2) {
      return;
    }

    // Close open context menu on left click
    if (contextMenu) {
      setContextMenu(null);
    }

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
        x: point.x - 85,
        y: point.y - 85,
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

    // Check if starting arrow/line on a connector anchor
    const snapStart = findNearestConnectorPoint(point, elements);
    const startX = snapStart ? snapStart.x : point.x;
    const startY = snapStart ? snapStart.y : point.y;

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
        points: [startX, startY, startX, startY],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        startBinding: snapStart ? { elementId: snapStart.elementId, anchor: snapStart.anchor } : undefined,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'line') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'line',
        points: [startX, startY, startX, startY],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        startBinding: snapStart ? { elementId: snapStart.elementId, anchor: snapStart.anchor } : undefined,
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

    const point = getCanvasPoint(stage);

    // Broadcast cursor position to collaborators
    onUpdateCursor(point);

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

    // Check connector snap when drawing arrow/line
    if (isDrawing.current && newShape && (newShape.type === 'arrow' || newShape.type === 'line')) {
      const snap = findNearestConnectorPoint(point, elements);
      setActiveSnapAnchor(snap);

      const targetX = snap ? snap.x : point.x;
      const targetY = snap ? snap.y : point.y;

      setNewShape({
        ...newShape,
        points: [newShape.points[0], newShape.points[1], targetX, targetY],
        endBinding: snap ? { elementId: snap.elementId, anchor: snap.anchor } : undefined,
      });
      return;
    }

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
    }
  };

  // Mouse Up / Touch End
  const handleMouseUp = () => {
    setActiveSnapAnchor(null);

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

      // Only perform box selection if box was actually dragged
      if (Math.abs(x2 - x1) > 3 || Math.abs(y2 - y1) > 3) {
        const matchedIds: string[] = [];
        elements.forEach((el) => {
          const bounds = getElementBounds(el);
          const hasOverlap = !(
            bounds.maxX < x1 ||
            bounds.minX > x2 ||
            bounds.maxY < y1 ||
            bounds.minY > y2
          );
          if (hasOverlap) {
            matchedIds.push(el.id);
          }
        });

        setSelectedIds(matchedIds);
      }
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
      // If the clicked item is already part of the selected set, preserve the group selection
      setSelectedIds((prev) => (prev.includes(id) && prev.length > 1 ? prev : [id]));
    }
  };

  // Element attribute update (drag/transform) + connector auto-updates!
  const handleElementChange = (id: string, newAttrs: Partial<CanvasElement>) => {
    const existing = elements.find((el) => el.id === id);
    if (!existing) return;

    const updated = {
      ...existing,
      ...newAttrs,
      updatedAt: Date.now(),
    } as CanvasElement;

    onSetElement(updated);

    // Update any connected arrows / lines
    const attachedUpdated = updateAttachedConnectors(updated, elements);
    if (attachedUpdated.length > 0) {
      onSetBatchElements(attachedUpdated);
    }
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

  // Selected Elements actions for Context Menu
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

  const handleDuplicate = () => {
    const targetList = selectedElements.length > 0 ? selectedElements : (contextMenu?.targetElement ? [contextMenu.targetElement] : []);
    const duplicates: CanvasElement[] = [];
    const newIds: string[] = [];

    targetList.forEach((el) => {
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

    duplicates.forEach((dup) => onSetElement(dup));
    setSelectedIds(newIds);
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      onDeleteElements(selectedIds);
      setSelectedIds([]);
    } else if (contextMenu?.targetElement) {
      onDeleteElement(contextMenu.targetElement.id);
    }
  };

  const handleBringToFront = () => {
    const maxZ = Math.max(...elements.map((el) => el.zIndex ?? 0), 0);
    selectedElements.forEach((el, index) => {
      onSetElement({
        ...el,
        zIndex: maxZ + 1 + index,
        updatedAt: Date.now(),
      });
    });
  };

  const handleSendToBack = () => {
    const minZ = Math.min(...elements.map((el) => el.zIndex ?? 0), 0);
    selectedElements.forEach((el, index) => {
      onSetElement({
        ...el,
        zIndex: minZ - 1 - (selectedElements.length - index),
        updatedAt: Date.now(),
      });
    });
  };

  const handleBringForward = () => {
    selectedElements.forEach((el) => {
      onSetElement({
        ...el,
        zIndex: (el.zIndex ?? 0) + 1,
        updatedAt: Date.now(),
      });
    });
  };

  const handleSendBackward = () => {
    selectedElements.forEach((el) => {
      onSetElement({
        ...el,
        zIndex: Math.max(0, (el.zIndex ?? 0) - 1),
        updatedAt: Date.now(),
      });
    });
  };

  const handleQuickAddSticky = (point: { x: number; y: number }, color: StickyColor = 'yellow') => {
    const newSticky: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'sticky',
      x: point.x - 85,
      y: point.y - 85,
      width: 170,
      height: 170,
      text: 'New Note',
      color,
      fontSize: 18,
      zIndex: getNextZIndex(),
      updatedAt: Date.now(),
    };
    onSetElement(newSticky);
    setSelectedIds([newSticky.id]);
    onSetTool('select');
  };

  const handleQuickAddText = (point: { x: number; y: number }) => {
    const newText: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: point.x,
      y: point.y,
      text: 'Type text here...',
      fontSize: toolProperties.fontSize || 22,
      fontFamily: 'Inter, sans-serif',
      fill: toolProperties.strokeColor || '#f8fafc',
      zIndex: getNextZIndex(),
      updatedAt: Date.now(),
    };
    onSetElement(newText);
    setSelectedIds([newText.id]);
    onSetTool('select');
  };

  const handleQuickAddShape = (type: 'rect' | 'circle' | 'arrow' | 'line', point: { x: number; y: number }) => {
    const nextZ = getNextZIndex();
    let newEl: CanvasElement;

    if (type === 'rect') {
      newEl = {
        id: crypto.randomUUID(),
        type: 'rect',
        x: point.x - 70,
        y: point.y - 50,
        width: 140,
        height: 100,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        cornerRadius: 6,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    } else if (type === 'circle') {
      newEl = {
        id: crypto.randomUUID(),
        type: 'circle',
        x: point.x,
        y: point.y,
        radiusX: 60,
        radiusY: 60,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    } else if (type === 'arrow') {
      newEl = {
        id: crypto.randomUUID(),
        type: 'arrow',
        points: [point.x - 60, point.y - 40, point.x + 60, point.y + 40],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    } else {
      newEl = {
        id: crypto.randomUUID(),
        type: 'line',
        points: [point.x - 60, point.y, point.x + 60, point.y],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    }

    onSetElement(newEl);
    setSelectedIds([newEl.id]);
    onSetTool('select');
  };

  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  const handleExportCurrentViewport = () => {
    if (stageRef.current) {
      exportStageToPNG(stageRef.current, {
        pixelRatio: 2,
        scope: 'viewport',
        fileName: `whiteboard-viewport-${Date.now()}.png`,
      });
    }
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

  const isDark = theme === 'dark';

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${
        isDark ? 'bg-slate-950' : 'bg-slate-50'
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onMouseLeave={() => onUpdateCursor(null)}
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
        onContextMenu={handleContextMenu}
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
            theme={theme}
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

          {/* Magnetic Shape Connection Points */}
          <ConnectorAnchors
            anchors={allConnectorAnchors}
            activeAnchor={activeSnapAnchor}
            visible={showConnectorAnchors}
          />

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

          {/* Real-Time Collaborator Cursors */}
          <PeerCursors collaborators={collaborators} />

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

      {/* Floating Badges for Object Reactions & Comment Counts */}
      <ObjectOverlayBadges
        elements={elements}
        comments={comments}
        stagePos={stagePos}
        stageScale={stageScale}
        theme={theme}
        localUserId={localUser.id}
        selectedIds={selectedIds}
        onToggleReaction={onToggleReaction}
        onOpenEmojiPicker={onOpenEmojiPicker}
        onOpenComments={onOpenComments}
      />

      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canvasPoint={contextMenu.canvasPoint}
          targetElement={contextMenu.targetElement}
          selectedElements={selectedElements}
          onClose={() => setContextMenu(null)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onEditItem={() => {
            if (contextMenu.targetElement) {
              const el = contextMenu.targetElement;
              handleStartEditing(el.id, {
                x: el.x * stageScale + stagePos.x,
                y: el.y * stageScale + stagePos.y,
                width: ((el as any).width || 120) * stageScale,
                height: ((el as any).height || 60) * stageScale,
                text: (el as any).text || '',
                fontSize: ((el as any).fontSize || 18) * stageScale,
                color: (el as any).color,
                fill: (el as any).fill,
              });
            }
          }}
          onChangeColor={(col) => {
            if (contextMenu.targetElement && contextMenu.targetElement.type === 'sticky') {
              onSetElement({
                ...contextMenu.targetElement,
                color: col as StickyColor,
                updatedAt: Date.now(),
              });
            }
          }}
          onAddSticky={handleQuickAddSticky}
          onAddText={handleQuickAddText}
          onAddShape={handleQuickAddShape}
          onSelectAll={() => {
            setSelectedIds(elements.map((el) => el.id));
            onSetTool('select');
          }}
          onResetZoom={handleResetZoom}
          onExportViewport={handleExportCurrentViewport}
          onUploadImage={onUploadImagePrompt}
          onCopy={onCopyElements}
          onCut={onCutElements}
          onPaste={onPasteElements}
          hasClipboard={clipboard.length > 0}
          onToggleReaction={onToggleReaction}
          onOpenComments={onOpenComments}
        />
      )}

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
              if (editingItem.type === 'text' && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitInlineEdit();
              }
            }}
            onBlur={commitInlineEdit}
            className={`w-full h-full resize-none outline-none border-2 border-indigo-500 rounded p-2 bg-transparent leading-relaxed ${
              editingItem.type === 'sticky'
                ? "font-['Caveat'] font-semibold text-slate-900"
                : isDark ? 'font-sans font-medium text-slate-100' : 'font-sans font-medium text-slate-900'
            }`}
            style={{
              fontSize: `${Math.max(12, editingItem.fontSize)}px`,
              color: editingItem.type === 'sticky' ? '#0f172a' : editingItem.fill || (isDark ? '#f8fafc' : '#0f172a'),
            }}
          />
        </div>
      )}
    </div>
  );
};
