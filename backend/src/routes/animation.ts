import express from 'express'
import { body } from 'express-validator'
import { validateRequest } from '../middleware/validateRequest'
import { llmService } from '../services/llm'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/errorHandler'
import { searchService, SearchResult } from '../services/search'

const router = express.Router()

const formatSearchResults = (results: SearchResult[]) => {
  if (!results || results.length === 0) return '暂无检索结果'
  return results
    .slice(0, 5)
    .map((r, index) => `${index + 1}. ${r.title}: ${r.snippet}`)
    .join('\n')
}

router.post(
  '/',
  [
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('context').optional().isObject(),
    body('config').optional().isObject(),
    validateRequest
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { description, context, config } = req.body
      logger.info('Generating animation code', { descriptionLength: description.length })

      const searchResults = await searchService.search(description, config?.search)
      const formattedSearchResults = formatSearchResults(searchResults)
      const mergedContext = { ...(context || {}), searchResults }

      const prompt = `
      You are an expert frontend developer specializing in creating interactive educational visualizations using HTML5, CSS, and vanilla JavaScript.

      Task: Create a self-contained, interactive HTML file that demonstrates/explains the concept: "${description}".

      Key Requirements:
      1. **Interactivity is Priority**: The visualization MUST be interactive. Users should be able to click, drag, input values, or control playback (Start/Pause/Reset) to see how the concept works. Static animations are not enough.
      2. **Visual Feedback**: Provide immediate visual feedback for user interactions.
      3. **Tech Stack**: Use vanilla HTML/CSS/JS. Use HTML5 Canvas API if complex drawing is needed, otherwise DOM manipulation is fine. No external heavy frameworks (React/Vue), but lightweight CDNs (like D3.js or GSAP) are allowed if they significantly enhance the result and are robust.
      4. **Self-Contained**: Output a SINGLE HTML string containing CSS in <style> and JS in <script>.
      5. **Design**: Use modern, clean styling (Apple-like aesthetics). Use a neutral background color that works well in both light and dark modes (e.g., #f9fafb or transparent with defined container styles).
      6. **Instructions**: Include brief on-screen instructions telling the user how to interact (e.g., "Drag the ball...", "Click to simulate...").

      检索摘要（来自联网检索）：
      ${formattedSearchResults}

      Context: ${JSON.stringify(mergedContext)}

      Response Format:
      Return ONLY the raw HTML code. Do NOT wrap in markdown code blocks.
      `

      // We reuse the chat method or call llm directly. 
      // Since llmService.chat is designed for chat, we might want a raw generation method.
      // But chat method is fine if we parse the output.
      
      // Let's assume we can use the existing chat or callOpenAI/callOllama methods if exposed.
      // Looking at llm.ts (from memory), chat calls callOllama/callOpenAI.
      // We can add a method 'generateCode' to llmService or just use chat and strip markdown.
      
      const response = await llmService.chat({ message: prompt }, config?.llm)
      
      // Clean up response (remove markdown code blocks if present)
      let code = response.replace(/^```html\n/, '').replace(/^```\n/, '').replace(/\n```$/, '')
      if (code.includes('```')) {
         // Fallback regex to extract code block
         const match = code.match(/```(?:html)?\n([\s\S]*?)\n```/)
         if (match) code = match[1]
      }

      res.json({
        success: true,
        data: {
          code,
          generatedAt: new Date().toISOString()
        }
      })
    } catch (error: any) {
      logger.error('Animation generation failed', { error: error.message })
      next(new AppError('Animation generation failed', 500))
    }
  }
)

export default router
