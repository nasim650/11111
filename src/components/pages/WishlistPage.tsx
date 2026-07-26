'use client'

import { useState, useReducer, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, ShoppingCart, Trash2, Share2, ArrowUpDown,
  ShoppingBag, Sparkles, X, Package, Check, Copy, Facebook, MessageCircle, MoveRight, ArrowRight,
  Link2, Gift, Tag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAppStore, type CartItem, type WishlistItem } from '@/lib/store'
import { formatPrice, safeNum } from '@/lib/utils'
import { toast } from 'sonner'

type SortOption = 'date' | 'price-asc' | 'price-desc' | 'name'

interface ProductStock {
  id: string
  stock: number
}

function sortWishlistItems(items: WishlistItem[], sort: SortOption): WishlistItem[] {
  const sorted = [...items]
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => {
        const pa = a.discountPrice != null ? a.discountPrice : a.price
        const pb = b.discountPrice != null ? b.discountPrice : b.price
        return pa - pb
      })
    case 'price-desc':
      return sorted.sort((a, b) => {
        const pa = a.discountPrice != null ? a.discountPrice : a.price
        const pb = b.discountPrice != null ? b.discountPrice : b.price
        return pb - pa
      })
    case 'name':
      return sorted.sort((a, b) => a.productName.localeCompare(b.productName))
    default:
      return sorted
  }
}

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.05 }
  }
}

const staggerItem = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
}

