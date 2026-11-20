'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, AlertCircle, HelpCircle, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/lib/store'
import { extractItems } from '@/lib/api'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string | null
  isActive: boolean
  sortOrder: number
}

interface HomepageSection {
  id: string
  title: string
  type: string
  subtitle: string | null
  description: string | null
  image: string | null
  categoryId: string | null
  content: string | null
  sortOrder: number
  isActive: boolean
  layout: string
  limit: number
  category?: { id: string; name: string; slug: string } | null
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// ─── FAQ Tab ─────────────────────────────────────────────────────────────────

function FAQTab() {
  const { accessToken } = useAppStore()
  const [items, setItems] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editItem, setEditItem] = useState<FAQItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formQ, setFormQ] = useState('')
  const [formA, setFormA] = useState('')
  const [formCat, setFormCat] = useState('')
  const [formOrder, setFormOrder] = useState(0)
  const [formActive, setFormActive] = useState(true)

  const fetchFAQs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/faq?admin=true&limit=100', {
        headers: authHeaders(accessToken),
      })
      const data = await res.json()
      if (data.success) setItems(extractItems(data) as FAQItem[])
      else setError(data.error || 'Failed to load FAQ')
    } catch {
      setError('Failed to load FAQ items')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchFAQs() }, [fetchFAQs])

  function openCreate() {
    setEditItem(null)
    setFormQ('')
    setFormA('')
    setFormCat('')
    setFormOrder(items.length)
    setFormActive(true)
    setShowForm(true)
  }

  function openEdit(item: FAQItem) {
    setEditItem(item)
    setFormQ(item.question)
    setFormA(item.answer)
    setFormCat(item.category || '')
    setFormOrder(item.sortOrder)
    setFormActive(item.isActive)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formQ.trim() || !formA.trim()) {
      toast.error('Question and answer are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        question: formQ.trim(),
        answer: formA.trim(),
        category: formCat.trim() || null,
        sortOrder: formOrder,
        isActive: formActive,
      }
      const url = editItem ? `/api/faq/${editItem.id}` : '/api/faq'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(editItem ? 'FAQ updated' : 'FAQ created')
        setShowForm(false)
        fetchFAQs()
      } else {
        toast.error(data.error || 'Save failed')
      }
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: FAQItem) {
    try {
      const res = await fetch(`/api/faq/${item.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        setItems((prev) => prev.map((f) => f.id === item.id ? { ...f, isActive: !f.isActive } : f))
      } else toast.error(data.error || 'Toggle failed')
    } catch {
      toast.error('Toggle failed')
    }
  }

  async function handleDelete(item: FAQItem) {
    if (!confirm(`Delete FAQ: "${item.question.slice(0, 50)}..."?`)) return
    try {
      const res = await fetch(`/api/faq/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('FAQ deleted')
        setItems((prev) => prev.filter((f) => f.id !== item.id))
      } else toast.error(data.error || 'Delete failed')
    } catch {
      toast.error('Delete failed')
    }
  }

  async function handleReorder(item: FAQItem, direction: 'up' | 'down') {
    const idx = items.findIndex((f) => f.id === item.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === items.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const swap = items[swapIdx]
    // Swap sort orders
    await Promise.all([
      fetch(`/api/faq/${item.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/faq/${swap.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      }),
    ])
    fetchFAQs()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">FAQ Items</h3>
          <p className="text-xs text-muted-foreground">Database-driven FAQ shown on the public homepage</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add FAQ
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading FAQ items...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <HelpCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No FAQ items yet. Add your first FAQ to have it appear on the homepage.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                item.isActive ? 'bg-background border-border' : 'bg-muted/40 border-dashed border-muted-foreground/30'
              }`}
            >
              <div className="flex flex-col gap-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => handleReorder(item, 'up')}
                  disabled={idx === 0}
                  aria-label="Move up"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReorder(item, 'down')}
                  disabled={idx === items.length - 1}
                  aria-label="Move down"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${!item.isActive ? 'text-muted-foreground' : ''}`}>
                  {item.question}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.answer}</p>
                {item.category && (
                  <Badge variant="outline" className="mt-1 text-[10px] h-4">{item.category}</Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  aria-label={item.isActive ? 'Deactivate' : 'Activate'}
                  title={item.isActive ? 'Active – click to hide' : 'Inactive – click to show'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    item.isActive
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label="Edit"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  aria-label="Delete"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAQ Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="faq-q">Question <span aria-hidden="true" className="text-red-500">*</span></Label>
              <Input
                id="faq-q"
                value={formQ}
                onChange={(e) => setFormQ(e.target.value)}
                placeholder="Enter the question..."
                maxLength={500}
                aria-required="true"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-a">Answer <span aria-hidden="true" className="text-red-500">*</span></Label>
              <Textarea
                id="faq-a"
                value={formA}
                onChange={(e) => setFormA(e.target.value)}
                placeholder="Enter the answer..."
                rows={4}
                maxLength={2000}
                aria-required="true"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="faq-cat">Category (optional)</Label>
                <Input
                  id="faq-cat"
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                  placeholder="e.g. Delivery"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="faq-order">Sort Order</Label>
                <Input
                  id="faq-order"
                  type="number"
                  value={formOrder}
                  onChange={(e) => setFormOrder(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="faq-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label htmlFor="faq-active" className="cursor-pointer">
                {formActive ? 'Active (shown on homepage)' : 'Inactive (hidden from homepage)'}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sections Tab ─────────────────────────────────────────────────────────────

function SectionsTab() {
  const { accessToken } = useAppStore()
  const [items, setItems] = useState<HomepageSection[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editSection, setEditSection] = useState<HomepageSection | null>(null)
  const [showSectionDialog, setShowSectionDialog] = useState(false)
  const [savingSection, setSavingSection] = useState(false)

  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('seasonal')
  const [formSubtitle, setFormSubtitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImage, setFormImage] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formLink, setFormLink] = useState('')
  const [formTag, setFormTag] = useState('')
  const [formOrder, setFormOrder] = useState(0)
  const [formActive, setFormActive] = useState(true)

  const fetchSections = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [secRes, catRes] = await Promise.all([
        fetch('/api/homepage-sections?admin=true&limit=50', {
          headers: authHeaders(accessToken),
        }),
        fetch('/api/categories?limit=50'),
      ])
      const secData = await secRes.json()
      if (secData.success) setItems(extractItems(secData) as HomepageSection[])
      else setError(secData.error || 'Failed to load sections')

      if (catRes.ok) {
        const catData = await catRes.json()
        setCategories(extractItems(catData))
      }
    } catch {
      setError('Failed to load homepage sections')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchSections() }, [fetchSections])

  function openCreateSection() {
    setEditSection(null)
    setFormTitle('')
    setFormType('seasonal')
    setFormSubtitle('')
    setFormDescription('')
    setFormImage('')
    setFormCategoryId('')
    setFormLink('')
    setFormTag('')
    setFormOrder(items.length)
    setFormActive(true)
    setShowSectionDialog(true)
  }

  function openEditSection(item: HomepageSection) {
    setEditSection(item)
    setFormTitle(item.title)
    setFormType(item.type || 'seasonal')
    setFormSubtitle(item.subtitle || '')
    setFormDescription(item.description || '')
    setFormImage(item.image || '')
    setFormCategoryId(item.categoryId || '')
    let link = ''
    let tag = ''
    if (item.content) {
      try {
        const parsed = JSON.parse(item.content)
        link = parsed.link || ''
        tag = parsed.tag || ''
      } catch {}
    }
    setFormLink(link)
    setFormTag(tag)
    setFormOrder(item.sortOrder)
    setFormActive(item.isActive)
    setShowSectionDialog(true)
  }

  async function handleSaveSection() {
    if (!formTitle.trim()) {
      toast.error('Title is required')
      return
    }
    setSavingSection(true)
    try {
      let contentStr: string | null = null
      if (formLink.trim() || formTag.trim()) {
        contentStr = JSON.stringify({
          link: formLink.trim() || undefined,
          tag: formTag.trim() || undefined,
        })
      }
      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        type: formType,
        subtitle: formSubtitle.trim() || null,
        description: formDescription.trim() || null,
        image: formImage.trim() || null,
        categoryId: formCategoryId || null,
        content: contentStr,
        sortOrder: formOrder,
        isActive: formActive,
      }
      const url = editSection ? `/api/homepage-sections/${editSection.id}` : '/api/homepage-sections'
      const method = editSection ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(editSection ? 'Section updated' : 'Section created')
        setShowSectionDialog(false)
        fetchSections()
      } else {
        toast.error(data.error || 'Failed to save section')
      }
    } catch {
      toast.error('Failed to save section')
    } finally {
      setSavingSection(false)
    }
  }

  async function handleDeleteSection(item: HomepageSection) {
    if (!confirm(`Delete section "${item.title}"?`)) return
    try {
      const res = await fetch(`/api/homepage-sections/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Section deleted')
        setItems((prev) => prev.filter((s) => s.id !== item.id))
      } else {
        toast.error(data.error || 'Delete failed')
      }
    } catch {
      toast.error('Delete failed')
    }
  }

  async function handleToggle(item: HomepageSection) {
    try {
      const res = await fetch(`/api/homepage-sections/${item.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        setItems((prev) => prev.map((s) => s.id === item.id ? { ...s, isActive: !s.isActive } : s))
        toast.success(`Section ${!item.isActive ? 'activated' : 'deactivated'}`)
      } else toast.error(data.error || 'Toggle failed')
    } catch {
      toast.error('Toggle failed')
    }
  }

  async function handleReorder(item: HomepageSection, direction: 'up' | 'down') {
    const idx = items.findIndex((s) => s.id === item.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === items.length - 1) return
    const swap = items[direction === 'up' ? idx - 1 : idx + 1]
    await Promise.all([
      fetch(`/api/homepage-sections/${item.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/homepage-sections/${swap.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      }),
    ])
    fetchSections()
  }

  const typeLabels: Record<string, string> = {
    product_grid: 'Product Grid',
    banner: 'Banner',
    category: 'Category',
    custom: 'Custom',
    testimonial: 'Testimonial',
    features: 'Features',
    promo: 'Promo',
    seasonal: 'Seasonal Collection',
    trust: 'Trust / Why Choose',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Homepage Sections</h3>
          <p className="text-xs text-muted-foreground">Control visibility, copy, images, destinations and order of homepage sections</p>
        </div>
        <Button size="sm" onClick={openCreateSection} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Section
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sections...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <LayoutGrid className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No homepage sections configured yet.</p>
          <p className="text-xs mt-1">Click &quot;Add Section&quot; to configure seasonal or trust content.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                item.isActive ? 'bg-background border-border' : 'bg-muted/40 border-dashed border-muted-foreground/30'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleReorder(item, 'up')}
                  disabled={idx === 0}
                  aria-label="Move up"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReorder(item, 'down')}
                  disabled={idx === items.length - 1}
                  aria-label="Move down"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${!item.isActive ? 'text-muted-foreground' : ''}`}>
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] h-4">
                    {typeLabels[item.type] || item.type}
                  </Badge>
                  {item.subtitle && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{item.subtitle}</span>
                  )}
                  {item.category && (
                    <span className="text-[10px] text-muted-foreground">→ {item.category.name}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditSection(item)}
                  aria-label={`Edit ${item.title}`}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(item)}
                  aria-label={`Delete ${item.title}`}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Switch
                  checked={item.isActive}
                  onCheckedChange={() => handleToggle(item)}
                  aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.title}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section Edit/Create Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSection ? 'Edit Section' : 'Add Section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sec-title">Title <span aria-hidden="true" className="text-red-500">*</span></Label>
              <Input
                id="sec-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Winter Warmth Essentials or 100% Authentic"
                maxLength={200}
                aria-required="true"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sec-type">Section Type</Label>
                <select
                  id="sec-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="seasonal">Seasonal Collection</option>
                  <option value="trust">Trust / Why Choose</option>
                  <option value="product_grid">Product Grid</option>
                  <option value="banner">Banner</option>
                  <option value="category">Category</option>
                  <option value="features">Features</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sec-order">Sort Order</Label>
                <Input
                  id="sec-order"
                  type="number"
                  value={formOrder}
                  onChange={(e) => setFormOrder(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec-sub">Subtitle / Badge Tag (optional)</Label>
              <Input
                id="sec-sub"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder="e.g. Handcrafted Traditional or Verified"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec-desc">Description (optional)</Label>
              <Textarea
                id="sec-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description or promise details..."
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec-img">Image URL (optional)</Label>
              <Input
                id="sec-img"
                value={formImage}
                onChange={(e) => setFormImage(e.target.value)}
                placeholder="/images/... or https://..."
              />
            </div>

            {formType === 'seasonal' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sec-cat">Linked Category</Label>
                  <select
                    id="sec-cat"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">None (Custom Link)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sec-link">Custom Destination Link</Label>
                  <Input
                    id="sec-link"
                    value={formLink}
                    onChange={(e) => setFormLink(e.target.value)}
                    placeholder="e.g. /products?search=ghee"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                id="sec-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label htmlFor="sec-active" className="cursor-pointer">
                {formActive ? 'Active (visible on homepage)' : 'Inactive (hidden from public site)'}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSectionDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSection} disabled={savingSection}>
              {savingSection ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminHomepageContentPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Homepage Content</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage FAQ items and homepage section visibility. Changes take effect immediately on the public site.
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="faq">
        <TabsList>
          <TabsTrigger value="faq" className="gap-1.5">
            <HelpCircle className="h-4 w-4" /> FAQ
          </TabsTrigger>
          <TabsTrigger value="sections" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" /> Sections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <FAQTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <SectionsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
