import express from 'express'
import { body } from 'express-validator'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/errorHandler'
import { validateRequest } from '../middleware/validateRequest'
import { llmService } from '../services/llm'

const router = express.Router()

router.post('/',
  [
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('history').optional().isArray(),
    body('context').optional().isObject(),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { message, history, context } = req.body
      logger.info('Processing chat request', { messageLength: message.length })

      const reply = await llmService.chat({ message, history, context })

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
