import express from 'express'
import { body, validationResult } from 'express-validator'
import { userStore } from '../services/userStore'
import { sessionStore } from '../services/sessionStore'
import { attachUser } from '../middleware/auth'

const router = express.Router()

const validate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { message: 'Validation failed' }, timestamp: new Date().toISOString() })
    return
  }
  next()
}

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isString().isLength({ min: 8, max: 200 }).withMessage('Password length must be 8-200'),
    body('displayName').optional().isString().isLength({ min: 1, max: 80 }),
    validate,
  ],
  async (req: express.Request, res: express.Response) => {
    const { email, password, displayName } = req.body
    try {
      const user = await userStore.create(email, password, displayName)
      res.json({ success: true, data: { user: { id: user.id, email: user.email, displayName: user.displayName } }, timestamp: new Date().toISOString() })
    } catch (e: any) {
      if (e?.message === 'EMAIL_EXISTS') {
        res.status(409).json({ success: false, error: { message: 'Email already registered' }, timestamp: new Date().toISOString() })
        return
      }
      res.status(500).json({ success: false, error: { message: 'Register failed' }, timestamp: new Date().toISOString() })
    }
  }
)

router.post(
  '/login',
  [body('email').isEmail(), body('password').isString().isLength({ min: 8, max: 200 }), validate],
  async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body
    const user = await userStore.verify(email, password)
    if (!user) {
      res.status(401).json({ success: false, error: { message: 'Invalid credentials' }, timestamp: new Date().toISOString() })
      return
    }
    const session = sessionStore.create(user.id)
    const isProd = process.env.NODE_ENV === 'production'
    res.cookie('sid', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: (session.expiresAt.getTime() - Date.now()),
    })
    res.json({ success: true, data: { user: { id: user.id, email: user.email, displayName: user.displayName } }, timestamp: new Date().toISOString() })
  }
)

router.post('/logout', (req: express.Request, res: express.Response) => {
  const sid = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('sid='))?.split('=')[1]
  if (sid) {
    sessionStore.destroy(sid)
    res.clearCookie('sid', { path: '/' })
  }
  res.json({ success: true, data: { ok: true }, timestamp: new Date().toISOString() })
})

router.get('/me', attachUser, async (req: express.Request, res: express.Response) => {
  const user = (req as any).currentUser
  if (!user) {
    res.status(401).json({ success: false, error: { message: 'Unauthorized' }, timestamp: new Date().toISOString() })
    return
  }
  res.json({ success: true, data: { user: { id: user.id, email: user.email, displayName: user.displayName } }, timestamp: new Date().toISOString() })
})

export default router
