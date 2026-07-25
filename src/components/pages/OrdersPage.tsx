'use client'

import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Eye, ChevronRight, Search, Truck, RotateCcw,
  MapPin, CheckCircle2, Clock, XCircle, AlertCircle, PackageCheck,
  ShoppingBag, Filter, ChevronLeft, ChevronRight as ChevronRightIcon,
  CalendarDays, CreditCard, ArrowRight, RefreshCw, MoreHorizontal,
  Banknote, Wallet, Inbox, ShoppingBasket, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore, type CartItem } from '@/lib/store'
import { extractItems } from '@/lib/api'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  createdAt: string
  deliveryCharge?: number
  discountAmount?: number
  items?: Array<{
    productName: string
    quantity: number
    price: number
    image?: string
  }>
}

// ─── Status Config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, {
  color: string
  bg: string
  border: string
  icon: typeof Package
  label: string
  dotColor: string
  gradient: string
}> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock, label: 'Pending', dotColor: 'bg-amber-400', gradient: 'from-amber-500 to-amber-600' },
  confirmed: { color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', icon: CheckCircle2, label: 'Confirmed', dotColor: 'bg-teal-400', gradient: 'from-teal-500 to-teal-600' },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: Package, label: 'Processing', dotColor: 'bg-orange-400', gradient: 'from-orange-500 to-orange-600' },
  shipped: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: Truck, label: 'Shipped', dotColor: 'bg-purple-400', gradient: 'from-purple-500 to-purple-600' },
  delivered: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: PackageCheck, label: 'Delivered', dotColor: 'bg-emerald-400', gradient: 'from-emerald-500 to-emerald-600' },
  cancelled: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle, label: 'Cancelled', dotColor: 'bg-red-400', gradient: 'from-red-500 to-red-600' },
  refunded: { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: RotateCcw, label: 'Refunded', dotColor: 'bg-gray-400', gradient: 'from-gray-500 to-gray-600' },
}

const statusSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']

// ─── Timeline Component ───────────────────────────────────────────────────────

