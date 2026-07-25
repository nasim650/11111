'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react'

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  minOrder: number
  maxDiscount?: number | null
  usageLimit?: number | null
  usedCount: number
  validFrom: string
  validTo: string
  isActive: boolean
  createdAt: string
}

const emptyCoupon: Partial<Coupon> = {
  code: '',
  type: 'percentage',
  value: 0,
  minOrder: 0,
  maxDiscount: null,
  usageLimit: null,
  validFrom: '',
  validTo: '',
  isActive: true,
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchCoupons = useCallback(async () => {
    try {
      const res = await fetch('/api/coupons')
      if (res.ok) {
        const data = await res.json()
        setCoupons(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch coupons')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  function openCreate() {
    setEditing({ ...emptyCoupon })
    setDialogOpen(true)
  }

  function openEdit(c: Coupon) {
    setEditing({
      ...c,
      validFrom: c.validFrom ? new Date(c.validFrom).toISOString().split('T')[0] : '',
      validTo: c.validTo ? new Date(c.validTo).toISOString().split('T')[0] : '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!editing?.code) {
      toast.error('Coupon code is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...editing,
        code: editing.code.toUpperCase(),
        value: Number(editing.value) || 0,
        minOrder: Number(editing.minOrder) || 0,
        maxDiscount: editing.maxDiscount ? Number(editing.maxDiscount) : null,
        usageLimit: editing.usageLimit ? Number(editing.usageLimit) : null,
      }
      const isEdit = !!editing.id
      const url = isEdit ? `/api/coupons/${editing.id}` : '/api/coupons'
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
      toast.success(isEdit ? 'Coupon updated' : 'Coupon created')
      setDialogOpen(false)
      fetchCoupons()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save coupon')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/coupons/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Coupon deleted')
      fetchCoupons()
    } catch {
      toast.error('Failed to delete coupon')
    } finally {
      setDeleteId(null)
    }
  }

  const isExpired = (coupon: Coupon) => coupon.validTo && new Date(coupon.validTo) < new Date()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Coupons</CardTitle>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Coupon
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No coupons yet</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>Create your first coupon</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium text-sm">{c.code}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize text-xs">{c.type}</Badge></TableCell>
                    <TableCell className="text-sm">{c.type === 'percentage' ? `${c.value}%` : `৳${c.value}`}</TableCell>
                    <TableCell className="text-sm">৳{c.minOrder.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{c.usedCount}/{c.usageLimit ?? '∞'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : 'N/A'} - {c.validTo ? new Date(c.validTo).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={
                        !c.isActive ? 'bg-gray-100 text-gray-800' :
                        isExpired(c) ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }>
                        {!c.isActive ? 'Inactive' : isExpired(c) ? 'Expired' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}><Pencil className="size-3" /></Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="size-3" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit Coupon' : 'Add Coupon'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Coupon Code *</Label>
              <Input
                value={editing?.code ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, code: e.target.value.toUpperCase() }) as Partial<Coupon>)}
                placeholder="SAVE20"
                className="font-mono"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editing?.type ?? 'percentage'} onValueChange={(v) => setEditing((prev) => ({ ...prev, type: v }) as Partial<Coupon>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value *</Label>
                <Input type="number" value={editing?.value ?? 0} onChange={(e) => setEditing((prev) => ({ ...prev, value: Number(e.target.value) }) as Partial<Coupon>)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Min Order (৳)</Label>
                <Input type="number" value={editing?.minOrder ?? 0} onChange={(e) => setEditing((prev) => ({ ...prev, minOrder: Number(e.target.value) }) as Partial<Coupon>)} />
              </div>
              <div className="space-y-2">
                <Label>Max Discount (৳)</Label>
                <Input type="number" value={editing?.maxDiscount ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, maxDiscount: e.target.value ? Number(e.target.value) : null }) as Partial<Coupon>)} placeholder="No limit" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Usage Limit</Label>
              <Input type="number" value={editing?.usageLimit ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, usageLimit: e.target.value ? Number(e.target.value) : null }) as Partial<Coupon>)} placeholder="Unlimited" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input type="date" value={editing?.validFrom ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, validFrom: e.target.value }) as Partial<Coupon>)} />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input type="date" value={editing?.validTo ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, validTo: e.target.value }) as Partial<Coupon>)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing?.isActive ?? true} onCheckedChange={(c) => setEditing((prev) => ({ ...prev, isActive: c }) as Partial<Coupon>)} />
              <Label>Active</Label>
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
          <AlertDialogHeader><AlertDialogTitle>Delete Coupon</AlertDialogTitle><AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
