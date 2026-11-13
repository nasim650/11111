'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { X, Minus, Plus, ShoppingBag, Trash2, Truck, Gift, Sparkles, Tag, BadgeCheck, ChevronRight, RotateCcw, ArrowRight, Package } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { formatPrice, safeNum } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──
interface SuggestedProduct {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  unit: string
  stock: number
  image?: string
  category?: { name: string }
}

interface CouponData {
  code: string
  type: string
  value: number
  discount: number
  minOrder: number | null
  maxDiscount: number | null
}

export default function CartSidebar() {
  const router = useRouter()
  const {
    isCartOpen,
    setCartOpen,
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    totalItems,
    siteConfig,
    navigate,
    addToCart,
    openQuickView,
  } = useAppStore()

  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [prevTotal, setPrevTotal] = useState(0)
  const [totalAnimating, setTotalAnimating] = useState(false)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponExpanded, setCouponExpanded] = useState(false)

  // Frequently bought together suggestions
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([])
  const [suggestedLoading, setSuggestedLoading] = useState(false)

  const freeShippingThreshold = safeNum(siteConfig?.freeShippingThreshold, 1500)
  const shippingCharge = safeNum(siteConfig?.shippingCharge, 60)
  const currentSubtotal = safeNum(subtotal(), 0)
  const itemCount = safeNum(totalItems(), 0)
  const shippingProgress = freeShippingThreshold > 0 ? Math.min((currentSubtotal / freeShippingThreshold) * 100, 100) : 100
  const isFreeShipping = currentSubtotal >= freeShippingThreshold
  const estimatedShipping = isFreeShipping ? 0 : shippingCharge

  // Calculate total savings from discounts
  const discountSavings = cartItems.reduce((sum, item) => {
    const p = safeNum(item.price)
    const dp = item.discountPrice != null ? safeNum(item.discountPrice) : null
    const q = safeNum(item.quantity, 1)
    if (dp != null && dp < p) {
      return sum + (p - dp) * q
    }
    return sum
  }, 0)

  const couponDiscount = safeNum(appliedCoupon?.discount, 0)
  const totalSavings = safeNum(discountSavings + couponDiscount, 0)
  const estimatedTotal = Math.max(0, safeNum(currentSubtotal + estimatedShipping - couponDiscount, 0))
  const amountToFreeShipping = Math.max(0, safeNum(freeShippingThreshold - currentSubtotal, 0))

  // Animate total changes
  useEffect(() => {
    if (prevTotal !== 0 && prevTotal !== estimatedTotal) {
      setTotalAnimating(true)
      const t = setTimeout(() => setTotalAnimating(false), 600)
      return () => clearTimeout(t)
    }
    setPrevTotal(estimatedTotal)
  }, [estimatedTotal, prevTotal])

  // ── Fetch frequently bought together suggestions ──
  useEffect(() => {
    if (!isCartOpen || cartItems.length === 0) return

    const cartProductIds = cartItems.map((item) => item.productId)
    const referenceProductId = cartItems[0]?.productId
    if (!referenceProductId) return

    setSuggestedLoading(true)
    fetch(`/api/recommendations?productId=${referenceProductId}&limit=4`)
      .then((r) => r.json())
      .then((data) => {
        const products = (data?.data || []).filter(
          (p: SuggestedProduct) => !cartProductIds.includes(p.id)
        )
        setSuggestedProducts(products.slice(0, 3))
      })
      .catch(() => setSuggestedProducts([]))
      .finally(() => setSuggestedLoading(false))
  }, [isCartOpen, cartItems.length])

  // ── Reset coupon when cart changes significantly ──
  useEffect(() => {
    if (appliedCoupon && currentSubtotal < (appliedCoupon.minOrder || 0)) {
      setAppliedCoupon(null)
      toast.info('Coupon removed — order amount below minimum')
    }
  }, [currentSubtotal, appliedCoupon])

  const handleQuantityChange = async (cartItemId: string, newQty: number) => {
    if (newQty < 1) return
    setUpdatingId(cartItemId)
    try {
      await updateQuantity(cartItemId, newQty)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemove = async (cartItemId: string) => {
    setRemovingId(cartItemId)
    try {
      await removeFromCart(cartItemId)
    } finally {
      setRemovingId(null)
    }
  }

  const handleCheckout = () => {
    setCartOpen(false)
    router.push('/checkout')
    navigate('checkout')
  }

  // ── Coupon Apply ──
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, orderAmount: currentSubtotal }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setCouponError(data.error || 'Invalid coupon')
        setAppliedCoupon(null)
        return
      }

      setAppliedCoupon(data.data)
      toast.success(`Coupon applied! You save ৳${data.data.discount.toLocaleString()}`)
    } catch {
      setCouponError('Failed to validate coupon')
      setAppliedCoupon(null)
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
    toast.info('Coupon removed')
  }

  // ── Add suggested product to cart ──
  const handleAddSuggestion = async (product: SuggestedProduct) => {
    try {
      await addToCart({
        productId: product.id,
        productName: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity: 1,
        unit: product.unit,
        image: product.image || '/placeholder.png',
        stock: product.stock,
      })
      toast.success(`${product.name} added to cart`)
      setSuggestedProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  // ── Clear cart handler ──
  const handleClearCart = async () => {
    try {
      await clearCart()
      setAppliedCoupon(null)
      setCouponCode('')
      toast.success('Cart cleared')
    } catch {
      toast.error('Failed to clear cart')
    }
  }

  return (
    <Sheet open={isCartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Shopping Cart
            {itemCount > 0 && (
              <motion.span
                key={itemCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5"
              >
                {itemCount}
              </motion.span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">Your shopping cart items</SheetDescription>
        </SheetHeader>

        {cartItems.length === 0 ? (
          /* ── Empty Cart State ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            {/* Friendly illustration */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="relative"
            >
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <ShoppingBag className="h-14 w-14 text-primary/25" strokeWidth={1.5} />
              </div>
              {/* Floating sparkles */}
              <motion.div
                className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center"
                animate={{ y: [0, -5, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
              </motion.div>
              <motion.div
                className="absolute -bottom-1 -left-1 h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center"
                animate={{ y: [0, 5, 0], rotate: [0, -10, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Package className="h-3.5 w-3.5 text-emerald-500" />
              </motion.div>
            </motion.div>

            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Your cart is empty</h3>
              <p className="text-muted-foreground text-sm max-w-[240px]">
                Looks like you haven&apos;t added any authentic Bangladeshi products yet!
              </p>
            </div>
            <Button
              className="gap-2 min-w-[200px] shadow-lg shadow-primary/20"
              onClick={() => {
                setCartOpen(false)
                navigate('products')
              }}
            >
              <ShoppingBag className="h-4 w-4" />
              Start Shopping
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary gap-1"
              onClick={() => {
                setCartOpen(false)
                navigate('products')
              }}
            >
              <Gift className="h-4 w-4" />
              Check out our offers
            </Button>
          </div>
        ) : (
          <>
            {/* ── Free Shipping Progress Bar ── */}
            <div className="px-6 py-3 bg-gradient-to-r from-primary/5 to-primary/[0.02] border-b">
              {isFreeShipping ? (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-primary text-sm font-medium"
                >
                  <Truck className="h-4 w-4 shrink-0" />
                  <span>You qualify for FREE shipping!</span>
                  <motion.span
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5 }}
                    className="text-lg"
                  >
                    🎉
                  </motion.span>
                </motion.div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Only <span className="font-bold text-primary">{formatPrice(amountToFreeShipping)}</span> more for free shipping!
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatPrice(currentSubtotal)} / {formatPrice(freeShippingThreshold)}</span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(shippingProgress, 100)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                    {/* Truck icon moving along the progress */}
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      animate={{ left: `${Math.min(shippingProgress, 95)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    >
                      <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm ring-2 ring-white">
                        <Truck className="h-2.5 w-2.5 text-white" />
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Savings Banner ── */}
            <AnimatePresence>
              {totalSavings > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100"
                >
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                    <BadgeCheck className="h-4 w-4 shrink-0" />
                    <span>You save <span className="font-bold">{formatPrice(totalSavings)}</span></span>
                    {discountSavings > 0 && couponDiscount > 0 && (
                      <span className="text-xs text-emerald-600/70">
                        ({formatPrice(discountSavings)} discounts + {formatPrice(couponDiscount)} coupon)
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Cart Items ── */}
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-4">
                <AnimatePresence mode="popLayout">
                  {cartItems.map((item, index) => {
                    const price = item.discountPrice != null ? item.discountPrice : item.price
                    const hasDiscount = item.discountPrice != null && item.discountPrice < item.price
                    const qty = Number(item.quantity) || 1
                    const itemPrice = Number(price) || 0
                    const originalPrice = Number(item.price) || 0
                    const itemSavings = hasDiscount ? (originalPrice - itemPrice) * qty : 0
                    return (
                      <motion.div
                        key={`cart-${item.id}-${index}`}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40, scale: 0.95 }}
                        transition={{ duration: 0.25, type: 'spring', stiffness: 300, damping: 25 }}
                        className={`flex gap-3 p-3 rounded-xl border border-transparent hover:border-border/40 hover:bg-muted/30 transition-all duration-200 group/item ${
                          removingId === item.id ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100'
                        }`}
                      >
                        {/* Product Image with quantity badge */}
                        <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0 ring-1 ring-border/50">
                          <Image
                            src={item.image}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                          {/* Quantity badge on image */}
                          <AnimatePresence>
                            {qty > 1 && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-background"
                              >
                                {qty}x
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-sm font-medium line-clamp-2 leading-tight">{item.productName}</h4>
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-all duration-150 opacity-0 group-hover/item:opacity-100 shrink-0"
                              onClick={() => handleRemove(item.id)}
                              aria-label="Remove item"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">/{item.unit}</p>

                          {/* Price with strikethrough for discount */}
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <motion.span
                              key={`price-${itemPrice * qty}`}
                              initial={{ scale: 1.1, color: '#059669' }}
                              animate={{ scale: 1, color: undefined }}
                              transition={{ duration: 0.3 }}
                              className="text-sm font-bold text-primary"
                            >
                              {formatPrice(itemPrice * qty)}
                            </motion.span>
                            {hasDiscount && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatPrice(originalPrice * qty)}
                              </span>
                            )}
                          </div>

                          {/* Item savings */}
                          {itemSavings > 0 && (
                            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                              Save {formatPrice(itemSavings)}
                            </p>
                          )}

                          {/* Quantity Controls */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center rounded-lg border bg-background overflow-hidden">
                              <button
                                className="h-7 w-7 flex items-center justify-center hover:bg-primary/10 text-primary transition-all duration-150 active:scale-90"
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                disabled={updatingId === item.id}
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <motion.span
                                key={qty}
                                initial={{ scale: 1.3 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                className="h-7 w-8 flex items-center justify-center text-sm font-semibold border-x"
                              >
                                {qty}
                              </motion.span>
                              <button
                                className="h-7 w-7 flex items-center justify-center hover:bg-primary/10 text-primary transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                disabled={updatingId === item.id || item.quantity >= item.stock}
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Delete button (always visible on mobile) */}
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all duration-150 active:scale-90 sm:opacity-0 sm:group-hover/item:opacity-100"
                              onClick={() => handleRemove(item.id)}
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* ── Expandable Coupon Code Section ── */}
            <div className="px-6 py-3 border-t bg-muted/10">
              <button
                type="button"
                className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setCouponExpanded(!couponExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-secondary" />
                  {appliedCoupon ? 'Coupon Applied' : 'Apply Coupon Code'}
                </div>
                <motion.div
                  animate={{ rotate: couponExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              </button>

              <AnimatePresence>
                {couponExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2">
                      {appliedCoupon ? (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50"
                        >
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white text-xs">{appliedCoupon.code}</Badge>
                            <span className="text-xs text-emerald-700 font-medium">
                              -৳{appliedCoupon.discount.toLocaleString()}
                              {appliedCoupon.type === 'percentage' && ` (${appliedCoupon.value}%)`}
                            </span>
                          </div>
                          <button
                            onClick={handleRemoveCoupon}
                            className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </motion.div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter coupon code"
                            value={couponCode}
                            onChange={(e) => {
                              setCouponCode(e.target.value.toUpperCase())
                              setCouponError('')
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                            className="h-9 text-sm flex-1"
                            autoFocus
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 shrink-0"
                            onClick={handleApplyCoupon}
                            disabled={couponLoading || !couponCode.trim()}
                          >
                            {couponLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            ) : (
                              'Apply'
                            )}
                          </Button>
                        </div>
                      )}
                      {couponError && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 mt-1.5 flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          {couponError}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Frequently Bought Together ── */}
            {suggestedProducts.length > 0 && (
              <div className="px-6 py-3 border-t bg-muted/10">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-secondary" />
                  Customers also bought
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {suggestedProducts.map((product) => {
                    const effectivePrice = product.discountPrice ?? product.price
                    return (
                      <motion.button
                        key={product.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-background hover:shadow-sm hover:border-primary/30 transition-all shrink-0 group/sug"
                        onClick={() => handleAddSuggestion(product)}
                        whileTap={{ scale: 0.97 }}
                      >
                        <div className="h-10 w-10 rounded-md bg-muted/30 overflow-hidden relative shrink-0">
                          <Image
                            src={product.image || '/placeholder.png'}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div className="text-left min-w-0 max-w-[120px]">
                          <p className="text-xs font-medium line-clamp-1">{product.name}</p>
                          <p className="text-xs font-bold text-primary">{formatPrice(effectivePrice)}</p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover/sug:text-primary transition-colors shrink-0" />
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Cart Summary & Actions ── */}
            <div className="border-t px-6 py-4 space-y-3 bg-background">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                  <span className="font-medium">{formatPrice(currentSubtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Coupon ({appliedCoupon.code})
                    </span>
                    <span className="font-medium text-emerald-600">-{formatPrice(couponDiscount)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  {isFreeShipping ? (
                    <span className="font-medium text-primary">FREE</span>
                  ) : (
                    <span className="font-medium">{formatPrice(estimatedShipping)}</span>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Estimated Total</span>
                  <motion.span
                    key={estimatedTotal}
                    initial={totalAnimating ? { scale: 1.15, color: '#059669' } : { scale: 1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="text-lg font-bold text-primary"
                  >
                    {formatPrice(estimatedTotal)}
                  </motion.span>
                </div>
                {!isFreeShipping && (
                  <p className="text-xs text-muted-foreground">
                    Free shipping on orders {formatPrice(freeShippingThreshold)}+
                  </p>
                )}
              </div>

              <SheetFooter className="gap-2 sm:gap-2 p-0">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setCartOpen(false)
                    router.push('/cart')
                    navigate('cart')
                  }}
                >
                  View Cart
                </Button>
                <Button className="flex-1 gap-2 shadow-lg shadow-primary/20" onClick={handleCheckout}>
                  Checkout
                  <span className="text-xs opacity-80">{formatPrice(estimatedTotal)}</span>
                </Button>
              </SheetFooter>

              {/* Clear Cart Button */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-red-500 gap-1.5"
                onClick={handleClearCart}
              >
                <RotateCcw className="h-3 w-3" />
                Clear Cart
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
