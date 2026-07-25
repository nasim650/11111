'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  X,
  CreditCard,
  MapPin,
  Calendar,
  Printer,
  RotateCcw,
  Phone,
  AlertCircle,
  ShieldCheck,
  Banknote,
  Wallet,
  ChevronRight,
  Loader2,
  FileText,
  ShoppingBag,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAppStore, type CartItem } from '@/lib/store'
import { authFetch } from '@/lib/api'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unit: string
  price: number
  image?: string
}

interface OrderDetail {
  id: string
  orderNumber: string
  totalAmount: number
  discountAmount: number
  deliveryCharge: number
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  orderNote?: string
  couponCode?: string
  createdAt: string
  updatedAt: string
  userId?: string
  guestName?: string
  guestPhone?: string
  guestEmail?: string
  guestAddress?: string
  items: OrderItem[]
  payment?: {
    method: string
    status: string
    transactionId?: string
    paidAt?: string
  }
  tracking?: {
    estimatedDelivery?: {
      min: string
      max: string
    }
  }
}

// ─── Status Config ────────────────────────────────────────────────────────────

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Clock, desc: 'Your order has been received' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, desc: 'Order confirmed by seller' },
  { key: 'processing', label: 'Processing', icon: Package, desc: 'We are preparing your order' },
  { key: 'shipped', label: 'Shipped', icon: Truck, desc: 'Your order is on the way' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Order delivered successfully' },
]

const statusBadgeColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-teal-100 text-teal-800',
  processing: 'bg-orange-100 text-orange-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}

const statusHeaderColors: Record<string, string> = {
  pending: 'from-amber-500 to-amber-600',
  confirmed: 'from-teal-500 to-teal-600',
  processing: 'from-orange-500 to-orange-600',
  shipped: 'from-purple-500 to-purple-600',
  delivered: 'from-emerald-500 to-emerald-600',
  cancelled: 'from-red-500 to-red-600',
}

const cancelReasons = [
  'Changed my mind',
  'Found a better price elsewhere',
  'Delivery taking too long',
  'Ordered by mistake',
  'Need to modify the order',
  'Other reason',
]

