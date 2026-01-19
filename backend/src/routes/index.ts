import express from 'express'
import nodeRoutes from './nodes'
import searchRoutes from './search'
import chatRoutes from './chat'
import animationRoutes from './animation'

const router = express.Router()

// Mount sub-routes
router.use('/nodes', nodeRoutes)
router.use('/search', searchRoutes)
router.use('/chat', chatRoutes)
router.use('/animation', animationRoutes)

// Health check
router.get('/health', (req, res) => {
  void req
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// API info
router.get('/', (req, res) => {
  void req
  res.json({
    success: true,
    message: 'NexLearn AI API',
    version: '1.0.0',
    endpoints: {
      nodes: '/api/v1/nodes',
      search: '/api/v1/search',
      code: '/api/v1/code'
    }
  })
})

export default router
