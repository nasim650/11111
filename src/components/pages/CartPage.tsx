'use client'

import { useEffect, useReducer, useState } from 'react'
import Image from 'next/image'
import {
  Minus, Plus, Trash2, ShoppingCart, Tag, ArrowRight, ArrowLeft,
  ShieldCheck, Truck, ShoppingBag, Heart, X, AlertCircle,
  Package, Home, Gift, BadgeCheck, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useAppStore } from '@/lib/store'
import { extractItems } from '@/lib/api'
import { toast } from 'sonner'

interface SuggestedProduct {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  images?: Array<{ url: string; alt?: string }>
  unit: string
}

export default function CartPage() {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    subtotal,
    totalItems,
    navigate,
    siteConfig,
    clearCart,
    addToCart,
    addToWishlist,
  } = useAppStore()

  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [suggestedProducts, setSuggestedProducts] = useReducer(
    (_: SuggestedProduct[], next: SuggestedProduct[]) => next,
    []
  )

  const sub = subtotal()
  const shipping = sub >= (siteConfig?.freeShippingThreshold || 1500) ? 0 : (siteConfig?.shippingCharge || 60)
  const total = sub + shipping - discount
  const itemCount = totalItems()
  const totalSavings = cartItems.reduce((sum, item) => {
    if (item.discountPrice != null && item.discountPrice < item.price) {
      return sum + ((item.price - item.discountPrice) * item.quantity)
    }
    return sum
  }, 0)

  const estimatedDelivery = (() => {
    const date = new Date()
    date.setDate(date.getDate() + 4)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  })()

  useEffect(() => {
    fetch('/api/products?limit=6&status=active')
      .then((r) => r.json())
      .then((data) => {
        setSuggestedProducts(extractItems<SuggestedProduct>(data))
      })
      .catch(() => {})
  }, [])

  const handleQuantityChange = async (cartItemId: string, newQty: number) => {
    if (newQty < 1) return
    await updateQuantity(cartItemId, newQty)
  }

  const handleRemove = async (cartItemId: string) => {
    setRemovingId(cartItemId)
    setTimeout(async () => {
      await removeFromCart(cartItemId)
      setRemovingId(null)
      toast.success('Item removed from cart')
    }, 300)
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, totalAmount: sub }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Invalid coupon code')
        return
      }
      const discountAmount = data.type === 'percentage'
        ? Math.min(sub * (data.value / 100), data.maxDiscount || Infinity)
        : data.value
      setDiscount(discountAmount)
      setAppliedCoupon(couponCode)
      toast.success(`Coupon applied! You save ৳${discountAmount.toFixed(0)}`)
    } catch {
      toast.error('Failed to validate coupon')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setDiscount(0)
    setAppliedCoupon('')
    setCouponCode('')
    toast.success('Coupon removed')
  }

  const handleClearCart = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    await clearCart()
    setConfirmClear(false)
    toast.success('Cart cleared')
  }

  const handleAddSuggestedToCart = async (product: SuggestedProduct) => {
    const effectivePrice = product.discountPrice ?? product.price
    await addToCart({
      productId: product.id,
      productName: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      quantity: 1,
      unit: product.unit || 'kg',
      image: product.images?.[0]?.url || '/placeholder.png',
      stock: 100,
    })
  }

  const freeShippingThreshold = siteConfig?.freeShippingThreshold || 1500
  const freeShippingRemaining = Math.max(freeShippingThreshold - sub, 0)

  // ─── Empty Cart State ──────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Breadcrumb */}
        <div className="bg-muted/30 py-3 border-b">
          <div className="container mx-auto px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink onClick={() => navigate('home')} className="cursor-pointer flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink className="text-foreground font-medium">Shopping Cart</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4">
          <div className="relative mb-6">
            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-12 w-12 text-primary/40" />
            </div>
            <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center border-2 border-background shadow-sm text-sm font-bold text-amber-700">
              0
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Cart is Empty</h2>
          <p className="text-muted-foreground mb-8 text-center max-w-sm">
            Looks like you haven&apos;t added anything yet. Start exploring our authentic Bangladeshi food products!
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => navigate('products')} size="lg" className="h-12 px-8 rounded-xl">
              <ShoppingBag className="h-5 w-5 mr-2" /> Start Shopping
            </Button>
            <Button variant="outline" onClick={() => navigate('products')} size="lg" className="h-12 px-8 rounded-xl">
              <Tag className="h-5 w-5 mr-2" /> Check Offers
            </Button>
          </div>
        </div>

        {suggestedProducts.length > 0 && (
          <div className="border-t bg-muted/30 py-8 px-4">
            <div className="container mx-auto max-w-4xl">
              <h3 className="text-lg font-semibold mb-4">You Might Also Like</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {suggestedProducts.slice(0, 6).map((product) => (
                  <div
                    key={product.id}
                    className="text-center group cursor-pointer"
                    onClick={() => navigate('product-detail', { id: product.id })}
                  >
                    <div className="w-full aspect-square rounded-lg bg-muted/50 overflow-hidden mb-2">
                      <img
                        src={product.images?.[0]?.url || '/placeholder.png'}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{product.name}</p>
                    <p className="text-xs text-primary font-semibold mt-0.5">
                      ৳{(product.discountPrice ?? product.price).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Order Summary Card (shared between desktop sidebar and mobile sheet) ──
  const OrderSummaryContent = (
    <CardContent className="space-y-4 p-4 sm:p-5">
      {/* Compact item list */}
      <div className="space-y-3">
        {cartItems.map((item) => {
          const price = item.discountPrice != null ? item.discountPrice : item.price
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted/40 flex-shrink-0">
                <Image
                  src={item.image}
                  alt={item.productName}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.productName}</p>
                <p className="text-xs text-muted-foreground">৳{price.toLocaleString()} {item.unit && `· ${item.unit}`}</p>
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">
                ৳{(price * item.quantity).toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
          <span className="font-medium">৳{sub.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery Charge</span>
          <span className={`font-medium ${shipping === 0 ? 'text-emerald-600' : ''}`}>
            {shipping === 0 ? 'FREE' : `৳${shipping}`}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-emerald-600 font-medium">-৳{discount.toLocaleString()}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between items-center pt-1">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-bold text-primary">৳{Math.max(0, total).toLocaleString()}</span>
        </div>
      </div>

      {/* Savings callout */}
      {(totalSavings > 0 || discount > 0) && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">
            You save ৳{((totalSavings || 0) + (discount || 0)).toLocaleString()}
          </p>
        </div>
      )}

      {/* Coupon section — inline */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Gift className="h-3.5 w-3.5 text-amber-500" />
          Coupon Code
        </Label>
        {appliedCoupon ? (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                <Tag className="h-3 w-3 mr-1" />
                {appliedCoupon}
              </Badge>
              <span className="text-xs text-emerald-700 font-semibold">-৳{discount.toLocaleString()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCoupon}
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <X className="h-3 w-3 mr-0.5" /> Remove
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Enter code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
              className="h-10"
            />
            <Button
              variant="outline"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="h-10 px-5 border-primary/30 text-primary hover:bg-primary/5"
            >
              {couponLoading ? '...' : 'Apply'}
            </Button>
          </div>
        )}
      </div>

      {/* Free shipping progress (compact) */}
      {freeShippingRemaining > 0 ? (
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-primary" />
            Add <span className="font-semibold text-foreground">৳{freeShippingRemaining.toLocaleString()}</span> more for free delivery
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, (sub / freeShippingThreshold) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium text-emerald-700">You qualify for FREE delivery!</span>
        </div>
      )}

      {/* Estimated delivery */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Truck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span>Estimated delivery: <strong className="text-foreground">{estimatedDelivery}</strong></span>
      </div>
    </CardContent>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Breadcrumb */}
      <div className="bg-muted/30 py-3 border-b">
        <div className="container mx-auto px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('home')} className="cursor-pointer flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-foreground font-medium">Shopping Cart</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Compact Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Shopping Cart</h1>
            <p className="text-sm text-muted-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''} in your cart</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-lg ${confirmClear ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-red-500 hover:text-red-600 hover:bg-red-50'}`}
            onClick={handleClearCart}
          >
            {confirmClear ? (
              <><AlertCircle /> Confirm?</>
            ) : (
              <><Trash2 className="h-4 w-4" /> Clear Cart</>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="container mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Cart Items (main column) */}
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map((item) => {
                const price = item.discountPrice != null ? item.discountPrice : item.price
                const hasDiscount = item.discountPrice != null && item.discountPrice < item.price
                const isRemoving = removingId === item.id
                return (
                  <Card
                    key={item.id}
                    className={`transition-all duration-300 shadow-sm hover:shadow-md ${
                      isRemoving ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100'
                    }`}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        {/* Product Image */}
                        <div
                          className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0 cursor-pointer group"
                          onClick={() => navigate('product-detail', { id: item.productId })}
                        >
                          <Image
                            src={item.image}
                            alt={item.productName}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                            sizes="96px"
                          />
                          {hasDiscount && (
                            <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                              -{Math.round(((item.price - (item.discountPrice ?? item.price)) / item.price) * 100)}%
                            </div>
                          )}
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className="font-semibold text-sm sm:text-base line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => navigate('product-detail', { id: item.productId })}
                            >
                              {item.productName}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                              onClick={() => handleRemove(item.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <p className="text-xs text-muted-foreground mt-0.5">per {item.unit}</p>

                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="font-bold text-primary">৳{price.toLocaleString()}</span>
                            {hasDiscount && (
                              <span className="text-xs text-muted-foreground line-through">৳{item.price.toLocaleString()}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2.5">
                            {/* Quantity Stepper */}
                            <div className="flex items-center border rounded-lg overflow-hidden shadow-sm">
                              <button
                                className="h-8 w-8 flex items-center justify-center hover:bg-primary/10 transition-colors active:scale-90 disabled:opacity-40 disabled:hover:bg-transparent"
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="h-8 w-10 flex items-center justify-center text-sm font-semibold border-x bg-muted/30">{item.quantity}</span>
                              <button
                                className="h-8 w-8 flex items-center justify-center hover:bg-primary/10 transition-colors active:scale-90 disabled:opacity-40 disabled:hover:bg-transparent"
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.stock}
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-bold text-sm sm:text-base">৳{(price * item.quantity).toLocaleString()}</span>
                              <button
                                className="hidden sm:flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => handleRemove(item.id)}
                                aria-label="Remove item"
                                title="Remove"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <button
                            className="text-xs text-muted-foreground hover:text-primary mt-2 flex items-center gap-1 transition-colors"
                            onClick={async () => {
                              await addToWishlist({
                                productId: item.productId,
                                productName: item.productName,
                                price: item.price,
                                discountPrice: item.discountPrice,
                                image: item.image,
                              })
                              toast.success('Moved to wishlist')
                            }}
                          >
                            <Heart className="h-3 w-3" /> Move to Wishlist
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {/* Continue Shopping link */}
              <button
                className="text-sm text-primary hover:underline font-medium flex items-center gap-1 py-2"
                onClick={() => navigate('products')}
              >
                <ArrowLeft className="h-4 w-4" /> Continue Shopping
              </button>
            </div>

            {/* Order Summary Sidebar (desktop) */}
            <div className="hidden lg:block">
              <Card className="sticky top-4 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Order Summary
                    </span>
                    <Badge variant="secondary" className="text-xs">{itemCount} items</Badge>
                  </CardTitle>
                </CardHeader>
                {OrderSummaryContent}
                <CardContent className="pt-0 space-y-3">
                  <Button
                    className="w-full h-12 text-base rounded-xl font-semibold shadow-md shadow-primary/20"
                    size="lg"
                    onClick={() => navigate('checkout')}
                  >
                    Proceed to Checkout <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Secure SSL encrypted checkout
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* You Might Also Like Section */}
          {suggestedProducts.length > 0 && (
            <div className="mt-10 border-t pt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                You Might Also Like
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {suggestedProducts.slice(0, 6).map((product) => {
                  const effectivePrice = product.discountPrice ?? product.price
                  return (
                    <div key={product.id} className="border rounded-xl p-2 hover:shadow-md transition-all duration-200 group">
                      <div
                        className="aspect-square rounded-lg bg-muted/50 overflow-hidden mb-2 cursor-pointer"
                        onClick={() => navigate('product-detail', { id: product.id })}
                      >
                        <img
                          src={product.images?.[0]?.url || '/placeholder.png'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <p
                        className="text-xs font-medium line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate('product-detail', { id: product.id })}
                      >
                        {product.name}
                      </p>
                      <p className="text-sm text-primary font-bold mt-1">৳{effectivePrice.toLocaleString()}</p>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs mt-2 rounded-lg"
                        onClick={() => handleAddSuggestedToCart(product)}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky bottom checkout bar */}
      <div className="lg:hidden sticky bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight">
              {itemCount} item{itemCount !== 1 ? 's' : ''} · {shipping === 0 ? 'Free delivery' : `+৳${shipping} delivery`}
            </p>
            <p className="text-lg font-bold text-primary leading-tight">
              ৳{Math.max(0, total).toLocaleString()}
              {discount > 0 && (
                <span className="ml-1.5 text-xs font-medium text-emerald-600">
                  saving ৳{discount.toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <Button
            className="h-11 px-6 rounded-xl font-semibold flex-shrink-0"
            onClick={() => navigate('checkout')}
          >
            Checkout <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
