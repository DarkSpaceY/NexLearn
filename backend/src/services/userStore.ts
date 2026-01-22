import crypto from 'crypto'
import { getAuthState, saveAuthState, PersistedUserRecord } from './authStorage'

export interface User {
  id: string
  email: string
  passwordHash: string
  displayName?: string
  createdAt: Date
  updatedAt: Date
}

const usersById = new Map<string, User>()
const emailToId = new Map<string, string>()

const authState = getAuthState()

const toUser = (record: PersistedUserRecord): User => ({
  id: record.id,
  email: record.email,
  passwordHash: record.passwordHash,
  displayName: record.displayName,
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
})

const toRecord = (user: User): PersistedUserRecord => ({
  id: user.id,
  email: user.email,
  passwordHash: user.passwordHash,
  displayName: user.displayName,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
})

const stripPassword = (user: User): User => ({
  ...user,
  passwordHash: '',
})

const hydrate = () => {
  authState.users.forEach(record => {
    const user = toUser(record)
    usersById.set(user.id, user)
    emailToId.set(user.email, user.id)
  })
}

hydrate()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const saltHex = parts[1]
  const keyHex = parts[2]
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(keyHex, 'hex')
  const actual = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(actual, expected)
}

export const userStore = {
  async create(email: string, password: string, displayName?: string): Promise<User> {
    if (emailToId.has(email)) {
      throw new Error('EMAIL_EXISTS')
    }
    const id = crypto.randomUUID()
    const now = new Date()
    const user: User = {
      id,
      email,
      passwordHash: hashPassword(password),
      displayName,
      createdAt: now,
      updatedAt: now,
    }
    usersById.set(id, user)
    emailToId.set(email, id)
    authState.users.push(toRecord(user))
    saveAuthState()
    return stripPassword(user)
  },

  async getByEmail(email: string): Promise<User | null> {
    const id = emailToId.get(email)
    if (!id) return null
    const u = usersById.get(id)
    if (!u) return null
    return stripPassword(u)
  },

  async getById(id: string): Promise<User | null> {
    const u = usersById.get(id)
    if (!u) return null
    return stripPassword(u)
  },

  async verify(email: string, password: string): Promise<User | null> {
    const id = emailToId.get(email)
    if (!id) return null
    const u = usersById.get(id)
    if (!u) return null
    const ok = verifyPassword(password, u.passwordHash)
    if (!ok) return null
    return stripPassword(u)
  },
}
