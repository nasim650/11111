'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { unpackSmartAddress, generateDeliveryLabelText } from '@/lib/bangladesh-address'
import {
  ShoppingCart, Eye, Truck, Package,
  X, Loader2, ArrowUpDown, CheckCircle2, ListChecks,
} from 'lucide-react'
import {
  ORDER_STATUS,
  PRODUCTION_FLOW,
  TERMINAL_STATUSES,
  ALL_STATUSES,
  getStatusMeta,
  getStatusLabel,
  getStatusBadgeClass,
  getNextStatus,
  isTerminal,
  getFlowProgress,
} from '@/lib/order-status'

interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unit: string
  price: number
  total: number
  image?: string
}

interface Order {
  id: string
  orderNumber: string
  userId: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  items: OrderItem[]
  subtotal: number
  deliveryCharge: number
  discount: number
  total: number
  status: string
  paymentMethod: string
  paymentStatus: string
  shippingAddress?: string
  note?: string
  createdAt: string
  updatedAt: string
}

// ─── Status config comes from the shared `@/lib/order-status` module ─────────
// (single source of truth — reused by AdminOrdersPage,
// OrderDetailPage, OrderTrackingPage). Local aliases keep call sites terse.

const statusColors = (s: string) => getStatusBadgeClass(s)
const statusFlow = ALL_STATUSES.map((s) => s as string)
const statusLabels = (s: string) => getStatusLabel(s)

