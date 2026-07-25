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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Search, Users as UsersIcon, Eye, Pencil } from 'lucide-react'

interface Customer {
  id: string
  name?: string
  email?: string
  phone?: string
  role: string
  isActive: boolean
  avatar?: string
  createdAt: string
  _count?: { orders: number; reviews: number }
}

export default function AdminCustomersPage() {
  const { navigate } = useAppStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Customer> | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('role', 'customer')
      const res = await fetch(`/api/users?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  function openDetail(c: Customer) {
    setSelectedCustomer(c)
    setDetailOpen(true)
  }

  function openEdit(c: Customer) {
    setEditing({ ...c })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!editing?.id) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: editing.isActive, role: editing.role }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Customer updated')
      setEditOpen(false)
      fetchCustomers()
    } catch {
      toast.error('Failed to update customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium text-sm">{c.name ?? 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.email ?? '-'}</TableCell>
                    <TableCell className="text-sm">{c.phone ?? '-'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c._count?.orders ?? 0}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs capitalize">{c.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={c.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openDetail(c)}><Eye className="size-3" /></Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}><Pencil className="size-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Customer Details</DialogTitle></DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                  {selectedCustomer.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-medium">{selectedCustomer.name ?? 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.email ?? ''}</p>
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{selectedCustomer.phone ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="capitalize">{selectedCustomer.role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="secondary" className={selectedCustomer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{selectedCustomer.isActive ? 'Active' : 'Inactive'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Orders</span><span>{selectedCustomer._count?.orders ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reviews</span><span>{selectedCustomer._count?.reviews ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span>{new Date(selectedCustomer.createdAt).toLocaleDateString()}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editing.role ?? 'customer'} onValueChange={(v) => setEditing((prev) => ({ ...prev, role: v }) as Partial<Customer>)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.isActive ?? true} onCheckedChange={(c) => setEditing((prev) => ({ ...prev, isActive: c }) as Partial<Customer>)} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
