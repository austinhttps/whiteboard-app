import { CanvasElement, ConnectionAnchor, ConnectorPoint } from '../types/whiteboard';

/**
 * Get the 4 connection anchor points (top, right, bottom, left) for any connectable shape
 */
export function getElementAnchors(element: CanvasElement): ConnectorPoint[] {
  if (element.type === 'rect' || element.type === 'sticky') {
    const width = element.width;
    const height = element.height;
    const cx = element.x + width / 2;
    const cy = element.y + height / 2;

    return [
      { x: cx, y: element.y, anchor: 'top', elementId: element.id },
      { x: element.x + width, y: cy, anchor: 'right', elementId: element.id },
      { x: cx, y: element.y + height, anchor: 'bottom', elementId: element.id },
      { x: element.x, y: cy, anchor: 'left', elementId: element.id },
    ];
  }

  if (element.type === 'circle') {
    const rx = element.radiusX;
    const ry = element.radiusY;

    return [
      { x: element.x, y: element.y - ry, anchor: 'top', elementId: element.id },
      { x: element.x + rx, y: element.y, anchor: 'right', elementId: element.id },
      { x: element.x, y: element.y + ry, anchor: 'bottom', elementId: element.id },
      { x: element.x - rx, y: element.y, anchor: 'left', elementId: element.id },
    ];
  }

  return [];
}

/**
 * Find all connector points across all connectable elements on the board
 */
export function getAllConnectorPoints(elements: CanvasElement[], excludeIds: string[] = []): ConnectorPoint[] {
  const points: ConnectorPoint[] = [];
  elements.forEach((el) => {
    if (!excludeIds.includes(el.id)) {
      points.push(...getElementAnchors(el));
    }
  });
  return points;
}

/**
 * Check if a point is close to any connector anchor (within snap threshold)
 */
export function findNearestConnectorPoint(
  point: { x: number; y: number },
  elements: CanvasElement[],
  excludeIds: string[] = [],
  threshold: number = 24
): ConnectorPoint | null {
  const allAnchors = getAllConnectorPoints(elements, excludeIds);
  let closest: ConnectorPoint | null = null;
  let minDistance = threshold;

  allAnchors.forEach((anchor) => {
    const dist = Math.hypot(anchor.x - point.x, anchor.y - point.y);
    if (dist < minDistance) {
      minDistance = dist;
      closest = anchor;
    }
  });

  return closest;
}

/**
 * Get coordinates of a specific anchor on an element
 */
export function getAnchorPosition(element: CanvasElement, anchor: ConnectionAnchor): { x: number; y: number } | null {
  const anchors = getElementAnchors(element);
  const found = anchors.find((a) => a.anchor === anchor);
  return found ? { x: found.x, y: found.y } : null;
}

/**
 * Re-calculate connected arrows/lines when a shape moves
 */
export function updateAttachedConnectors(
  movedElement: CanvasElement,
  allElements: CanvasElement[]
): CanvasElement[] {
  const updatedElements: CanvasElement[] = [];

  allElements.forEach((el) => {
    if (el.type === 'arrow' || el.type === 'line') {
      let changed = false;
      const points = [...el.points];

      if (el.startBinding && el.startBinding.elementId === movedElement.id) {
        const startPos = getAnchorPosition(movedElement, el.startBinding.anchor);
        if (startPos) {
          points[0] = startPos.x;
          points[1] = startPos.y;
          changed = true;
        }
      }

      if (el.endBinding && el.endBinding.elementId === movedElement.id) {
        const endPos = getAnchorPosition(movedElement, el.endBinding.anchor);
        if (endPos) {
          points[2] = endPos.x;
          points[3] = endPos.y;
          changed = true;
        }
      }

      if (changed) {
        updatedElements.push({
          ...el,
          points,
          updatedAt: Date.now(),
        });
      }
    }
  });

  return updatedElements;
}
