import express from 'express'
import { body } from 'express-validator'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/errorHandler'
import { validateRequest } from '../middleware/validateRequest'
import { llmService } from '../services/llm'
import { searchService } from '../services/search'

const router = express.Router()

const buildSearchQuery = (message: string, context?: any) => {
  const base = (message || '').trim()
  if (!base) return ''
  const visibleText = typeof context?.visibleText === 'string' ? context.visibleText.trim() : ''
  const combined = visibleText ? `${base} ${visibleText}` : base
  return combined.length > 200 ? combined.slice(0, 200) : combined
}

router.post('/',
  [
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('history').optional().isArray(),
    body('context').optional().isObject(),
    body('config').optional().isObject(),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { message, history, context, config } = req.body
      logger.info('Processing chat request', { messageLength: message.length })

      const searchQuery = buildSearchQuery(message, context)
      const searchResults = searchQuery ? await searchService.search(searchQuery, config?.search) : []
      const nextContext = { ...(context || {}), searchResults }
      const reply = await llmService.chat({ message, history, context: nextContext }, config?.llm)

      res.json({
        success: true,
        data: {
          reply,
          generatedAt: new Date().toISOString()
        }
      })
    } catch (error: any) {
      logger.error('Chat request failed', { error: error.message })
      next(new AppError('Chat failed', 500))
    }
  }
)

export default router
