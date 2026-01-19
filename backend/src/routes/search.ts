import express from 'express'
import { query, validationResult } from 'express-validator'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/errorHandler'
import { searchService } from '../services/search'

const router = express.Router()

// Validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  void res
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400))
  }
  next()
}

// Search endpoint
router.get('/',
  [
    query('q').isString().isLength({ min: 1, max: 500 }).withMessage('Query must be 1-500 characters'),
    query('limit').optional().isInt({ min: 1, max: 20 }).toInt().withMessage('Limit must be 1-20'),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const query = req.query.q as string
      const limit = (req.query.limit as any) || 10

      logger.info('Processing search request', { query, limit })

      // Perform search
      const results = await searchService.search(query)

      // Apply limit
      const limitedResults = results.slice(0, limit)

      const response = {
        success: true,
        data: {
          query,
          results: limitedResults,
          totalResults: results.length,
          limitedResults: limitedResults.length,
          searchedAt: new Date().toISOString()
        }
      }

      logger.info('Search request completed', {
        query,
        resultCount: limitedResults.length,
        totalResults: results.length
      })

      res.json(response)

    } catch (error: any) {
      logger.error('Search request failed', {
        error: error.message,
        query: req.query.q,
        stack: error.stack
      })
      next(new AppError('Search failed', 500))
    }
  }
)

// Mock search endpoint (for development/testing)
router.get('/mock',
  [
    query('q').isString().isLength({ min: 1, max: 500 }).withMessage('Query must be 1-500 characters'),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const query = req.query.q as string

      logger.info('Processing mock search request', { query })

      const results = await searchService.mockSearch(query)

      const response = {
        success: true,
        data: {
          query,
          results,
          totalResults: results.length,
          isMock: true,
          searchedAt: new Date().toISOString()
        }
      }

      res.json(response)

    } catch (error: any) {
      logger.error('Mock search request failed', {
        error: error.message,
        query: req.query.q,
        stack: error.stack
      })
      next(new AppError('Mock search failed', 500))
    }
  }
)

export default router
