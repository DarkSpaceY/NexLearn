import { Node, Edge, Position, AnchorPosition, TableOfContentsItem } from '@/types'

/**
 * 节点工具函数
 */

/**
 * 创建新节点
 */
export function createNode(
  theme: string,
  position: Position,
  parentId?: string,
  projectId = 'default'
): Node {
  return {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    theme,
    summary: '', // 待AI生成
    contentMd: '', // 待AI生成
    toc: [],
    annotations: [],
    favorites: false,
    animations: [],
    position,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    },
    status: 'idle',
  }
}

/**
 * 创建边
 */
export function createEdge(
  fromNodeId: string,
  toNodeId: string,
  fromAnchor: AnchorPosition = 'bottom',
  toAnchor: AnchorPosition = 'top',
  projectId = 'default'
): Edge {
  return {
    id: crypto.randomUUID(),
    projectId,
    fromNodeId,
    toNodeId,
    fromAnchor,
    toAnchor,
    meta: {},
  }
}

/**
 * 计算节点中心点位置
 */
export function getNodeCenter(node: Node): Position {
  // 假设节点尺寸为 200x120
  const NODE_WIDTH = 200
  const NODE_HEIGHT = 120

  return {
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + NODE_HEIGHT / 2,
  }
}

/**
 * 获取节点的锚点位置
 */
export function getAnchorPosition(
  node: Node,
  anchor: AnchorPosition
): Position {
  const center = getNodeCenter(node)
  const NODE_WIDTH = 200
  const NODE_HEIGHT = 120

  switch (anchor) {
    case 'top':
      return { x: center.x, y: node.position.y }
    case 'bottom':
      return { x: center.x, y: node.position.y + NODE_HEIGHT }
    default:
      return center
  }
}

/**
 * 计算两个节点之间的距离
 */
export function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x
  const dy = pos1.y - pos2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 检查两个节点是否相邻（用于布局算法）
 */
export function areNodesAdjacent(node1: Node, node2: Node): boolean {
  const distance = getDistance(
    getNodeCenter(node1),
    getNodeCenter(node2)
  )
  const NODE_SPACING = 250 // 节点间距
  return distance <= NODE_SPACING
}

/**
 * 获取节点的子节点
 */
export function getChildNodes(nodes: Node[], parentId: string): Node[] {
  return nodes.filter(node => node.parentId === parentId)
}

/**
 * 获取节点的兄弟节点
 */
export function getSiblingNodes(nodes: Node[], node: Node): Node[] {
  if (!node.parentId) return []
  return nodes.filter(n => n.parentId === node.parentId && n.id !== node.id)
}

/**
 * 获取节点的父节点
 */
export function getParentNode(nodes: Node[], node: Node): Node | null {
  if (!node.parentId) return null
  return nodes.find(n => n.id === node.parentId) || null
}

/**
 * 获取节点的层次深度
 */
export function getNodeDepth(nodes: Node[], node: Node): number {
  let depth = 0
  let current = node

  while (current.parentId) {
    const parent = getParentNode(nodes, current)
    if (!parent) break
    depth++
    current = parent
  }

  return depth
}

/**
 * 更新节点位置（自动调整子节点位置）
 */
export function updateNodePosition(
  nodes: Node[],
  nodeId: string,
  newPosition: Position
): Node[] {
  const updatedNodes = [...nodes]
  const nodeIndex = updatedNodes.findIndex(n => n.id === nodeId)

  if (nodeIndex === -1) return nodes

  const oldPosition = updatedNodes[nodeIndex].position
  const deltaX = newPosition.x - oldPosition.x
  const deltaY = newPosition.y - oldPosition.y

  // 更新节点本身位置
  updatedNodes[nodeIndex] = {
    ...updatedNodes[nodeIndex],
    position: newPosition,
    metadata: {
      ...updatedNodes[nodeIndex].metadata,
      updatedAt: new Date(),
    },
  }

  // 更新所有子节点的位置
  const childNodes = getChildNodes(updatedNodes, nodeId)
  childNodes.forEach(child => {
    const childIndex = updatedNodes.findIndex(n => n.id === child.id)
    if (childIndex !== -1) {
      updatedNodes[childIndex] = {
        ...updatedNodes[childIndex],
        position: {
          x: updatedNodes[childIndex].position.x + deltaX,
          y: updatedNodes[childIndex].position.y + deltaY,
        },
      }
    }
  })

  return updatedNodes
}

/**
 * 生成树形布局
 */
