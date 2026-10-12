import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  // A committed fallback makes every deployment forgeable. Keep the check at
  // request time so builds can run without production secrets, but never sign
  // or trust a token when the real secret is absent or weak.
  if (!secret || secret.length < 32) {
    throw new Error('JWT signing is not configured')
  }
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function generateToken(userId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ userId, sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

export async function verifyToken(token: string): Promise<{ userId: string; sessionVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const sessionVersion = payload.sv
    if (typeof payload.userId !== 'string' || typeof sessionVersion !== 'number') return null
    return { userId: payload.userId, sessionVersion }
  } catch {
    return null
  }
}

export async function getUserFromToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)
  return payload?.userId || null
}