function getStepIndex(status: string): number {
  if (status === 'cancelled') return -1
  const idx = statusSteps.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

function formatPaymentMethod(method: string): string {
  if (!method) return '—'
  const map: Record<string, string> = {
    cod: 'Cash on Delivery',
    online: 'SSLCommerz Payment Gateway',
    card: 'Card Payment',
  }
  return map[method] || method.charAt(0).toUpperCase() + method.slice(1)
}

// ─── Null-safety helpers ──────────────────────────────────────────────────────
// These mirror the fixes applied to the admin orders page: the API may return
// null/undefined for numeric fields (subtotal, discountAmount, deliveryCharge,
// totalAmount, item.price, item.quantity), and calling .toLocaleString() on
// null/undefined throws "Cannot read properties of null". The helpers below
// coerce to safe numbers/strings so the page never crashes on missing data.

function safeNum(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function safeStr(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback
  const s = String(value)
  return s.length > 0 ? s : fallback
}

function titleCase(value: unknown, fallback = '—'): string {
  const s = safeStr(value, '')
  if (!s) return fallback
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatBDT(value: unknown): string {
  return `৳${safeNum(value).toLocaleString()}`
}

// ─── Vertical Timeline ────────────────────────────────────────────────────────

function VerticalTimeline({ currentStatus, createdAt }: { currentStatus: string; createdAt: string }) {
  const currentStep = getStepIndex(currentStatus)
  const isCancelled = currentStatus === 'cancelled'

  if (isCancelled) {
    return (
      <div className="relative pl-8">
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-red-200" />
        <div className="relative flex items-start gap-4 pb-5">
          <div className="absolute left-[-21px] h-8 w-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center z-10 shadow-md shadow-red-200">
            <X className="h-4 w-4" />
          </div>
          <div className="flex-1 ml-2">
            <span className="text-sm font-bold text-red-700">Order Cancelled</span>
            <p className="text-xs text-red-500 mt-0.5">This order has been cancelled</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-400 to-emerald-200" />

      {statusSteps.map((step, idx) => {
        const StepIcon = step.icon
        const isCompleted = idx <= currentStep
        const isCurrent = idx === currentStep

        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative flex items-start gap-4 pb-6 last:pb-0"
          >
            <div className={`absolute left-[-21px] h-8 w-8 rounded-full flex items-center justify-center z-10 ${
              isCompleted
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-200'
                : isCurrent
                ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-400 shadow-md'
                : 'bg-gray-50 text-gray-400 border-2 border-gray-200'
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <StepIcon className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 ml-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isCompleted ? 'text-emerald-700' : isCurrent ? 'text-gray-800' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {isCompleted && idx < statusSteps.length - 1 && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] h-5 px-2 font-semibold">Done</Badge>
                )}
                {isCurrent && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] h-5 px-2 font-semibold">Current</Badge>
                )}
              </div>
              <p className={`text-xs mt-1 ${isCompleted || isCurrent ? 'text-gray-500' : 'text-gray-400'}`}>
                {step.desc}
              </p>
              {idx === 0 && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {createdAt
                    ? new Date(createdAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { pageParams, navigate, addToCart } = useAppStore()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(() => true)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)

  const orderId = String(pageParams?.id || '')

  const fetchOrder = useCallback(async (id: string) => {
    try {
      const r = await authFetch(`/api/orders/${id}`)
      if (!r.ok) throw new Error('Order not found')
      const data = await r.json()
      setOrder(data.data || data)
    } catch {
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!orderId) return
    fetchOrder(orderId)
  }, [orderId, fetchOrder])

  // ─── Cancel Order ──────────────────────────────────────────────────────────

  const handleCancelOrder = async () => {
    if (!order) return
    setCancelling(true)
    try {
      const res = await authFetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel order')
      }
      toast.success('Order cancelled successfully')
      fetchOrder(orderId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order')
    } finally {
      setCancelling(false)
    }
  }

  // ─── Reorder ───────────────────────────────────────────────────────────────

  const handleReorder = async () => {
    if (!order?.items?.length) return
    let added = 0
    for (const item of order.items) {
      try {
        const cartItem: Omit<CartItem, 'id'> = {
          productId: `reorder-${Date.now()}`,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          image: item.image || '/placeholder.png',
          stock: 999,
        }
        await addToCart(cartItem)
        added++
      } catch {
        // continue
      }
    }
    toast.success(`${added} item${added !== 1 ? 's' : ''} added to cart`)
    navigate('cart')
  }

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // ─── Not Found ─────────────────────────────────────────────────────────────

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertCircle className="h-12 w-12 text-red-300" />
            </div>
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Order Not Found</h2>
          <p className="text-gray-500 mb-8">The order you are looking for does not exist.</p>
          <Button onClick={() => navigate('orders')} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8 font-semibold shadow-md shadow-emerald-200">
            <Package className="h-4 w-4 mr-2" />
            View All Orders
          </Button>
        </div>
      </div>
    )
  }

  const isCancelled = order.orderStatus === 'cancelled'
  const isDelivered = order.orderStatus === 'delivered'
  const canCancel = ['pending', 'confirmed'].includes(order.orderStatus)
  // Guard against items being null/undefined (the API can return an empty or
  // missing items array); without this, .reduce() would throw on null.
  const orderItems = Array.isArray(order.items) ? order.items : []
  const subtotal = orderItems.reduce(
    (sum, item) => sum + safeNum(item.price) * safeNum(item.quantity),
    0
  )
  const estimatedDelivery = order.tracking?.estimatedDelivery
  const headerGradient = statusHeaderColors[order.orderStatus] || 'from-emerald-600 to-teal-600'
  const safeOrderNumber = safeStr(order.orderNumber)
  const safeOrderStatus = titleCase(order.orderStatus)
  const safePaymentStatus = titleCase(order.paymentStatus)
  const safePaymentMethod = formatPaymentMethod(order.paymentMethod)
  const createdDateLabel = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('orders')} className="hover:bg-gray-100 rounded-xl h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Order #{safeOrderNumber}</h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Placed on {createdDateLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`text-sm px-4 py-1.5 border-0 font-bold ${statusBadgeColors[order.orderStatus] || 'bg-gray-100 text-gray-800'}`}>
                {safeOrderStatus}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">

        {/* ─── Status Timeline Card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className={`bg-gradient-to-r ${headerGradient} px-6 py-4`}>
              <h3 className="text-white font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-white" />
                </div>
                Order Status
              </h3>
            </div>
            <CardContent className="p-6">
              <VerticalTimeline currentStatus={order.orderStatus} createdAt={order.createdAt} />

              {/* Estimated Delivery */}
              {estimatedDelivery && estimatedDelivery.min && estimatedDelivery.max && !isCancelled && !isDelivered && (
                <div className="mt-6 pt-5 border-t flex items-center gap-3 text-sm text-gray-600 bg-emerald-50/50 rounded-xl p-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Estimated delivery</p>
                    <span className="font-bold text-gray-900">
                      {new Date(estimatedDelivery.min).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })} – {new Date(estimatedDelivery.max).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )}
              {(!estimatedDelivery || !estimatedDelivery.min || !estimatedDelivery.max) && !isCancelled && !isDelivered && (
                <div className="mt-6 pt-5 border-t flex items-center gap-3 text-sm text-gray-600 bg-emerald-50/50 rounded-xl p-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Estimated delivery</p>
                    <span className="font-bold text-gray-900">3–5 business days</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Order Items ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Package className="h-4 w-4 text-white" />
                </div>
                Order Items ({orderItems.length})
              </h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-3">
                {orderItems.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-6">No items in this order.</p>
                ) : (
                  orderItems.map((item, idx) => (
                    <motion.div
                      key={item.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="relative h-18 w-18 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border" style={{ height: '72px', width: '72px' }}>
                        {item.image ? (
                          <Image src={item.image} alt={safeStr(item.productName, 'Product')} fill className="object-cover" sizes="72px" />
                        ) : (
                          <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
                            <Package className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{safeStr(item.productName, 'Product')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{safeNum(item.quantity)} × ৳{safeNum(item.price).toLocaleString()} per {safeStr(item.unit, 'unit')}</p>
                      </div>
                      <span className="font-bold text-sm text-gray-900 whitespace-nowrap">
                        ৳{(safeNum(item.price) * safeNum(item.quantity)).toLocaleString()}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>

              <Separator className="my-5" />

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">৳{subtotal.toLocaleString()}</span>
                </div>
                {safeNum(order.discountAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                    <span className="text-emerald-600 font-bold">-{formatBDT(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Charge</span>
                  <span className={safeNum(order.deliveryCharge) === 0 ? 'text-emerald-600 font-bold' : 'text-gray-900 font-medium'}>
                    {safeNum(order.deliveryCharge) === 0 ? 'FREE' : formatBDT(order.deliveryCharge)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg pt-1">
                  <span className="text-gray-900">Total</span>
                  <span className="text-emerald-700">{formatBDT(order.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Delivery & Payment Info ────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Delivery Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg overflow-hidden h-full">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3">
                <h4 className="text-white font-bold flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  Delivery Info
                </h4>
              </div>
              <CardContent className="p-5 space-y-3 text-sm">
                {order.guestName && (
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-600">{safeStr(order.guestName, 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{order.guestName}</p>
                    </div>
                  </div>
                )}
                {order.guestPhone && (
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-gray-700 mt-1">{order.guestPhone}</span>
                  </div>
                )}
                {order.guestAddress && (
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-gray-700 mt-1 leading-relaxed">{order.guestAddress}</span>
                  </div>
                )}
                {order.orderNote && (
                  <div className="flex items-start gap-3 pt-3 border-t">
                    <div className="h-7 w-7 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                    <span className="text-gray-600 mt-1 text-xs leading-relaxed">{order.orderNote}</span>
                  </div>
                )}
                {!order.guestName && !order.guestPhone && !order.guestAddress && (
                  <p className="text-gray-400 italic text-xs">Delivery details not available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="border-0 shadow-lg overflow-hidden h-full">
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-3">
                <h4 className="text-white font-bold flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4" />
                  Payment Info
                </h4>
              </div>
              <CardContent className="p-5 space-y-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Method</span>
                  <div className="flex items-center gap-2">
                    {order.paymentMethod === 'cod' ? (
                      <Banknote className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Wallet className="h-4 w-4 text-teal-500" />
                    )}
                    <span className="font-semibold text-gray-900">{safePaymentMethod}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge
                    className={`text-xs border-0 font-semibold ${
                      order.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : order.paymentStatus === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {safePaymentStatus}
                  </Badge>
                </div>
                {order.payment?.transactionId && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Transaction ID</span>
                    <span className="font-mono text-xs text-gray-600">{order.payment.transactionId}</span>
                  </div>
                )}
                {order.payment?.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Paid At</span>
                    <span className="text-xs text-gray-600">
                      {new Date(order.payment.paidAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t flex items-center gap-2 text-xs text-gray-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Payment is secure and encrypted</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ─── Action Buttons ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 overflow-hidden">
            <CardContent className="p-6">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                Actions
              </h4>
              <div className="flex flex-wrap gap-3">
                {/* Cancel Order Button */}
                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl font-semibold"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel Order
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-lg">
                          <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          </div>
                          Cancel Order #{safeOrderNumber}?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 mt-2">
                          This action cannot be undone. Your order will be cancelled and any payment will be refunded according to our policy.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <div className="my-3">
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">Reason for cancellation</Label>
                        <Select value={cancelReason} onValueChange={setCancelReason}>
                          <SelectTrigger className="w-full rounded-xl">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {cancelReasons.map((reason) => (
                              <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Keep Order</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelOrder}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                          disabled={cancelling}
                        >
                          {cancelling ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            'Yes, Cancel Order'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Track Order */}
                {(order.orderStatus === 'shipped' || order.orderStatus === 'processing') && (
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl font-semibold"
                    onClick={() => navigate('order-tracking', { id: order.id })}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Track Shipment
                  </Button>
                )}

                {/* Reorder - available for delivered or any completed order */}
                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl font-semibold"
                  onClick={handleReorder}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reorder
                </Button>

                {/* Download Invoice PDF */}
                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl font-semibold"
                  onClick={() => window.print()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Save Invoice
                </Button>

                {/* Back to Orders */}
                <Button
                  variant="ghost"
                  className="text-gray-500 rounded-xl font-semibold"
                  onClick={() => navigate('orders')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Orders
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
