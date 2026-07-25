import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaginationParams, paginatedResponse } from '@/lib/utils'
import { csrfGuard, rateLimitOrResponse, requireAdmin } from '@/lib/security'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'application/pdf']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function sanitizeFilename(name: string): string {
  const base = path.basename(name)
  return base.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(url)
    const folder = url.searchParams.get('folder')
    const type = url.searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (folder) where.folder = folder
    if (type) where.type = type

    const [files, total] = await Promise.all([
      db.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.mediaFile.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: paginatedResponse(files, total, page, limit),
    })
  } catch (error) {
    console.error('Get media error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const limited = rateLimitOrResponse(request, 'media-upload', 20, 60 * 1000)
    if (limited) return limited
    const admin = await requireAdmin(request)
    if (!admin.ok) return admin.response

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = sanitizeFilename((formData.get('folder') as string) || 'general')
    const alt = (formData.get('alt') as string) || null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum 10MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `File type ${file.type} is not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `File extension ${ext} is not allowed.` },
        { status: 400 }
      )
    }

    const safeExt = ext || '.jpg'
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${safeExt}`
    const filepath = path.join(uploadDir, filename)

    await writeFile(filepath, buffer)

    const url = `/uploads/${folder}/${filename}`

    // Determine type
    let type = 'document'
    if (file.type.startsWith('image/')) type = 'image'
    else if (file.type.startsWith('video/')) type = 'video'
    else if (file.type === 'application/pdf') type = 'pdf'

    const mediaFile = await db.mediaFile.create({
      data: {
        name: sanitizeFilename(file.name),
        url,
        type,
        mimeType: file.type,
        size: file.size,
        folder,
        alt,
      },
    })

    return NextResponse.json({ success: true, data: mediaFile }, { status: 201 })
  } catch (error) {
    console.error('Upload media error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