export function generateTreeLayout(
  nodes: Node[],
  rootNodeId: string,
  startPosition: Position = { x: 0, y: 0 }
): Node[] {
  const updatedNodes = [...nodes]
  const rootIndex = updatedNodes.findIndex(n => n.id === rootNodeId)

  if (rootIndex === -1) return nodes

  // 设置根节点位置
  updatedNodes[rootIndex] = {
    ...updatedNodes[rootIndex],
    position: startPosition,
  }

  // 递归布局子节点
  function layoutChildren(parentId: string, parentPosition: Position, depth = 1) {
    const children = getChildNodes(updatedNodes, parentId)
    const childCount = children.length

    if (childCount === 0) return

    const NODE_SPACING_X = 250
    const NODE_SPACING_Y = 150
    const startX = parentPosition.x - ((childCount - 1) * NODE_SPACING_X) / 2
    const childY = parentPosition.y + NODE_SPACING_Y

    children.forEach((child, index) => {
      const childIndex = updatedNodes.findIndex(n => n.id === child.id)
      if (childIndex !== -1) {
        const childPosition = {
          x: startX + index * NODE_SPACING_X,
          y: childY,
        }

        updatedNodes[childIndex] = {
          ...updatedNodes[childIndex],
          position: childPosition,
        }

        // 递归布局子孙节点
        layoutChildren(child.id, childPosition, depth + 1)
      }
    })
  }

  layoutChildren(rootNodeId, startPosition)
  return updatedNodes
}

/**
 * 验证节点数据完整性
 */
export function validateNode(node: Partial<Node>): string[] {
  const errors: string[] = []

  if (!node.id) errors.push('缺少节点ID')
  if (!node.theme || node.theme.trim() === '') errors.push('缺少节点主题')
  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('缺少或无效的节点位置')
  }
  if (!node.metadata) errors.push('缺少节点元数据')
  if (!node.metadata?.createdAt) errors.push('缺少创建时间')

  return errors
}

/**
 * 验证边数据完整性
 */
export function validateEdge(edge: Partial<Edge>): string[] {
  const errors: string[] = []

  if (!edge.id) errors.push('缺少边ID')
  if (!edge.fromNodeId) errors.push('缺少起始节点ID')
  if (!edge.toNodeId) errors.push('缺少结束节点ID')
  if (edge.fromNodeId === edge.toNodeId) errors.push('起始节点和结束节点不能相同')

  return errors
}

export function buildNodeContext(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  visibleText?: string
): {
  visibleText?: string
  nodeTree?: string
  parentNode?: { id: string; theme: string; summary: string }
  siblingNodes?: Array<{ id: string; theme: string; summary: string }>
  childNodes?: Array<{ id: string; theme: string; summary: string }>
} {
  const parent = getParentNode(nodes, node)
  const siblings = getSiblingNodes(nodes, node)
  // 通过 parentId 与连线共同识别子节点
  const childIdSet = new Set<string>()
  nodes.forEach(n => {
    if (n.parentId === node.id) childIdSet.add(n.id)
  })
  edges.forEach(e => {
    if (e.fromNodeId === node.id) childIdSet.add(e.toNodeId)
  })
  const children = nodes.filter(n => childIdSet.has(n.id))

  // 组装简洁的节点片段文本
  const lines: string[] = []
  if (parent) lines.push(`[父] ${parent.theme}: ${parent.summary}`)
  if (siblings.length > 0) {
    lines.push(...siblings.map(n => `[兄弟] ${n.theme}: ${n.summary}`))
  }
  if (children.length > 0) {
    lines.push(...children.map(n => `[子] ${n.theme}: ${n.summary}`))
  }
  const nodeTree = lines.length > 0 ? lines.join('\n') : undefined

  return {
    visibleText: visibleText && visibleText.trim() ? visibleText : undefined,
    nodeTree,
    parentNode: parent
      ? { id: parent.id, theme: parent.theme, summary: parent.summary }
      : undefined,
    siblingNodes: siblings.map(n => ({ id: n.id, theme: n.theme, summary: n.summary })),
    childNodes: children.map(n => ({ id: n.id, theme: n.theme, summary: n.summary })),
  }
}

/**
 * 从 Markdown 文本解析目录（忽略代码块围栏）
 */
export function parseTocFromMarkdown(markdown: string): TableOfContentsItem[] {
  if (!markdown || typeof markdown !== 'string') return []
  const lines = markdown.split('\n')
  const toc: TableOfContentsItem[] = []
  let inFence = false

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmedStart = line.trimStart()
    if (trimmedStart.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{1,3})\s+(.+)$/.exec(trimmedStart)
    if (!match) continue
    const level = match[1].length
    const text = match[2].trim()
    if (!text) continue
    const slug = text.replace(/\s+/g, '-').toLowerCase()
    const anchor = `h${level}-${slug}`
    toc.push({ level, text, anchor })
  }

  return toc
}
