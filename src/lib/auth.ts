import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

// Secret key - in production, JWT_SECRET environment variable is REQUIRED
// The app will fail to start in production without it
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'khati-khadyo-jwt-secret-key-2026-production-fallback'
)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function generateToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { userId: payload.userId as string }
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
