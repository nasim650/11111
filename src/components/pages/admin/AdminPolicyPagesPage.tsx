'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { Plus, Pencil, Trash2, FileText, Bold, Italic, Heading1, Link as LinkIcon, List, Eye, Code2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface PolicyPage {
  id: string
  title: string
  slug: string
  content: string
  isActive: boolean
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  createdAt: string
}

const emptyPage: Partial<PolicyPage> = {
  title: '',
  slug: '',
  content: '',
  isActive: true,
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
}

type EditorTab = 'edit' | 'preview' | 'split'

function MarkdownToolbar({ textareaRef, onInsert }: { textareaRef: React.RefObject<HTMLTextAreaElement | null>; onInsert: (before: string, after: string, placeholder: string) => void }) {
  return (
    <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Bold"
        onClick={() => onInsert('**', '**', 'bold text')}
      >
        <Bold className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Italic"
        onClick={() => onInsert('*', '*', 'italic text')}
      >
        <Italic className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Heading"
        onClick={() => onInsert('## ', '', 'Heading')}
      >
        <Heading1 className="size-4" />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Link"
        onClick={() => onInsert('[', '](url)', 'link text')}
      >
        <LinkIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Unordered List"
        onClick={() => onInsert('- ', '', 'List item')}
      >
        <List className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Code Block"
        onClick={() => onInsert('```\n', '\n```', 'code')}
      >
        <Code2 className="size-4" />
      </Button>
    </div>
  )
}

export default function AdminPolicyPagesPage() {
  const [pages, setPages] = useState<PolicyPage[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<PolicyPage> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editorTab, setEditorTab] = useState<EditorTab>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch('/api/policy-pages')
      if (res.ok) {
        const data = await res.json()
        setPages(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch policy pages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPages() }, [fetchPages])

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
  }

  function openCreate() {
    setEditing({ ...emptyPage })
    setEditorTab('edit')
    setDialogOpen(true)
  }

  function openEdit(p: PolicyPage) {
    setEditing({ ...p })
    setEditorTab('edit')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!editing?.title) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...editing,
        slug: editing.slug || generateSlug(editing.title),
      }
      const isEdit = !!editing.id
      const url = isEdit ? `/api/policy-pages/${editing.id}` : '/api/policy-pages'
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
      toast.success(isEdit ? 'Page updated' : 'Page created')
      setDialogOpen(false)
      fetchPages()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save page')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/policy-pages/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Page deleted')
      fetchPages()
    } catch {
      toast.error('Failed to delete page')
    } finally {
      setDeleteId(null)
    }
  }

  // Insert markdown syntax at cursor position
  const handleInsert = useCallback((before: string, after: string, placeholder: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = editing?.content ?? ''
    const selectedText = currentValue.substring(start, end)

    const insertText = selectedText || placeholder
    const newValue = currentValue.substring(0, start) + before + insertText + after + currentValue.substring(end)

    setEditing((prev) => ({ ...prev, content: newValue }) as Partial<PolicyPage>)

    // Set cursor position after the inserted text
    requestAnimationFrame(() => {
      textarea.focus()
      const newCursorPos = start + before.length + insertText.length + after.length
      textarea.setSelectionRange(
        start + before.length,
        selectedText ? newCursorPos : start + before.length + placeholder.length
      )
    })
  }, [editing?.content])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Policy Pages</CardTitle>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Page
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No policy pages yet</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>Add your first page</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(p)}><Pencil className="size-3" /></Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="size-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit Page' : 'Add Page'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={editing?.title ?? ''}
                  onChange={(e) => {
                    const title = e.target.value
                    setEditing((prev) => ({
                      ...prev,
                      title,
                      slug: prev?.id ? prev.slug : generateSlug(title),
                    }) as Partial<PolicyPage>)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={editing?.slug ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, slug: e.target.value }) as Partial<PolicyPage>)} />
              </div>
            </div>

            {/* Markdown Editor with Toolbar and Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Content (Markdown)</Label>
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                  <Button
                    variant={editorTab === 'edit' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-3 text-xs gap-1"
                    onClick={() => setEditorTab('edit')}
                  >
                    <Code2 className="size-3" /> Edit
                  </Button>
                  <Button
                    variant={editorTab === 'split' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-3 text-xs gap-1"
                    onClick={() => setEditorTab('split')}
                  >
                    Split
                  </Button>
                  <Button
                    variant={editorTab === 'preview' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-3 text-xs gap-1"
                    onClick={() => setEditorTab('preview')}
                  >
                    <Eye className="size-3" /> Preview
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                {(editorTab === 'edit' || editorTab === 'split') && (
                  <div className={editorTab === 'split' ? 'md:w-1/2 md:inline-block' : ''}>
                    <MarkdownToolbar textareaRef={textareaRef} onInsert={handleInsert} />
                    <Textarea
                      ref={textareaRef}
                      value={editing?.content ?? ''}
                      onChange={(e) => setEditing((prev) => ({ ...prev, content: e.target.value }) as Partial<PolicyPage>)}
                      rows={16}
                      className="font-mono text-sm border-0 rounded-none focus-visible:ring-0 resize-none"
                      placeholder="Write content in markdown..."
                    />
                  </div>
                )}

                {(editorTab === 'preview' || editorTab === 'split') && (
                  <div className={`bg-background ${editorTab === 'split' ? 'md:w-1/2 md:inline-block md:align-top border-l' : ''}`}>
                    <div className="p-2 border-b bg-muted/30">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="size-3" /> Preview
                      </span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[300px] overflow-y-auto max-h-[500px]">
                      {editing?.content ? (
                        <ReactMarkdown>{editing.content}</ReactMarkdown>
                      ) : (
                        <p className="text-muted-foreground italic">Start writing to see preview...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={editing?.isActive ?? true} onCheckedChange={(c) => setEditing((prev) => ({ ...prev, isActive: c }) as Partial<PolicyPage>)} />
              <Label>Active</Label>
            </div>
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">SEO Settings</h4>
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input value={editing?.metaTitle ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, metaTitle: e.target.value }) as Partial<PolicyPage>)} />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea value={editing?.metaDescription ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, metaDescription: e.target.value }) as Partial<PolicyPage>)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Meta Keywords</Label>
                <Input value={editing?.metaKeywords ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, metaKeywords: e.target.value }) as Partial<PolicyPage>)} />
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
          <AlertDialogHeader><AlertDialogTitle>Delete Page</AlertDialogTitle><AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
