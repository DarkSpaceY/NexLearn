import type { Request, Response, NextFunction } from 'express'
import { sessionStore } from '../services/sessionStore'
import { userStore } from '../services/userStore'

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  const parts = cookieHeader.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (!k) continue
    const v = rest.join('=')
    if (!v) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie)
  const sid = cookies['sid']
  if (!sid) return next()
  const s = sessionStore.get(sid)
  if (!s) return next()
  const user = await userStore.getById(s.userId)
  if (user) {
    ;(req as any).currentUser = user
  }
  next()
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const u = (req as any).currentUser
  if (!u) {
    res.status(401).json({ success: false, error: { message: 'Unauthorized' }, timestamp: new Date().toISOString() })
    return
  }
  next()
}
