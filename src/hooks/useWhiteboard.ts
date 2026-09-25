import { useEffect, useState, useCallback } from 'react';
import { whiteboardService } from '../services/yjsDoc';
import { CanvasElement } from '../types/whiteboard';

export function useWhiteboard() {
  const [boardId, setBoardId] = useState<string>(() => whiteboardService.getOrCreateBoardId());
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  useEffect(() => {
    whiteboardService.initBoard(boardId);

    const unsubscribeLoad = whiteboardService.subscribeLoading((loaded) => {
      setIsLoaded(loaded);
    });

    const unsubscribeElements = whiteboardService.subscribe((updatedElements) => {
      setElements(updatedElements);
      setCanUndo(whiteboardService.canUndo());
      setCanRedo(whiteboardService.canRedo());
    });

    // Listen for browser popstate (back/forward button)
    const handlePopState = () => {
      const newBoardId = whiteboardService.getOrCreateBoardId();
      setBoardId(newBoardId);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubscribeLoad();
      unsubscribeElements();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [boardId]);

  const createNewBoard = useCallback(() => {
    const newId = crypto.randomUUID();
    whiteboardService.updateUrl(newId);
    setBoardId(newId);
  }, []);

  const switchBoard = useCallback((targetId: string) => {
    whiteboardService.updateUrl(targetId);
    setBoardId(targetId);
  }, []);

  const setElement = useCallback((element: CanvasElement) => {
    whiteboardService.setElement(element);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const setBatchElements = useCallback((elementsList: CanvasElement[]) => {
    whiteboardService.setElements(elementsList);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const deleteElement = useCallback((id: string) => {
    whiteboardService.deleteElement(id);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const deleteElements = useCallback((ids: string[]) => {
    whiteboardService.deleteElements(ids);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const clearAll = useCallback(() => {
    whiteboardService.clearAll();
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const undo = useCallback(() => {
    const res = whiteboardService.undo();
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
    return res;
  }, []);

  const redo = useCallback(() => {
    const res = whiteboardService.redo();
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
    return res;
  }, []);

  return {
    boardId,
    elements,
    isLoaded,
    canUndo,
    canRedo,
    createNewBoard,
    switchBoard,
    setElement,
    setBatchElements,
    deleteElement,
    deleteElements,
    clearAll,
    undo,
    redo,
    getNextZIndex: () => whiteboardService.getNextZIndex(),
  };
}