export default function AdminOrdersPage() {
  const { navigate } = useAppStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  // ─── Multi-select state ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '50')
      const res = await fetch(`/api/orders?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        // Map API field names to the Order interface expected by this component
        const rawOrders = extractItems<Record<string, unknown>>(data)
        const mapped: Order[] = rawOrders.map((o) => {
          const items = (o.items as Array<Record<string, unknown>>) || []
          const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
          return {
            id: o.id as string,
            orderNumber: o.orderNumber as string,
            userId: o.userId as string,
            customerName: (o.guestName as string) || (o.user as Record<string, unknown> | undefined)?.name as string || '—',
            customerEmail: (o.guestEmail as string) || (o.user as Record<string, unknown> | undefined)?.email as string || '',
            customerPhone: (o.guestPhone as string) || (o.user as Record<string, unknown> | undefined)?.phone as string || '',
            items: items.map((it) => ({
              id: it.id as string,
              productId: (it.productId as string) || '',
              productName: it.productName as string,
              quantity: it.quantity as number,
              unit: it.unit as string,
              price: it.price as number,
              total: (Number(it.price) || 0) * (Number(it.quantity) || 0),
              ...(it.image ? { image: it.image as string } : {}),
            })),
            subtotal,
            deliveryCharge: Number(o.deliveryCharge) || 0,
            discount: Number(o.discountAmount) || 0,
            total: Number(o.totalAmount) || 0,
            status: (o.orderStatus as string) || 'pending',
            paymentMethod: (o.paymentMethod as string) || 'cod',
            paymentStatus: (o.paymentStatus as string) || 'pending',
            shippingAddress: (o.guestAddress as string) || '',
            note: (o.orderNote as string) || '',
            createdAt: o.createdAt as string,
            updatedAt: o.updatedAt as string,
          }
        })
        setOrders(mapped)
      }
    } catch {
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ─── Selection helpers ────────────────────────────────────────────────────

  const allSelected = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0 && !allSelected

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)))
    }
  }

  function toggleSelect(orderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // ─── Open detail ─────────────────────────────────────────────────────────

  function openDetail(order: Order) {
    setSelectedOrder(order)
    setDetailOpen(true)
  }

  // ─── Update status ───────────────────────────────────────────────────────

  async function updateStatus(orderId: string, status: string) {
    setUpdating(true)
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }
      toast.success(`Order status updated to ${statusLabels(status) || status}`)
      fetchOrders()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status } : null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update order status')
    } finally {
      setUpdating(false)
    }
  }

  // ─── Bulk status update ──────────────────────────────────────────────────

  async function bulkUpdateStatus(newStatus: string) {
    if (selectedIds.size === 0) return
    setUpdating(true)
    let successCount = 0
    for (const orderId of selectedIds) {
      try {
        const res = await authFetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderStatus: newStatus }),
        })
        if (res.ok) successCount++
      } catch {
        // continue
      }
    }
    toast.success(`${successCount} order${successCount !== 1 ? 's' : ''} updated to ${statusLabels(newStatus) || newStatus}`)
    clearSelection()
    fetchOrders()
    setUpdating(false)
  }

  // ─── Status counts ───────────────────────────────────────────────────────

  const countFor = (key: string) =>
    orders.filter((o) => o.status === key || o.status === key.toUpperCase()).length

  const counts = {
    all: orders.length,
    [ORDER_STATUS.PENDING]: countFor(ORDER_STATUS.PENDING),
    [ORDER_STATUS.CONFIRMED]: countFor(ORDER_STATUS.CONFIRMED),
    [ORDER_STATUS.PROCESSING]: countFor(ORDER_STATUS.PROCESSING),
    [ORDER_STATUS.PACKED]: countFor(ORDER_STATUS.PACKED),
    [ORDER_STATUS.READY_TO_SHIP]: countFor(ORDER_STATUS.READY_TO_SHIP),
    [ORDER_STATUS.SHIPPED]: countFor(ORDER_STATUS.SHIPPED),
    [ORDER_STATUS.DELIVERED]: countFor(ORDER_STATUS.DELIVERED),
    [ORDER_STATUS.CANCELLED]: countFor(ORDER_STATUS.CANCELLED),
    [ORDER_STATUS.RETURNED]: countFor(ORDER_STATUS.RETURNED),
  }

  return (
    <div className="space-y-4">
      {/* ─── Status Tabs ──────────────────────────────────────────────────── */}
      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setLoading(true) }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          {PRODUCTION_FLOW.map((s) => (
            <TabsTrigger key={s} value={s}>
              {getStatusLabel(s)} ({counts[s]})
            </TabsTrigger>
          ))}
          {TERMINAL_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {getStatusLabel(s)} ({counts[s]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ─── Bulk Actions Bar ─────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 animate-in fade-in slide-in-from-top-2">
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold">
            {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50">
                <ArrowUpDown className="size-3.5" />
                Update Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {statusFlow.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => bulkUpdateStatus(s)}
                  disabled={updating}
                  className="cursor-pointer"
                >
                  <Badge variant="secondary" className={`text-[10px] mr-2 ${statusColors(s)}`}>
                    {s}
                  </Badge>
                  Set to {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="gap-1.5 text-gray-500 hover:text-gray-700 rounded-xl"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* ─── Orders Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as unknown as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                  </TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={selectedIds.has(order.id) ? 'bg-emerald-50/50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{order.orderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{order.customerName ?? 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone ?? ''}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{order.items?.length ?? 0} items</Badge>
                    </TableCell>
                    <TableCell className="font-medium">৳{order.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'} className="text-xs">
                          {order.paymentStatus}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">{order.paymentMethod}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className={statusColors(order.status)}>
                          {statusLabels(order.status) || order.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 hover:bg-emerald-50 hover:text-emerald-700"
                              disabled={updating}
                            >
                              <ArrowUpDown className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {statusFlow.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => updateStatus(order.id, s)}
                                disabled={updating || order.status === s}
                                className="cursor-pointer"
                              >
                                <Badge variant="secondary" className={`text-[10px] mr-2 ${statusColors(s)}`}>
                                  {statusLabels(s) || s}
                                </Badge>
                                Set to {statusLabels(s) || s}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-0.5">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openDetail(order)}>
                          <Eye className="size-3" />
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

      {/* ─── Order Detail Dialog ───────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5" /> Order {selectedOrder?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* ─── Status Summary + Flow ─────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary" className={statusColors(selectedOrder.status)}>
                    {statusLabels(selectedOrder.status) || selectedOrder.status}
                  </Badge>
                  {isTerminal(selectedOrder.status) && (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-gray-300">
                      Terminal state
                    </Badge>
                  )}
                  {updating && <Loader2 className="size-4 animate-spin text-emerald-600" />}
                </div>

                {/* Production flow progress bar */}
                {!isTerminal(selectedOrder.status) && (
                  <div className="rounded-xl border bg-gray-50/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">Production Flow</span>
                      <span className="text-xs text-muted-foreground">
                        {getFlowProgress(selectedOrder.status)}% complete
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {PRODUCTION_FLOW.map((s, i) => {
                        const meta = getStatusMeta(s)
                        const Icon = meta.icon
                        const currentIdx = PRODUCTION_FLOW.indexOf(selectedOrder.status as never)
                        const isDone = i <= currentIdx
                        const isCurrent = s === selectedOrder.status
                        return (
                          <div key={s} className="flex items-center flex-1 last:flex-none">
                            <div
                              className={`flex flex-col items-center gap-1 ${isCurrent ? 'scale-110' : ''} transition-transform`}
                              title={meta.label}
                            >
                              <div
                                className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isDone
                                    ? `${meta.dotClass} text-white`
                                    : 'bg-gray-200 text-gray-400'
                                } ${isCurrent ? 'ring-2 ring-offset-1 ring-emerald-400' : ''}`}
                              >
                                <Icon className="size-3.5" />
                              </div>
                              <span className={`text-[9px] ${isDone ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                                {meta.shortLabel}
                              </span>
                            </div>
                            {i < PRODUCTION_FLOW.length - 1 && (
                              <div className={`flex-1 h-0.5 mx-1 ${i < currentIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Status actions: quick advance + full selector */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isTerminal(selectedOrder.status) && getNextStatus(selectedOrder.status) && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                      disabled={updating}
                      onClick={() => updateStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Advance to {getStatusLabel(getNextStatus(selectedOrder.status)!)}
                    </Button>
                  )}
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(v) => updateStatus(selectedOrder.id, v)}
                    disabled={updating}
                  >
                    <SelectTrigger className="w-48 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1 block">
                        Production Flow
                      </span>
                      {PRODUCTION_FLOW.map((s) => (
                        <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                      ))}
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1 block">
                        Terminal
                      </span>
                      {TERMINAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ─── Status Visibility: Payment / Delivery / Print ─────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Payment</p>
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${
                      selectedOrder.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedOrder.paymentStatus === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {selectedOrder.paymentStatus || '—'}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">{selectedOrder.paymentMethod || '—'}</p>
                </div>
                <div className="rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Delivery</p>
                  <Badge variant="secondary" className={`text-[11px] ${statusColors(selectedOrder.status)}`}>
                    {statusLabels(selectedOrder.status) || '—'}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {isTerminal(selectedOrder.status) ? 'Closed' : 'In progress'}
                  </p>
                </div>
                <div className="rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Items</p>
                  <Badge variant="secondary" className="text-[11px] bg-blue-100 text-blue-800">
                    {selectedOrder.items?.length ?? 0}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">products</p>
                </div>
              </div>

              {/* Customer Info & Bangladesh Smart Address */}
              {(() => {
                const smart = unpackSmartAddress({
                  name: selectedOrder.customerName,
                  phone: selectedOrder.customerPhone,
                  address: selectedOrder.shippingAddress,
                })
                return (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="text-sm font-semibold mb-2">Customer Info</h4>
                        <p className="text-sm font-bold">{selectedOrder.customerName ?? 'N/A'}</p>
                        <p className="text-sm text-primary font-semibold">📞 {selectedOrder.customerPhone ?? ''}</p>
                        {smart.altPhone && <p className="text-xs text-muted-foreground">Alt Phone: {smart.altPhone}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{selectedOrder.customerEmail ?? ''}</p>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/20 bg-primary/[0.02]">
                      <CardContent className="p-4 space-y-1 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-foreground">Shipping Address</h4>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            {smart.label || 'Home'}
                          </Badge>
                        </div>
                        <p className="font-mono text-foreground font-semibold">{smart.addressDetail}</p>
                        <p className="text-muted-foreground">
                          {smart.unionOrArea ? `${smart.unionOrArea}, ` : ''}{smart.upazila}, {smart.district}, {smart.division}
                        </p>
                        {smart.landmark && <p className="text-amber-700 font-semibold">📍 Landmark: {smart.landmark}</p>}
                        {selectedOrder.note && <p className="text-emerald-700 italic">📝 Note: {selectedOrder.note}</p>}
                        
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-[11px] font-bold border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => {
                              const labelText = generateDeliveryLabelText(
                                smart,
                                selectedOrder.orderNumber,
                                selectedOrder.total,
                                selectedOrder.paymentMethod
                              )
                              const printWin = window.open('', '_blank')
                              if (printWin) {
                                printWin.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px;line-height:1.5">${labelText}</pre>`)
                                printWin.document.close()
                                printWin.print()
                              }
                            }}
                          >
                            🖨️ Print Rider Delivery Label (5s Scan)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}

              {/* Items */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Order Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedOrder.items ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.image ? (
                            <img src={item.image} alt={item.productName} className="h-10 w-10 rounded-lg object-cover border" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="size-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{item.productName}</TableCell>
                        <TableCell className="text-sm">৳{item.price}</TableCell>
                        <TableCell className="text-sm">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-sm font-medium">৳{item.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>৳{selectedOrder.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Delivery Charge</span><span>৳{selectedOrder.deliveryCharge.toLocaleString()}</span></div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-green-600"><span>Discount</span><span>-৳{selectedOrder.discount.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span>৳{selectedOrder.total.toLocaleString()}</span></div>
              </div>

              {selectedOrder.note && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Order Note</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.note}</p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <p>Order Date: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                <p>Last Updated: {new Date(selectedOrder.updatedAt).toLocaleString()}</p>
                <p>Payment: {selectedOrder.paymentMethod} - {selectedOrder.paymentStatus}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
