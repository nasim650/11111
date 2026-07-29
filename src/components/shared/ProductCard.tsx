'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Heart, ShoppingCart, Eye, Star, Package, Check, GitCompare, MapPin, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
    <Card className="overflow-hidden border-border/50 rounded-xl">
      <div className="relative aspect-square bg-muted/30 shimmer" />
      <CardContent className="p-3 space-y-2">
        <div className="h-3 w-16 shimmer rounded" />
        <div className="h-4 w-full shimmer rounded" />
        <div className="h-4 w-3/4 shimmer rounded" />
        <div className="flex gap-1">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-3 w-3 shimmer rounded-full" />
          ))}
        </div>
        <div className="h-5 w-20 shimmer rounded" />
        <div className="h-10 w-full shimmer rounded-lg mt-2" />
      </CardContent>
    </Card>
  )
}

export default function ProductCard({ product }: ProductCardProps) {
  const { navigate, addToCart, isInWishlist, toggleWishlist, openQuickView, isInCompare, addToCompare, removeFromCompare } =
    useAppStore()
  const [loading, setLoading] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [compareChecked, setCompareChecked] = useState(product?.id ? isInCompare(product.id) : false)
  const [isHovered, setIsHovered] = useState(false)
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wishlisted = product?.id ? isInWishlist(product.id) : false

  // Cleanup timer
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
  const discountPercent = hasDiscount && price > 0
    ? Math.round(((price - product.discountPrice!) / price) * 100)
    : 0

  // Stock status
  const outOfStock = stock <= 0
  const lowStock = stock > 0 && stock < 10
  const stockPercentage = Math.min((stock / 50) * 100, 100)
  const stockColor = stock <= 5 ? 'bg-red-500' : stock <= 15 ? 'bg-amber-500' : 'bg-emerald-500'

  // Origin
  const isBangladeshi = !product.origin || product.origin === 'Bangladesh' || product.origin === 'BD'

  // Savings amount
  const pVal = safeNum(product.price)
  const dpVal = product.discountPrice != null ? safeNum(product.discountPrice) : null
  const savingsAmount = hasDiscount && dpVal != null ? Math.max(0, pVal - dpVal) : 0

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

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (compareChecked) {
      removeFromCompare(product.id)
      setCompareChecked(false)
      toast.success('Removed from comparison', { icon: '🔄' })
    } else {
      const compareCount = useAppStore.getState().compareProducts.length
      if (compareCount >= 4) {
        toast.error('You can compare up to 4 products at a time', { icon: '⚠️' })
        return
      }
      addToCompare(product.id)
      setCompareChecked(true)
      toast.success('Added to comparison', {
        icon: '⚖️',
        description: `${compareCount + 1}/4 products selected. ${compareCount + 1 >= 2 ? 'Click "Compare Now" to compare!' : 'Add 1 more to start comparing.'}`,
      })
    }
  }

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/60 rounded-xl bg-white transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 hover:-translate-y-1 flex flex-col justify-between h-full"
      onClick={() => navigate('product-detail', { id: product.id })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div>
        <div className="relative aspect-square overflow-hidden bg-muted/30 rounded-t-xl">
          {/* Shimmer loading effect for images */}
          {imageUrl && !imgLoaded && (
            <div className="absolute inset-0 shimmer" />
          )}

          {imageUrl ? (
            <div className="absolute inset-0 overflow-hidden bg-slate-50/80 dark:bg-slate-900/40">
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className={`object-contain p-2 transition-transform duration-500 group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                onError={() => setImgError(true)}
                onLoad={() => setImgLoaded(true)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
              <Package className="h-12 w-12 text-primary/30" />
            </div>
          )}

          {/* Badges - Top Left */}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10 pointer-events-none">
            {hasDiscount && (
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30"
                aria-label={`Discount ${discountPercent}%`}
              >
                <span className="text-white text-[10px] font-extrabold leading-none">
                  -{discountPercent}%
                </span>
              </div>
            )}
            {product.isNewArrival && (
              <Badge className="bg-emerald-500 text-white text-[10px] px-2 shadow-sm font-bold tracking-wide">
                NEW
              </Badge>
            )}
            {product.isBestSeller && !product.isNewArrival && (
              <Badge className="bg-amber-500 text-white text-[10px] px-2 shadow-sm font-bold tracking-wide">
                HOT 🔥
              </Badge>
            )}
            {lowStock && !outOfStock && (
              <Badge className="bg-orange-500/90 text-white text-[10px] px-1.5 py-0 shadow-sm animate-pulse">
                Low Stock
              </Badge>
            )}
          </div>

          {/* Floating Quick Action Buttons - Top Right (Absolute Positioning, No Reflow) */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-20">
            {/* Wishlist Button: Always accessible on touch/mobile, slides in cleanly on desktop */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleWishlist}
              className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-300 ${
                wishlisted
                  ? 'bg-red-500 text-white opacity-100'
                  : 'bg-white/95 text-gray-700 hover:bg-white hover:text-red-500 sm:opacity-0 sm:translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
              }`}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`h-4 w-4 transition-colors ${wishlisted ? 'fill-white text-white' : ''}`} />
            </motion.button>

            {/* Quick View Button */}
            {!outOfStock && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleQuickView}
                className="h-8 w-8 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md text-gray-700 hover:bg-white hover:text-emerald-700 sm:opacity-0 sm:translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                aria-label="Quick view"
              >
                <Eye className="h-4 w-4" />
              </motion.button>
            )}

            {/* Compare Button */}
            {!outOfStock && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCompare}
                className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-300 ${
                  compareChecked
                    ? 'bg-emerald-600 text-white opacity-100'
                    : 'bg-white/95 text-gray-700 hover:bg-white hover:text-emerald-700 sm:opacity-0 sm:translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                }`}
                aria-label={compareChecked ? 'Remove from comparison' : 'Compare'}
              >
                <GitCompare className="h-4 w-4" />
              </motion.button>
            )}
          </div>

          {/* Out of stock overlay */}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-20">
              <Badge variant="secondary" className="text-xs bg-white/95 text-gray-800 font-bold px-4 py-1 shadow-xl">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>

        {/* Stock Progress Bar - directly under image */}
        {!outOfStock && (
          <div className="h-1 bg-muted">
            <div
              className={`h-full ${stockColor} transition-all duration-500`}
              style={{ width: `${stockPercentage}%` }}
            />
          </div>
        )}
        {outOfStock && (
          <div className="h-1 bg-red-200" />
        )}

        <CardContent className="p-3 space-y-1.5">
          {/* Category */}
          {product.category && (
            <p className="text-xs text-muted-foreground truncate">
              {product.category.name}
            </p>
          )}

          {/* Name */}
          <h3 className="font-medium text-sm line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-emerald-700 transition-colors duration-200">
            {product.name}
          </h3>

          {/* Rating */}
          {(product.averageRating != null && product.averageRating > 0) ? (
            <div className="flex items-center gap-1">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => {
                  const fill = product.averageRating! - i
                  return (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < Math.round(product.averageRating!)
                          ? 'fill-amber-400 text-amber-400'
                          : fill > 0 && fill < 1
                          ? 'fill-amber-400/50 text-amber-400'
                          : 'text-gray-200'
                      }`}
                    />
                  )
                })}
              </div>
              <span className="text-xs text-amber-600 font-semibold">{product.averageRating!.toFixed(1)}</span>
              {product.reviewCount != null && product.reviewCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({product.reviewCount})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold border-emerald-300 text-emerald-700 bg-emerald-50/60">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                New
              </Badge>
              <span className="text-[10px] text-muted-foreground">No reviews yet</span>
            </div>
          )}

          {/* Price with savings */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-extrabold text-amber-600">
                {formatPrice(effectivePrice)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through decoration-red-400">
                  {formatPrice(product.price)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">/{product.unit}</span>
            </div>
            {hasDiscount && (
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                  Save {formatPrice(savingsAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Stock Indicator Text */}
          {!outOfStock && (
            <div className="flex items-center justify-between text-[10px] pt-0.5">
              <span className={`font-medium ${lowStock ? 'text-red-500 animate-pulse font-semibold' : 'text-muted-foreground'}`}>
                {lowStock ? `Only ${product.stock} left!` : 'In Stock'}
              </span>
              {lowStock && (
                <span className="text-orange-500 font-semibold">
                  Hurry up!
                </span>
              )}
            </div>
          )}
        </CardContent>
      </div>

      {/* Action Buttons — Add To Cart + Buy Now matching reference design */}
      <div className="p-3 pt-0 mt-auto flex items-center gap-2">
        <Button
          variant="outline"
          className="flex-1 h-9 text-xs font-semibold rounded-xl border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all gap-1 px-2"
          size="sm"
          disabled={outOfStock || loading}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />
          {addedToCart ? 'Added!' : 'Add To Cart'}
        </Button>
        <Button
          className="flex-1 h-9 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all gap-1 px-2"
          size="sm"
          disabled={outOfStock || loading}
          onClick={async (e) => {
            e.stopPropagation()
            if (outOfStock) return
            await handleAddToCart(e)
            navigate('checkout')
          }}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Buy now
        </Button>
      </div>
    </Card>
  )
}
