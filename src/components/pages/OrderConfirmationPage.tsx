'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Package,
  Home,
  MapPin,
  CreditCard,
  CalendarDays,
  Truck,
  AlertCircle,
  Loader2,
  ShoppingBag,
  Phone,
  Download,
  ArrowRight,
  Clock,
  CircleDot,
  CircleCheck,
  Circle,
  Gift,
  ShieldCheck,
  Copy,
  ExternalLink,
  Star,
  Heart,
  Banknote,
  Wallet,
  FileText,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'
import { extractItems } from '@/lib/api'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unit: string
  price: number
  image?: string | null
  product?: {
    id: string
    name: string
    slug: string
    image?: string | null
    imageAlt?: string
  } | null
}

interface OrderData {
  id: string
  orderNumber: string
  totalAmount: number
  discountAmount: number
  deliveryCharge: number
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  orderNote?: string | null
  couponCode?: string | null
  createdAt: string
  userId?: string | null
  guestName?: string | null
  guestPhone?: string | null
  guestEmail?: string | null
  guestAddress?: string | null
  items: OrderItem[]
  payment?: {
    method: string
    status: string
    transactionId?: string | null
    paidAt?: string | null
  } | null
  tracking?: {
    estimatedDelivery?: {
      min: string
      max: string
    }
  } | null
}

interface RecommendedProduct {
  id: string
  name: string
  slug: string
  price: number
  discountPrice?: number | null
  image?: string | null
  unit: string
  rating?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cod: 'Cash on Delivery',
    online: 'SSLCommerz Payment Gateway',
    card: 'Card Payment',
    bkash: 'bKash',
    nagad: 'Nagad',
    rocket: 'Rocket',
  }
  return map[method] || method.charAt(0).toUpperCase() + method.slice(1)
}

// ─── Animated SVG Checkmark ───────────────────────────────────────────────────

function AnimatedCheckmark() {
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28" aria-label="Order confirmed">
      <circle
        cx="50" cy="50" r="45"
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        className="opacity-20"
      />
      <circle
        cx="50" cy="50" r="45"
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        strokeDasharray="283"
        strokeDashoffset="283"
        style={{ animation: 'circleDraw 0.8s 0.2s ease-out forwards' }}
      />
      <path
        d="M30 52 L44 66 L70 36"
        fill="none"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset="60"
        style={{ animation: 'checkStroke 0.4s 0.9s ease-out forwards' }}
      />
    </svg>
  )
}

// ─── Delivery Timeline Component ──────────────────────────────────────────────

const deliverySteps = [
  { key: 'placed', label: 'Order Placed', desc: 'Your order has been confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', desc: 'We are preparing your order', icon: Package },
  { key: 'shipped', label: 'Shipped', desc: 'Your order is on the way', icon: Truck },
  { key: 'delivered', label: 'Delivered', desc: 'Order will be delivered', icon: CircleCheck },
]

