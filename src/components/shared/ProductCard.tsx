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
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wishlisted = product?.id ? isInWishlist(product.id) : false

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
      className="group cursor-pointer overflow-hidden border border-stone-200 rounded-2xl bg-white transition-all duration-200 hover:shadow-md hover:border-stone-300 flex flex-col h-full"
      onClick={() => navigate('product-detail', { id: product.id })}
    >
      {/* Image Area — fixed height, images fill cleanly */}
      <div className="relative h-36 w-full overflow-hidden bg-stone-100 rounded-t-2xl shrink-0">
        {/* Shimmer */}
        {imageUrl && !imgLoaded && (
          <div className="absolute inset-0 bg-stone-100 animate-pulse" />
        )}

        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="h-10 w-10 text-stone-300" />
          </div>
        )}

        {/* Single Badge — Top Left */}
        {badge && (
          <span
            className={`absolute top-2 left-2 z-10 text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-sm ${badge.style}`}
          >
            {badge.label}
          </span>
        )}

        {/* Floating Action Buttons — Top Right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-20">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleWishlist}
            className={`h-7 w-7 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 ${
              wishlisted
                ? 'bg-red-500 text-white'
                : 'bg-white/90 text-slate-500 hover:text-red-500 sm:opacity-0 group-hover:opacity-100'
            }`}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart className={`h-3.5 w-3.5 ${wishlisted ? 'fill-white text-white' : ''}`} />
          </motion.button>

          {!outOfStock && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleQuickView}
              className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-slate-500 hover:text-emerald-700 sm:opacity-0 group-hover:opacity-100 transition-all duration-200"
              aria-label="Quick view"
            >
              <Eye className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20">
            <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full shadow-sm border border-stone-200">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Card Content — single flat flow, no justify-between gap */}
      <CardContent className="p-2.5 flex flex-col gap-1">
        {/* Category */}
        {product.category && (
          <p className="text-[10px] text-slate-400 truncate leading-none">
            {product.category.name}
          </p>
        )}

        {/* Product Name */}
        <h3 className="font-semibold text-xs text-slate-800 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors duration-200">
          {product.name}
        </h3>

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

        {/* Price row */}
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-sm font-bold text-amber-600">
            {formatPrice(effectivePrice)}
          </span>
          {hasDiscount && (
            <span className="text-[11px] text-slate-400 line-through">
              {formatPrice(price)}
            </span>
          )}
          <span className="text-[10px] text-slate-400">/{product.unit}</span>
        </div>

        {/* Save badge */}
        {hasDiscount && dpVal != null && (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md self-start">
            Save {formatPrice(Math.max(0, pVal - dpVal))}
          </span>
        )}

        {/* Add to Cart Button */}
        <Button
          className={`w-full h-8 text-[11px] font-semibold rounded-lg gap-1 mt-1 transition-all ${
            outOfStock
              ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
              : addedToCart
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
          }`}
          disabled={outOfStock || loading}
          onClick={handleAddToCart}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ShoppingCart className="h-3 w-3" />
          )}
          {loading ? 'Adding…' : addedToCart ? '✓ Added' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </CardContent>
    </Card>
  )
}
