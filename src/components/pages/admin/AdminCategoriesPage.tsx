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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Upload,
  X,
  FolderTree,
  GripVertical,
} from 'lucide-react'

interface Subcategory {
  id: string
  name: string
  slug: string
  categoryId: string
  isActive?: boolean
}

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  icon?: string
  bannerImage?: string
  isActive: boolean
  showInMenu: boolean
  showInHome: boolean
  sortOrder: number
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  subcategories?: Subcategory[]
}

const emptyCategory: Partial<Category> = {
  name: '',
  slug: '',
  description: '',
  image: '',
  icon: '',
  bannerImage: '',
  isActive: true,
  showInMenu: true,
  showInHome: false,
  sortOrder: 0,
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [subDialogOpen, setSubDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null)
  const [editingSub, setEditingSub] = useState<Partial<Subcategory> & { categoryId?: string } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'category' | 'subcategory'>('category')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
  }

  function openCreate() {
    setEditingCategory({ ...emptyCategory })
    setDialogOpen(true)
  }

  function openEdit(cat: Category) {
    setEditingCategory({ ...cat })
    setDialogOpen(true)
  }

  function openCreateSub(categoryId: string) {
    setEditingSub({ name: '', slug: '', categoryId, isActive: true })
    setSubDialogOpen(true)
  }

  function openEditSub(sub: Subcategory, categoryId: string) {
    setEditingSub({ ...sub, categoryId })
    setSubDialogOpen(true)
  }

  async function handleSaveCategory() {
    if (!editingCategory?.name) {
      toast.error('Category name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...editingCategory,
        slug: editingCategory.slug || generateSlug(editingCategory.name),
        sortOrder: Number(editingCategory.sortOrder) || 0,
      }
      const isEdit = !!editingCategory.id
      const url = isEdit ? `/api/categories/${editingCategory.id}` : '/api/categories'
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
      toast.success(isEdit ? 'Category updated' : 'Category created')
      setDialogOpen(false)
      fetchCategories()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSub() {
    if (!editingSub?.name || !editingSub?.categoryId) {
      toast.error('Subcategory name and category are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...editingSub,
        slug: editingSub.slug || generateSlug(editingSub.name),
        categoryId: editingSub.categoryId,
      }
      const isEdit = !!editingSub.id
      const url = isEdit ? `/api/subcategories/${editingSub.id}` : '/api/subcategories'
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
      toast.success(isEdit ? 'Subcategory updated' : 'Subcategory created')
      setSubDialogOpen(false)
      fetchCategories()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save subcategory')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const url = deleteType === 'category'
        ? `/api/categories/${deleteId}`
        : `/api/subcategories/${deleteId}`
      const res = await authFetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(`${deleteType === 'category' ? 'Category' : 'Subcategory'} deleted`)
      fetchCategories()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleteId(null)
    }
  }

  async function handleImageUpload(field: 'image' | 'icon' | 'bannerImage') {
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
          setEditingCategory((prev) => ({
            ...prev,
            [field]: files[0].url,
          }) as Partial<Category>)
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
          <CardTitle>Categories</CardTitle>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Category
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No categories yet</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>
                Add your first category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Subcategories</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Menu</TableHead>
                  <TableHead>Home</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <React.Fragment key={cat.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() =>
                            setExpandedId(expandedId === cat.id ? null : cat.id)
                          }
                        >
                          {expandedId === cat.id ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GripVertical className="size-4 text-muted-foreground" />
                          {cat.image && (
                            <img src={cat.image} alt="" className="size-8 rounded object-cover" />
                          )}
                          <span className="font-medium">{cat.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cat.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {cat.subcategories?.length ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cat.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                        >
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{cat.showInMenu ? '✓' : '✗'}</TableCell>
                      <TableCell>{cat.showInHome ? '✓' : '✗'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(cat)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openCreateSub(cat.id)}
                            title="Add subcategory"
                          >
                            <Plus className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            onClick={() => { setDeleteId(cat.id); setDeleteType('category') }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === cat.id && (cat.subcategories ?? []).map((sub) => (
                      <TableRow key={sub.id} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell className="pl-10">
                          <span className="text-sm">↳ {sub.name}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sub.slug}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={sub.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                          >
                            {sub.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditSub(sub, cat.id)}>
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={() => { setDeleteId(sub.id); setDeleteType('subcategory') }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory?.id ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={editingCategory?.name ?? ''}
                  onChange={(e) => {
                    const name = e.target.value
                    setEditingCategory((prev) => ({
                      ...prev,
                      name,
                      slug: prev?.id ? prev.slug : generateSlug(name),
                    }) as Partial<Category>)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={editingCategory?.slug ?? ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, slug: e.target.value }) as Partial<Category>)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editingCategory?.description ?? ''}
                onChange={(e) =>
                  setEditingCategory((prev) => ({ ...prev, description: e.target.value }) as Partial<Category>)
                }
                rows={3}
              />
            </div>
            {/* Asset Standard Recommendation Callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
                <span>💡 Category Asset Standard</span>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">
                <span className="font-semibold">Recommended:</span> 800 × 800 px (1:1 Square) for Category Cards | 1200 × 400 px (3:1) for Category Banners | Preferred: WebP, PNG, JPG.
                <br />
                Images are automatically normalized and centered on fixed 1:1 canvas containers to prevent stretching.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingCategory?.image ?? ''}
                    onChange={(e) =>
                      setEditingCategory((prev) => ({ ...prev, image: e.target.value }) as Partial<Category>)
                    }
                    placeholder="URL or upload"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('image')}>
                    <Upload className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingCategory?.icon ?? ''}
                    onChange={(e) =>
                      setEditingCategory((prev) => ({ ...prev, icon: e.target.value }) as Partial<Category>)
                    }
                    placeholder="Icon URL or upload"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('icon')}>
                    <Upload className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banner Image</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingCategory?.bannerImage ?? ''}
                    onChange={(e) =>
                      setEditingCategory((prev) => ({ ...prev, bannerImage: e.target.value }) as Partial<Category>)
                    }
                    placeholder="Banner URL or upload"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => handleImageUpload('bannerImage')}>
                    <Upload className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={editingCategory?.sortOrder ?? 0}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, sortOrder: Number(e.target.value) }) as Partial<Category>)
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingCategory?.isActive ?? true}
                  onCheckedChange={(checked) =>
                    setEditingCategory((prev) => ({ ...prev, isActive: checked }) as Partial<Category>)
                  }
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingCategory?.showInMenu ?? true}
                  onCheckedChange={(checked) =>
                    setEditingCategory((prev) => ({ ...prev, showInMenu: checked }) as Partial<Category>)
                  }
                />
                <Label>Show in Menu</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingCategory?.showInHome ?? false}
                  onCheckedChange={(checked) =>
                    setEditingCategory((prev) => ({ ...prev, showInHome: checked }) as Partial<Category>)
                  }
                />
                <Label>Show in Home</Label>
              </div>
            </div>
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">SEO Settings</h4>
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input
                  value={editingCategory?.metaTitle ?? ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, metaTitle: e.target.value }) as Partial<Category>)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  value={editingCategory?.metaDescription ?? ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, metaDescription: e.target.value }) as Partial<Category>)
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Keywords</Label>
                <Input
                  value={editingCategory?.metaKeywords ?? ''}
                  onChange={(e) =>
                    setEditingCategory((prev) => ({ ...prev, metaKeywords: e.target.value }) as Partial<Category>)
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving ? 'Saving...' : editingCategory?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSub?.id ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editingSub?.name ?? ''}
                onChange={(e) => {
                  const name = e.target.value
                  setEditingSub((prev) => ({
                    ...prev,
                    name,
                    slug: prev?.id ? prev.slug : generateSlug(name),
                  }) as Partial<Subcategory> & { categoryId?: string })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={editingSub?.slug ?? ''}
                onChange={(e) =>
                  setEditingSub((prev) => ({ ...prev, slug: e.target.value }) as Partial<Subcategory> & { categoryId?: string })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingSub?.isActive !== false}
                onCheckedChange={(checked) =>
                  setEditingSub((prev) => ({ ...prev, isActive: checked }) as Partial<Subcategory> & { categoryId?: string })
                }
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSub} disabled={saving}>
              {saving ? 'Saving...' : editingSub?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteType === 'category' ? 'Category' : 'Subcategory'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
              {deleteType === 'category' && ' All subcategories will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
