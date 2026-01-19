import express from 'express'
import { body, param, validationResult } from 'express-validator'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/errorHandler'
import { llmService } from '../services/llm'
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

// Generate node content
router.post('/:id/generate',
  [
    param('id').exists().withMessage('Node ID is required'),
    body('theme').isString().isLength({ min: 1, max: 200 }).withMessage('Theme must be 1-200 characters'),
    body('description').optional().isString(),
    body('language').optional().isIn(['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR']).withMessage('Invalid language'),
    body('length').optional().isIn(['short', 'medium', 'long']).withMessage('Invalid length'),
    body('context').optional().isObject(),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { id } = req.params
      const { theme, description, language = 'zh-CN', length = 'medium', context } = req.body

      logger.info('Generating node content', { nodeId: id, theme, language, length })

      // Step 1: Perform search
      const searchResults = await searchService.search(theme)

      // Step 2: Generate content using LLM
      const generatedContent = await llmService.generateNodeContent({
        theme,
        searchResults,
        language,
        length,
        context,
        description
      })

      // Step 3: Parse response (handle markdown code blocks)
      let parsedContent: any

      try {
        // Try direct JSON parse first
        parsedContent = JSON.parse(generatedContent)
      } catch (e) {
        // If direct parse fails, try to extract JSON from markdown code block
        const jsonMatch = generatedContent.match(/```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```/)
        if (jsonMatch) {
          try {
            parsedContent = JSON.parse(jsonMatch[1])
          } catch (e2: any) {
            throw new Error('Failed to parse JSON from LLM response: ' + e2.message)
          }
        } else {
          throw new Error('LLM response does not contain valid JSON: ' + generatedContent.substring(0, 200) + '...')
        }
      }

      const { summary, content_md } = parsedContent

      const result = {
        success: true,
        data: {
          nodeId: id,
          theme,
          summary,
          contentMd: content_md,
          searchResults,
          generatedAt: new Date().toISOString()
        }
      }

      logger.info('Node content generated successfully', { nodeId: id })
      res.json(result)

    } catch (error: any) {
      logger.error('Failed to generate node content', { error: error.message, stack: error.stack })
      next(new AppError('Failed to generate node content', 500))
    }
  }
)

// Get node ideas/recommendations
router.post('/:id/ideas',
  [
    param('id').exists().withMessage('Node ID is required'),
    body('theme').isString().isLength({ min: 1, max: 200 }).withMessage('Theme must be 1-200 characters'),
    body('context').optional().isObject(),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { id } = req.params
      const { theme, context } = req.body

      logger.info('Generating node ideas', { nodeId: id, theme, hasContext: !!context })

      // Step 1: Search for related topics
      const searchResults = await searchService.search(theme)

      // Step 2: Generate ideas using LLM with context
      const ideas = await llmService.generateIdeas({
        theme,
        searchResults,
        language: 'zh-CN',
        context
      })

      // Step 3: Parse ideas (handle markdown code blocks)
      let ideaList: string[]

      try {
        // Try direct JSON parse first
        ideaList = JSON.parse(ideas)
      } catch (e) {
        // If direct parse fails, try to extract JSON from markdown code block
        const jsonMatch = ideas.match(/```(?:json)?\s*\n?(\[[\s\S]*?\])\s*\n?```/)
        if (jsonMatch) {
          try {
            ideaList = JSON.parse(jsonMatch[1])
          } catch (e2: any) {
            throw new Error('Failed to parse ideas JSON from LLM response: ' + e2.message)
          }
        } else {
          throw new Error('LLM response does not contain valid ideas JSON: ' + ideas.substring(0, 200) + '...')
        }
      }

      const result = {
        success: true,
        data: {
          nodeId: id,
          theme,
          ideas: ideaList,
          searchResults,
          generatedAt: new Date().toISOString()
        }
      }

      logger.info('Node ideas generated successfully', { nodeId: id, ideaCount: ideaList.length })
      res.json(result)

    } catch (error: any) {
      logger.error('Failed to generate node ideas', { error: error.message, stack: error.stack })
      next(new AppError('Failed to generate node ideas', 500))
    }
  }
)

// Generate mindmap data
router.post('/:id/mindmap',
  [
    param('id').exists().withMessage('Node ID is required'),
    body('content').isString().isLength({ min: 1 }).withMessage('Content is required'),
    body('language').optional().isIn(['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR']).withMessage('Invalid language'),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { id } = req.params
      const { content, language = 'zh-CN' } = req.body

      logger.info('Generating mindmap', { nodeId: id, language })

      const query = (() => {
        const h1Match = (content || '').match(/^#\s+(.+)$/m)
        if (h1Match) return h1Match[1].trim()
        return (content || '').slice(0, 120)
      })()

      const searchResults = await searchService.search(query)

      const resp = await llmService.generateMindMap({
        content,
        language,
        searchResults
      })

      let mindmap: any
      try {
        mindmap = JSON.parse(resp)
      } catch (e) {
        const jsonMatch = resp.match(/```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```/)
        if (jsonMatch) {
          mindmap = JSON.parse(jsonMatch[1])
        } else {
          throw new Error('LLM response does not contain valid mindmap JSON')
        }
      }

      const result = {
        success: true,
        data: {
          mindmap,
          generatedAt: new Date().toISOString()
        }
      }

      logger.info('Mindmap generated successfully', { nodeId: id })
      res.json(result)
    } catch (error: any) {
      logger.error('Failed to generate mindmap', { error: error.message, stack: error.stack })
      next(new AppError('Failed to generate mindmap', 500))
    }
  }
)


export default router
