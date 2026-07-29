'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { Plus, Pencil, Trash2, Upload, ImageIcon, Eye } from 'lucide-react'

interface Banner {
  id: string
  title: string
  subtitle?: string
  description?: string
  desktopImage?: string
  mobileImage?: string
  link?: string
  ctaText?: string
  ctaLink?: string
  startDate?: string
  endDate?: string
  location: string
  isActive: boolean
  sortOrder: number
  bgColor?: string
  textColor?: string
}

const emptyBanner: Partial<Banner> = {
  title: '',
  subtitle: '',
  description: '',
  desktopImage: '',
  mobileImage: '',
  link: '',
  ctaText: '',
  ctaLink: '',
  startDate: '',
  endDate: '',
  location: 'hero',
  isActive: true,
  sortOrder: 0,
  bgColor: '',
  textColor: '',
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Banner> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/banners?admin=true&limit=100')
      if (res.ok) {
        const data = await res.json()
        setBanners(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch banners')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBanners() }, [fetchBanners])

  function openCreate() {
    setEditing({ ...emptyBanner })
    setDialogOpen(true)
  }

  function openEdit(b: Banner) {
    setEditing({ ...b })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!editing?.title) {
      toast.error('Banner title is required')
      return
    }
    setSaving(true)
    try {
      const payload = { ...editing, sortOrder: Number(editing.sortOrder) || 0 }
      const isEdit = !!editing.id
      const url = isEdit ? `/api/banners/${editing.id}` : '/api/banners'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      toast.success(isEdit ? 'Banner updated' : 'Banner created')
      setDialogOpen(false)
      fetchBanners()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save banner')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/banners/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Banner deleted')
      fetchBanners()
    } catch {
      toast.error('Failed to delete banner')
    } finally {
      setDeleteId(null)
    }
  }

  async function handleImageUpload(field: 'desktopImage' | 'mobileImage') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const formData = new FormData()
      formData.append('files', file)
      try {
        const res = await authFetch('/api/uploads', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        const files = data.files ?? data ?? []
        if (files.length > 0) {
          setEditing((prev) => ({ ...prev, [field]: files[0].url }) as Partial<Banner>)
        }
      } catch {
        toast.error('Image upload failed')
      }
    }
    input.click()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Banners</CardTitle>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Banner
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : banners.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No banners yet</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>
                Add your first banner
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {b.desktopImage ? (
                        <img src={b.desktopImage} alt={b.title} className="h-12 w-20 object-cover rounded" />
                      ) : (
                        <div className="h-12 w-20 bg-muted rounded flex items-center justify-center">
                          <Eye className="size-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{b.title}</p>
                      {b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">{b.location}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.startDate && new Date(b.startDate).toLocaleDateString()}
                      {b.endDate && ` - ${new Date(b.endDate).toLocaleDateString()}`}
                      {!b.startDate && 'No schedule'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {b.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{b.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(b)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeleteId(b.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Banner Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Banner' : 'Add Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={editing?.title ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }) as Partial<Banner>)} />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input value={editing?.subtitle ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, subtitle: e.target.value }) as Partial<Banner>)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editing?.description ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }) as Partial<Banner>)} rows={3} />
            </div>
            {/* Asset Standard Recommendation Callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
                <span>💡 Banner Asset Standard</span>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">
                <span className="font-semibold">Desktop Banner:</span> 1920 × 600 px (16:5 ratio) | <span className="font-semibold">Mobile Banner:</span> 800 × 800 px (1:1 ratio) | Preferred: WebP, PNG, JPG.
                <br />
                High-resolution images of any file size are accepted and automatically optimized for fast storefront loading.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Desktop Image</Label>
                <div className="flex gap-2">
                  <Input value={editing?.desktopImage ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, desktopImage: e.target.value }) as Partial<Banner>)} placeholder="URL or upload" />
                  <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('desktopImage')}>
                    <Upload className="size-4" />
                  </Button>
                </div>
                {editing?.desktopImage && <img src={editing.desktopImage} alt="Desktop" className="h-20 object-cover rounded mt-1" />}
              </div>
              <div className="space-y-2">
                <Label>Mobile Image</Label>
                <div className="flex gap-2">
                  <Input value={editing?.mobileImage ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, mobileImage: e.target.value }) as Partial<Banner>)} placeholder="URL or upload" />
                  <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('mobileImage')}>
                    <Upload className="size-4" />
                  </Button>
                </div>
                {editing?.mobileImage && <img src={editing.mobileImage} alt="Mobile" className="h-20 object-cover rounded mt-1" />}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Link</Label>
                <Input value={editing?.link ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, link: e.target.value }) as Partial<Banner>)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={editing?.location ?? 'hero'} onValueChange={(v) => setEditing((prev) => ({ ...prev, location: v }) as Partial<Banner>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">Hero</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>CTA Text</Label>
                <Input value={editing?.ctaText ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, ctaText: e.target.value }) as Partial<Banner>)} />
              </div>
              <div className="space-y-2">
                <Label>CTA Link</Label>
                <Input value={editing?.ctaLink ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, ctaLink: e.target.value }) as Partial<Banner>)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={editing?.startDate ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, startDate: e.target.value }) as Partial<Banner>)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={editing?.endDate ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, endDate: e.target.value }) as Partial<Banner>)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={editing?.sortOrder ?? 0} onChange={(e) => setEditing((prev) => ({ ...prev, sortOrder: Number(e.target.value) }) as Partial<Banner>)} />
              </div>
              <div className="space-y-2">
                <Label>BG Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={editing?.bgColor ?? '#ffffff'} onChange={(e) => setEditing((prev) => ({ ...prev, bgColor: e.target.value }) as Partial<Banner>)} className="w-12 p-1" />
                  <Input value={editing?.bgColor ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, bgColor: e.target.value }) as Partial<Banner>)} placeholder="#ffffff" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Text Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={editing?.textColor ?? '#000000'} onChange={(e) => setEditing((prev) => ({ ...prev, textColor: e.target.value }) as Partial<Banner>)} className="w-12 p-1" />
                  <Input value={editing?.textColor ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, textColor: e.target.value }) as Partial<Banner>)} placeholder="#000000" />
                </div>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch checked={editing?.isActive ?? true} onCheckedChange={(c) => setEditing((prev) => ({ ...prev, isActive: c }) as Partial<Banner>)} />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing?.id ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Banner</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
