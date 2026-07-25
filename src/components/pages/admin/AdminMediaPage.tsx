'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { Camera, Upload, Trash2, Copy, Search, FolderOpen } from 'lucide-react'

interface MediaFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  createdAt: string
  folder?: string
}

export default function AdminMediaPage() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const res = await fetch(`/api/media?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setFiles(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch media')
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function handleUpload(filesList: FileList | File[]) {
    setUploading(true)
    const formData = new FormData()
    Array.from(filesList).forEach((f) => formData.append('files', f))
    try {
      const res = await authFetch('/api/uploads', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      toast.success(`${filesList.length} file(s) uploaded`)
      fetchFiles()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/media/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('File deleted')
      fetchFiles()
    } catch {
      toast.error('Failed to delete file')
    } finally {
      setDeleteId(null)
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    toast.success('URL copied to clipboard')
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(type: string) {
    if (type?.startsWith('image')) return '🖼️'
    if (type?.startsWith('video')) return '🎬'
    if (type?.startsWith('application/pdf')) return '📄'
    return '📁'
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardContent
          className={`p-6 border-2 border-dashed rounded-lg transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
          }}
        >
          <div className="text-center">
            <Upload className="mx-auto size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag & drop files here, or click to upload
            </p>
            <Input
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
              className="max-w-xs mx-auto"
              disabled={uploading}
            />
            {uploading && <p className="text-sm text-muted-foreground mt-2">Uploading...</p>}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Files Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Camera className="mx-auto size-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No media files found</p>
            <p className="text-xs text-muted-foreground mt-1">Upload files using the area above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file) => (
            <Card key={file.id} className="group relative overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {file.type?.startsWith('image') ? (
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">{getFileIcon(file.type)}</span>
                )}
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => copyUrl(file.url)} title="Copy URL">
                    <Copy className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={() => setDeleteId(file.id)} title="Delete">
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete File</AlertDialogTitle><AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
