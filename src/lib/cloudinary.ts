import crypto from 'crypto'

type CloudinaryUpload = {
  secure_url: string
  public_id: string
  bytes: number
  format: string
  resource_type: string
}

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName, apiKey, apiSecret }
}

/**
 * Cloud name only (for URL parsing). Used by getCloudinaryPublicId so that
 * public-id extraction works even when the full API credentials are not set
 * (e.g. during local dev or when only the cloud name is known).
 */
function cloudName(): string | null {
  return process.env.CLOUDINARY_CLOUD_NAME || null
}

function sign(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex')
}

export function isCloudinaryConfigured(): boolean {
  // Explicitly check for non-empty values — empty strings in .env should not
  // count as "configured". This guards against the case where
  // CLOUDINARY_CLOUD_NAME is set but the API key/secret are blank.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  return Boolean(cloudName && apiKey && apiSecret && cloudName.trim() && apiKey.trim() && apiSecret.trim())
}

export async function uploadImageToCloudinary(file: File, folder: string): Promise<{
  url: string
  publicId: string
  bytes: number
  format: string
  resourceType: string
}> {
  const config = cloudinaryConfig()
  if (!config) {
    throw new Error('Cloudinary is not configured')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const safeFolder = `khati-khadyo/${folder.replace(/[^a-zA-Z0-9/_-]/g, '') || 'general'}`
  const params = { folder: safeFolder, timestamp }
  const signature = sign(params, config.apiSecret)

  const formData = new FormData()
  formData.set('file', file)
  formData.set('api_key', config.apiKey)
  formData.set('timestamp', String(timestamp))
  formData.set('folder', safeFolder)
  formData.set('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Cloudinary upload failed: ${response.status} ${detail}`)
  }

  const result = await response.json() as CloudinaryUpload
  return {
    url: result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/'),
    publicId: result.public_id,
    bytes: result.bytes,
    format: result.format,
    resourceType: result.resource_type,
  }
}

export function getCloudinaryPublicId(url: string): string | null {
  const name = cloudName()
  if (!name || !url.includes(`res.cloudinary.com/${name}/`)) return null

  try {
    const parsed = new URL(url)
    const marker = '/image/upload/'
    const markerIndex = parsed.pathname.indexOf(marker)
    if (markerIndex === -1) return null

    let rest = parsed.pathname.slice(markerIndex + marker.length)
    rest = rest.replace(/^f_auto,q_auto\//, '')
    rest = rest.replace(/^v\d+\//, '')
    return rest.replace(/\.[^.]+$/, '') || null
  } catch {
    return null
  }
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  const config = cloudinaryConfig()
  if (!config) return

  const timestamp = Math.floor(Date.now() / 1000)
  const params = { public_id: publicId, timestamp }
  const signature = sign(params, config.apiSecret)
  const formData = new FormData()
  formData.set('public_id', publicId)
  formData.set('api_key', config.apiKey)
  formData.set('timestamp', String(timestamp))
  formData.set('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Cloudinary delete failed: ${response.status} ${detail}`)
  }
}
