import { Position } from '@/types'

/**
 * Canvas 工具函数
 */

/**
 * 将屏幕坐标转换为 Canvas 坐标
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  zoom: number,
  pan: Position
): Position {
  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom,
  }
}

/**
 * 将 Canvas 坐标转换为屏幕坐标
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  zoom: number,
  pan: Position
): Position {
  return {
    x: canvasX * zoom + pan.x,
    y: canvasY * zoom + pan.y,
  }
}

/**
 * 计算缩放后的位置
 */
export function zoomPosition(
  position: Position,
  zoom: number,
  origin: Position = { x: 0, y: 0 }
): Position {
  return {
    x: origin.x + (position.x - origin.x) * zoom,
    y: origin.y + (position.y - origin.y) * zoom,
  }
}

/**
 * 计算平移后的位置
 */
export function panPosition(position: Position, pan: Position): Position {
  return {
    x: position.x + pan.x,
    y: position.y + pan.y,
  }
}

/**
 * 获取鼠标位置相对于 Canvas 的坐标
 */
export function getMouseCanvasPosition(
  event: MouseEvent,
  canvasElement: HTMLElement,
  zoom: number,
  pan: Position
): Position {
  const rect = canvasElement.getBoundingClientRect()
  const screenX = event.clientX - rect.left
  const screenY = event.clientY - rect.top

  return screenToCanvas(screenX, screenY, zoom, pan)
}

/**
 * 获取触摸位置相对于 Canvas 的坐标
 */
export function getTouchCanvasPosition(
  touch: Touch,
  canvasElement: HTMLElement,
  zoom: number,
  pan: Position
): Position {
  const rect = canvasElement.getBoundingClientRect()
  const screenX = touch.clientX - rect.left
  const screenY = touch.clientY - rect.top

  return screenToCanvas(screenX, screenY, zoom, pan)
}

/**
 * 计算两指触摸的中心点
 */
export function getTouchesCenter(touches: Touch[]): Position {
  if (touches.length === 0) return { x: 0, y: 0 }
  if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY }

  const sumX = touches.reduce((sum, touch) => sum + touch.clientX, 0)
  const sumY = touches.reduce((sum, touch) => sum + touch.clientY, 0)

  return {
    x: sumX / touches.length,
    y: sumY / touches.length,
  }
}

/**
 * 计算两指触摸的距离
 */
export function getTouchesDistance(touches: Touch[]): number {
  if (touches.length < 2) return 0

  const touch1 = touches[0]
  const touch2 = touches[1]

  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY

  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 平滑插值
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}

/**
 * 计算边界框
 */
export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  center: Position
}

export function calculateBoundingBox(positions: Position[]): BoundingBox | null {
  if (positions.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  positions.forEach(pos => {
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x)
    maxY = Math.max(maxY, pos.y)
  })

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  }
}

/**
 * 检查点是否在矩形内
 */
export function isPointInRect(
  point: Position,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * 检查两个矩形是否相交
 */
export function rectsIntersect(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  )
}

/**
 * 缩放到适应内容
 */
export function calculateFitZoom(
  contentBounds: BoundingBox,
  viewportSize: { width: number; height: number },
  padding = 50
): number {
  if (!contentBounds) return 1

  const availableWidth = viewportSize.width - padding * 2
  const availableHeight = viewportSize.height - padding * 2

  const scaleX = availableWidth / contentBounds.width
  const scaleY = availableHeight / contentBounds.height

  return Math.min(scaleX, scaleY, 1) // 最大放大到1倍
}

/**
 * 计算居中位置
 */
export function calculateCenterPosition(
  contentBounds: BoundingBox,
  viewportSize: { width: number; height: number },
  zoom: number
): Position {
  if (!contentBounds) return { x: 0, y: 0 }

  const scaledWidth = contentBounds.width * zoom
  const scaledHeight = contentBounds.height * zoom

  return {
    x: (viewportSize.width - scaledWidth) / 2 - contentBounds.minX * zoom,
    y: (viewportSize.height - scaledHeight) / 2 - contentBounds.minY * zoom,
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T
  }

  const clonedObj = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key])
    }
  }

  return clonedObj
}

/**
 * 获取设备像素比
 */
export function getDevicePixelRatio(): number {
  return window.devicePixelRatio || 1
}

/**
 * 检查是否支持触摸
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * 获取视窗大小
 */
export function getViewportSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}