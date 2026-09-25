import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { CanvasElement } from '../types/whiteboard';

/**
 * Manages the Yjs Document, IndexedDB persistence, and multiplayer readiness.
 */
class WhiteboardService {
  private doc: Y.Doc | null = null;
  private indexeddbProvider: IndexeddbPersistence | null = null;
  private elementsMap: Y.Map<CanvasElement> | null = null;
  private undoManager: Y.UndoManager | null = null;
  private currentBoardId: string = '';
  private isLoaded: boolean = false;
  private loadListeners: Set<(isLoaded: boolean) => void> = new Set();
  private changeListeners: Set<(elements: CanvasElement[]) => void> = new Set();

  /**
   * Extract board UUID from current URL or generate a new one.
   */
  public getOrCreateBoardId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    let boardId = urlParams.get('board');

    if (!boardId || boardId.trim() === '') {
      boardId = crypto.randomUUID();
      this.updateUrl(boardId);
    }

    return boardId;
  }

  /**
   * Update the browser URL without reloading the page.
   */
  public updateUrl(boardId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('board', boardId);
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * Initialize or switch to a board document with IndexedDB persistence.
   */
  public initBoard(boardId: string): void {
    if (this.currentBoardId === boardId && this.doc) {
      return;
    }

    // Clean up previous instance
    this.cleanup();

    this.currentBoardId = boardId;
    this.isLoaded = false;
    this.notifyLoadListeners(false);

    // 1. Create Yjs Document
    this.doc = new Y.Doc();

    // 2. Obtain shared map for canvas elements
    this.elementsMap = this.doc.getMap<CanvasElement>('canvas-elements');

    // 3. Connect local persistence with IndexedDB
    const dbName = `whiteboard-board-${boardId}`;
    this.indexeddbProvider = new IndexeddbPersistence(dbName, this.doc);

    // Handle IndexedDB load event
    this.indexeddbProvider.on('synced', () => {
      this.isLoaded = true;
      this.notifyLoadListeners(true);
      this.notifyChangeListeners();
    });

    // 4. Initialize UndoManager scoped to elementsMap
    this.undoManager = new Y.UndoManager(this.elementsMap, {
      trackedOrigins: new Set([null, undefined, 'local']),
    });

    // 5. Subscribe to CRDT state changes
    this.elementsMap.observe(() => {
      this.notifyChangeListeners();
    });

    /*
     * Multiplayer readiness:
     * When ready to enable real-time collaboration across networks,
     * simply attach a provider here, e.g.:
     *
     * import { WebsocketProvider } from 'y-websocket';
     * const wsProvider = new WebsocketProvider('wss://your-yjs-server.com', boardId, this.doc);
     *
     * or:
     * import { WebrtcProvider } from 'y-webrtc';
     * const rtcProvider = new WebrtcProvider(`collab-board-${boardId}`, this.doc);
     */
  }

  /**
   * Clean up document and providers when switching boards or unmounting.
   */
  public cleanup(): void {
    if (this.indexeddbProvider) {
      this.indexeddbProvider.destroy();
      this.indexeddbProvider = null;
    }
    if (this.undoManager) {
      this.undoManager.destroy();
      this.undoManager = null;
    }
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.elementsMap = null;
    this.isLoaded = false;
  }

  /**
   * Get all elements as a sorted array by zIndex and timestamp.
   */
  public getElements(): CanvasElement[] {
    if (!this.elementsMap) return [];
    const elements: CanvasElement[] = [];
    this.elementsMap.forEach((element) => {
      if (element && element.id) {
        elements.push(element);
      }
    });
    return elements.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  /**
   * Set or update an element in the CRDT document.
   */
  public setElement(element: CanvasElement, origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      this.elementsMap!.set(element.id, {
        ...element,
        updatedAt: Date.now(),
      });
    }, origin);
  }

  /**
   * Batch set multiple elements in a single CRDT transaction.
   */
  public setElements(elements: CanvasElement[], origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      elements.forEach((element) => {
        this.elementsMap!.set(element.id, {
          ...element,
          updatedAt: Date.now(),
        });
      });
    }, origin);
  }

  /**
   * Remove an element by ID.
   */
  public deleteElement(id: string, origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      this.elementsMap!.delete(id);
    }, origin);
  }

  /**
   * Delete multiple elements by IDs.
   */
  public deleteElements(ids: string[], origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      ids.forEach((id) => this.elementsMap!.delete(id));
    }, origin);
  }

  /**
   * Clear all elements from board.
   */
  public clearAll(origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      const keys = Array.from(this.elementsMap!.keys());
      keys.forEach((key) => this.elementsMap!.delete(key));
    }, origin);
  }

  /**
   * Undo last operation.
   */
  public undo(): boolean {
    if (this.undoManager && this.undoManager.undoStack.length > 0) {
      this.undoManager.undo();
      return true;
    }
    return false;
  }

  /**
   * Redo previously undone operation.
   */
  public redo(): boolean {
    if (this.undoManager && this.undoManager.redoStack.length > 0) {
      this.undoManager.redo();
      return true;
    }
    return false;
  }

  public canUndo(): boolean {
    return (this.undoManager?.undoStack.length ?? 0) > 0;
  }

  public canRedo(): boolean {
    return (this.undoManager?.redoStack.length ?? 0) > 0;
  }

  /**
   * Get current highest zIndex to layer new elements on top.
   */
  public getNextZIndex(): number {
    const elements = this.getElements();
    if (elements.length === 0) return 1;
    const maxZ = Math.max(...elements.map((el) => el.zIndex ?? 0));
    return maxZ + 1;
  }

  /**
   * Subscribe to element changes.
   */
  public subscribe(listener: (elements: CanvasElement[]) => void): () => void {
    this.changeListeners.add(listener);
    // Send initial state immediately
    listener(this.getElements());
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /**
   * Subscribe to loading/sync state.
   */
  public subscribeLoading(listener: (isLoaded: boolean) => void): () => void {
    this.loadListeners.add(listener);
    listener(this.isLoaded);
    return () => {
      this.loadListeners.delete(listener);
    };
  }

  private notifyChangeListeners(): void {
    const elements = this.getElements();
    this.changeListeners.forEach((listener) => listener(elements));
  }

  private notifyLoadListeners(isLoaded: boolean): void {
    this.loadListeners.forEach((listener) => listener(isLoaded));
  }

  public getBoardId(): string {
    return this.currentBoardId;
  }

  public isReady(): boolean {
    return this.isLoaded;
  }
}

export const whiteboardService = new WhiteboardService();
