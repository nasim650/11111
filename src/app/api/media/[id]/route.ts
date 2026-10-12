import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfGuard, rateLimitOrResponse, requireAdmin } from '@/lib/security'
import { deleteManagedMedia } from '@/lib/media'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = csrfGuard(request)
    if (csrf) return csrf
    const limited = await rateLimitOrResponse(request, 'media-delete', 30, 60 * 1000)
    if (limited) return limited
    const admin = await requireAdmin(request)
    if (!admin.ok) return admin.response

    const { id } = await params
    const media = await db.mediaFile.findUnique({ where: { id } })

    if (!media) {
      return NextResponse.json(
        { success: false, error: 'Media file not found' },
        { status: 404 }
      )
    }

    // Delete the physical file (local or Cloudinary) and matching DB records by URL
    await deleteManagedMedia([media.url])

    // Safety net: delete by ID in case deleteManagedMedia didn't match the URL pattern
    await db.mediaFile.deleteMany({ where: { id } })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete media error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
