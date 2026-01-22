import React, { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '@/stores/appStore'
import { Node as AppNode, Edge as AppEdge } from '@/types'
import { ReactFlowNode } from './ReactFlowNode'
import { ReactFlowEdge } from './ReactFlowEdge'

// 自定义节点类型
const nodeTypes = {
  appNode: ReactFlowNode,
}

// 自定义边类型
const edgeTypes = {
  appEdge: ReactFlowEdge,
}

interface ReactFlowCanvasProps {
  nodes: AppNode[]
  edges: AppEdge[]
  onNodeDoubleClick?: (node: AppNode) => void
  onNodeIdeaClick?: (node: AppNode) => void
}

export function ReactFlowCanvas({ nodes, edges, onNodeDoubleClick: onNodeDoubleClickProp, onNodeIdeaClick }: ReactFlowCanvasProps) {
  const { ui, updateNode, addEdge: addAppEdge, updateEdge: updateAppEdge, setSelectedNode, deleteNode, deleteEdge, currentProject } = useAppStore()

  // 转换应用节点格式为ReactFlow节点格式
  const reactFlowNodes = useMemo((): Node[] => {
    return nodes.map(node => ({
      id: node.id,
      type: 'appNode',
      position: { x: node.position.x, y: node.position.y },
      data: {
        node,
        onIdeaClick: onNodeIdeaClick,
        onDoubleClick: onNodeDoubleClickProp,
      },
      draggable: true,
    }))
  }, [nodes, onNodeDoubleClickProp, onNodeIdeaClick])

  // 转换应用边格式为ReactFlow边格式 - 确保ID唯一性
  const reactFlowEdges = useMemo((): Edge[] => {
    console.log('[ReactFlowCanvas] Converting edges:', edges.length, 'edges')
    const converted = edges.map(edge => {
      console.log('[ReactFlowCanvas] Converting edge:', edge.id, edge.fromNodeId, '->', edge.toNodeId)
      return {
        id: edge.id,
        type: 'appEdge',
        source: edge.fromNodeId,
        target: edge.toNodeId,
        sourceHandle: edge.fromAnchor,
        targetHandle: edge.toAnchor,
        data: {
          edge,
        },
      }
    })
    console.log('[ReactFlowCanvas] Converted edges:', converted.map(e => e.id))

    // 检查重复ID
    const ids = converted.map(e => e.id)
    const uniqueIds = new Set(ids)
    if (ids.length !== uniqueIds.size) {
      console.error('[ReactFlowCanvas] DUPLICATE EDGE IDS FOUND:', ids.filter((id, index) => ids.indexOf(id) !== index))
      console.error('[ReactFlowCanvas] All edge IDs:', ids)
    }

    return converted
  }, [edges])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(reactFlowNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(reactFlowEdges)

  // 使用受控模式，直接使用转换后的数据
  React.useEffect(() => {
    setRfNodes(reactFlowNodes)
  }, [reactFlowNodes, setRfNodes])

  React.useEffect(() => {
    setRfEdges(reactFlowEdges)
  }, [reactFlowEdges, setRfEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || !params.sourceHandle || !params.targetHandle) return

      const newEdge: AppEdge = {
        id: `edge-${crypto.randomUUID()}`,
        projectId: nodes[0]?.projectId || 'default',
        fromNodeId: params.source,
        toNodeId: params.target,
        fromAnchor: params.sourceHandle as 'top' | 'bottom',
        toAnchor: params.targetHandle as 'top' | 'bottom',
        meta: {},
      }

      addAppEdge(newEdge)
    },
    [addAppEdge, nodes]
  )

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const appNode = nodes.find(n => n.id === node.id)
      if (appNode) {
        updateNode(appNode.id, {
          ...appNode,
          position: { x: node.position.x, y: node.position.y },
        })
      }
    },
    [nodes, updateNode]
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const appNode = nodes.find(n => n.id === node.id)
      if (appNode) {
        onNodeDoubleClickProp?.(appNode)
      }
    },
    [nodes, onNodeDoubleClickProp]
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode]
  )

  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      nodesToDelete.forEach((node) => {
        deleteNode(node.id)
      })
    },
    [deleteNode]
  )

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        deleteEdge(edge.id)
      })
    },
    [deleteEdge]
  )

  const edgeUpdateSuccessful = useRef(true)

  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false
  }, [])

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target || !newConnection.sourceHandle || !newConnection.targetHandle) return

      updateAppEdge(oldEdge.id, {
        fromNodeId: newConnection.source,
        toNodeId: newConnection.target,
        fromAnchor: newConnection.sourceHandle as 'top' | 'bottom',
        toAnchor: newConnection.targetHandle as 'top' | 'bottom',
      })

      edgeUpdateSuccessful.current = true
    },
    [updateAppEdge]
  )

  const onEdgeUpdateEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeUpdateSuccessful.current) {
        deleteEdge(edge.id)
      }
    },
    [deleteEdge]
  )

  const snapToGrid = currentProject?.settings.snapToGrid ?? false

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        edgesUpdatable
        deleteKeyCode={['Backspace', 'Delete']}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        attributionPosition="bottom-left"
        defaultViewport={{
          x: ui.canvas?.pan.x || 0,
          y: ui.canvas?.pan.y || 0,
          zoom: ui.canvas?.zoom || 1,
        }}
        minZoom={0.1}
        maxZoom={2}
        className={ui.theme === 'dark' ? 'dark' : ''}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={ui.theme === 'dark' ? '#ffffff' : '#000000'}
        />
        <Controls />
        <MiniMap
          nodeColor={ui.theme === 'dark' ? '#ffffff' : '#000000'}
          maskColor={ui.theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'}
        />
      </ReactFlow>
    </div>
  )
}

// 包装在ReactFlowProvider中
export function ReactFlowCanvasWithProvider(props: ReactFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowCanvas {...props} />
    </ReactFlowProvider>
  )
}