function WishlistItemCard({
  item,
  onRemove,
  onMoveToCart,
  stockInfo,
}: {
  item: WishlistItem
  onRemove: (productId: string) => void
  onMoveToCart: (item: WishlistItem) => void
  stockInfo: number | null
}) {
  const { navigate } = useAppStore()
  const [removing, setRemoving] = useState(false)
  const [moving, setMoving] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleMoveToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMoving(true)
    await onMoveToCart(item)
    setMoving(false)
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRemoving(true)
    setTimeout(() => onRemove(item.productId), 300)
  }

  const effectivePrice = item.discountPrice != null ? item.discountPrice : item.price
  const hasDiscount = item.discountPrice != null && item.discountPrice < item.price
  const savings = hasDiscount ? item.price - (item.discountPrice ?? 0) : 0
  const isInStock = stockInfo === null || stockInfo > 0
  const isLowStock = stockInfo !== null && stockInfo > 0 && stockInfo <= 5

  return (
    <motion.div
      variants={staggerItem}
      layout
      className={`group cursor-pointer border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 bg-white ${
        removing ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100'
      }`}
      onClick={() => navigate('product-detail', { id: item.productId })}
      whileHover={{ y: -4 }}
    >
      <div className="relative aspect-square bg-muted/30 overflow-hidden">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted/30 animate-pulse" />
        )}
        <img
          src={item.image}
          alt={item.productName}
          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
        />
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Remove button */}
        <button
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/95 shadow-md flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-200 active:scale-90 z-10"
          onClick={handleRemove}
          title="Remove from wishlist"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Discount badge */}
        {hasDiscount && (
          <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs z-10 rounded-lg px-2">
            -{Math.round(((item.price - (item.discountPrice ?? item.price)) / item.price) * 100)}%
          </Badge>
        )}

        {/* Stock badge */}
        <div className="absolute bottom-2 left-2 z-10">
          {stockInfo !== null && !isInStock && (
            <Badge className="bg-red-500/90 text-white text-xs backdrop-blur-sm rounded-lg">Out of Stock</Badge>
          )}
          {isLowStock && (
            <Badge className="bg-amber-500/90 text-white text-xs backdrop-blur-sm rounded-lg">Low Stock ({stockInfo})</Badge>
          )}
          {isInStock && !isLowStock && stockInfo !== null && (
            <Badge className="bg-emerald-500/90 text-white text-xs backdrop-blur-sm rounded-lg">In Stock</Badge>
          )}
        </div>

        {/* Hover action buttons overlay */}
        <div className="absolute bottom-2 right-2 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="h-8 w-8 rounded-lg bg-white/95 shadow-sm flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
            onClick={async (e) => {
              e.stopPropagation()
              const { addToCart } = useAppStore.getState()
              try {
                const cartItem: Omit<CartItem, 'id'> = {
                  productId: item.productId,
                  productName: item.productName,
                  price: item.price,
                  discountPrice: item.discountPrice,
                  quantity: 1,
                  unit: 'kg',
                  image: item.image,
                  stock: stockInfo ?? 999,
                }
                await addToCart(cartItem)
                toast.success('Added to cart')
              } catch {
                toast.error('Failed to add to cart')
              }
            }}
            title="Add to Cart"
            disabled={!isInStock}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
          </motion.button>
          {isInStock && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="h-8 w-8 rounded-lg bg-white/95 shadow-sm flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-colors"
              onClick={handleMoveToCart}
              disabled={moving}
              title="Move to Cart"
            >
              <MoveRight className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {item.productName}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-primary text-base">
            {formatPrice(effectivePrice)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(item.price)}
            </span>
          )}
        </div>
        {savings > 0 && (
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <Tag className="h-3 w-3" /> Save {formatPrice(savings)}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1 h-9 text-xs rounded-xl shadow-sm"
            size="sm"
            disabled={moving || !isInStock}
            onClick={async (e) => {
              e.stopPropagation()
              const { addToCart } = useAppStore.getState()
              try {
                const cartItem: Omit<CartItem, 'id'> = {
                  productId: item.productId,
                  productName: item.productName,
                  price: item.price,
                  discountPrice: item.discountPrice,
                  quantity: 1,
                  unit: 'kg',
                  image: item.image,
                  stock: stockInfo ?? 999,
                }
                await addToCart(cartItem)
                toast.success('Added to cart')
              } catch {
                toast.error('Failed to add to cart')
              }
            }}
            variant={!isInStock ? 'secondary' : 'default'}
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            {!isInStock ? 'Out of Stock' : 'Add to Cart'}
          </Button>
          {isInStock && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs rounded-xl gap-1.5 min-w-0 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
              disabled={moving}
              onClick={handleMoveToCart}
              title="Move to Cart (removes from wishlist)"
            >
              <MoveRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Move</span>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ShareDialog({ wishlistItems }: { wishlistItems: WishlistItem[] }) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const shareText = `Check out my wishlist on Khati Khadyo!\n\n${wishlistItems.map((i) => `- ${i.productName} (৳${(i.discountPrice ?? i.price).toLocaleString()})`).join('\n')}`
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    toast.success('Wishlist copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyWishlistLink = async () => {
    const link = `${shareUrl}?page=wishlist`
    await navigator.clipboard.writeText(link)
    setLinkCopied(true)
    toast.success('Wishlist link copied!')
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareText)}`
    window.open(url, '_blank', 'width=600,height=400')
  }

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`
    window.open(url, '_blank')
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Khati Khadyo Wishlist',
          text: shareText,
          url: shareUrl,
        })
      } catch {
        // user cancelled
      }
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Share2 className="h-4 w-4 mr-1.5" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="h-4 w-4 text-primary" />
            </div>
            Share Your Wishlist
          </DialogTitle>
          <DialogDescription>
            Share your wishlist with friends and family
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {/* Copy wishlist link */}
          <Button
            className="w-full justify-start gap-3 h-12 rounded-xl"
            variant="outline"
            onClick={handleCopyWishlistLink}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-emerald-600" />
            </div>
            {linkCopied ? 'Link Copied!' : 'Copy Wishlist Link'}
          </Button>
          <Button
            className="w-full justify-start gap-3 h-12 rounded-xl"
            variant="outline"
            onClick={handleFacebookShare}
          >
            <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center">
              <Facebook className="h-4 w-4 text-white" />
            </div>
            Share on Facebook
          </Button>
          <Button
            className="w-full justify-start gap-3 h-12 rounded-xl"
            variant="outline"
            onClick={handleWhatsAppShare}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            Share on WhatsApp
          </Button>
          <Button
            className="w-full justify-start gap-3 h-12 rounded-xl"
            variant="outline"
            onClick={handleCopyLink}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
            </div>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              className="w-full justify-start gap-3 h-12 rounded-xl"
              variant="outline"
              onClick={handleNativeShare}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Share2 className="h-4 w-4 text-primary" />
              </div>
              More Options...
            </Button>
          )}
        </div>
        {/* Preview */}
        <div className="mt-2 p-3 bg-muted/50 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Preview</p>
          <p className="text-xs text-muted-foreground line-clamp-3">{shareText}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function WishlistPage() {
  const { wishlistItems, removeFromWishlist, addToCart, navigate } = useAppStore()
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  // Fetch stock info for wishlist items
  const [stockMap, setStockMap] = useReducer(
    (prev: Record<string, number>, next: Record<string, number>) => ({ ...prev, ...next }),
    {}
  )

  useEffect(() => {
    if (wishlistItems.length === 0) return
    const fetchStock = async () => {
      const newStockData: Record<string, number> = {}
      await Promise.all(
        wishlistItems.map(async (item) => {
          if (stockMap[item.productId] !== undefined) return
          try {
            const res = await fetch(`/api/products/${item.productId}`)
            if (res.ok) {
              const data = await res.json()
              const product = data.data || data
              if (product && typeof product.stock === 'number') {
                newStockData[item.productId] = product.stock
              }
            }
          } catch {
            // ignore
          }
        })
      )
      if (Object.keys(newStockData).length > 0) {
        setStockMap(newStockData)
      }
    }
    fetchStock()
  }, [wishlistItems, stockMap])

  const handleRemove = async (productId: string) => {
    setRemovedIds((prev) => new Set(prev).add(productId))
    setTimeout(async () => {
      await removeFromWishlist(productId)
      setRemovedIds((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
      toast.success('Removed from wishlist')
    }, 300)
  }

  const handleMoveToCart = async (item: WishlistItem) => {
    const stock = stockMap[item.productId]
    if (stock !== undefined && stock <= 0) {
      toast.error('This product is out of stock')
      return
    }
    try {
      const cartItem: Omit<CartItem, 'id'> = {
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        discountPrice: item.discountPrice,
        quantity: 1,
        unit: 'kg',
        image: item.image,
        stock: stock ?? 999,
      }
      await addToCart(cartItem)
      await removeFromWishlist(item.productId)
      toast.success('Moved to cart!')
    } catch {
      toast.error('Failed to move to cart')
    }
  }

  const handleAddAllToCart = async () => {
    const inStockItems = wishlistItems.filter((item) => {
      const stock = stockMap[item.productId]
      return stock === undefined || stock > 0
    })
    if (inStockItems.length === 0) {
      toast.error('No items in stock to add')
      return
    }
    let added = 0
    for (const item of inStockItems) {
      try {
        const cartItem: Omit<CartItem, 'id'> = {
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          discountPrice: item.discountPrice,
          quantity: 1,
          unit: 'kg',
          image: item.image,
          stock: stockMap[item.productId] ?? 999,
        }
        await addToCart(cartItem)
        added++
      } catch {
        // continue
      }
    }
    toast.success(`${added} item${added !== 1 ? 's' : ''} added to cart`)
  }

  const visibleItems = sortWishlistItems(
    wishlistItems.filter((i) => !removedIds.has(i.productId)),
    sortBy
  )

  // Empty state
  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-muted/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20 px-4 max-w-md mx-auto"
        >
          {/* Heart Illustration */}
          <div className="relative mb-8 inline-block">
            <div className="h-44 w-44 rounded-full bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center mx-auto border-2 border-dashed border-red-200 shadow-lg">
              <div className="relative">
                <Heart className="h-18 w-18 text-red-300" style={{ width: '4.5rem', height: '4.5rem' }} />
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-secondary animate-ping" style={{ animationDuration: '2s' }} />
              </div>
            </div>
            {/* Decorative sparkles */}
            <Sparkles className="h-6 w-6 text-secondary absolute -top-2 -right-2 animate-pulse" />
            <Sparkles className="h-4 w-4 text-primary absolute bottom-2 -left-3 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-red-200" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Wishlist is Empty</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Start saving your favorite products here! Click the{' '}
            <Heart className="h-4 w-4 inline text-red-400" /> icon on any product to add it to your wishlist.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate('products')} className="rounded-xl px-6 shadow-md">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Start Exploring
            </Button>
            <Button variant="outline" onClick={() => navigate('products')} className="rounded-xl px-6">
              <Gift className="h-4 w-4 mr-2" />
              Check Offers
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  const totalValue = wishlistItems.reduce((sum, item) => {
    const price = item.discountPrice != null ? item.discountPrice : item.price
    return sum + price
  }, 0)
  const totalSavings = wishlistItems.reduce((sum, item) => {
    if (item.discountPrice != null && item.discountPrice < item.price) {
      return sum + (item.price - item.discountPrice)
    }
    return sum
  }, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-muted/20">
      {/* Header - Enhanced */}
      <div className="bg-gradient-to-r from-red-50 via-primary/5 to-red-50 py-6 border-b">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                </div>
                My Wishlist
                <Badge className="bg-primary text-primary-foreground ml-1 rounded-full px-2.5 text-xs">
                  {wishlistItems.length}
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''} saved · Total value {formatPrice(totalValue)}
                {totalSavings > 0 && (
                  <span className="text-emerald-600 ml-2 font-medium flex items-center gap-1 sm:inline-flex">
                    <Tag className="h-3 w-3" /> Save {formatPrice(totalSavings)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Sort */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[160px] h-9 text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date Added</SelectItem>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Share with Dialog */}
              <ShareDialog wishlistItems={wishlistItems} />
              {/* Add All to Cart with count badge */}
              <Button size="sm" onClick={handleAddAllToCart} className="rounded-xl relative shadow-sm">
                <ShoppingCart className="h-4 w-4 mr-1.5" />
                Add All to Cart
                <Badge className="absolute -top-2 -right-2 bg-secondary text-white text-xs h-5 min-w-5 flex items-center justify-center rounded-full px-1">
                  {wishlistItems.length}
                </Badge>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="container mx-auto px-4 py-8">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {visibleItems.map((item) => (
            <WishlistItemCard
              key={item.productId}
              item={item}
              onRemove={handleRemove}
              onMoveToCart={handleMoveToCart}
              stockInfo={stockMap[item.productId] ?? null}
            />
          ))}
        </motion.div>

        {/* Continue Shopping CTA */}
        {wishlistItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-10"
          >
            <Button
              variant="outline"
              className="rounded-full px-8"
              onClick={() => navigate('products')}
            >
              Continue Shopping <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
