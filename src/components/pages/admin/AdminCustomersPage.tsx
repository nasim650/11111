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
import {
  Search,
  Users as UsersIcon,
  Eye,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  CreditCard,
  Banknote,
  Clock,
} from 'lucide-react'

interface ActivityOrderItem {
  name: string
  quantity: number
  price: number
  unit?: string
}

interface ActivityOrder {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: number
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  itemCount: number
  items: ActivityOrderItem[]
}

interface SixMonthActivity {
  since: string
  totalOrders: number
  deliveredOrders: number
  cancelledOrders: number
  totalPaid: number
  totalCod: number
  orders: ActivityOrder[]
}

interface Customer {
  id: string
  name?: string
  email?: string
  phone?: string
  role: string
  isActive: boolean
  isVerified?: boolean
  hasPassword?: boolean
  identityStatus?: 'guest_profile' | 'registered_account'
  avatar?: string
  createdAt: string
  _count?: { orders: number; reviews: number }
}

interface CustomerDetail extends Customer {
  sixMonthActivity?: SixMonthActivity
  stats?: {
    orderCount: number
    totalSpent: number
    wishlistCount: number
    cartCount: number
    reviewCount: number
  }
}

export default function AdminCustomersPage() {
  const { navigate } = useAppStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
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

  async function openDetail(c: Customer) {
    setSelectedCustomer(c)
    setCustomerDetail(null)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await authFetch(`/api/users/${c.id}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setCustomerDetail(json.data)
        }
      }
    } catch {
      toast.error('Failed to load customer details')
    } finally {
      setDetailLoading(false)
    }
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
              <Input placeholder="Search customers by name, phone, or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Phone & Verification</TableHead>
                  <TableHead>Identity</TableHead>
                  <TableHead>Orders</TableHead>
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
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{c.phone ?? '-'}</span>
                        {c.phone && (
                          c.isVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 h-4">Verified</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 h-4">Unverified</Badge>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.identityStatus === 'guest_profile' ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">Guest Profile</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">Registered</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c._count?.orders ?? 0}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={c.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openDetail(c)} aria-label="View Details"><Eye className="size-3" /></Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)} aria-label="Edit Customer"><Pencil className="size-3" /></Button>
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Customer Profile & Activity</DialogTitle></DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Profile Overview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
                    {selectedCustomer.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{selectedCustomer.name ?? 'Guest / Customer'}</h3>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.email ?? 'No email provided'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono">{selectedCustomer.phone ?? 'No phone'}</span>
                      {selectedCustomer.phone && (
                        selectedCustomer.isVerified ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 h-4">Verified Phone</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 h-4">Unverified Phone</Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 text-xs">
                  {selectedCustomer.identityStatus === 'guest_profile' ? (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">Guest Phone Profile</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Registered Account</Badge>
                  )}
                  <span className="text-muted-foreground">Joined: {new Date(selectedCustomer.createdAt).toLocaleDateString()}</span>
                  <Badge variant="secondary" className={selectedCustomer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* 6-Month Activity Section (Part D) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    <h4 className="font-semibold text-sm">6-Month Order Activity (Last 180 Days)</h4>
                  </div>
                  {customerDetail?.sixMonthActivity && (
                    <span className="text-xs text-muted-foreground">
                      Since {new Date(customerDetail.sixMonthActivity.since).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {detailLoading ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded" />)}
                    </div>
                    <Skeleton className="h-28 w-full rounded" />
                  </div>
                ) : customerDetail?.sixMonthActivity ? (
                  <div className="space-y-4">
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span className="text-xs">Total Orders</span>
                          <ShoppingBag className="size-3.5" />
                        </div>
                        <p className="text-lg font-bold">{customerDetail.sixMonthActivity.totalOrders}</p>
                      </div>

                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span className="text-xs text-emerald-700">Delivered</span>
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        </div>
                        <p className="text-lg font-bold text-emerald-700">{customerDetail.sixMonthActivity.deliveredOrders}</p>
                      </div>

                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span className="text-xs text-rose-700">Cancelled/Fail</span>
                          <XCircle className="size-3.5 text-rose-600" />
                        </div>
                        <p className="text-lg font-bold text-rose-700">{customerDetail.sixMonthActivity.cancelledOrders}</p>
                      </div>

                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span className="text-xs text-blue-700">Total Paid</span>
                          <CreditCard className="size-3.5 text-blue-600" />
                        </div>
                        <p className="text-base font-bold text-blue-700">৳{customerDetail.sixMonthActivity.totalPaid.toLocaleString()}</p>
                      </div>

                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span className="text-xs text-amber-700">Total COD</span>
                          <Banknote className="size-3.5 text-amber-600" />
                        </div>
                        <p className="text-base font-bold text-amber-700">৳{customerDetail.sixMonthActivity.totalCod.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Orders Table */}
                    <div className="border rounded-md overflow-hidden">
                      {customerDetail.sixMonthActivity.orders.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          No orders placed in the last 6 months.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs">Order #</TableHead>
                              <TableHead className="text-xs">Date</TableHead>
                              <TableHead className="text-xs">Items</TableHead>
                              <TableHead className="text-xs">Total</TableHead>
                              <TableHead className="text-xs">Payment</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customerDetail.sixMonthActivity.orders.map((order) => (
                              <TableRow key={order.id} className="text-xs">
                                <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                                <TableCell className="text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <div className="max-w-[200px] truncate" title={order.items.map(it => `${it.name} x${it.quantity}`).join(', ')}>
                                    {order.items.map(it => `${it.name} x${it.quantity}`).join(', ')}
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">৳{order.totalAmount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <span className="uppercase text-[11px]">{order.paymentMethod}</span>
                                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${order.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'text-amber-700 border-amber-300'}`}>
                                      {order.paymentStatus}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="capitalize text-[10px]">
                                    {order.orderStatus}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border rounded-md text-xs text-muted-foreground text-center">
                    No 6-month activity data available.
                  </div>
                )}
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
