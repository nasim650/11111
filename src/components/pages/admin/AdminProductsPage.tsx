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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  X,
  MoreHorizontal,
  Package,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Product {
  id: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  price: number
  discountPrice?: number | null
  unit: string
  stock: number
  categoryId: string
  subcategoryId?: string | null
  origin?: string
  qualityNote?: string
  ingredients?: string
  storageInstruction?: string
  deliveryNote?: string
  status: string
  isFeatured: boolean
  isBestSeller: boolean
  isNewArrival: boolean
  tags?: string[] | string
  specifications?: Record<string, string> | string
  images?: Array<{ id: string; url: string; alt?: string }>
  videoUrl?: string
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  category?: { id: string; name: string }
  createdAt: string
}

interface Category {
  id: string
  name: string
  subcategories?: Array<{ id: string; name: string }>
}

const emptyProduct: Partial<Product> = {
  name: '',
  slug: '',
  description: '',
  shortDescription: '',
  price: 0,
  discountPrice: null,
  unit: 'kg',
  stock: 0,
  categoryId: '',
  subcategoryId: '',
  origin: '',
  qualityNote: '',
  ingredients: '',
  storageInstruction: '',
  deliveryNote: '',
  status: 'active',
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: false,
  tags: [],
  specifications: {},
  images: [],
  videoUrl: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [specKey, setSpecKey] = useState('')
  const [specValue, setSpecValue] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)
      params.set('limit', '50')
      const res = await fetch(`/api/products?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, categoryFilter])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(extractItems(data))
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  function openCreate() {
    setEditingProduct({ ...emptyProduct })
    setActiveTab('basic')
    setDialogOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct({
      ...product,
      tags: Array.isArray(product.tags)
        ? product.tags
        : typeof product.tags === 'string'
          ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
      specifications:
        typeof product.specifications === 'string'
          ? JSON.parse(product.specifications || '{}')
          : product.specifications ?? {},
    })
    setActiveTab('basic')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!editingProduct?.name) {
      toast.error('Product name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...editingProduct,
        slug: editingProduct.slug || generateSlug(editingProduct.name),
        price: Number(editingProduct.price) || 0,
        discountPrice: editingProduct.discountPrice ? Number(editingProduct.discountPrice) : null,
        stock: Number(editingProduct.stock) || 0,
      }

      const isEdit = !!editingProduct.id
      const url = isEdit ? `/api/products/${editingProduct.id}` : '/api/products'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save product')
      }

      toast.success(isEdit ? 'Product updated' : 'Product created')
      setDialogOpen(false)
      fetchProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Product deleted')
      fetchProducts()
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setDeleteId(null)
    }
  }

  async function handleBulkAction(action: string) {
    if (selectedIds.length === 0) return
    try {
      await Promise.all(
        selectedIds.map((id) =>
          authFetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: action }),
          })
        )
      )
      toast.success(`${selectedIds.length} products updated`)
      setSelectedIds([])
      fetchProducts()
    } catch {
      toast.error('Bulk action failed')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  function addTag() {
    if (!tagInput.trim()) return
    const currentTags = Array.isArray(editingProduct?.tags) ? editingProduct.tags : []
    const tags = [...currentTags, tagInput.trim()]
    setEditingProduct((prev) => ({ ...prev, tags }) as Partial<Product>)
    setTagInput('')
  }

  function removeTag(index: number) {
    const tags = Array.isArray(editingProduct?.tags)
      ? editingProduct.tags.filter((_, i) => i !== index)
      : []
    setEditingProduct((prev) => ({ ...prev, tags }) as Partial<Product>)
  }

  function addSpec() {
    if (!specKey.trim()) return
    const currentSpecifications =
      editingProduct?.specifications && typeof editingProduct.specifications !== 'string'
        ? editingProduct.specifications
        : {}
    const specifications = { ...currentSpecifications, [specKey.trim()]: specValue.trim() }
    setEditingProduct((prev) => ({ ...prev, specifications }) as Partial<Product>)
    setSpecKey('')
    setSpecValue('')
  }

  function removeSpec(key: string) {
    const specifications =
      editingProduct?.specifications && typeof editingProduct.specifications !== 'string'
        ? { ...editingProduct.specifications }
        : {}
    delete specifications[key]
    setEditingProduct((prev) => ({ ...prev, specifications }) as Partial<Product>)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const formData = new FormData()
    Array.from(files).forEach((f) => formData.append('files', f))
    try {
      const res = await authFetch('/api/uploads', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      const newImages = (data.files ?? []).map((f: { url: string; id?: string }) => ({
        id: f.id ?? `img_${Date.now()}`,
        url: f.url,
        alt: '',
      }))
      setEditingProduct((prev) => ({
        ...prev,
        images: [...(prev?.images ?? []), ...newImages],
      }) as Partial<Product>)
    } catch {
      toast.error('Image upload failed')
    }
  }

  function removeImage(index: number) {
    const images = editingProduct?.images?.filter((_, i) => i !== index) ?? []
    setEditingProduct((prev) => ({ ...prev, images }) as Partial<Product>)
  }

  const selectedCategory = categories.find((c) => c.id === editingProduct?.categoryId)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter((cat) => cat.id).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="size-4" /> Add Product
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('active')}>
                Set Active
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('inactive')}>
                Set Inactive
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === products.length && products.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(products.map((p) => p.id))
                        } else {
                          setSelectedIds([])
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Package className="mx-auto size-10 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No products found</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>
                        Add your first product
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(product.id)}
                          onCheckedChange={() => toggleSelect(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.images?.[0]?.url ? (
                            <img
                              src={product.images[0].url}
                              alt={product.name}
                              className="size-10 rounded-md object-cover"
                            />
                          ) : (
                            <div className="size-10 rounded-md bg-muted flex items-center justify-center">
                              <Package className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {product.category?.name ?? '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">৳{product.price}</span>
                          {product.discountPrice && (
                            <span className="ml-1 text-xs text-muted-foreground line-through">
                              ৳{product.discountPrice}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={product.stock <= 5 ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {product.stock} {product.unit}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            product.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : product.status === 'inactive'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {product.isFeatured && (
                            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                              Featured
                            </Badge>
                          )}
                          {product.isBestSeller && (
                            <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700">
                              Best
                            </Badge>
                          )}
                          {product.isNewArrival && (
                            <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700">
                              New
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(product)}>
                              <Pencil className="mr-2 size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(product.id)}
                            >
                              <Trash2 className="mr-2 size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct?.id ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full flex-wrap">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Stock</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={editingProduct?.name ?? ''}
                    onChange={(e) => {
                      const name = e.target.value
                      setEditingProduct((prev) => ({
                        ...prev,
                        name,
                        slug: prev?.id ? prev.slug : generateSlug(name),
                      }) as Partial<Product>)
                    }}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editingProduct?.slug ?? ''}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        slug: e.target.value,
                      }) as Partial<Product>)
                    }
                    placeholder="product-slug"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Short Description</Label>
                <Textarea
                  value={editingProduct?.shortDescription ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      shortDescription: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="Brief product description"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Full Description</Label>
                <Textarea
                  value={editingProduct?.description ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="Detailed product description"
                  rows={5}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={editingProduct?.categoryId ?? ''}
                    onValueChange={(value) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        categoryId: value,
                        subcategoryId: '',
                      }) as Partial<Product>)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter((cat) => cat.id).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select
                    value={editingProduct?.subcategoryId ?? ''}
                    onValueChange={(value) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        subcategoryId: value,
                      }) as Partial<Product>)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedCategory?.subcategories ?? []).filter((sub) => sub.id).map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingProduct?.status ?? 'active'}
                  onValueChange={(value) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      status: value,
                    }) as Partial<Product>)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Price (৳) *</Label>
                  <Input
                    type="number"
                    value={editingProduct?.price ?? 0}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        price: Number(e.target.value),
                      }) as Partial<Product>)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Price (৳)</Label>
                  <Input
                    type="number"
                    value={editingProduct?.discountPrice ?? ''}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        discountPrice: e.target.value ? Number(e.target.value) : null,
                      }) as Partial<Product>)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={editingProduct?.unit ?? 'kg'}
                    onValueChange={(value) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        unit: value,
                      }) as Partial<Product>)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="g">Gram</SelectItem>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="bottle">Bottle</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  value={editingProduct?.stock ?? 0}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      stock: Number(e.target.value),
                    }) as Partial<Product>)
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct?.isFeatured ?? false}
                    onCheckedChange={(checked) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        isFeatured: checked,
                      }) as Partial<Product>)
                    }
                  />
                  <Label>Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct?.isBestSeller ?? false}
                    onCheckedChange={(checked) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        isBestSeller: checked,
                      }) as Partial<Product>)
                    }
                  />
                  <Label>Best Seller</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct?.isNewArrival ?? false}
                    onCheckedChange={(checked) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        isNewArrival: checked,
                      }) as Partial<Product>)
                    }
                  />
                  <Label>New Arrival</Label>
                </div>
              </div>
              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(Array.isArray(editingProduct?.tags) ? editingProduct.tags : []).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {tag}
                      <X className="size-3 cursor-pointer" onClick={() => removeTag(i)} />
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Specifications */}
              <div className="space-y-2">
                <Label>Specifications</Label>
                <div className="flex gap-2">
                  <Input
                    value={specKey}
                    onChange={(e) => setSpecKey(e.target.value)}
                    placeholder="Key"
                  />
                  <Input
                    value={specValue}
                    onChange={(e) => setSpecValue(e.target.value)}
                    placeholder="Value"
                  />
                  <Button type="button" variant="outline" onClick={addSpec}>
                    Add
                  </Button>
                </div>
                <div className="mt-2 space-y-1">
                  {Object.entries(
                    editingProduct?.specifications && typeof editingProduct.specifications !== 'string'
                      ? editingProduct.specifications
                      : {}
                  ).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{key}:</span>
                      <span className="text-muted-foreground">{value}</span>
                      <X
                        className="size-3 cursor-pointer text-destructive"
                        onClick={() => removeSpec(key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origin</Label>
                  <Input
                    value={editingProduct?.origin ?? ''}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        origin: e.target.value,
                      }) as Partial<Product>)
                    }
                    placeholder="e.g., Sylhet, Bangladesh"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quality Note</Label>
                  <Input
                    value={editingProduct?.qualityNote ?? ''}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        qualityNote: e.target.value,
                      }) as Partial<Product>)
                    }
                    placeholder="Quality information"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ingredients</Label>
                <Textarea
                  value={editingProduct?.ingredients ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      ingredients: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="List ingredients"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Storage Instruction</Label>
                <Textarea
                  value={editingProduct?.storageInstruction ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      storageInstruction: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="Storage instructions"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Note</Label>
                <Textarea
                  value={editingProduct?.deliveryNote ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      deliveryNote: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="Delivery information"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Video URL</Label>
                <Input
                  value={editingProduct?.videoUrl ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      videoUrl: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="https://youtube.com/..."
                />
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Product Images</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="mx-auto size-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag images here or click to upload
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {editingProduct?.images?.map((img, index) => (
                  <div key={img.id ?? index} className="relative group">
                    <img
                      src={img.url}
                      alt={img.alt ?? ''}
                      className="w-full h-24 object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input
                  value={editingProduct?.metaTitle ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      metaTitle: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="SEO title"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  value={editingProduct?.metaDescription ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      metaDescription: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="SEO description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Keywords</Label>
                <Input
                  value={editingProduct?.metaKeywords ?? ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      metaKeywords: e.target.value,
                    }) as Partial<Product>)
                  }
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingProduct?.id ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
