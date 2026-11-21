/**
 * Automatic Prisma Migration Deployment on Build
 * Safely deploys pending migrations when DATABASE_URL is available.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

// If running locally where .env exists and process.env.DATABASE_URL isn't pre-loaded
if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=')
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '')
        }
      }
    }
  } catch (_) {}
}

if (process.env.DATABASE_URL) {
  try {
    console.log('[deploy-migrations] DATABASE_URL detected. Applying pending migrations...')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    console.log('[deploy-migrations] Database migrations are up to date.')
  } catch (error) {
    console.warn('[deploy-migrations] Migration deployment warning:', error instanceof Error ? error.message : String(error))
  }
} else {
  console.log('[deploy-migrations] DATABASE_URL not set; skipping automated migration deployment.')
}
