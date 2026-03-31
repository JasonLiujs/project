import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { GitNexusEdgeNode, GitNexusImpactGraph } from '../../../types/gitnexus';

interface ImpactGraphProps {
  impact: GitNexusImpactGraph;
}

const MAX_NODES_PER_SIDE = 4;

function getColor(impact?: string): string {
  switch (impact) {
    case 'high':
      return '#f87171';
    case 'medium':
      return '#fbbf24';
    case 'low':
      return '#60a5fa';
    default:
      return '#94a3b8';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;
}

function buildNodePositions(
  nodes: GitNexusEdgeNode[],
  x: number,
  nodeWidth: number,
  nodeHeight: number,
  height: number,
  gap: number,
) {
  const visibleNodes = nodes.slice(0, MAX_NODES_PER_SIDE);
  const totalHeight = visibleNodes.length * nodeHeight + Math.max(0, visibleNodes.length - 1) * gap;
  const startY = Math.max(24, (height - totalHeight) / 2);

  return visibleNodes.map((node, index) => ({
    node,
    x,
    y: startY + index * (nodeHeight + gap),
    rightX: x + nodeWidth,
    centerY: startY + index * (nodeHeight + gap) + nodeHeight / 2,
  }));
}

const ImpactGraph: React.FC<ImpactGraphProps> = ({ impact }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const gradientId = useId().replace(/:/g, '-');

  useEffect(() => {
    const element = shellRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setContainerWidth(element.getBoundingClientRect().width);

    return () => {
      observer.disconnect();
    };
  }, []);

  const layout = useMemo(() => {
    const width = Math.max(320, Math.floor(containerWidth || 640) - 24);
    const sidePadding = clamp(Math.round(width * 0.035), 12, 36);
    const nodeWidth = clamp(Math.round(width * 0.245), 126, 220);
    const nodeHeight = width < 430 ? 48 : 54;
    const gap = width < 430 ? 10 : 16;
    const centerX = Math.round((width - nodeWidth) / 2);
    const leftX = sidePadding;
    const rightX = Math.max(centerX + nodeWidth + sidePadding, width - nodeWidth - sidePadding);
    const visibleCount = Math.max(
      impact.inbound.slice(0, MAX_NODES_PER_SIDE).length,
      impact.outbound.slice(0, MAX_NODES_PER_SIDE).length,
      1,
    );
    const height = Math.max(280, visibleCount * nodeHeight + Math.max(0, visibleCount - 1) * gap + 80);
    const centerY = Math.round((height - nodeHeight) / 2 + nodeHeight / 2);
    const bend = clamp(Math.round((rightX - (centerX + nodeWidth)) * 0.45), 36, 90);
    const titleMax = clamp(Math.round(nodeWidth / 9), 12, 26);
    const subtitleMax = clamp(Math.round(nodeWidth / 7), 18, 34);

    return {
      width,
      height,
      leftX,
      rightX,
      centerX,
      centerY,
      nodeWidth,
      nodeHeight,
      gap,
      bend,
      titleMax,
      subtitleMax,
    };
  }, [containerWidth, impact.inbound, impact.outbound]);

  const inboundPositions = useMemo(
    () => buildNodePositions(
      impact.inbound,
      layout.leftX,
      layout.nodeWidth,
      layout.nodeHeight,
      layout.height,
      layout.gap,
    ),
    [impact.inbound, layout],
  );

  const outboundPositions = useMemo(
    () => buildNodePositions(
      impact.outbound,
      layout.rightX,
      layout.nodeWidth,
      layout.nodeHeight,
      layout.height,
      layout.gap,
    ),
    [impact.outbound, layout],
  );

  return (
    <div ref={shellRef} className="impact-graph-shell">
      <div className="impact-graph-caption">
        <span>上游依赖</span>
        <span>当前修改目标</span>
        <span>下游影响</span>
      </div>

      <svg
        className="impact-graph-canvas"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="GitNexus impact graph"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {inboundPositions.map(({ node, rightX, centerY }, index) => {
          const endX = layout.centerX;
          const path = `M ${rightX} ${centerY} C ${rightX + layout.bend} ${centerY}, ${endX - layout.bend} ${layout.centerY}, ${endX} ${layout.centerY}`;
          return (
            <g key={`inbound-${node.file}-${node.name}-${index}`}>
              <path className="impact-graph-edge inbound" d={path} />
              <circle cx={rightX} cy={centerY} r="4" fill={getColor(node.impact)} />
            </g>
          );
        })}

        {outboundPositions.map(({ node, x, centerY }, index) => {
          const startX = layout.centerX + layout.nodeWidth;
          const path = `M ${startX} ${layout.centerY} C ${startX + layout.bend} ${layout.centerY}, ${x - layout.bend} ${centerY}, ${x} ${centerY}`;
          return (
            <g key={`outbound-${node.file}-${node.name}-${index}`}>
              <path className="impact-graph-edge outbound" d={path} />
              <circle cx={x} cy={centerY} r="4" fill={getColor(node.impact)} />
            </g>
          );
        })}

        {inboundPositions.map(({ node, x, y }, index) => (
          <g key={`in-node-${node.file}-${node.name}-${index}`} transform={`translate(${x}, ${y})`}>
            <rect className="impact-graph-node inbound" width={layout.nodeWidth} height={layout.nodeHeight} rx="14" />
            <text x="14" y="20" className="impact-graph-node-title">
              {truncate(node.name, layout.titleMax)}
            </text>
            <text x="14" y="38" className="impact-graph-node-subtitle">
              {truncate(node.file, layout.subtitleMax)}
            </text>
            <circle cx={layout.nodeWidth - 18} cy="16" r="5" fill={getColor(node.impact)} />
          </g>
        ))}

        <g transform={`translate(${layout.centerX}, ${(layout.height - layout.nodeHeight) / 2})`}>
          <rect
            className="impact-graph-node target"
            width={layout.nodeWidth}
            height={layout.nodeHeight}
            rx="16"
            fill={`url(#${gradientId})`}
          />
          <text x="16" y="20" className="impact-graph-target-title">
            {truncate(impact.target.symbol || '文件级影响', layout.titleMax)}
          </text>
          <text x="16" y="39" className="impact-graph-target-subtitle">
            {truncate(impact.target.filePath, layout.subtitleMax)}
          </text>
        </g>

        {outboundPositions.map(({ node, x, y }, index) => (
          <g key={`out-node-${node.file}-${node.name}-${index}`} transform={`translate(${x}, ${y})`}>
            <rect className="impact-graph-node outbound" width={layout.nodeWidth} height={layout.nodeHeight} rx="14" />
            <text x="14" y="20" className="impact-graph-node-title">
              {truncate(node.name, layout.titleMax)}
            </text>
            <text x="14" y="38" className="impact-graph-node-subtitle">
              {truncate(node.file, layout.subtitleMax)}
            </text>
            <circle cx={layout.nodeWidth - 18} cy="16" r="5" fill={getColor(node.impact)} />
          </g>
        ))}
      </svg>

      <div className="impact-graph-footer">
        <span>上游节点 {impact.inbound.length}</span>
        <span>受影响文件 {impact.filesAffected.length}</span>
        <span>下游节点 {impact.outbound.length}</span>
      </div>
    </div>
  );
};

export default ImpactGraph;
