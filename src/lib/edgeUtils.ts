import { Edge, Node, Position, AnchorPosition } from '@/types'

/**
 * 边工具函数
 */

/**
 * 计算贝塞尔曲线路径
 * 用于绘制连接两个节点的曲线
 */
export function calculateEdgePath(
  fromPosition: Position,
  toPosition: Position,
  fromAnchor: AnchorPosition,
  toAnchor: AnchorPosition
): string {
  const dx = toPosition.x - fromPosition.x
  const dy = toPosition.y - fromPosition.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // 控制点偏移距离（距离的1/3）
  const offset = Math.min(distance * 0.33, 150)

  // 根据锚点方向计算控制点
  const cp1 = calculateControlPoint(fromPosition, fromAnchor, offset)
  const cp2 = calculateControlPoint(toPosition, toAnchor, -offset)

  // SVG 路径
  return `M ${fromPosition.x} ${fromPosition.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPosition.x} ${toPosition.y}`
}

/**
 * 计算控制点位置
 */
function calculateControlPoint(
  position: Position,
  anchor: AnchorPosition,
  offset: number
): Position {
  switch (anchor) {
    case 'top':
      return { x: position.x, y: position.y - offset }
    case 'bottom':
      return { x: position.x, y: position.y + offset }
    default:
      return position
  }
}

/**
 * 检查边是否连接到指定节点
 */
export function isEdgeConnectedToNode(edge: Edge, nodeId: string): boolean {
  return edge.fromNodeId === nodeId || edge.toNodeId === nodeId
}

/**
 * 获取节点的所有连接边
 */
export function getNodeEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => isEdgeConnectedToNode(edge, nodeId))
}

/**
 * 获取节点的入边（指向该节点的边）
 */
export function getIncomingEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => edge.toNodeId === nodeId)
}

/**
 * 获取节点出边（从该节点发出的边）
 */
export function getOutgoingEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => edge.fromNodeId === nodeId)
}

/**
 * 检查两个节点之间是否已有边连接
 */
export function hasEdgeBetween(
  edges: Edge[],
  fromNodeId: string,
  toNodeId: string
): boolean {
  return edges.some(
    edge =>
      (edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId) ||
      (edge.fromNodeId === toNodeId && edge.toNodeId === fromNodeId)
  )
}

/**
 * 获取边的中点位置（用于显示标签等）
 */
export function getEdgeMidpoint(
  fromPosition: Position,
  toPosition: Position
): Position {
  return {
    x: (fromPosition.x + toPosition.x) / 2,
    y: (fromPosition.y + toPosition.y) / 2,
  }
}

/**
 * 计算边的长度
 */
export function getEdgeLength(
  fromPosition: Position,
  toPosition: Position
): number {
  const dx = toPosition.x - fromPosition.x
  const dy = toPosition.y - fromPosition.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 检测边是否被点击（用于交互）
 */
export function isPointNearEdge(
  point: Position,
  fromPosition: Position,
  toPosition: Position,
  threshold = 10
): boolean {
  const A = point.x - fromPosition.x
  const B = point.y - fromPosition.y
  const C = toPosition.x - fromPosition.x
  const D = toPosition.y - fromPosition.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D

  if (lenSq === 0) {
    // 起点和终点重合
    return Math.sqrt(A * A + B * B) <= threshold
  }

  const param = dot / lenSq

  let xx: number, yy: number

  if (param < 0) {
    xx = fromPosition.x
    yy = fromPosition.y
  } else if (param > 1) {
    xx = toPosition.x
    yy = toPosition.y
  } else {
    xx = fromPosition.x + param * C
    yy = fromPosition.y + param * D
  }

  const dx = point.x - xx
  const dy = point.y - yy
  const distance = Math.sqrt(dx * dx + dy * dy)

  return distance <= threshold
}

/**
 * 获取边的箭头方向
 */
export function getEdgeDirection(
  fromAnchor: AnchorPosition,
  toAnchor: AnchorPosition
): 'down' | 'up' | 'left' | 'right' {
  if (fromAnchor === 'top' && toAnchor === 'bottom') return 'down'
  if (fromAnchor === 'bottom' && toAnchor === 'top') return 'up'
  // 目前只支持上下方向，左右方向暂时不支持
  return 'down' // 默认
}

/**
 * 计算箭头位置和旋转角度
 */
export function getArrowTransform(
  toPosition: Position,
  direction: 'down' | 'up' | 'left' | 'right',
  arrowSize = 10
): { x: number; y: number; rotation: number } {
  let x = toPosition.x
  let y = toPosition.y
  let rotation = 0

  switch (direction) {
    case 'down':
      y -= arrowSize
      rotation = 0
      break
    case 'up':
      y += arrowSize
      rotation = 180
      break
    case 'right':
      x -= arrowSize
      rotation = -90
      break
    case 'left':
      x += arrowSize
      rotation = 90
      break
  }

  return { x, y, rotation }
}

/**
 * 清理悬空边（连接到不存在节点的边）
 */
export function removeOrphanedEdges(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeIds = new Set(nodes.map(node => node.id))
  return edges.filter(edge =>
    nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)
  )
}

/**
 * 重新连接边（当节点ID改变时）
 */
export function reconnectEdge(
  edge: Edge,
  oldNodeId: string,
  newNodeId: string,
  isFromNode = true
): Edge {
  if (isFromNode) {
    return {
      ...edge,
      fromNodeId: newNodeId,
    }
  } else {
    return {
      ...edge,
      toNodeId: newNodeId,
    }
  }
}

/**
 * 获取边的权重（用于图算法）
 */
export function getEdgeWeight(edge: Edge): number {
  return edge.meta?.weight || 1
}

/**
 * 设置边的权重
 */
export function setEdgeWeight(edge: Edge, weight: number): Edge {
  return {
    ...edge,
    meta: {
      ...edge.meta,
      weight,
    },
  }
}

/**
 * 切换边的方向
 */
export function reverseEdge(edge: Edge): Edge {
  return {
    ...edge,
    fromNodeId: edge.toNodeId,
    toNodeId: edge.fromNodeId,
    fromAnchor: edge.toAnchor,
    toAnchor: edge.fromAnchor,
  }
}

/**
 * 批量更新边的属性
 */
export function updateEdgesMeta(
  edges: Edge[],
  edgeIds: string[],
  updates: Partial<Edge['meta']>
): Edge[] {
  return edges.map(edge =>
    edgeIds.includes(edge.id)
      ? { ...edge, meta: { ...edge.meta, ...updates } }
      : edge
  )
}