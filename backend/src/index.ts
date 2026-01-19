import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { notFoundHandler } from './middleware/notFoundHandler'
import routes from './routes'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config()

import net from 'net'

const app = express()
const START_PORT = Number(process.env.PORT) || 3001

// Security middleware
app.use(helmet())

// CORS configuration
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]))

app.use(cors({
  origin: (origin, callback) => {
    // 允许非浏览器或同源请求（如服务器间调用）
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS: Origin ${origin} not allowed`), false)
  },
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: (Number(process.env.API_RATE_WINDOW) || 15) * 60 * 1000, // Default 15 minutes
  max: Number(process.env.API_RATE_LIMIT) || 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Compression middleware
app.use(compression())

// Logging middleware
app.use((req, res, next) => {
  void res
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined
  })
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  void req
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// API routes
app.use('/api/v1', routes)

// Error handling middleware
app.use(notFoundHandler)
app.use(errorHandler)

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '0.0.0.0')
  })
}

async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let p = start; p <= end; p++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isPortAvailable(p)
    if (ok) return p
  }
  throw new Error('No available port')
}

async function start() {
  const max = Number(process.env.PORT_MAX) || (START_PORT + 99)
  let port = START_PORT
  try {
    port = await findAvailablePort(START_PORT, max)
  } catch (e: any) {
    logger.error('Failed to find available port', { error: e?.message })
    process.exit(1)
  }
  app.listen(port, () => {
    logger.info(`Server started on port ${port}`, {
      environment: process.env.NODE_ENV,
      port,
      basePath: '/api/v1'
    })
  })
}

void start()

export default app
