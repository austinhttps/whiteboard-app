import Konva from 'konva';
import { jsPDF } from 'jspdf';
import { CanvasElement } from '../types/whiteboard';

export interface ExportOptions {
  pixelRatio?: number;
  fileName?: string;
  scope?: 'viewport' | 'all' | 'selection';
  selectedIds?: string[];
  background?: string;
}

/**
 * Calculate bounding rectangle for stage export
 */
function getExportRect(stage: Konva.Stage, scope: 'viewport' | 'all' | 'selection', selectedIds: string[]) {
  if (scope === 'viewport') {
    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const scale = stage.scaleX();
    const x = -stage.x() / scale;
    const y = -stage.y() / scale;

    return {
      x: x * scale + stage.x(),
      y: y * scale + stage.y(),
      width: stageWidth,
      height: stageHeight,
    };
  }

  if (scope === 'selection' && selectedIds.length > 0) {
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

        const padding = 24;
        return {
          x: minX - padding,
          y: minY - padding,
          width: (maxX - minX) + padding * 2,
          height: (maxY - minY) + padding * 2,
        };
      }
    }
  }

  return null;
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

  const exportRect = getExportRect(stage, scope, selectedIds);

  const dataURL = stage.toDataURL({
    pixelRatio,
    mimeType: 'image/png',
    ...(exportRect ? exportRect : {}),
  });

  triggerDownload(dataURL, fileName);
}

/**
 * Export Konva Stage to High-Quality JPG / JPEG
 */
export function exportStageToJPG(stage: Konva.Stage, options: ExportOptions = {}) {
  const {
    pixelRatio = 2,
    fileName = `whiteboard-${Date.now()}.jpg`,
    scope = 'all',
    selectedIds = [],
  } = options;

  const exportRect = getExportRect(stage, scope, selectedIds);

  const dataURL = stage.toDataURL({
    pixelRatio,
    mimeType: 'image/jpeg',
    quality: 0.95,
    ...(exportRect ? exportRect : {}),
  });

  triggerDownload(dataURL, fileName);
}

/**
 * Export Whiteboard to PDF Document
 */
export function exportStageToPDF(stage: Konva.Stage, options: { fileName?: string; title?: string; theme?: 'dark' | 'light' } = {}) {
  const { fileName = `whiteboard-${Date.now()}.pdf`, theme: _theme = 'dark' } = options;

  const dataURL = stage.toDataURL({
    pixelRatio: 2,
    mimeType: 'image/jpeg',
    quality: 0.92,
  });

  const stageWidth = stage.width();
  const stageHeight = stage.height();
  const orientation = stageWidth >= stageHeight ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [stageWidth, stageHeight],
  });

  pdf.addImage(dataURL, 'JPEG', 0, 0, stageWidth, stageHeight);
  pdf.save(fileName);
}

/**
 * Export Whiteboard elements to standalone Scalable Vector Graphics (SVG)
 * Compatible with Google Docs/Slides/Drawings & Microsoft Office (Word/PowerPoint/Excel)
 */
export function exportElementsToSVG(
  elements: CanvasElement[],
  options: { fileName?: string; width?: number; height?: number; theme?: 'dark' | 'light' } = {}
) {
  const {
    fileName = `whiteboard-${Date.now()}.svg`,
    width = 1920,
    height = 1080,
    theme = 'dark',
  } = options;

  const bgColor = theme === 'dark' ? '#0f172a' : '#f8fafc';

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  svgContent += `  <rect width="100%" height="100%" fill="${bgColor}" />\n`;

  // Sort elements by zIndex
  const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  sorted.forEach((el) => {
    if (el.type === 'pen') {
      const pts = el.points;
      if (pts.length >= 4) {
        let pathData = `M ${pts[0]} ${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) {
          pathData += ` L ${pts[i]} ${pts[i + 1]}`;
        }
        svgContent += `  <path d="${pathData}" stroke="${el.color}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />\n`;
      }
    } else if (el.type === 'rect') {
      svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" rx="${el.cornerRadius || 4}" />\n`;
    } else if (el.type === 'circle') {
      svgContent += `  <ellipse cx="${el.x}" cy="${el.y}" rx="${el.radiusX}" ry="${el.radiusY}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" />\n`;
    } else if (el.type === 'arrow' || el.type === 'line') {
      const [x1, y1, x2, y2] = el.points;
      svgContent += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${el.color}" stroke-width="${el.strokeWidth}" stroke-linecap="round" />\n`;
    } else if (el.type === 'sticky') {
      const stickyColors: Record<string, string> = {
        yellow: '#fef08a',
        pink: '#fbcfe8',
        blue: '#bae6fd',
        green: '#bbf7d0',
        purple: '#e9d5ff',
        orange: '#fed7aa',
      };
      const bg = stickyColors[el.color] || '#fef08a';
      svgContent += `  <g transform="translate(${el.x}, ${el.y})">\n`;
      svgContent += `    <rect width="${el.width}" height="${el.height}" fill="${bg}" rx="8" filter="drop-shadow(0px 4px 8px rgba(0,0,0,0.2))" />\n`;
      svgContent += `    <text x="12" y="30" font-family="sans-serif" font-size="${el.fontSize || 16}" fill="#1e293b">${escapeXml(el.text || '')}</text>\n`;
      svgContent += `  </g>\n`;
    } else if (el.type === 'text') {
      svgContent += `  <text x="${el.x}" y="${el.y + (el.fontSize || 20)}" font-family="sans-serif" font-size="${el.fontSize || 20}" fill="${el.fill}">${escapeXml(el.text || '')}</text>\n`;
    }
  });

  svgContent += `</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = url;
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
  triggerDownload(url, `board-${boardId.slice(0, 8)}-${Date.now()}.json`);
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
