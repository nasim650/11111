import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { db } from '@/lib/db'
import { uploadImageToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary'
import { csrfGuard, rateLimitOrResponse, requireAdmin } from '@/lib/security'
import { createAuditLog } from '@/lib/audit'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 5
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

function sanitizeFilename(name: string): string {
  // Remove path traversal attempts and dangerous characters
  const base = path.basename(name)
  // Replace any non-alphanumeric, non-dot, non-dash, non-underscore characters
  return base.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

/**
 * Fallback: save file to local filesystem under public/uploads/{folder}/
 * Returns a URL path like /uploads/{folder}/{filename}
 */
async function uploadToLocal(file: File, folder: string): Promise<{ url: string; filename: string; size: number }> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
  await mkdir(uploadDir, { recursive: true })

  const ext = path.extname(file.name).toLowerCase() || '.jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
  const filepath = path.join(uploadDir, filename)

  await writeFile(filepath, buffer)

  const url = `/uploads/${folder}/${filename}`
  return { url, filename, size: file.size }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const limited = rateLimitOrResponse(request, 'uploads', 20, 60 * 1000)
    if (limited) return limited
    const admin = await requireAdmin(request)
    if (!admin.ok) return admin.response

    const formData = await request.formData()
    const folder = sanitizeFilename((formData.get('folder') as string) || 'general')

    // Support both single file and multiple files
    const files: File[] = []
    const singleFile = formData.get('file') as File | null
    if (singleFile) {
      files.push(singleFile)
    }
    // Also check for multiple files under 'files' key
    const multiFiles = formData.getAll('files') as File[]
    if (multiFiles.length > 0) {
      files.push(...multiFiles)
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate maximum files per request
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_FILES} files allowed per request` },
        { status: 400 }
      )
    }

    const useCloudinary = isCloudinaryConfigured()
    if (process.env.NODE_ENV !== 'production') {
      console.log('[uploads] useCloudinary=' + useCloudinary + ' cloudName=' + JSON.stringify(process.env.CLOUDINARY_CLOUD_NAME) + ' apiKeyEmpty=' + !process.env.CLOUDINARY_API_KEY + ' apiSecretEmpty=' + !process.env.CLOUDINARY_API_SECRET)
    }
    const uploadedFiles: Array<{ url: string; filename: string; originalName: string; size: number; type: string }> = []

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `File type ${file.type} is not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate file extension (double-check even if MIME type is valid)
      const ext = path.extname(file.name).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { success: false, error: `File extension ${ext} is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" exceeds maximum allowed size of 5MB` },
          { status: 400 }
        )
      }

      const safeExt = ext || '.jpg'
      let url: string
      let filename: string
      let size: number

      if (useCloudinary) {
        // Upload to Cloudinary
        try {
          const upload = await uploadImageToCloudinary(file, folder)
          url = upload.url
          filename = `${upload.publicId}${safeExt}`
          size = upload.bytes || file.size
        } catch (cloudinaryError) {
          console.error('Cloudinary upload failed, falling back to local:', cloudinaryError)
          const local = await uploadToLocal(file, folder)
          url = local.url
          filename = local.filename
          size = local.size
        }
      } else {
        // Cloudinary not configured — use local filesystem
        const local = await uploadToLocal(file, folder)
        url = local.url
        filename = local.filename
        size = local.size
      }

      uploadedFiles.push({
        url,
        filename,
        originalName: file.name,
        size,
        type: file.type,
      })

      await db.mediaFile.create({
        data: {
          name: sanitizeFilename(file.name),
          url,
          type: 'image',
          mimeType: file.type,
          size,
          folder,
          alt: null,
        },
      })
    }

    await createAuditLog({
      adminId: admin.userId,
      action: 'upload',
      module: 'media',
      newData: uploadedFiles.map((file) => ({ url: file.url, type: file.type, size: file.size })),
    })

    return NextResponse.json({
      success: true,
      data: uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles,
      files: uploadedFiles,
    }, { status: 201 })
  } catch (error) {
    console.error('Upload file error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