function OrderTimeline({ status }: { status: string }) {
  const currentIdx = statusSteps.indexOf(status)
  const isCancelled = status === 'cancelled'

  return (
    <div className="flex items-center gap-0 my-3">
      {statusSteps.map((step, idx) => {
        const isCompleted = !isCancelled && idx <= currentIdx
        const isCurrent = !isCancelled && idx === currentIdx
        const StatusIcon = statusConfig[step]?.icon || Package

        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCancelled
                    ? 'bg-red-100 text-red-400'
                    : isCompleted
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm shadow-emerald-200'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                } ${isCurrent ? 'ring-2 ring-emerald-600/20 ring-offset-1' : ''}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <StatusIcon className="h-3 w-3" />
                )}
              </div>
              <span className={`text-[9px] mt-1 font-medium ${isCompleted ? 'text-emerald-700' : 'text-gray-400'}`}>
                {statusConfig[step]?.label || step}
              </span>
            </div>
            {idx < statusSteps.length - 1 && (
              <div className={`h-0.5 w-full -mt-5 rounded-full ${
                !isCancelled && idx < currentIdx ? 'bg-emerald-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function getEstimatedDelivery(createdAt: string, status: string): string | null {
  if (status === 'delivered' || status === 'cancelled') return null
  const created = new Date(createdAt)
  const est = new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000)
  return est.toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cod: 'Cash on Delivery',
    online: 'Online Payment',
  }
  return map[method] || method.charAt(0).toUpperCase() + method.slice(1)
}

// ─── Empty State Illustration ─────────────────────────────────────────────────

function EmptyOrdersIllustration({ isFiltered, onBrowse }: { isFiltered: boolean; onBrowse: () => void }) {
  return (
    <div className="text-center py-16">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <div className="relative mx-auto mb-8">
          {/* Background circle */}
          <div className="h-40 w-40 rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mx-auto shadow-inner">
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
              {isFiltered ? (
                <Filter className="h-12 w-12 text-emerald-300" />
              ) : (
                <Inbox className="h-12 w-12 text-emerald-300" />
              )}
            </div>
          </div>
          {/* Decorative dots */}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-2 right-2 h-4 w-4 rounded-full bg-amber-300 opacity-60"
          />
          <motion.div
            animate={{ y: [5, -5, 5] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-4 left-4 h-3 w-3 rounded-full bg-emerald-400 opacity-60"
          />
          <motion.div
            animate={{ x: [-3, 3, -3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-10 left-0 h-3 w-3 rounded-full bg-teal-300 opacity-60"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-2xl font-bold text-gray-800 mb-3">
          {isFiltered ? 'No Orders Found' : 'No Orders Yet'}
        </h3>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
          {isFiltered
            ? 'Try adjusting your search or filter criteria to find what you\'re looking for.'
            : 'Start shopping to see your orders here! Browse our fresh products and place your first order.'}
        </p>
        <Button onClick={onBrowse} className="rounded-full px-8 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 font-semibold">
          <ShoppingBag className="h-4 w-4 mr-2" />
          Browse Products
        </Button>
      </motion.div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { navigate, isAuthenticated, user, addToCart } = useAppStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ordersPerPage = 5

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('login')
      return
    }
    if (user?.id) {
      fetch(`/api/orders?userId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          const ords = extractItems<Order>(data)
          setOrders(ords)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, user?.id, navigate])

  const filteredOrders = useMemo(() => {
    let filtered = orders

    if (activeTab !== 'all') {
      filtered = filtered.filter((o) => o.orderStatus === activeTab)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.items?.some((i) => i.productName.toLowerCase().includes(q))
      )
    }

    return filtered
  }, [orders, activeTab, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const handleReorder = async (order: Order) => {
    if (!order.items?.length) return
    let added = 0
    for (const item of order.items) {
      try {
        const cartItem: Omit<CartItem, 'id'> = {
          productId: `reorder-${Date.now()}`,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          unit: 'kg',
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
  }

  const handleTrack = (orderId: string) => {
    navigate('order-detail', { id: orderId })
  }

  // ─── Order Status Counts ──────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length }
    orders.forEach((o) => {
      counts[o.orderStatus] = (counts[o.orderStatus] || 0) + 1
    })
    return counts
  }, [orders])

  if (!isAuthenticated) return null

  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  // ─── Pagination with ellipsis ─────────────────────────────────────────────

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }

    return (
      <div className="flex items-center justify-center gap-1.5 pt-8">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 rounded-lg"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((page, idx) =>
          typeof page === 'string' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              className={`h-9 w-9 p-0 rounded-lg font-semibold ${page === currentPage ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 rounded-lg"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Orders</h1>
              <p className="text-sm text-emerald-100 mt-0.5">Track, manage and reorder your purchases</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: 'Total Orders', value: orders.length, icon: Package, color: 'bg-white/15' },
              { label: 'Active', value: orders.filter((o) => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.orderStatus)).length, icon: Clock, color: 'bg-amber-400/30' },
              { label: 'Delivered', value: orders.filter((o) => o.orderStatus === 'delivered').length, icon: PackageCheck, color: 'bg-emerald-400/30' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} rounded-xl px-4 py-3 backdrop-blur-sm flex items-center gap-3`}>
                <stat.icon className="h-5 w-5 text-white/80" />
                <div>
                  <p className="text-white font-bold text-xl leading-tight">{stat.value}</p>
                  <p className="text-emerald-100 text-[10px] font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* ─── Search + Tabs ──────────────────────────────────────────────── */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order number or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white border-gray-200 shadow-sm rounded-xl focus:border-emerald-400 focus:ring-emerald-200"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 bg-white border-gray-200 shadow-sm rounded-xl"
              onClick={() => {
                if (user?.id) {
                  setLoading(true)
                  fetch(`/api/orders?userId=${user.id}`)
                    .then((r) => r.json())
                    .then((data) => {
                      const ords = extractItems<Order>(data)
                      setOrders(ords)
                    })
                    .catch(() => {})
                    .finally(() => setLoading(false))
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-white border border-gray-200 p-1.5 shadow-sm rounded-xl">
              {tabs.map((tab) => {
                const count = tab.value === 'all'
                  ? orders.length
                  : (statusCounts[tab.value] || 0)
                const tabConfig = statusConfig[tab.value]
                const TabIcon = tabConfig?.icon

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1 rounded-lg px-3 py-1.5"
                  >
                    {TabIcon && <TabIcon className="h-3 w-3" />}
                    {tab.label}
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-[10px] px-1.5 font-semibold">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* ─── Loading State ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          /* ─── Empty State ──────────────────────────────────────────────── */
          <EmptyOrdersIllustration isFiltered={!!searchQuery || activeTab !== 'all'} onBrowse={() => navigate('products')} />
        ) : (
          /* ─── Order List ────────────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-800">{paginatedOrders.length}</span> of{' '}
                <span className="font-semibold text-gray-800">{filteredOrders.length}</span> orders
              </p>
            </div>
            <AnimatePresence mode="popLayout">
              {paginatedOrders.map((order, idx) => {
                const config = statusConfig[order.orderStatus] || statusConfig.pending
                const StatusIcon = config.icon
                const estDelivery = getEstimatedDelivery(order.createdAt, order.orderStatus)

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                  >
                    <Card
                      className="hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden bg-white cursor-pointer group"
                      onClick={() => navigate('order-detail', { id: order.id })}
                    >
                      <CardContent className="p-0">
                        {/* Order header with status */}
                        <div className={`px-5 py-3.5 border-b ${config.bg} ${config.border} flex items-center justify-between`}>
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm`}>
                              <StatusIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <span className={`text-sm font-bold ${config.color}`}>
                                {config.label}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                                <span className="font-mono font-semibold">#{order.orderNumber}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(order.createdAt).toLocaleDateString('en-BD', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>

                        <div className="p-5">
                          {/* Timeline */}
                          <OrderTimeline status={order.orderStatus} />

                          {/* Items preview */}
                          <div className="flex items-center gap-4 mt-4 mb-3">
                            <div className="flex -space-x-2.5">
                              {order.items?.slice(0, 4).map((item, itemIdx) => (
                                <div
                                  key={itemIdx}
                                  className="h-12 w-12 rounded-xl bg-gray-100 border-2 border-white overflow-hidden shadow-sm"
                                >
                                  {item.image ? (
                                    <Image src={item.image} alt={item.productName} className="h-full w-full object-cover" width={48} height={48} />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                                      <Package className="h-5 w-5 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {(order.items?.length || 0) > 4 && (
                                <div className="h-12 w-12 rounded-xl bg-emerald-50 border-2 border-white flex items-center justify-center shadow-sm">
                                  <span className="text-[10px] font-bold text-emerald-600">
                                    +{(order.items?.length || 0) - 4}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {order.items?.map((i) => i.productName).join(', ') || 'No items'}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Estimated delivery */}
                          {estDelivery && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-emerald-50/50 rounded-lg px-3 py-2 w-fit">
                              <Truck className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Est. delivery: <span className="font-semibold text-gray-700">{estDelivery}</span></span>
                            </div>
                          )}

                          {/* Bottom row */}
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500 font-medium">
                                {order.paymentMethod === 'cod' ? (
                                  <><Banknote className="h-2.5 w-2.5 mr-1" /> COD</>
                                ) : (
                                  <><Wallet className="h-2.5 w-2.5 mr-1" /> Online</>
                                )}
                              </Badge>
                              <Badge
                                className={`text-[10px] border-0 font-semibold ${
                                  order.paymentStatus === 'paid'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : order.paymentStatus === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {order.paymentStatus}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-emerald-700 text-lg">
                                ৳{(order.totalAmount ?? 0).toLocaleString()}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {(order.orderStatus === 'shipped' || order.orderStatus === 'processing') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold"
                                    onClick={(e) => { e.stopPropagation(); handleTrack(order.id) }}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Track
                                  </Button>
                                )}
                                {order.orderStatus === 'delivered' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold"
                                    onClick={(e) => { e.stopPropagation(); handleReorder(order) }}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reorder
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* ─── Pagination ──────────────────────────────────────────────── */}
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  )
}
