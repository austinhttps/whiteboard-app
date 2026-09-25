import React from 'react';
import { Group, Circle, Line, Rect } from 'react-konva';
import { GridType, ThemeMode } from '../../types/whiteboard';

interface GridBackgroundProps {
  width: number;
  height: number;
  scale: number;
  stageX: number;
  stageY: number;
  gridType: GridType;
  theme?: ThemeMode;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({
  width,
  height,
  scale,
  stageX,
  stageY,
  gridType,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#090d16' : '#f8fafc';
  const dotColor = isDark ? '#334155' : '#94a3b8';
  const lineColor = isDark ? '#1e293b' : '#e2e8f0';

  if (gridType === 'none') {
    return (
      <Rect
        x={-stageX / scale}
        y={-stageY / scale}
        width={width / scale}
        height={height / scale}
        fill={bgColor}
        listening={false}
      />
    );
  }

  const gridSize = 40;
  const startX = Math.floor((-stageX / scale) / gridSize) * gridSize - gridSize;
  const startY = Math.floor((-stageY / scale) / gridSize) * gridSize - gridSize;
  const endX = startX + (width / scale) + gridSize * 2;
  const endY = startY + (height / scale) + gridSize * 2;

  // Background rect
  const bgRect = (
    <Rect
      x={-stageX / scale}
      y={-stageY / scale}
      width={width / scale}
      height={height / scale}
      fill={bgColor}
      listening={false}
    />
  );

  if (gridType === 'dots') {
    const dots: React.ReactNode[] = [];
    const dotRadius = Math.max(1, 1.5 / Math.sqrt(scale));

    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        dots.push(
          <Circle
            key={`dot-${x}-${y}`}
            x={x}
            y={y}
            radius={dotRadius}
            fill={dotColor}
            opacity={isDark ? 0.6 : 0.45}
            listening={false}
          />
        );
      }
    }

    return (
      <Group listening={false}>
        {bgRect}
        {dots}
      </Group>
    );
  }

  // Grid lines
  const lines: React.ReactNode[] = [];
  for (let x = startX; x <= endX; x += gridSize) {
    lines.push(
      <Line
        key={`vline-${x}`}
        points={[x, startY, x, endY]}
        stroke={lineColor}
        strokeWidth={1 / scale}
        opacity={isDark ? 0.7 : 0.6}
        listening={false}
      />
    );
  }

  for (let y = startY; y <= endY; y += gridSize) {
    lines.push(
      <Line
        key={`hline-${y}`}
        points={[startX, y, endX, y]}
        stroke={lineColor}
        strokeWidth={1 / scale}
        opacity={isDark ? 0.7 : 0.6}
        listening={false}
      />
    );
  }

  return (
    <Group listening={false}>
      {bgRect}
      {lines}
    </Group>
  );
};
