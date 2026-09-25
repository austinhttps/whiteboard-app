import Konva from 'konva';
import { CanvasElement } from '../types/whiteboard';

export interface ExportOptions {
  pixelRatio?: number;
  fileName?: string;
  scope?: 'viewport' | 'all' | 'selection';
  selectedIds?: string[];
  background?: string;
}

/**
 * Export Konva Stage to high-resolution PNG
 */
export function exportStageToPNG(stage: Konva.Stage, options: ExportOptions = {}) {
  const {
    pixelRatio = 2,
    fileName = `whiteboard-${Date.now()}.png`,
    scope = 'all',
    selectedIds = [],
  } = options;

  let exportRect: { x: number; y: number; width: number; height: number } | null = null;

  if (scope === 'viewport') {
    // Current visible viewport
    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const scale = stage.scaleX();
    const x = -stage.x() / scale;
    const y = -stage.y() / scale;

    exportRect = {
      x: x * scale + stage.x(),
      y: y * scale + stage.y(),
      width: stageWidth,
      height: stageHeight,
    };
  } else if (scope === 'selection' && selectedIds.length > 0) {
    // Find bounding box of selected elements
    const layers = stage.getLayers();
    const layer = layers[0];
    if (layer) {
      const selectedNodes = layer.find((node: Konva.Node) => selectedIds.includes(node.id()));
      if (selectedNodes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedNodes.forEach((node) => {
          const clientRect = node.getClientRect({ relativeTo: stage });
          minX = Math.min(minX, clientRect.x);
          minY = Math.min(minY, clientRect.y);
          maxX = Math.max(maxX, clientRect.x + clientRect.width);
          maxY = Math.max(maxY, clientRect.y + clientRect.height);
        });

        const padding = 20;
        exportRect = {
          x: minX - padding,
          y: minY - padding,
          width: (maxX - minX) + padding * 2,
          height: (maxY - minY) + padding * 2,
        };
      }
    }
  }

  // Generate data URL
  const dataURL = stage.toDataURL({
    pixelRatio,
    mimeType: 'image/png',
    ...(exportRect ? {
      x: exportRect.x,
      y: exportRect.y,
      width: exportRect.width,
      height: exportRect.height,
    } : {}),
  });

  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export board state as JSON file
 */
export function exportBoardToJson(elements: CanvasElement[], boardId: string) {
  const data = {
    version: '1.0',
    boardId,
    exportedAt: new Date().toISOString(),
    elements,
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `board-${boardId.slice(0, 8)}-${Date.now()}.json`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import board elements from JSON file
 */
export async function importBoardFromJson(file: File): Promise<CanvasElement[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.elements)) {
          resolve(parsed.elements);
        } else if (Array.isArray(parsed)) {
          resolve(parsed);
        } else {
          reject(new Error('Invalid whiteboard JSON format: missing elements array'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
