'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { ShoppingCart, Heart, Eye, Minus, Plus, ChevronLeft, ChevronRight, Package, Check, AlertTriangle, X, BadgeCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type CartItem, type WishlistItem } from '@/lib/store'
import { formatPrice, safeNum } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──
interface ProductImage {
  url: string
  alt?: string
  isFeatured?: boolean
}

interface QuickProduct {
  id: string
  name: string
  slug: string
  price: number
  discountPrice?: number | null
  unit: string
  stock: number
  shortDescription?: string
  description?: string
  origin?: string
  specifications?: string
  images?: ProductImage[]
  category?: { name: string; slug: string }
  isBestSeller?: boolean
  isNewArrival?: boolean
  isFeatured?: boolean
}

export default function QuickViewModal() {
  const { isQuickViewOpen, quickViewProductId, closeQuickView, navigate, addToCart, isInWishlist, toggleWishlist } = useAppStore()
  const [product, setProduct] = useState<QuickProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoading, setImageLoading] = useState(true)
  const wishlisted = quickViewProductId ? isInWishlist(quickViewProductId) : false

  useEffect(() => {
    if (isQuickViewOpen && quickViewProductId) {
      setLoading(true)
      setQuantity(1)
      setCurrentImageIndex(0)
      fetch(`/api/products/${quickViewProductId}`)
        .then((res) => res.json())
        .then((data) => {
          const productData = data?.data || data
          setProduct(productData)
          setLoading(false)
        })
        .catch(() => {
          setProduct(null)
          setLoading(false)
        })
    } else {
      setProduct(null)
    }
  }, [isQuickViewOpen, quickViewProductId])

  const images = product?.images?.filter((img) => img.url) || []
  const hasMultipleImages = images.length > 1

  // Navigate image carousel
  const nextImage = useCallback(() => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
      setImageLoading(true)
    }
  }, [hasMultipleImages, images.length])

  const prevImage = useCallback(() => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
      setImageLoading(true)
    }
  }, [hasMultipleImages, images.length])

  const handleAddToCart = async () => {
    if (!product || product.stock <= 0) {
      toast.error('Out of Stock', { description: 'This item is currently out of stock.' })
      return
    }
    setAdding(true)
    try {
      const imageUrl = product.images?.[0]?.url || '/placeholder.png'
      const cartItem: Omit<CartItem, 'id'> = {
        productId: product.id,
        productName: product.name,
        price: safeNum(product.price),
        discountPrice: product.discountPrice != null ? safeNum(product.discountPrice) : null,
        quantity: safeNum(quantity, 1),
        unit: product.unit,
        image: imageUrl,
        stock: safeNum(product.stock),
      }
      await addToCart(cartItem)
      toast.success('Added to cart', { description: `${quantity}× ${product.name}` })
    } catch {
      toast.error('Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  const handleWishlist = async () => {
    if (!product) return
    const imageUrl = product.images?.[0]?.url || '/placeholder.png'
    const item: WishlistItem = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: imageUrl,
    }
    await toggleWishlist(item)
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const handleViewDetails = () => {
    if (!product) return
    closeQuickView()
    navigate('product-detail', { id: product.id })
  }

  const imageUrl = images[currentImageIndex]?.url || product?.images?.[0]?.url || '/placeholder.png'
  const effectivePrice = product?.discountPrice != null ? product.discountPrice : product?.price
  const hasDiscount = product?.discountPrice != null && product.discountPrice < product.price
  const discountPercent = hasDiscount && product ? Math.round(((product.price - product.discountPrice!) / product.price) * 100) : 0

  // Parse specifications
  let specs: Array<{ key: string; value: string }> = []
  if (product?.specifications) {
    try {
      const parsed = JSON.parse(product.specifications)
      if (Array.isArray(parsed)) {
        specs = parsed.map((s: { key?: string; label?: string; value?: string }) => ({
          key: s.key || s.label || '',
          value: s.value || '',
        })).filter((s: { key: string; value: string }) => s.key && s.value)
      } else if (typeof parsed === 'object') {
        specs = Object.entries(parsed).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      }
    } catch {
      // Not JSON, ignore
    }
  }

  // Stock status
  const outOfStock = product?.stock !== undefined && product.stock <= 0
  const lowStock = product?.stock !== undefined && product.stock > 0 && product.stock <= 5

  return (
    <Dialog open={isQuickViewOpen} onOpenChange={(open) => !open && closeQuickView()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{product?.name || 'Quick View'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading product...</p>
            </div>
          </div>
        ) : product ? (
          <div className="flex flex-col md:flex-row">
            {/* ── Left: Image Carousel ── */}
            <div className="relative w-full md:w-[320px] aspect-square bg-muted/20 shrink-0">
              {/* Main Image */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="320px"
                    onLoad={() => setImageLoading(false)}
                  />
                  {imageLoading && (
                    <div className="absolute inset-0 bg-muted/30 animate-pulse" />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Discount badge */}
              {hasDiscount && (
                <Badge className="absolute top-3 left-3 bg-red-500 text-white z-10 shadow-sm">
                  -{discountPercent}%
                </Badge>
              )}

              {/* New/BestSeller badges */}
              {product.isNewArrival && (
                <Badge className="absolute top-3 right-12 bg-emerald-500 text-white z-10 shadow-sm">
                  New
                </Badge>
              )}
              {product.isBestSeller && (
                <Badge className="absolute top-3 right-3 bg-amber-500 text-white z-10 shadow-sm">
                  Best Seller
                </Badge>
              )}

              {/* Out of stock overlay */}
              {outOfStock && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                  <Badge variant="secondary" className="text-sm bg-white/90 text-gray-800 font-semibold px-4 py-1">
                    Out of Stock
                  </Badge>
                </div>
              )}

              {/* Carousel Navigation Arrows */}
              {hasMultipleImages && !outOfStock && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-white transition-colors z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-white transition-colors z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {/* Image Dots */}
              {hasMultipleImages && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentImageIndex(idx)
                        setImageLoading(true)
                      }}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        idx === currentImageIndex
                          ? 'w-5 bg-white shadow-sm'
                          : 'w-2 bg-white/50 hover:bg-white/70'
                      }`}
                      aria-label={`View image ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Thumbnail strip */}
              {hasMultipleImages && (
                <div className="absolute bottom-10 left-3 right-3 flex gap-1.5 overflow-x-auto scrollbar-hide z-10">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentImageIndex(idx)
                        setImageLoading(true)
                      }}
                      className={`h-10 w-10 rounded-md overflow-hidden shrink-0 border-2 transition-all duration-200 ${
                        idx === currentImageIndex
                          ? 'border-white shadow-md'
                          : 'border-white/30 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt || ''}
                        width={40}
                        height={40}
                        className="object-cover h-full w-full"
                        sizes="40px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Product Info ── */}
            <div className="flex-1 p-5 md:p-6 flex flex-col overflow-y-auto max-h-[60vh] md:max-h-[500px]">
              {/* Category */}
              {product.category && (
                <p className="text-xs text-muted-foreground mb-1">{product.category.name}</p>
              )}

              {/* Product Name */}
              <h2 className="text-lg font-bold leading-tight line-clamp-2 mb-2">
                {product.name}
              </h2>

              {/* Stock Status Indicator */}
              <div className="mb-3">
                {outOfStock ? (
                  <div className="flex items-center gap-1.5 text-red-500 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="font-medium">Out of Stock</span>
                  </div>
                ) : lowStock ? (
                  <div className="flex items-center gap-1.5 text-orange-500 text-sm">
                    <Package className="h-3.5 w-3.5" />
                    <span className="font-medium">Only {product.stock} left in stock</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
                    <Check className="h-3.5 w-3.5" />
                    <span className="font-medium">In Stock</span>
                    {product.stock <= 20 && (
                      <span className="text-muted-foreground">({product.stock} available)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(effectivePrice)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">/{product.unit}</span>
              </div>

              {/* Savings message */}
              {hasDiscount && (
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-md mb-3 w-fit">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  You save {formatPrice(Math.round(safeNum(product.price) - safeNum(product.discountPrice)))} ({discountPercent}% off)
                </div>
              )}

              {/* Short Description */}
              {product.shortDescription && (
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {product.shortDescription}
                </p>
              )}

              {/* Specifications Summary */}
              {specs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Specifications</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {specs.slice(0, 4).map((spec, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="text-muted-foreground">{spec.key}: </span>
                        <span className="font-medium">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                  {specs.length > 4 && (
                    <button
                      onClick={handleViewDetails}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      +{specs.length - 4} more specs
                    </button>
                  )}
                </div>
              )}

              {/* Origin */}
              {product.origin && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                  <Package className="h-3.5 w-3.5" />
                  <span>Origin: <span className="font-medium text-foreground">{product.origin}</span></span>
                </div>
              )}

              <Separator className="my-2" />

              {/* ── Quantity Selector + Add to Cart ── */}
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Qty:</span>
                  <div className="flex items-center rounded-lg border bg-background overflow-hidden">
                    <button
                      className="h-9 w-9 flex items-center justify-center hover:bg-primary/10 text-primary transition-all duration-150 active:scale-90"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={outOfStock}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="h-9 w-10 flex items-center justify-center text-sm font-semibold border-x">
                      {quantity}
                    </span>
                    <button
                      className="h-9 w-9 flex items-center justify-center hover:bg-primary/10 text-primary transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => setQuantity((q) => Math.min(product?.stock || 1, q + 1))}
                      disabled={outOfStock || quantity >= (product?.stock || 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Total: <span className="font-bold text-primary">{formatPrice((effectivePrice || 0) * quantity)}</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-11"
                    disabled={outOfStock || adding}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {adding ? 'Adding...' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={handleWishlist}
                  >
                    <Heart className={`h-4 w-4 transition-all duration-200 ${wishlisted ? 'fill-red-500 text-red-500 scale-110' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* View Full Details */}
              <Button
                variant="outline"
                className="w-full mt-3 gap-2"
                onClick={handleViewDetails}
              >
                <Eye className="h-4 w-4" />
                View Full Details
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Product not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
