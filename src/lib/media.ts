import path from 'path'
import { unlink } from 'fs/promises'
import { db } from '@/lib/db'
import { deleteCloudinaryAsset, getCloudinaryPublicId } from '@/lib/cloudinary'

function getManagedUploadPath(url: string): string | null {
  const normalizedUrl = url.replace(/\\/g, '/')
  if (!normalizedUrl.startsWith('/uploads/')) return null

  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
  const filePath = path.resolve(process.cwd(), 'public', normalizedUrl.slice(1))
  const relativePath = path.relative(uploadsRoot, filePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null
  return filePath
}

export async function deleteManagedMedia(urls: Array<string | null | undefined>) {
  const uniqueUrls = [...new Set(urls.filter((url): url is string => Boolean(url)))]
  const managedUrls = uniqueUrls.filter((url) => getManagedUploadPath(url))
  const cloudinaryUrls = uniqueUrls
    .map((url) => ({ url, publicId: getCloudinaryPublicId(url) }))
    .filter((item): item is { url: string; publicId: string } => Boolean(item.publicId))

  await Promise.all(
    managedUrls.map(async (url) => {
      const filePath = getManagedUploadPath(url)
      if (!filePath) return

      try {
        await unlink(filePath)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT') {
          console.error(`Failed to delete uploaded media: ${url}`, error)
        }
      }
    })
  )

  await Promise.all(
    cloudinaryUrls.map(async ({ url, publicId }) => {
      try {
        await deleteCloudinaryAsset(publicId)
      } catch (error) {
        console.error(`Failed to delete Cloudinary media: ${url}`, error)
      }
    })
  )

  const dbManagedUrls = [...managedUrls, ...cloudinaryUrls.map((item) => item.url)]
  if (dbManagedUrls.length > 0) {
    await db.mediaFile.deleteMany({ where: { url: { in: dbManagedUrls } } })
  }
}
