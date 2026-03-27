import React, { useEffect, useRef, useState } from 'react';
import './WorkflowChart.css';

interface WorkflowNode {
  state_key: string;
  name: string;
  is_milestone: boolean;
  owner_roles: string[];
  visibility_usage_mode: number;
}

interface WorkflowConnection {
  source_state_key: string;
  target_state_key: string;
}

interface NodeSkillConfig {
  nodeId: string;
  skill: string;
}

interface WorkflowChartProps {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  selectedNodes?: string[];
  onNodeSelect?: (nodeIds: string[]) => void;
  selectable?: boolean;
  nodeSkillConfigs?: NodeSkillConfig[];
  skillIcons?: Record<string, string>;
}

interface NodePosition {
  x: number;
  y: number;
  level: number;
}

interface LayoutNode extends WorkflowNode {
  position: NodePosition;
  id: string;
}

const WorkflowChart: React.FC<WorkflowChartProps> = ({
  nodes,
  connections,
  selectedNodes = [],
  onNodeSelect,
  selectable = false,
  nodeSkillConfigs = [],
  skillIcons = {}
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 计算节点层级和位置的布局算法
  const calculateLayout = () => {
    if (!nodes.length) return;

    // 如果没有连接，就简单地水平排列所有节点
    if (!connections.length) {
      const nodeWidth = 120;
      const nodeHeight = 60;
      const horizontalSpacing = 160;
      const startX = 80;
      const startY = 100;

      const positioned: LayoutNode[] = nodes.map((node, index) => ({
        ...node,
        id: node.state_key,
        position: {
          x: startX + index * horizontalSpacing,
          y: startY,
          level: 0
        }
      }));

      setLayoutNodes(positioned);
      setSvgSize({
        width: Math.max(600, startX + nodes.length * horizontalSpacing + 80), // 增加右侧边距
        height: Math.max(280, startY + nodeHeight + 80) // 增加下方边距
      });
      return;
    }

    // 构建邻接表
    const adjacencyList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    // 初始化
    nodes.forEach(node => {
      adjacencyList[node.state_key] = [];
      inDegree[node.state_key] = 0;
    });

    // 建立连接关系
    connections.forEach(conn => {
      if (adjacencyList[conn.source_state_key] && inDegree[conn.target_state_key] !== undefined) {
        adjacencyList[conn.source_state_key].push(conn.target_state_key);
        inDegree[conn.target_state_key]++;
      }
    });

    // 拓扑排序确定层级
    const levels: Record<string, number> = {};
    const queue: string[] = [];

    // 找到起始节点（入度为0的节点）
    Object.keys(inDegree).forEach(nodeId => {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
        levels[nodeId] = 0;
      }
    });

    // BFS计算每个节点的层级
    let maxLevel = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels[current];

      adjacencyList[current].forEach(neighbor => {
        inDegree[neighbor]--;
        levels[neighbor] = Math.max(levels[neighbor] || 0, currentLevel + 1);
        maxLevel = Math.max(maxLevel, levels[neighbor]);

        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // 按层级分组节点
    const nodesByLevel: Record<number, string[]> = {};
    Object.keys(levels).forEach(nodeId => {
      const level = levels[nodeId];
      if (!nodesByLevel[level]) {
        nodesByLevel[level] = [];
      }
      nodesByLevel[level].push(nodeId);
    });

    // 计算布局参数
    const nodeWidth = 120;
    const nodeHeight = 60;
    const horizontalSpacing = 180;
    const verticalSpacing = 80; // 减小垂直间距
    const startX = 50;
    const padding = 40;

    // 计算每个节点的位置 - 居中分布
    const positioned: LayoutNode[] = [];
    let totalWidth = 0;
    let totalHeight = 0;

    // 先计算每一层的总高度，以便居中分布
    const levelHeights: Record<number, number> = {};
    for (let level = 0; level <= maxLevel; level++) {
      const levelNodes = nodesByLevel[level] || [];
      levelHeights[level] = Math.max(0, (levelNodes.length - 1) * verticalSpacing);
    }

    // 计算整个流程图的总高度
    const maxLevelHeight = Math.max(...Object.values(levelHeights));
    const chartCenterY = padding + maxLevelHeight / 2;

    for (let level = 0; level <= maxLevel; level++) {
      const levelNodes = nodesByLevel[level] || [];
      const startXForLevel = startX + (level * horizontalSpacing);

      // 计算这一层的起始Y位置（居中分布）
      const levelHeight = (levelNodes.length - 1) * verticalSpacing;
      const startYForLevel = chartCenterY - levelHeight / 2;

      levelNodes.forEach((nodeId, index) => {
        const node = nodes.find(n => n.state_key === nodeId);
        if (node) {
          const y = startYForLevel + index * verticalSpacing;
          positioned.push({
            ...node,
            id: nodeId,
            position: {
              x: startXForLevel,
              y: y,
              level: level
            }
          });

          totalWidth = Math.max(totalWidth, startXForLevel + nodeWidth);
          totalHeight = Math.max(totalHeight, y + nodeHeight);
        }
      });
    }

    totalHeight = Math.max(totalHeight, chartCenterY + maxLevelHeight / 2 + nodeHeight + padding);

    setLayoutNodes(positioned);
    setSvgSize({
      width: Math.max(800, totalWidth + 100),
      height: Math.max(600, totalHeight + 100)
    });
  };

  // 监听容器大小变化
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width - 32, // 减去padding
          height: Math.min(500, Math.max(300, rect.width * 0.6)) // 响应式高度
        });
      }
    };

    updateContainerSize();

    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    calculateLayout();
  }, [nodes, connections]);

  // 自动适配缩放比例 - 设置为当前大小的1.5倍
  useEffect(() => {
    if (svgSize.width > 0 && containerSize.width > 0) {
      const padding = 20; // 很小的边距
      const scaleX = (containerSize.width - padding) / svgSize.width;
      const scaleY = (containerSize.height - padding) / svgSize.height;
      const fitScale = Math.min(scaleX, scaleY);
      // 设置为当前大小的1.5倍
      const defaultScale = fitScale * 3.6; // 当前的1.5倍大小
      setScale(defaultScale);
      setPanOffset({ x: 0, y: 0 }); // 重置偏移
    }
  }, [svgSize, containerSize]);

  // 缩放控制函数
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.2));
  };

  const handleZoomReset = () => {
    if (svgSize.width > 0 && containerSize.width > 0) {
      const padding = 20; // 很小的边距
      const scaleX = (containerSize.width - padding) / svgSize.width;
      const scaleY = (containerSize.height - padding) / svgSize.height;
      const fitScale = Math.min(scaleX, scaleY);
      // 重置为当前大小的1.5倍
      const defaultScale = fitScale * 3.6; // 当前的1.5倍大小
      setScale(defaultScale);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleZoomFit = () => {
    if (svgSize.width > 0 && containerSize.width > 0) {
      const padding = 40; // 更大的边距，确保完全可见
      const scaleX = (containerSize.width - padding) / svgSize.width;
      const scaleY = (containerSize.height - padding) / svgSize.height;
      const fitScale = Math.min(scaleX, scaleY);
      setScale(fitScale);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // 获取连接路径
  const getConnectionPath = (sourceId: string, targetId: string) => {
    const sourceNode = layoutNodes.find(n => n.id === sourceId);
    const targetNode = layoutNodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) return '';

    const sourceX = sourceNode.position.x + 120; // 节点右边
    const sourceY = sourceNode.position.y + 30; // 节点中心
    const targetX = targetNode.position.x; // 节点左边
    const targetY = targetNode.position.y + 30; // 节点中心

    // 计算贝塞尔曲线控制点
    const controlPointX = sourceX + (targetX - sourceX) / 2;

    return `M ${sourceX} ${sourceY} C ${controlPointX} ${sourceY} ${controlPointX} ${targetY} ${targetX} ${targetY}`;
  };

  // 处理节点点击
  const handleNodeClick = (nodeId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // 阻止事件冒泡
      e.preventDefault(); // 阻止默认行为
    }

    // 如果正在拖拽，不处理点击
    if (isDragging) return;

    if (!selectable || !onNodeSelect) return;

    if (selectedNodes.includes(nodeId)) {
      onNodeSelect(selectedNodes.filter(id => id !== nodeId));
    } else {
      onNodeSelect([...selectedNodes, nodeId]);
    }
  };

  // 拖拽支持 - 改进版本
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as Element;

    // 如果点击的是节点相关元素，不启动拖拽
    if (target.closest('g.workflow-node') ||
        target.classList.contains('workflow-node') ||
        target.parentElement?.classList.contains('workflow-node')) {
      return;
    }

    // 启动拖拽
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });

    const startX = e.clientX;
    const startY = e.clientY;
    const startPanX = panOffset.x;
    const startPanY = panOffset.y;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;
      setPanOffset({
        x: startPanX + deltaX, // 改为加号，让拖拽方向正确
        y: startPanY + deltaY  // 改为加号，让拖拽方向正确
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const endX = e.clientX;
      const endY = e.clientY;
      const distance = Math.sqrt(
        Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
      );

      // 如果移动距离很小，认为是点击而不是拖拽
      if (distance < 3) {
        // 这里可以添加其他点击处理
      }

      setIsDragging(false);
      setDragStart(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 获取节点样式类
  const getNodeClass = (node: LayoutNode) => {
    const classes = ['workflow-node'];

    if (node.is_milestone) {
      classes.push('milestone-node');
    }

    if (selectable && selectedNodes.includes(node.id)) {
      classes.push('selected-node');
    }

    if (selectable) {
      classes.push('selectable-node');
    }

    return classes.join(' ');
  };

  // 获取角色标签
  const getRoleLabel = (roles: string[]) => {
    const roleMap: Record<string, string> = {
      pm: 'PM',
      ui: 'UI',
      da: 'DA',
      legal: 'Legal',
      leader: 'Leader',
      rd_owner: 'RD',
      ios: 'iOS',
      android: 'Android',
      fe: '前端',
      server: '后端',
      pc: 'PC',
      qa: 'QA'
    };

    return roles.map(role => roleMap[role] || role).join(', ');
  };

  // 获取节点的技能配置
  const getNodeSkill = (nodeId: string) => {
    const config = nodeSkillConfigs.find(config => config.nodeId === nodeId);
    return config ? {
      skill: config.skill,
      icon: skillIcons[config.skill] || '⚙️'
    } : null;
  };

  return (
    <div className="workflow-chart-container" ref={containerRef}>
      {/* 缩放控制按钮 */}
      <div className="chart-controls">
        <button className="zoom-btn" onClick={handleZoomIn} title="放大">
          ➕
        </button>
        <button className="zoom-btn" onClick={handleZoomOut} title="缩小">
          ➖
        </button>
        <button className="zoom-btn" onClick={handleZoomReset} title="重置默认大小">
          🏠
        </button>
        <button className="zoom-btn" onClick={handleZoomFit} title="适合视窗">
          📐
        </button>
        <span className="zoom-info">{Math.round(scale * 100)}%</span>
      </div>

      <svg
        ref={svgRef}
        width={containerSize.width || 800}
        height={containerSize.height || 500}
        className={`workflow-chart-svg ${isDragging ? 'dragging' : ''}`}
        viewBox={`${-panOffset.x} ${-panOffset.y} ${(containerSize.width || 800) / scale} ${(containerSize.height || 500) / scale}`}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* 定义箭头标记 */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#6b7280"
            />
          </marker>
        </defs>

        {/* 背景矩形，用于拖拽 - 确保覆盖整个可视区域 */}
        <rect
          x={-panOffset.x}
          y={-panOffset.y}
          width={(containerSize.width || 800) / scale}
          height={(containerSize.height || 500) / scale}
          fill="transparent"
          className="chart-background"
        />

        {/* 主要内容组，应用缩放 */}
        <g transform={`scale(${scale})`}>
          {/* 绘制连接线 */}
          <g className="connections">
          {connections.map((conn, index) => (
            <path
              key={`${conn.source_state_key}-${conn.target_state_key}-${index}`}
              d={getConnectionPath(conn.source_state_key, conn.target_state_key)}
              className="connection-path"
              markerEnd="url(#arrowhead)"
            />
          ))}
        </g>

        {/* 绘制节点 */}
        <g className="nodes">
          {layoutNodes.map(node => (
            <g
              key={node.id}
              transform={`translate(${node.position.x}, ${node.position.y})`}
              className={getNodeClass(node)}
              onClick={(e) => handleNodeClick(node.id, e)}
            >
              {/* 节点背景 */}
              <rect
                width="120"
                height="60"
                className="node-background"
                rx="8"
              />

              {/* 里程碑标记 */}
              {node.is_milestone && (
                <circle
                  cx="110"
                  cy="10"
                  r="4"
                  className="milestone-marker"
                />
              )}

              {/* 技能图标 */}
              {(() => {
                const skillConfig = getNodeSkill(node.id);
                return skillConfig && (
                  <g className="skill-badge">
                    <circle
                      cx="95"
                      cy="15"
                      r="12"
                      className="skill-badge-bg"
                    />
                    <text
                      x="95"
                      y="20"
                      textAnchor="middle"
                      className="skill-icon"
                      fontSize="14"
                    >
                      {skillConfig.icon}
                    </text>
                  </g>
                );
              })()}

              {/* 选中标记 */}
              {selectable && selectedNodes.includes(node.id) && (
                <rect
                  width="120"
                  height="60"
                  className="selection-overlay"
                  rx="8"
                />
              )}

              {/* 节点文本 */}
              {node.owner_roles.length > 0 ? (
                <>
                  <text
                    x="60"
                    y="28"
                    textAnchor="middle"
                    className="node-title"
                  >
                    {node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
                  </text>
                  {/* 角色信息 */}
                  <text
                    x="60"
                    y="45"
                    textAnchor="middle"
                    className="node-roles"
                  >
                    {getRoleLabel(node.owner_roles)}
                  </text>
                </>
              ) : (
                <text
                  x="60"
                  y="35"
                  textAnchor="middle"
                  className="node-title"
                >
                  {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
                </text>
              )}

            </g>
          ))}
        </g>
        </g>
      </svg>

      {/* 图例 - 悬停显示 */}
      <div className="chart-legend-trigger">
        <span className="legend-icon">ℹ️</span>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-node normal-legend"></div>
            <span>普通节点</span>
          </div>
          <div className="legend-item">
            <div className="legend-node milestone-legend">
              <div className="milestone-marker-legend"></div>
            </div>
            <span>里程碑</span>
          </div>
          {selectable && (
            <div className="legend-item">
              <div className="legend-node selected-legend"></div>
              <span>已选中</span>
            </div>
          )}
          {nodeSkillConfigs.length > 0 && (
            <div className="legend-item">
              <div className="skill-badge-legend">⚙️</div>
              <span>已配置技能</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowChart;