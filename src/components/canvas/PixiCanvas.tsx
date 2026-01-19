import React, { useRef, useEffect, useState } from 'react'
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { Node, Edge } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { getNodeCenter, getAnchorPosition } from '@/lib/nodeUtils'
import { screenToCanvas, canvasToScreen } from '@/lib/canvasUtils'

interface PixiCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodeDoubleClick?: (node: Node) => void
  onNodeIdeaClick?: (node: Node) => void
}

export function PixiCanvas({ nodes, edges, onNodeDoubleClick, onNodeIdeaClick }: PixiCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const nodeContainerRef = useRef<Container | null>(null)
  const edgeContainerRef = useRef<Container | null>(null)

  const { ui, updateNode, addEdge, setSelectedNode } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragNode, setDragNode] = useState<Node | null>(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })

  // 根据主题确定颜色 - 使用高对比度颜色确保可见性
  const isDark = ui.theme === 'dark'
  const nodeBackgroundColor = isDark ? 0xffffff : 0x000000  // 深色主题中灰，浅色主题浅灰（与背景不同）
  const nodeBorderColor = isDark ? 0xffffff : 0x000000     // 边框颜色 - 白色/黑色确保高对比度
  const textColor = isDark ? 0xffffff : 0x000000           // 文字颜色 - 黑白高对比度
  const buttonColor = isDark ? 0xffffff : 0x000000         // 按钮颜色 - 白色/黑色确保可见
  const edgeColor = isDark ? 0xffffff : 0x000000           // 边颜色 - 白色/黑色高对比度
  const canvasBackgroundColor = isDark ? 0x000000 : 0xffffff  // 画布背景 - 纯黑/纯白
  const [containersReady, setContainersReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return

    // 初始化 PIXI 应用（兼容旧版本）
    const initApp = async () => {
      const app = new Application()

      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: canvasBackgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      })

      canvasRef.current?.appendChild(app.canvas)
      appRef.current = app

      // 创建容器
      const nodeContainer = new Container()
      const edgeContainer = new Container()

      app.stage.addChild(edgeContainer) // 边在下面
      app.stage.addChild(nodeContainer)  // 节点在上面

      nodeContainerRef.current = nodeContainer
      edgeContainerRef.current = edgeContainer

      // 设置初始变换
      if (ui?.canvas) {
        nodeContainer.scale.set(ui.canvas.zoom)
        nodeContainer.position.set(ui.canvas.pan.x, ui.canvas.pan.y)
      }

      // 渲染节点和边
      renderNodes(nodes)
      renderEdges(edges)
    }

    initApp()
    setContainersReady(true); 

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true)
        appRef.current = null
      }
    }
  }, [])

  // 更新Canvas变换
  useEffect(() => {
    if (!nodeContainerRef.current || !ui?.canvas) return

    nodeContainerRef.current.scale.set(ui.canvas.zoom)
    nodeContainerRef.current.position.set(ui.canvas.pan.x, ui.canvas.pan.y)
  }, [ui?.canvas?.zoom, ui?.canvas?.pan])

  // 重新渲染节点
  useEffect(() => {
    if (containersReady) renderNodes(nodes);
  }, [nodes, containersReady]);

  // 重新渲染边
  useEffect(() => {
    if (containersReady) renderEdges(edges);
  }, [edges, containersReady]);

  const renderNodes = (nodes: Node[]) => {
    if (!nodeContainerRef.current) return

    const container = nodeContainerRef.current
    container.removeChildren()

    nodes.forEach(node => {
      const nodeGraphics = createNodeGraphics(node)
      container.addChild(nodeGraphics)
    })
  }

  const renderEdges = (edges: Edge[]) => {
    if (!edgeContainerRef.current) return

    const container = edgeContainerRef.current
    container.removeChildren()

    edges.forEach(edge => {
      const edgeGraphics = createEdgeGraphics(edge)
      container.addChild(edgeGraphics)
    })
  }

  const createNodeGraphics = (node: Node): Container => {
    const container = new Container()

    // 节点背景（方形卡片）
    const background = new Graphics()
    background.stroke({ color: nodeBorderColor, width: 2 })
    background.fill(nodeBackgroundColor)
    background.roundRect(0, 0, 200, 120, 8)

    // 节点连接点（上下边缘的锚点）
    const topAnchor = new Graphics()
    topAnchor.fill(nodeBorderColor)
    topAnchor.circle(100, -5, 4) // 顶部锚点

    const bottomAnchor = new Graphics()
    bottomAnchor.fill(nodeBorderColor)
    bottomAnchor.circle(100, 125, 4) // 底部锚点

    container.addChild(background)
    container.addChild(topAnchor)
    container.addChild(bottomAnchor)

    // 白色遮罩（生成中状态）- 必须是白色半透明遮罩（不显示进度条）
    if (node.status === 'generating') {
      const mask = new Graphics()
      mask.fill({ color: 0xffffff, alpha: 0.8 }) // 白色半透明遮罩
      mask.roundRect(0, 0, 200, 120, 8)
      container.addChild(mask)

      // 显示“正在生成...”文本（移除进度条/百分比）
      const generatingText = new Text({
        text: '正在生成...',
        style: new TextStyle({
          fontFamily: 'Arial',
          fontSize: 12,
          fill: textColor,
        })
      })
      generatingText.position.set(70, 95)
      container.addChild(generatingText)
    }

    // 节点主题文本
    const titleStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 14,
      fill: textColor,
      wordWrap: true,
      wordWrapWidth: 180,
    })

    const titleText = new Text({ text: node.theme, style: titleStyle })
    titleText.position.set(10, 10)
    container.addChild(titleText)

    // 节点摘要文本
    const summaryStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 12,
      fill: textColor,
      wordWrap: true,
      wordWrapWidth: 180,
    })

    const summaryText = new Text({ text: node.summary || (node.status === 'generating' ? '' : node.status === 'error' ? '生成失败' : ''), style: summaryStyle })
    summaryText.position.set(10, 40)
    summaryText.alpha = 0.8
    container.addChild(summaryText)

    // 右侧竖列放置4个纯SVG图形按钮（无文字）
    const buttonsX = 170 // 右侧位置
    const buttonSize = 16
    const buttonSpacing = 6

    // 收藏按钮 - 使用简单的星形图形（SVG风格）
    const favoriteBtn = new Graphics()
    favoriteBtn.fill(buttonColor)
    // 绘制星形
    const starPoints = []
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5
      const radius = i % 2 === 0 ? buttonSize / 2 : buttonSize / 4
      starPoints.push(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    favoriteBtn.poly(starPoints)
    favoriteBtn.position.set(buttonsX, 20)
    favoriteBtn.interactive = true
    favoriteBtn.cursor = 'pointer'
    container.addChild(favoriteBtn)

    // 重新生成按钮 - 使用箭头循环图形
    const regenerateBtn = new Graphics()
    regenerateBtn.stroke({ color: buttonColor, width: 2 })
    // 绘制圆形箭头
    regenerateBtn.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2 - 1)
    // 箭头头部
    regenerateBtn.moveTo(buttonSize / 2 + 2, buttonSize / 4)
    regenerateBtn.lineTo(buttonSize / 2 + buttonSize / 4, buttonSize / 2)
    regenerateBtn.lineTo(buttonSize / 2 + 2, buttonSize * 3 / 4)
    regenerateBtn.position.set(buttonsX, 20 + buttonSize + buttonSpacing)
    regenerateBtn.interactive = true
    regenerateBtn.cursor = 'pointer'
    container.addChild(regenerateBtn)

    // 删除按钮 - 使用X图形
    const deleteBtn = new Graphics()
    deleteBtn.stroke({ color: buttonColor, width: 2 })
    // 绘制X
    deleteBtn.moveTo(2, 2)
    deleteBtn.lineTo(buttonSize - 2, buttonSize - 2)
    deleteBtn.moveTo(buttonSize - 2, 2)
    deleteBtn.lineTo(2, buttonSize - 2)
    deleteBtn.position.set(buttonsX, 20 + 2 * (buttonSize + buttonSpacing))
    deleteBtn.interactive = true
    deleteBtn.cursor = 'pointer'
    container.addChild(deleteBtn)

    // 联想推荐按钮 - 使用灯泡图形
    const ideaBtn = new Graphics()
    ideaBtn.fill(buttonColor)
    // 绘制灯泡形状
    ideaBtn.circle(buttonSize / 2, buttonSize / 3, buttonSize / 3)
    ideaBtn.rect(1, buttonSize / 3, buttonSize - 2, buttonSize / 2)
    ideaBtn.roundRect(0, buttonSize * 2 / 3, buttonSize, buttonSize / 6, 2)
    ideaBtn.position.set(buttonsX, 20 + 3 * (buttonSize + buttonSpacing))
    ideaBtn.interactive = true
    ideaBtn.cursor = 'pointer'
    ideaBtn.on('click', () => {
      onNodeIdeaClick?.(node)
    })
    container.addChild(ideaBtn)

    // 设置节点位置
    container.position.set(node.position.x, node.position.y)

    // 添加交互
    container.interactive = true
    container.cursor = 'pointer'

    container.on('mousedown', (e) => {
      setIsDragging(true)
      setDragNode(node)
      setDragStartPos({ x: e.data.global.x, y: e.data.global.y })
      setSelectedNode(node.id)
    })

    container.on('dblclick', () => {
      onNodeDoubleClick?.(node)
    })

    container.on('mousemove', (e) => {
      if (isDragging && dragNode?.id === node.id) {
        const newPos = screenToCanvas(
          e.data.global.x,
          e.data.global.y,
          ui?.canvas?.zoom || 1,
          ui?.canvas?.pan || { x: 0, y: 0 }
        )
        const deltaX = newPos.x - dragStartPos.x
        const deltaY = newPos.y - dragStartPos.y

        const updatedNode = {
          ...node,
          position: {
            x: node.position.x + deltaX,
            y: node.position.y + deltaY,
          },
        }

        updateNode(node.id, updatedNode)
        setDragStartPos(newPos)
      }
    })

    return container
  }

  const createEdgeGraphics = (edge: Edge): Graphics => {
    const graphics = new Graphics()

    // 查找连接的节点
    const fromNode = nodes.find(n => n.id === edge.fromNodeId)
    const toNode = nodes.find(n => n.id === edge.toNodeId)

    if (!fromNode || !toNode) return graphics

    // 获取锚点位置
    const fromPos = getAnchorPosition(fromNode, edge.fromAnchor)
    const toPos = getAnchorPosition(toNode, edge.toAnchor)

    // 计算控制点以创建更自然的曲线
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const offset = Math.min(distance * 0.4, 100) // 最大偏移100px

    // 确定控制点位置
    let controlX1, controlY1, controlX2, controlY2
    if (Math.abs(dy) > Math.abs(dx)) {
      // 垂直方向连接，使用水平控制点
      controlX1 = fromPos.x + offset
      controlY1 = fromPos.y
      controlX2 = toPos.x + offset
      controlY2 = toPos.y
    } else {
      // 水平方向连接，使用垂直控制点
      controlX1 = fromPos.x
      controlY1 = fromPos.y + offset
      controlX2 = toPos.x
      controlY2 = toPos.y + offset
    }

    // 1. 绘制贝塞尔曲线
    graphics.lineStyle(3, edgeColor, 1)
    graphics.moveTo(fromPos.x, fromPos.y)
    graphics.bezierCurveTo(
      controlX1,
      controlY1,
      controlX2,
      controlY2,
      toPos.x,
      toPos.y
    )

    // 2. 绘制箭头
    const arrowLength = 12
    const angle = Math.atan2(toPos.y - controlY2, toPos.x - controlX2)
    
    // 创建箭头路径点
    const arrowTip = { x: toPos.x, y: toPos.y }
    const arrowLeft = {
      x: toPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
      y: toPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
    }
    const arrowRight = {
      x: toPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
      y: toPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
    }

    // 绘制填充箭头
    graphics.beginFill(edgeColor)
    graphics.lineStyle(0)
    graphics.moveTo(arrowTip.x, arrowTip.y)
    graphics.lineTo(arrowLeft.x, arrowLeft.y)
    graphics.lineTo(arrowRight.x, arrowRight.y)
    graphics.closePath()
    graphics.endFill()

    return graphics
  }

  // 处理鼠标抬起
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false)
      setDragNode(null)
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  return <div ref={canvasRef} className="w-full h-full" />
}
