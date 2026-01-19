import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { MindMapData, MindMapNode, MindMapEdge } from '@/types'

interface MindMapGraphProps {
  data: MindMapData
  isDark: boolean
  onNodeClick?: (nodeId: string) => void
}

export const MindMapGraph: React.FC<MindMapGraphProps> = ({ data, isDark, onNodeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const { offsetWidth, offsetHeight } = containerRef.current
    setDimensions({ width: offsetWidth || 800, height: offsetHeight || 600 })
  }, [])

  useEffect(() => {
    if (!containerRef.current || !data.nodes.length) return

    // Clear previous graph
    d3.select(containerRef.current).selectAll('*').remove()

    const width = dimensions.width
    const height = dimensions.height

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('max-width', '100%')
      .style('height', 'auto')

    // Prepare data for d3
    const links = data.edges.map(d => ({ ...d, source: d.fromId, target: d.toId }))
    const nodes = data.nodes.map(d => ({ ...d }))

    // Simulation setup
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(50))

    // Draw lines for links
    const link = svg.append('g')
      .attr('stroke', isDark ? '#555' : '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1.5)

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)
      .on('click', (event, d) => {
        if (!d.hasContent) return
        if (onNodeClick) onNodeClick(d.id)
      })
      .style('cursor', (d: any) => d.hasContent ? 'pointer' : 'default')

    // Node circles
    node.append('circle')
      .attr('r', 20)
      .attr('fill', (d: any) => {
         if (!d.hasContent) return isDark ? '#374151' : '#f3f4f6'
         // Root node color or default
         return d.parentId ? (isDark ? '#1f2937' : '#fff') : (isDark ? '#3b82f6' : '#2563eb')
      })
      .attr('stroke', (d: any) => {
        if (!d.hasContent) return isDark ? '#4b5563' : '#d1d5db'
        return isDark ? '#4b5563' : '#2563eb'
      })
      .attr('stroke-width', 2)

    // Indicators
    const indicators = node.append('g')
      .attr('transform', 'translate(0, -28)') // Position above the node

    const iconColor = isDark ? '#e5e7eb' : '#1f2937'
    const shouldShowIndicators = (d: any) => Boolean(d.hasContent)

    const appendIcon = (
      selection: d3.Selection<any, any, any, any>,
      options: { x: number; title: string; pathD: string }
    ) => {
      selection
        .append('svg')
        .attr('width', 12)
        .attr('height', 12)
        .attr('x', options.x - 6)
        .attr('y', -6)
        .attr('viewBox', '0 0 24 24')
        .append('path')
        .attr('d', options.pathD)
        .attr('fill', iconColor)
        .append('title')
        .text(options.title)
    }

    // Annotations
    appendIcon(
      indicators.filter((d: any) => shouldShowIndicators(d) && d.stats?.hasAnnotations),
      {
        x: -14,
        title: '包含批注',
        pathD:
          'M6 3h10l2 2v16H6V3zm10 1.5V7h2.5L16 4.5zM8 10h8v2H8v-2zm0 4h8v2H8v-2zm0 4h6v2H8v-2z'
      }
    )

    // Favorites
    appendIcon(
      indicators.filter((d: any) => shouldShowIndicators(d) && d.stats?.hasFavorites),
      {
        x: 0,
        title: '包含收藏',
        pathD:
          'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z'
      }
    )

    // Animations
    appendIcon(
      indicators.filter((d: any) => shouldShowIndicators(d) && d.stats?.hasAnimations),
      {
        x: 14,
        title: '包含动画',
        pathD: 'M8 5v14l11-7L8 5z'
      }
    )

    // Node labels
    node.append('text')
      .text((d: any) => d.text)
      .attr('x', 25)
      .attr('y', 5)
      .style('font-size', '12px')
      .style('fill', isDark ? '#e5e7eb' : '#1f2937')
      .style('pointer-events', 'none')
      .style('text-shadow', isDark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)')

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: any) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [data, dimensions, isDark, onNodeClick])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full border border-border rounded-lg bg-background/50 overflow-hidden relative"
    />
  )
}
