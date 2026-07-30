'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Heart, ShoppingCart, Eye, Star, Package, Loader2, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore, type CartItem, type WishlistItem } from '@/lib/store'
import { formatPrice, safeNum } from '@/lib/utils'
import { toast } from 'sonner'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  discountPrice?: number | null
  unit: string
  stock: number
  origin?: string
  images?: Array<{ url: string; alt?: string }>
  category?: { name: string; slug: string }
  status?: string
  isNewArrival?: boolean
  isBestSeller?: boolean
  isFeatured?: boolean

  shortDescription?: string
  averageRating?: number
  reviewCount?: number
}

interface ProductCardProps {
  product: Product
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden border-stone-100 rounded-xl bg-white shadow-sm">
      <div className="relative aspect-square bg-stone-50 animate-pulse rounded-t-xl" />
      <CardContent className="p-3 space-y-2">
        <div className="h-2 w-16 bg-stone-100 animate-pulse rounded" />
        <div className="h-4 w-full bg-stone-100 animate-pulse rounded" />
        <div className="h-4 w-2/3 bg-stone-100 animate-pulse rounded" />
        <div className="h-8 w-full bg-stone-100 animate-pulse rounded-lg mt-2" />
      </CardContent>
    </Card>
  )
}

export default function ProductCard({ product }: ProductCardProps) {
  const { navigate, addToCart, isInWishlist, toggleWishlist, openQuickView } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [overflowWidth, setOverflowWidth] = useState(0)
  const titleContainerRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLSpanElement>(null)
  
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wishlisted = product?.id ? isInWishlist(product.id) : false

  useEffect(() => {
    if (titleContainerRef.current && titleTextRef.current) {
      const containerWidth = titleContainerRef.current.clientWidth
      const textWidth = titleTextRef.current.scrollWidth
      if (textWidth > containerWidth) {
        setIsOverflowing(true)
        setOverflowWidth(textWidth - containerWidth + 8) // 8px buffer
      } else {
        setIsOverflowing(false)
      }
    }
  }, [product?.name])

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    }
  }, [])

  if (!product || !product.id) return null

  const imageUrl = product.images?.[0]?.url && !imgError ? product.images[0].url : ''
  const price = typeof product.price === 'number' ? product.price : 0
  const stock = typeof product.stock === 'number' ? product.stock : 0
  const effectivePrice = product.discountPrice != null ? product.discountPrice : price
  const hasDiscount = product.discountPrice != null && product.discountPrice < price
  const discountPercent = hasDiscount && price > 0 ? Math.round(((price - product.discountPrice!) / price) * 100) : 0
  const outOfStock = stock <= 0
  const pVal = safeNum(product.price)
  const dpVal = product.discountPrice != null ? safeNum(product.discountPrice) : null

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (outOfStock) {
      toast.error('Out of Stock', { description: `"${product.name}" is currently out of stock.` })
      return
    }
    setLoading(true)
    try {
      const cartItem: Omit<CartItem, 'id'> = {
        productId: product.id,
        productName: product.name,
        price: pVal,
        discountPrice: dpVal,
        quantity: 1,
        unit: product.unit,
        image: imageUrl || '/placeholder.png',
        stock: safeNum(product.stock),
      }
      await addToCart(cartItem)
      setAddedToCart(true)
      toast.success('Added to cart', { description: `${product.name} added to your cart.` })
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
      addedTimerRef.current = setTimeout(() => setAddedToCart(false), 2000)
    } catch {
      toast.error('Failed to add to cart', { description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const item: WishlistItem = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: imageUrl || '/placeholder.png',
    }
    await toggleWishlist(item)
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation()
    openQuickView(product.id)
  }

  // Single badge priority
  const badge = hasDiscount
    ? { label: `-${discountPercent}%`, style: 'bg-red-500 text-white' }
    : product.isBestSeller
    ? { label: 'Best Selling', style: 'bg-amber-500 text-white' }
    : product.isNewArrival
    ? { label: 'New', style: 'bg-emerald-600 text-white' }
    : null

  return (
    <Card
      className="group/card cursor-pointer overflow-hidden border border-stone-200/60 rounded-xl bg-white transition-all duration-300 hover:shadow-xl hover:border-emerald-600/30 flex flex-col h-full relative"
      onClick={() => navigate('product-detail', { id: product.id })}
    >
      {/* ── 1. HERO BOX (Image Only) ── */}
      <div className="relative aspect-[4/3] w-full bg-stone-50 flex items-center justify-center shrink-0 overflow-hidden rounded-t-xl">
        {imageUrl && !imgLoaded && (
          <div className="absolute inset-0 bg-stone-100 animate-pulse" />
        )}

        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className={`object-cover object-center transition-transform duration-500 group-hover/card:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <Package className="h-10 w-10 text-stone-300" />
        )}

        {/* Badges */}
        {badge && (
          <span className={`absolute top-1.5 left-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${badge.style}`}>
            {badge.label}
          </span>
        )}

        {/* Hover Actions */}
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 z-20">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleWishlist}
            className={`h-6 w-6 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 ${
              wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-500 hover:text-red-500 md:opacity-0 md:group-hover/card:opacity-100'
            }`}
          >
            <Heart className={`h-3 w-3 ${wishlisted ? 'fill-white text-white' : ''}`} />
          </motion.button>
          {!outOfStock && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleQuickView}
              className="h-6 w-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-slate-500 hover:text-emerald-700 md:opacity-0 md:group-hover/card:opacity-100 transition-all duration-200"
            >
              <Eye className="h-3 w-3" />
            </motion.button>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full shadow-sm border border-stone-200">Out of Stock</span>
          </div>
        )}
      </div>

      {/* ── 2. CARD CONTENT (Compact Information Layout) ── */}
      <CardContent className="p-2.5 flex flex-col flex-1 bg-white justify-between gap-1">
        
        <div className="flex flex-col w-full shrink-0">
          {/* Category */}
          <div className="flex items-center w-full mb-0.5">
            <span className="text-[9px] text-slate-400 font-semibold truncate uppercase tracking-wider w-full text-left leading-none">
              {product.category?.name || 'Uncategorized'}
            </span>
          </div>

          {/* Product Title with Marquee Animation */}
          <div 
            ref={titleContainerRef}
            className="relative h-4 flex items-center w-full overflow-hidden shrink-0 group/title text-slate-800 font-bold text-xs md:text-sm transition-colors group-hover/card:text-emerald-700"
          >
            <motion.span
              ref={titleTextRef}
              className="whitespace-nowrap inline-block absolute left-0"
              animate={isOverflowing ? { x: [0, -overflowWidth, 0] } : { x: 0 }}
              transition={
                isOverflowing
                  ? {
                      x: {
                        repeat: Infinity,
                        repeatType: 'mirror',
                        duration: Math.max(3, overflowWidth / 20),
                        ease: 'linear',
                      },
                    }
                  : {}
              }
            >
              {product.name}
            </motion.span>
          </div>
        </div>

        {/* Flexible Spacer */}
        <div className="flex-1" />

        <div className="flex flex-col gap-1.5 w-full shrink-0">
          {/* ── PRICE ROW ── */}
          <div className="flex items-end gap-1.5 w-full whitespace-nowrap overflow-hidden leading-none">
            <span className="text-sm md:text-base font-extrabold text-amber-600 leading-none">
              {formatPrice(effectivePrice)}
            </span>
            <span className={`text-[10px] md:text-xs text-slate-400 line-through ${!hasDiscount ? 'invisible' : ''}`}>
              {formatPrice(price)}
            </span>
            <span className={`text-[9px] font-bold text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded ml-auto border border-emerald-100 ${!hasDiscount ? 'invisible' : ''}`}>
              Save {formatPrice(Math.max(0, pVal - (dpVal || 0)))}
            </span>
          </div>

          {/* ── BUTTONS ── */}
          <div className="flex items-center gap-1.5 w-full box-border">
            <Button
              className={`flex-1 min-w-0 h-7 px-2 text-[10px] md:text-xs font-bold rounded-md shadow-sm transition-colors ${
                outOfStock ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : addedToCart ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
              disabled={outOfStock || loading}
              onClick={handleAddToCart}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin mx-auto" />
              ) : addedToCart ? (
                <span className="truncate w-full text-center">Added</span>
              ) : outOfStock ? (
                <span className="truncate w-full text-center">Out of Stock</span>
              ) : (
                <div className="flex items-center justify-center gap-1 w-full overflow-hidden">
                  <ShoppingCart className="h-3 w-3 shrink-0" />
                  <span className="truncate">Add to Cart</span>
                </div>
              )}
            </Button>

            {/* Buy Now - Desktop Only, Equal Flex */}
            <Button
              className="hidden md:flex flex-1 min-w-0 h-7 px-2 text-[10px] md:text-xs font-bold rounded-md shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={outOfStock || loading}
              onClick={(e) => {
                e.stopPropagation()
                if (!outOfStock && !loading) {
                  handleAddToCart(e).then(() => navigate('checkout'))
                }
              }}
            >
              <div className="flex items-center justify-center gap-1 w-full overflow-hidden">
                <Zap className="h-3 w-3 shrink-0" />
                <span className="truncate">Buy Now</span>
              </div>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
