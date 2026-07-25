'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Heart, ShoppingCart, Eye, Star, Package, Check, GitCompare, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAppStore, type CartItem, type WishlistItem } from '@/lib/store'
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
  const [compareChecked, setCompareChecked] = useState(isInCompare(product.id))
  const [isHovered, setIsHovered] = useState(false)
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wishlisted = isInWishlist(product.id)
  const imageUrl =
    product.images?.[0]?.url && !imgError ? product.images[0].url : ''
  const effectivePrice =
    product.discountPrice != null ? product.discountPrice : product.price
  const hasDiscount =
    product.discountPrice != null && product.discountPrice < product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0

  // Stock status - updated threshold to <10 for "Low Stock"
  const outOfStock = product.stock <= 0
  const lowStock = product.stock > 0 && product.stock < 10
  const stockPercentage = Math.min((product.stock / 50) * 100, 100) // assume 50 is "plenty"
  const stockColor = product.stock <= 5 ? 'bg-red-500' : product.stock <= 15 ? 'bg-amber-500' : 'bg-emerald-500'

  // Origin
  const isBangladeshi = !product.origin || product.origin === 'Bangladesh' || product.origin === 'BD'

  // Savings amount
  const savingsAmount = hasDiscount ? product.price - product.discountPrice! : 0

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    }
  }, [])

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (outOfStock) return
    setLoading(true)
    try {
      const cartItem: Omit<CartItem, 'id'> = {
        productId: product.id,
        productName: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity: 1,
        unit: product.unit,
        image: imageUrl || '/placeholder.png',
        stock: product.stock,
      }
      await addToCart(cartItem)
      setAddedToCart(true)
      toast.success('Added to cart')
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
      addedTimerRef.current = setTimeout(() => setAddedToCart(false), 1500)
    } catch {
      toast.error('Failed to add to cart')
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
      className="group cursor-pointer overflow-hidden border-border/50 rounded-xl transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 hover:scale-[1.02]"
      onClick={() => navigate('product-detail', { id: product.id })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-square overflow-hidden bg-muted/30 rounded-t-xl">
        {/* Shimmer loading effect for images */}
        {imageUrl && !imgLoaded && (
          <div className="absolute inset-0 shimmer" />
        )}

        {imageUrl ? (
          <motion.div
            className="absolute inset-0"
            animate={{ scale: isHovered ? 1.1 : 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className={`object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => setImgError(true)}
              onLoad={() => setImgLoaded(true)}
            />
          </motion.div>
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
            <Package className="h-12 w-12 text-primary/30" />
          </div>
        )}

        {/* Gradient overlay on hover for better action button visibility */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-[5]"
            />
          )}
        </AnimatePresence>

        {/* Circular Discount Badge - Top Right */}
        {hasDiscount && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
            className={`absolute top-2 right-2 z-10 h-11 w-11 rounded-full flex items-center justify-center shadow-lg ${
              discountPercent > 20
                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/40'
                : 'bg-gradient-to-br from-emerald-500 to-orange-500 shadow-emerald-500/40'
            }`}
          >
            <div className="text-center leading-none">
              <span className="text-white text-[10px] font-extrabold block">-{discountPercent}%</span>
            </div>
          </motion.div>
        )}

        {/* Badges - Top Left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.isNewArrival && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="bg-emerald-500 text-white text-xs px-2 shadow-sm shadow-emerald-500/30 font-bold tracking-wide">
                NEW
              </Badge>
            </motion.div>
          )}
          {product.isBestSeller && !product.isNewArrival && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="bg-amber-500 text-white text-xs px-2 shadow-sm shadow-amber-500/30 font-bold tracking-wide">
                HOT 🔥
              </Badge>
            </motion.div>
          )}
          {lowStock && !outOfStock && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.3 }}
            >
              <Badge className="bg-orange-500/90 text-white text-[10px] px-1.5 py-0 shadow-sm animate-pulse">
                Low Stock
              </Badge>
            </motion.div>
          )}
        </div>

        {/* Origin Flag - Below discount badge */}
        {isBangladeshi && (
          <div className="absolute top-14 right-2 z-10">
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-sm">
              <span className="text-[10px]">🇧🇩</span>
              <span className="text-[9px] font-semibold text-emerald-700 hidden sm:inline">Local</span>
            </div>
          </div>
        )}

        {/* Quick Action Buttons - Appear from bottom on Hover */}
        <AnimatePresence>
          {isHovered && !outOfStock && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute bottom-2 left-2 right-2 flex gap-1.5 z-10"
            >
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCompare}
                className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md transition-all ${
                  compareChecked
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/90 text-gray-600 hover:bg-white hover:text-emerald-700'
                }`}
                aria-label={compareChecked ? 'Remove from comparison' : 'Compare'}
              >
                <GitCompare className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleWishlist}
                className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow-md text-gray-600 hover:bg-white hover:text-red-500 transition-all"
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart className={`h-3.5 w-3.5 transition-all duration-300 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleQuickView}
                className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow-md text-gray-600 hover:bg-white hover:text-emerald-700 transition-all"
                aria-label="Quick view"
              >
                <Eye className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center gap-1 shadow-md hover:bg-emerald-700 transition-all text-xs font-semibold"
                onClick={handleAddToCart}
                disabled={loading}
              >
                <AnimatePresence mode="wait">
                  {addedToCart ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </motion.span>
                  ) : (
                    <motion.span
                      key="cart"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center gap-1"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Add
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-20">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Badge variant="secondary" className="text-sm bg-white/95 text-gray-800 font-bold px-5 py-1.5 shadow-xl">
                Out of Stock
              </Badge>
            </motion.div>
          </div>
        )}

        {/* Compare indicator - always visible when in compare */}
        <AnimatePresence>
          {compareChecked && !isHovered && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute bottom-2 left-2 z-10"
            >
              <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-full px-2 py-0.5 shadow-md shadow-emerald-500/30">
                <GitCompare className="size-3" />
                <span className="text-[10px] font-bold">Compare</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stock Progress Bar - directly under image */}
      {!outOfStock && (
        <div className="h-1 bg-muted">
          <motion.div
            className={`h-full ${stockColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${stockPercentage}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
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
          <div className="flex items-center gap-1">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 text-gray-200" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">No reviews</span>
          </div>
        )}

        {/* Price with savings */}
        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <motion.span
              key={effectivePrice}
              initial={{ scale: 1.1, color: '#059669' }}
              animate={{ scale: 1, color: '#059669' }}
              transition={{ duration: 0.3 }}
              className="text-lg font-bold text-emerald-600"
            >
              ৳{effectivePrice.toLocaleString()}
            </motion.span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through decoration-red-400/70">
                ৳{product.price.toLocaleString()}
              </span>
            )}
            <span className="text-xs text-muted-foreground">/{product.unit}</span>
          </div>
          {hasDiscount && (
            <motion.p
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-emerald-600 font-semibold flex items-center gap-1"
            >
              <span className="inline-flex items-center justify-center h-4 px-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                Save ৳{savingsAmount.toLocaleString()}
              </span>
            </motion.p>
          )}
        </div>

        {/* Stock Indicator Text */}
        {!outOfStock && (
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-medium ${lowStock ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>
              {lowStock ? `Only ${product.stock} left!` : 'In Stock'}
            </span>
            {lowStock && (
              <span className="text-[10px] text-orange-500 font-semibold">
                Hurry up!
              </span>
            )}
          </div>
        )}

        {/* Add to cart button (visible always on mobile, on desktop when not hovered) */}
        <div className={`${isHovered ? 'hidden sm:hidden' : ''}`}>
          <Button
            className="w-full h-11 text-sm mt-2 min-h-[44px] transition-all duration-200 active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
            disabled={outOfStock || loading}
            onClick={handleAddToCart}
          >
            <AnimatePresence mode="wait">
              {addedToCart ? (
                <motion.span
                  key="added"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Added!
                </motion.span>
              ) : (
                <motion.span
                  key="default"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {loading ? 'Adding...' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