function DeliveryTimeline({ orderDate }: { orderDate: string }) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-400 to-emerald-200" />

      {deliverySteps.map((step, idx) => {
        const StepIcon = step.icon
        const isCompleted = idx === 0
        const isCurrent = idx === 1

        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + idx * 0.15 }}
            className="relative flex items-start gap-4 pb-6 last:pb-0"
          >
            <div className={`absolute left-[-21px] h-8 w-8 rounded-full flex items-center justify-center z-10 ${
              isCompleted
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-200'
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
                {isCompleted && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] h-5 px-2 font-semibold">Done</Badge>
                )}
                {isCurrent && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] h-5 px-2 font-semibold">Next</Badge>
                )}
              </div>
              <p className={`text-xs mt-1 ${isCompleted || isCurrent ? 'text-gray-500' : 'text-gray-400'}`}>
                {step.desc}
              </p>
              {idx === 0 && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(orderDate).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Confetti-like Particles ──────────────────────────────────────────────────

function SuccessParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: i * 0.06,
    x: Math.cos((i / 20) * 2 * Math.PI) * (80 + Math.random() * 40),
    y: Math.sin((i / 20) * 2 * Math.PI) * (80 + Math.random() * 40),
    color: ['#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#ec4899'][i % 6],
    size: 3 + Math.random() * 6,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 + p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ─── Recommended Products ────────────────────────────────────────────────────

function RecommendedProducts() {
  const { navigate, addToCart } = useAppStore()
  const [products, setProducts] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products?limit=4&featured=true')
      .then((r) => r.json())
      .then((data) => {
        const items = extractItems<RecommendedProduct>(data)
        setProducts(items.slice(0, 4))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    )
  }

  if (products.length === 0) return null

  const handleAddToCart = async (product: RecommendedProduct) => {
    try {
      await addToCart({
        productId: product.id,
        productName: product.name,
        price: product.discountPrice ?? product.price,
        quantity: 1,
        unit: product.unit || 'kg',
        image: product.image || '/placeholder.png',
        stock: 999,
      })
      toast.success(`${product.name} added to cart`)
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {products.map((product, idx) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 + idx * 0.1 }}
        >
          <Card
            className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden h-full"
            onClick={() => navigate('product-detail', { id: product.id, slug: product.slug })}
          >
            <div className="relative h-32 sm:h-36 bg-gray-100 overflow-hidden">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-8 w-8 text-gray-300" />
                </div>
              )}
              {product.discountPrice && (
                <Badge className="absolute top-2 left-2 bg-red-500 text-white border-0 text-[10px] h-5 font-bold shadow-sm">
                  -{Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-sm font-bold text-emerald-700">
                  ৳{(product.discountPrice ?? product.price).toLocaleString()}
                </span>
                {product.discountPrice && (
                  <span className="text-[10px] text-gray-400 line-through">
                    ৳{product.price.toLocaleString()}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="w-full h-8 mt-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold"
                onClick={(e) => { e.stopPropagation(); handleAddToCart(product) }}
              >
                <ShoppingBag className="h-3 w-3 mr-1" />
                Add to Cart
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderConfirmationPage() {
  const { pageParams, navigate, siteConfig } = useAppStore()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const [copiedOrder, setCopiedOrder] = useState(false)

  // Resolve order identifier from: URL params > pageParams
  const resolveOrderId = useCallback((): {
    id: string | null
    orderNumber: string | null
    paymentStatus: string | null
  } => {
    if (typeof window === 'undefined') {
      return { id: null, orderNumber: null, paymentStatus: null }
    }

    const urlParams = new URLSearchParams(window.location.search)
    const urlPayment = urlParams.get('payment')
    const urlOrderId = urlParams.get('orderId')
    const urlOrderNumber = urlParams.get('orderNumber')

    if (urlOrderId || urlOrderNumber) {
      return {
        id: urlOrderId,
        orderNumber: urlOrderNumber,
        paymentStatus: urlPayment,
      }
    }

    const paramsId = pageParams?.orderId
      ? String(pageParams.orderId)
      : null
    const paramsOrderNumber = pageParams?.orderNumber
      ? String(pageParams.orderNumber)
      : null

    return {
      id: paramsId,
      orderNumber: paramsOrderNumber,
      paymentStatus: null,
    }
  }, [pageParams])

  const fetchOrder = useCallback(
    async (id: string | null, orderNumber: string | null) => {
      try {
        if (id) {
          const r = await fetch(`/api/orders/${id}`)
          if (r.ok) {
            const data = await r.json()
            setOrder(data.data || data)
            return
          }
        }

        if (orderNumber) {
          const r = await fetch(
            `/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`
          )
          if (r.ok) {
            const data = await r.json()
            const items =
              data.data?.data ||
              data.data?.items ||
              data.data ||
              []
            if (Array.isArray(items) && items.length > 0) {
              const match = items.find(
                (o: OrderData) => o.orderNumber === orderNumber
              )
              if (match) {
                const detailR = await fetch(`/api/orders/${match.id}`)
                if (detailR.ok) {
                  const detailData = await detailR.json()
                  setOrder(detailData.data || detailData)
                  return
                }
              }
            }
          }
        }

        setNotFound(true)
      } catch {
        setNotFound(true)
        toast.error('Failed to load order details')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    const { id, orderNumber, paymentStatus } = resolveOrderId()

    const failedKeywords = ['fail', 'failed', 'FAILED', 'CANCELLED', 'cancelled']
    if (
      failedKeywords.includes(paymentStatus || '') ||
      pageParams?.paymentFailed
    ) {
      setPaymentFailed(true)
    }

    if (!id && !orderNumber) {
      setNotFound(true)
      setLoading(false)
      return
    }

    fetchOrder(id, orderNumber)
  }, [resolveOrderId, fetchOrder, pageParams?.paymentFailed])

  useEffect(() => {
    if (!loading && order && !paymentFailed) {
      const timer = setTimeout(() => setShowAnimation(true), 100)
      return () => clearTimeout(timer)
    }
  }, [loading, order, paymentFailed])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.has('payment') || urlParams.has('orderId')) {
        window.history.replaceState({}, '', '/')
      }
    }
  }, [])

  const handleCopyOrderNumber = () => {
    if (order?.orderNumber) {
      navigator.clipboard.writeText(order.orderNumber)
      setCopiedOrder(true)
      toast.success('Order number copied!')
      setTimeout(() => setCopiedOrder(false), 2000)
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-b from-gray-50 to-white">
        <Card className="w-full max-w-2xl border-0 shadow-lg">
          <CardContent className="p-10 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
              <p className="text-gray-500 font-medium">
                Loading your order details...
              </p>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-48 mx-auto" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Payment failed state ─────────────────────────────────────────────────

  if (paymentFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-b from-gray-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <Card className="border-0 shadow-xl">
            <CardContent className="p-10 text-center">
              {siteConfig?.logo && (
                <div className="flex justify-center mb-6">
                  <img
                    src={siteConfig.logo}
                    alt="Khati Khadyo"
                    className="h-10 w-auto object-contain"
                  />
                </div>
              )}

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="h-24 w-24 rounded-full bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center mx-auto mb-6 shadow-inner"
              >
                <AlertCircle className="h-12 w-12 text-red-500" />
              </motion.div>

              <h1 className="text-2xl font-bold mb-2 text-red-700">
                Payment Failed
              </h1>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Your payment could not be processed. Your order has been created
                but payment is still pending. You can retry payment from your
                orders page.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-semibold"
                  onClick={() => navigate('orders')}
                >
                  <Package className="h-4 w-4 mr-2" />
                  View My Orders
                </Button>
                <Button
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold"
                  onClick={() => navigate('home')}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ─── Not found state ──────────────────────────────────────────────────────

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-b from-gray-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <Card className="border-0 shadow-xl">
            <CardContent className="p-10 text-center">
              {siteConfig?.logo && (
                <div className="flex justify-center mb-6">
                  <img
                    src={siteConfig.logo}
                    alt="Khati Khadyo"
                    className="h-10 w-auto object-contain"
                  />
                </div>
              )}

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mx-auto mb-6 shadow-inner"
              >
                <AlertCircle className="h-12 w-12 text-amber-600" />
              </motion.div>

              <h1 className="text-2xl font-bold mb-2 text-gray-800">
                We Couldn&apos;t Find Your Order Details
              </h1>
              <p className="text-gray-500 mb-8 leading-relaxed">
                It looks like your order information was lost, possibly due to a
                page refresh. Don&apos;t worry — your order may still have been
                placed. Check your orders page or email for confirmation.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-semibold"
                  onClick={() => navigate('orders')}
                >
                  <Package className="h-4 w-4 mr-2" />
                  View My Orders
                </Button>
                <Button
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold"
                  onClick={() => navigate('home')}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ─── Success state with order details ─────────────────────────────────────

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const estimatedDelivery = order.tracking?.estimatedDelivery

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4">
      {/* CSS Animation Keyframes */}
      <style jsx>{`
        @keyframes circleDraw {
          0% { stroke-dashoffset: 283; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes checkStroke {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-100px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* ─── Success Header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-6 sm:px-10 pt-10 pb-12 text-center relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />
              <div className="absolute top-1/2 left-1/4 h-20 w-20 rounded-full bg-white/3" />

              {/* Animated Checkmark Circle */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="relative mx-auto mb-8"
              >
                <div
                  className="h-32 w-32 rounded-full bg-white/15 flex items-center justify-center mx-auto backdrop-blur-sm"
                  style={showAnimation ? { animation: 'ringPulse 2s ease-in-out 1.5s 2' } : {}}
                >
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center relative shadow-lg shadow-emerald-900/30">
                    <AnimatedCheckmark />
                  </div>
                </div>
                {showAnimation && <SuccessParticles />}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    Order Confirmed!
                  </h1>
                  <Sparkles className="h-5 w-5 text-amber-300" />
                </div>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-emerald-100 mb-8 text-sm sm:text-base leading-relaxed"
              >
                Thank you for your order. We&apos;ll send you a confirmation via email/phone.
              </motion.p>

              {/* Order Number Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 max-w-sm mx-auto border border-white/10"
              >
                <p className="text-emerald-100 text-sm font-medium mb-2">Order Number</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-3xl font-extrabold text-white tracking-wide">#{order.orderNumber}</p>
                  <button
                    onClick={handleCopyOrderNumber}
                    className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    title="Copy order number"
                  >
                    {copiedOrder ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <Copy className="h-4 w-4 text-white" />
                    )}
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Estimated Delivery Bar */}
            <div className="bg-white px-6 sm:px-10 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                </div>
                <span>
                  Estimated delivery:{' '}
                  <span className="font-bold text-gray-900">
                    {estimatedDelivery
                      ? `${formatDate(estimatedDelivery.min)} – ${formatDate(estimatedDelivery.max)}`
                      : '3–5 business days'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`border-0 font-semibold ${
                  order.paymentMethod === 'cod'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-teal-100 text-teal-700'
                }`}>
                  {order.paymentMethod === 'cod' ? (
                    <><Banknote className="h-3 w-3 mr-1" /> Cash on Delivery</>
                  ) : (
                    <><CreditCard className="h-3 w-3 mr-1" /> Prepaid</>
                  )}
                </Badge>
                <Badge className={`border-0 font-semibold ${
                  order.paymentStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </Badge>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ─── Delivery Timeline ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-white" />
                </div>
                Delivery Timeline
              </h3>
            </div>
            <CardContent className="p-6">
              <DeliveryTimeline orderDate={order.createdAt} />
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Order Items ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-white" />
                </div>
                Order Items ({order.items.length})
              </h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {order.items.map((item, idx) => {
                  const itemImage = item.image || item.product?.image || null

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.05 }}
                      className="flex items-center gap-4 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 border">
                        {itemImage ? (
                          <Image
                            src={itemImage}
                            alt={item.product?.imageAlt || item.productName}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.quantity} × ৳{item.price.toLocaleString()} per {item.unit}
                        </p>
                      </div>
                      <span className="font-bold text-sm text-emerald-700 whitespace-nowrap">
                        ৳{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </motion.div>
                  )
                })}
              </div>

              <Separator className="my-5" />

              {/* Price Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">৳{subtotal.toLocaleString()}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Discount {order.couponCode ? `(${order.couponCode})` : ''}
                    </span>
                    <span className="text-emerald-600 font-bold">-৳{order.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Charge</span>
                  <span className={order.deliveryCharge === 0 ? 'text-emerald-600 font-bold' : 'text-gray-900 font-medium'}>
                    {order.deliveryCharge === 0 ? 'FREE' : `৳${order.deliveryCharge.toLocaleString()}`}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg pt-1">
                  <span className="text-gray-900">Grand Total</span>
                  <span className="text-emerald-700">৳{order.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Delivery & Payment Info ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid md:grid-cols-2 gap-4"
        >
          {/* Delivery Address */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3">
              <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                Delivery Address
              </h4>
            </div>
            <CardContent className="p-5 space-y-2.5 text-sm">
              {order.guestName && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{order.guestName}</span>
                </div>
              )}
              {order.guestPhone && (
                <p className="text-gray-500 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {order.guestPhone}
                </p>
              )}
              {order.guestAddress && (
                <p className="text-gray-500 flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" /> {order.guestAddress}
                </p>
              )}
              {!order.guestName && !order.guestPhone && !order.guestAddress && (
                <p className="text-gray-400 italic">Address details not available</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-3">
              <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4" />
                Payment Method
              </h4>
            </div>
            <CardContent className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Method</span>
                <div className="flex items-center gap-1.5">
                  {order.paymentMethod === 'cod' ? (
                    <Banknote className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Wallet className="h-4 w-4 text-teal-500" />
                  )}
                  <span className="font-medium text-gray-900">{formatPaymentMethod(order.paymentMethod)}</span>
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
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </Badge>
              </div>
              {order.payment?.transactionId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="font-mono text-xs text-gray-600">{order.payment.transactionId}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Order Note ─────────────────────────────────────────────────── */}
        {order.orderNote && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-5 py-3">
                <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Order Note
                </h4>
              </div>
              <CardContent className="p-5">
                <p className="text-sm text-gray-700 leading-relaxed">{order.orderNote}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── Action Buttons ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 overflow-hidden">
            <CardContent className="p-6">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Star className="h-4 w-4 text-amber-500" />
                </div>
                What&apos;s Next?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white rounded-xl font-semibold"
                  onClick={() => navigate('order-detail', { id: order.id })}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Track Order
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white rounded-xl font-semibold"
                  onClick={() => navigate('orders')}
                >
                  <Package className="h-4 w-4 mr-2" />
                  View Orders
                </Button>
                <Button
                  className="h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold shadow-md shadow-emerald-200"
                  onClick={() => navigate('home')}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Download Invoice ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex justify-center"
        >
          <Button
            variant="outline"
            className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold px-8"
            onClick={() => navigate('order-detail', { id: order.id })}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Invoice
          </Button>
        </motion.div>

        {/* ─── Recommended Products ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Heart className="h-4 w-4" />
                You Might Also Like
              </h3>
            </div>
            <CardContent className="p-5">
              <RecommendedProducts />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
