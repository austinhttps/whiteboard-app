import React from 'react';
import { Group, Circle } from 'react-konva';
import { ConnectorPoint } from '../../types/whiteboard';

interface ConnectorAnchorsProps {
  anchors: ConnectorPoint[];
  activeAnchor: ConnectorPoint | null;
  visible: boolean;
}

export const ConnectorAnchors: React.FC<ConnectorAnchorsProps> = ({
  anchors,
  activeAnchor,
  visible,
}) => {
  if (!visible || anchors.length === 0) return null;

  return (
    <Group listening={false}>
      {anchors.map((anchor, index) => {
        const isTargeted =
          activeAnchor &&
          activeAnchor.elementId === anchor.elementId &&
          activeAnchor.anchor === anchor.anchor;

        return (
          <Group key={`anchor-${anchor.elementId}-${anchor.anchor}-${index}`} x={anchor.x} y={anchor.y} listening={false}>
            {/* Outer Magnetic Pulse Ring if Targeted */}
            {isTargeted && (
              <Circle
                radius={12}
                fill="rgba(99, 102, 241, 0.35)"
                stroke="#818cf8"
                strokeWidth={1.5}
              />
            )}

            {/* Inner Connection Dot */}
            <Circle
              radius={isTargeted ? 6 : 4}
              fill={isTargeted ? '#6366f1' : '#38bdf8'}
              stroke="#ffffff"
              strokeWidth={1.5}
              shadowColor="black"
              shadowBlur={4}
              shadowOpacity={0.3}
            />
          </Group>
        );
      })}
    </Group>
  );
};
