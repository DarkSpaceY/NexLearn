import express from 'express'
import { attachUser, requireAuth } from '../middleware/auth'
import { preferencesStore } from '../services/preferencesStore'

const router = express.Router()

router.use(attachUser)
router.use(requireAuth)

router.get('/preferences', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const user = (req as any).currentUser
    const prefs = preferencesStore.getForUser(user.id)
    res.json({
      success: true,
      data: {
        preferences: prefs || null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

router.put('/preferences', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const user = (req as any).currentUser
    const raw = req.body?.preferences
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid preferences payload' },
        timestamp: new Date().toISOString(),
      })
      return
    }
    const saved = preferencesStore.saveForUser(user.id, raw)
    res.json({
      success: true,
      data: {
        preferences: saved,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

export default router

