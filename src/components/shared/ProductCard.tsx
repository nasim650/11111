'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Heart, ShoppingCart, Eye, Star, Package, Loader2 } from 'lucide-react'
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
  isFlashSale?: boolean
  shortDescription?: string
  averageRating?: number
  reviewCount?: number
}

interface ProductCardProps {
  product: Product
}

// ── Shimmer Skeleton ──
export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden border-stone-200 rounded-2xl bg-white">
      <div className="relative aspect-square bg-stone-100 animate-pulse rounded-t-2xl" />
      <CardContent className="p-3 space-y-2">
        <div className="h-3 w-16 bg-stone-100 animate-pulse rounded" />
        <div className="h-4 w-full bg-stone-100 animate-pulse rounded" />
        <div className="h-4 w-2/3 bg-stone-100 animate-pulse rounded" />
        <div className="h-5 w-20 bg-stone-100 animate-pulse rounded" />
        <div className="h-9 w-full bg-stone-100 animate-pulse rounded-xl mt-1" />
      </CardContent>
    </Card>
  )
}

export default function ProductCard({ product }: ProductCardProps) {
  const { navigate, addToCart, isInWishlist, toggleWishlist, openQuickView } =
    useAppStore()
  const [loading, setLoading] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wishlisted = product?.id ? isInWishlist(product.id) : false

  useEffect(() => {
    if (titleRef.current) {
      setIsOverflowing(titleRef.current.scrollWidth > titleRef.current.clientWidth)
    }
  }, [product?.name])

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    }
  }, [])

  if (!product || !product.id) return null

  const imageUrl =
    product.images?.[0]?.url && !imgError ? product.images[0].url : ''
  const price = typeof product.price === 'number' ? product.price : 0
  const stock = typeof product.stock === 'number' ? product.stock : 0
  const effectivePrice =
    product.discountPrice != null ? product.discountPrice : price
  const hasDiscount =
    product.discountPrice != null && product.discountPrice < price
  const discountPercent =
    hasDiscount && price > 0
      ? Math.round(((price - product.discountPrice!) / price) * 100)
      : 0
  const outOfStock = stock <= 0
  const pVal = safeNum(product.price)
  const dpVal = product.discountPrice != null ? safeNum(product.discountPrice) : null

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (outOfStock) {
      toast.error('Out of Stock', {
        description: `"${product.name}" is currently out of stock.`,
      })
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
      toast.success('Added to cart', {
        description: `${product.name} added to your cart.`,
      })
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
      addedTimerRef.current = setTimeout(() => setAddedToCart(false), 2000)
    } catch {
      toast.error('Failed to add to cart', {
        description: 'Please try again.',
      })
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

  // Single badge priority: discount > bestSeller > newArrival
  const badge = hasDiscount
    ? { label: `-${discountPercent}%`, style: 'bg-red-500 text-white' }
    : product.isBestSeller
    ? { label: 'Best Selling', style: 'bg-amber-500 text-white' }
    : product.isNewArrival
    ? { label: 'New', style: 'bg-emerald-600 text-white' }
    : null

  return (
    <Card
      className="group cursor-pointer overflow-hidden border border-stone-200/60 rounded-xl bg-white transition-all duration-300 hover:shadow-lg hover:border-stone-300/80 flex flex-col h-full"
      onClick={() => navigate('product-detail', { id: product.id })}
    >
      {/* ── HERO BOX (Fixed Template) ── */}
      <div className="flex flex-col bg-stone-50 rounded-t-xl shrink-0 overflow-hidden relative">
        {/* Fixed Image Container (No top padding, natural alignment) */}
        <div className="relative aspect-square w-full flex items-center justify-center shrink-0">
          {imageUrl && !imgLoaded && (
            <div className="absolute inset-0 bg-stone-100 animate-pulse" />
          )}

          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className={`object-cover object-center transition-transform duration-300 group-hover:scale-105 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => setImgError(true)}
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <Package className="h-10 w-10 text-stone-300" />
          )}

          {/* Badges and Overlays */}
          {badge && (
            <span className={`absolute top-2.5 left-2.5 z-10 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm ${badge.style}`}>
              {badge.label}
            </span>
          )}

          <div className="absolute top-2.5 right-2.5 flex flex-col gap-2 z-20">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleWishlist}
              className={`h-8 w-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 ${
                wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-500 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100'
              }`}
              aria-label="Wishlist"
            >
              <Heart className={`h-4 w-4 ${wishlisted ? 'fill-white text-white' : ''}`} />
            </motion.button>
            {!outOfStock && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleQuickView}
                className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-slate-500 hover:text-emerald-700 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200"
                aria-label="Quick view"
              >
                <Eye className="h-4 w-4" />
              </motion.button>
            )}
          </div>

          {outOfStock && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20">
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full shadow-sm border border-stone-200">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Hero Box Content Order: Category -> Title */}
        <div className="px-3 md:px-4 pt-2 pb-3 flex flex-col gap-1.5 shrink-0 bg-stone-50">
          {/* Category Label (Fixed Height) */}
          <div className="h-4 w-full flex items-center shrink-0">
            {product.category && (
              <p className="text-[11px] md:text-xs text-slate-500 font-medium truncate w-full">
                {product.category.name}
              </p>
            )}
          </div>

          {/* Product Title (Fixed Single Line) */}
          <div className="h-5 md:h-6 w-full relative flex items-center shrink-0 overflow-hidden group/title">
            <h3 
              ref={titleRef}
              className={`font-bold text-sm md:text-base text-slate-800 whitespace-nowrap overflow-hidden transition-colors duration-200 group-hover:text-emerald-700 w-full ${
                isOverflowing 
                  ? 'overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-x'
                  : 'text-ellipsis'
              }`}
            >
              {product.name}
            </h3>
          </div>
        </div>
      </div>

      {/* ── CARD CONTENT (Spacer + Price + Buttons) ── */}
      <CardContent className="p-3 md:p-4 flex flex-col flex-1 bg-white">
        {/* Flexible Spacer */}
        <div className="flex-1" />

        {/* Rating — only if exists */}
        {product.averageRating != null && product.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-2.5 w-2.5 ${
                    i < Math.round(product.averageRating!)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-stone-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              {product.averageRating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Price Row (Fixed Height, Single Line) */}
        <div className="h-6 flex items-center gap-1.5 whitespace-nowrap overflow-hidden shrink-0 mt-auto">
          <span className="text-base md:text-lg font-extrabold text-amber-600">
            {formatPrice(effectivePrice)}
          </span>
          <span className={`text-xs md:text-sm text-slate-400 line-through ${!hasDiscount ? 'invisible' : ''}`}>
            {formatPrice(price)}
          </span>
          <span className={`text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md ml-auto shrink-0 ${!hasDiscount ? 'invisible' : ''}`}>
            Save {formatPrice(Math.max(0, pVal - (dpVal || 0)))}
          </span>
        </div>

        {/* Button Area */}
        <div className="mt-3 flex items-center gap-2 shrink-0">
          <Button
            className={`flex-1 h-9 md:h-10 text-sm font-bold rounded-xl transition-all shadow-sm ${
              outOfStock ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : addedToCart ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
            disabled={outOfStock || loading}
            onClick={handleAddToCart}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1.5 md:mr-2" />}
            <span className="md:hidden">{loading ? '...' : addedToCart ? '✓' : outOfStock ? 'Out' : 'Add'}</span>
            <span className="hidden md:inline">{loading ? 'Adding…' : addedToCart ? 'Added' : outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
          </Button>

          {/* Buy Now - Desktop Only */}
          <Button
            className="hidden md:flex flex-1 h-10 text-sm font-bold rounded-xl transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={outOfStock || loading}
            onClick={(e) => {
              e.stopPropagation()
              if (!outOfStock && !loading) {
                handleAddToCart(e).then(() => navigate('checkout'))
              }
            }}
          >
            Buy Now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
