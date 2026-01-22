import crypto from 'crypto'
import { getAuthState, saveAuthState, PersistedSessionRecord } from './authStorage'

export interface Session {
  id: string
  userId: string
  createdAt: Date
  expiresAt: Date
}

const sessions = new Map<string, Session>()
const authState = getAuthState()

const toSession = (record: PersistedSessionRecord): Session => ({
  id: record.id,
  userId: record.userId,
  createdAt: new Date(record.createdAt),
  expiresAt: new Date(record.expiresAt),
})

const toRecord = (session: Session): PersistedSessionRecord => ({
  id: session.id,
  userId: session.userId,
  createdAt: session.createdAt.toISOString(),
  expiresAt: session.expiresAt.toISOString(),
})

const hydrate = () => {
  authState.sessions.forEach(record => {
    const session = toSession(record)
    if (session.expiresAt.getTime() > Date.now()) {
      sessions.set(session.id, session)
    }
  })
  authState.sessions = authState.sessions.filter(s => {
    const exp = new Date(s.expiresAt).getTime()
    return exp > Date.now()
  })
  saveAuthState()
}

hydrate()

export const sessionStore = {
  create(userId: string, ttlMinutes = 24 * 60): Session {
    const id = crypto.randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000)
    const s: Session = { id, userId, createdAt: now, expiresAt }
    sessions.set(id, s)
    authState.sessions.push(toRecord(s))
    saveAuthState()
    return s
  },

  get(id: string): Session | null {
    const s = sessions.get(id)
    if (!s) return null
    if (s.expiresAt.getTime() <= Date.now()) {
      sessions.delete(id)
      authState.sessions = authState.sessions.filter(record => record.id !== id)
      saveAuthState()
      return null
    }
    return s
  },

  destroy(id: string): void {
    sessions.delete(id)
    authState.sessions = authState.sessions.filter(record => record.id !== id)
    saveAuthState()
  },
}
