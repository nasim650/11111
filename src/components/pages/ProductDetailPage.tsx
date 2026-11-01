'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  Minus,
  Plus,
  ShoppingCart,
  Heart,
  Share2,
  Star,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Compass,
  Copy,
  Check,
  GitCompareArrows,
  Facebook,
  MessageCircle,
  Package,
  Users,
  Sparkles,
  Home,
  ArrowRight,
  Clock,
  BadgeCheck,
  X,
  ChevronLeft,
  ZoomIn,
  Lock,
  CreditCard,
  Eye,
  Play,
  CalendarDays,
  FileText,
  ListChecks,
  MessageSquare,
  ArrowUp,
  Flame,
  BoxSelect,
  CircleDot,
  RotateCcw,
  ImageOff,
} from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore, type CartItem, type WishlistItem } from '@/lib/store'
import { extractItems } from '@/lib/api'
import ProductCard from '@/components/shared/ProductCard'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string
  rating: number
  comment?: string
  createdAt: string
  user?: { name?: string }
}

interface ProductDetail {
  id: string
  name: string
  slug: string
  shortDescription?: string
  description?: string
  price: number
  discountPrice?: number | null
  unit: string
  stock: number
  origin?: string
  qualityNote?: string
  ingredients?: string
  storageInstruction?: string
  deliveryNote?: string
  specifications?: string
  tags?: string
  category?: { id: string; name: string; slug: string }
  subcategory?: { id: string; name: string; slug: string }
  images?: Array<{ id: string; url: string; alt?: string }>
  videos?: Array<{ id: string; url: string; title?: string; thumbnail?: string }>
  reviews?: Review[]
  isNewArrival?: boolean
  isBestSeller?: boolean
  isFeatured?: boolean
  status: string
}

interface RelatedProduct {
  id: string
  name: string
  slug: string
  price: number
  discountPrice?: number | null
  unit: string
  stock: number
  images?: Array<{ url: string; alt?: string }>
  category?: { name: string; slug: string }
  status?: string
  isNewArrival?: boolean
  isBestSeller?: boolean
}

// ─── Animated Section Wrapper ─────────────────────────────────────────────────

function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Fullscreen Image Viewer ──────────────────────────────────────────────────

function FullscreenViewer({
  images,
  initialIndex,
  open,
  onClose,
}: {
  images: Array<{ id: string; url: string; alt?: string }>
  initialIndex: number
  open: boolean
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setIdx(initialIndex)
  }, [open, initialIndex])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(images.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, images.length, onClose])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-5xl w-full p-0 bg-black/95 border-none overflow-hidden">
        <DialogTitle className="sr-only">Image Viewer</DialogTitle>
        <div className="relative aspect-square w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <Image
                src={images[idx]?.url || '/placeholder.png'}
                alt={images[idx]?.alt || 'Product image'}
                fill
                className="object-contain"
                sizes="90vw"
                priority
              />
            </motion.div>
          </AnimatePresence>
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Nav arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors disabled:opacity-30"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
                disabled={idx === images.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors disabled:opacity-30"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-full">
            {idx + 1} / {images.length}
          </div>
          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 flex gap-2 max-w-md overflow-x-auto px-2 py-1 scrollbar-hide">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setIdx(i)}
                  className={`relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${
                    i === idx ? 'border-white ring-2 ring-white/30' : 'border-white/30 opacity-60 hover:opacity-90'
                  }`}
                >
                  <Image src={img.url} alt={img.alt || ''} fill className="object-cover" sizes="48px" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Scroll-to-Top Button ────────────────────────────────────────────────────

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 600)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 md:bottom-8 right-4 z-40 h-10 w-10 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center hover:bg-emerald-700 transition-colors"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDetailPage({ initialProduct }: { initialProduct?: ProductDetail | null } = {}) {
  const {
    pageParams,
    navigate,
    addToCart,
    isInWishlist,
    toggleWishlist,
    addRecentlyViewed,
    addToCompare,
    isInCompare,
    compareProducts,
    isAuthenticated,
    user,
    siteConfig,
    recentlyViewed,
  } = useAppStore()

  const [product, setProduct] = useState<ProductDetail | null>(initialProduct || null)
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([])
  const [alsoViewedProducts, setAlsoViewedProducts] = useState<RelatedProduct[]>([])
  const [frequentlyBoughtTogether, setFrequentlyBoughtTogether] = useState<RelatedProduct[]>([])
  const [selectedBundleItems, setSelectedBundleItems] = useState<Set<string>>(new Set())
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<RelatedProduct[]>([])
  const [reviews, setReviews] = useState<Review[]>(initialProduct?.reviews || [])
  const [loading, setLoading] = useState(!initialProduct)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [wishlistAnimating, setWishlistAnimating] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  // Zoom state
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 })
  const [isZooming, setIsZooming] = useState(false)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // Mobile touch state for image carousel
  const [touchStart, setTouchStart] = useState<number | null>(null)

  // Review form
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const mainCtaRef = useRef<HTMLDivElement>(null)
  const reviewsRef = useRef<HTMLDivElement>(null)
  const productId = String(pageParams?.id || '')

  // Sticky bar visibility on mobile
  useEffect(() => {
    const handleScroll = () => {
      if (mainCtaRef.current) {
        const rect = mainCtaRef.current.getBoundingClientRect()
        setShowStickyBar(rect.bottom < 0)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch product data
  useEffect(() => {
    if (initialProduct) {
      setProduct(initialProduct)
      if (initialProduct.reviews) {
        setReviews(initialProduct.reviews)
      }
      setLoading(false)
      addRecentlyViewed(initialProduct.id)

      const currentCatSlug = initialProduct.category?.slug
      Promise.all([
        currentCatSlug
          ? fetch(`/api/products?category=${currentCatSlug}&limit=8&status=active`)
              .then((r) => r.json())
              .then((d) =>
                extractItems<RelatedProduct>(d).filter(
                  (p) => p.id !== initialProduct.id
                )
              )
              .catch(() => [] as RelatedProduct[])
          : Promise.resolve([] as RelatedProduct[]),
        fetch(`/api/products?status=active&limit=8`)
          .then((r) => r.json())
          .then((d) =>
            extractItems<RelatedProduct>(d).filter(
              (p) => p.id !== initialProduct.id
            )
          )
          .catch(() => [] as RelatedProduct[]),
      ]).then(([sameCat, allActive]) => {
        if (sameCat.length > 0) {
          setAlsoViewedProducts(sameCat.slice(0, 6))
        }
        const crossCat = allActive.filter(
          (p) => !p.category?.slug || p.category.slug !== currentCatSlug
        )
        const youMayLike =
          crossCat.length >= 4 ? crossCat.slice(0, 8) : sameCat.slice(0, 8)
        setRelatedProducts(youMayLike)
      })
      return
    }

    if (!productId) return
    setLoading(true)
    setSelectedImage(0)
    setQuantity(1)
    setShowVideo(false)

    Promise.all([
      fetch(`/api/products/${productId}`).then((r) => r.json()),
      fetch(`/api/reviews?productId=${productId}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([productResponse, reviewsData]) => {
        const productData = productResponse?.data || productResponse
        setProduct(productData)
        setReviews(extractItems<Review>(reviewsData))
        addRecentlyViewed(productData.id)

        // ── Cross-category recommendations ──
        // "Customers Also Viewed" uses same-category products.
        // "You May Also Like" surfaces products from OTHER categories so
        // users can discover more (e.g. Rice & Grains → Spices / Lentils).
        // When there aren't enough cross-category products, we fall back
        // to filling the grid with same-category products.
        const currentCatSlug = productData.category?.slug
        Promise.all([
          currentCatSlug
            ? fetch(`/api/products?category=${currentCatSlug}&limit=8&status=active`)
                .then((r) => r.json())
                .then((d) =>
                  extractItems<RelatedProduct>(d).filter(
                    (p) => p.id !== productData.id
                  )
                )
                .catch(() => [] as RelatedProduct[])
            : Promise.resolve([] as RelatedProduct[]),
          fetch(`/api/products?status=active&limit=8`)
            .then((r) => r.json())
            .then((d) =>
              extractItems<RelatedProduct>(d).filter(
                (p) => p.id !== productData.id
              )
            )
            .catch(() => [] as RelatedProduct[]),
        ]).then(([sameCat, allActive]) => {
          // "Customers Also Viewed" — same-category products.
          if (sameCat.length > 0) {
            setAlsoViewedProducts(sameCat.slice(0, 6))
          }

          // "You May Also Like" — cross-category recommendations.
          // Filter OUT products in the same category as the current product.
          const crossCat = currentCatSlug
            ? allActive.filter((p) => p.category?.slug !== currentCatSlug)
            : allActive
          const desired = 8
          const result = [...crossCat.slice(0, desired)]
          // Fall back to same-category products if cross-category is sparse.
          if (result.length < desired) {
            const filler = sameCat
              .filter((p) => !result.some((r) => r.id === p.id))
              .slice(0, desired - result.length)
            result.push(...filler)
          }
          setRelatedProducts(result.slice(0, desired))
        })

        fetch(`/api/products?status=active&limit=4`)
          .then((r) => r.json())
          .then((d) => {
            const prods = extractItems<RelatedProduct>(d).filter(
              (p) => p.id !== productData.id
            )
            setFrequentlyBoughtTogether(prods.slice(0, 3))
          })
          .catch(() => {})
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [productId, addRecentlyViewed])

  // Reset Frequently-Bought-Together selection whenever the product changes.
  // The current product is always pre-selected and cannot be removed.
  useEffect(() => {
    if (product?.id) {
      setSelectedBundleItems(new Set([product.id]))
    }
  }, [product?.id])

  // Fetch recently viewed products
  useEffect(() => {
    if (recentlyViewed.length === 0) return
    const idsToFetch = recentlyViewed.filter((id) => id !== productId).slice(0, 8)
    if (idsToFetch.length === 0) return

    Promise.all(
      idsToFetch.map((id) =>
        fetch(`/api/products/${id}`)
          .then((r) => r.json())
          .then((d) => d?.data || d)
          .catch(() => null)
      )
    ).then((results) => {
      const valid = results.filter(Boolean) as RelatedProduct[]
      setRecentlyViewedProducts(valid.filter((p) => p.id !== productId))
    })
  }, [recentlyViewed, productId])

  const ratingBreakdown = useMemo(() => {
    const breakdown = [0, 0, 0, 0, 0]
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        breakdown[r.rating - 1]++
      }
    })
    return breakdown
  }, [reviews])

  // Estimated delivery date - must be before early returns
  const estimatedDelivery = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 3)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }, [])

  // Zoom handler - must be before early returns
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomPosition({ x, y })
  }, [])

  // Mobile swipe handler for image gallery
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent, imageCount: number) => {
    if (touchStart === null) return
    const diff = touchStart - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0 && selectedImage < imageCount - 1) {
        setSelectedImage((prev) => prev + 1)
      } else if (diff < 0 && selectedImage > 0) {
        setSelectedImage((prev) => prev - 1)
      }
    }
    setTouchStart(null)
  }, [touchStart, selectedImage])

  // ── Loading State ──
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-16 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-4 w-4 rounded-full" />
              ))}
              <Skeleton className="h-4 w-20 ml-2" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="flex gap-3">
              <Skeleton className="h-12 flex-1 rounded-xl" />
              <Skeleton className="h-12 flex-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="mt-12 space-y-4">
          <div className="flex gap-4 border-b pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  // ── Not Found State ──
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-6">The product you are looking for does not exist or has been removed.</p>
          <Button onClick={() => navigate('home')} className="rounded-full px-8 bg-emerald-600 hover:bg-emerald-700">
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </motion.div>
      </div>
    )
  }

  // ── Derived Values ──
  const wishlisted = isInWishlist(product.id)
  const compared = isInCompare(product.id)
  const images = product.images || []
  const videos = product.videos || []
  const imageUrl = images[selectedImage]?.url || '/placeholder.png'
  const effectivePrice = product.discountPrice != null && product.discountPrice < (product.price ?? 0) ? product.discountPrice : (product.price ?? 0)
  const hasDiscount = product.discountPrice != null && product.discountPrice < (product.price ?? Infinity)
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0
  const savingsAmount = hasDiscount ? (product.price - product.discountPrice!) : 0
  const inStock = product.stock > 0
  const lowStock = inStock && product.stock <= 10
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0
  const freeShippingThreshold = siteConfig?.freeShippingThreshold || 1500
  const shippingCharge = siteConfig?.shippingCharge || 60
  const cartTotal = effectivePrice * quantity
  const freeShippingProgress = Math.min(100, (cartTotal / freeShippingThreshold) * 100)
  const isFreeShipping = cartTotal >= freeShippingThreshold

  // ── Frequently Bought Together selection ──
  // Current product is always selected and cannot be toggled off.
  const toggleBundleItem = (id: string) => {
    if (!product || id === product.id) return
    setSelectedBundleItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const bundleTotal =
    (selectedBundleItems.has(product.id) ? effectivePrice : 0) +
    frequentlyBoughtTogether
      .filter((p) => selectedBundleItems.has(p.id))
      .reduce((sum, p) => sum + (p.discountPrice != null ? p.discountPrice : p.price ?? 0), 0)
  const selectedBundleCount = selectedBundleItems.size

  // Stock level percentage (for progress bar visualization)
  const maxStockDisplay = 50
  const stockLevelPercent = inStock ? Math.min(100, (product.stock / maxStockDisplay) * 100) : 0

  // Specs
  let specs: Array<{ key: string; value: string }> = []
  try {
    if (product.specifications) {
      const parsed = JSON.parse(product.specifications)
      specs = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([key, value]) => ({ key, value: String(value) }))
    }
  } catch { /* ignore */ }

  // Also add built-in specs
  const builtInSpecs: Array<{ key: string; value: string }> = []
  if (product.origin) builtInSpecs.push({ key: 'Origin', value: product.origin })
  if (product.qualityNote) builtInSpecs.push({ key: 'Quality Note', value: product.qualityNote })
  if (product.ingredients) builtInSpecs.push({ key: 'Ingredients', value: product.ingredients })
  if (product.storageInstruction) builtInSpecs.push({ key: 'Storage', value: product.storageInstruction })
  if (product.deliveryNote) builtInSpecs.push({ key: 'Delivery', value: product.deliveryNote })

  const allSpecs = [...builtInSpecs, ...specs]

  // Tags
  let tags: string[] = []
  try {
    if (product.tags) {
      const parsed = JSON.parse(product.tags)
      tags = Array.isArray(parsed) ? parsed : typeof parsed === 'string' ? parsed.split(',').map((t: string) => t.trim()) : []
    }
  } catch { /* ignore */ }

  // Product highlights for quick info
  const highlights: Array<{ icon: React.ReactNode; text: string }> = []
  if (product.origin) highlights.push({ icon: <BadgeCheck className="h-4 w-4 text-emerald-500" />, text: `Origin: ${product.origin}` })
  if (product.qualityNote) highlights.push({ icon: <ShieldCheck className="h-4 w-4 text-amber-500" />, text: product.qualityNote })
  if (product.unit) highlights.push({ icon: <Package className="h-4 w-4 text-emerald-500" />, text: `Unit: ${product.unit}` })
  if (inStock && !lowStock) highlights.push({ icon: <Truck className="h-4 w-4 text-emerald-500" />, text: 'In Stock - Ready to Ship' })
  if (isFreeShipping) highlights.push({ icon: <Truck className="h-4 w-4 text-amber-500" />, text: 'Free Shipping' })
  if (hasDiscount) highlights.push({ icon: <Flame className="h-4 w-4 text-red-500" />, text: `${discountPercent}% OFF - Limited Deal` })

  // ── Handlers ──
  const handleAddToCart = async () => {
    setAdding(true)
    try {
      const cartItem: Omit<CartItem, 'id'> = {
        productId: product.id,
        productName: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity,
        unit: product.unit,
        image: images[0]?.url || '/placeholder.png',
        stock: product.stock,
      }
      await addToCart(cartItem)
      toast.success('Added to cart', { description: `${quantity}× ${product.name}` })
    } catch {
      toast.error('Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  const handleBuyNow = async () => {
    await handleAddToCart()
    navigate('checkout')
  }

  const handleWishlist = async () => {
    setWishlistAnimating(true)
    const item: WishlistItem = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: images[0]?.url || '/placeholder.png',
    }
    await toggleWishlist(item)
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist')
    setTimeout(() => setWishlistAnimating(false), 600)
  }

  const handleCompare = () => {
    if (compared) {
      toast.info('Already in comparison list')
      return
    }
    if (compareProducts.length >= 4) {
      toast.error('Maximum 4 products can be compared')
      return
    }
    addToCompare(product.id)
    toast.success('Added to comparison')
  }

  const handleAddBundleToCart = async () => {
    if (!product) return
    const items: Array<Omit<CartItem, 'id'>> = []
    if (selectedBundleItems.has(product.id)) {
      items.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity: 1,
        unit: product.unit,
        image: images[0]?.url || '/placeholder.png',
        stock: product.stock,
      })
    }
    for (const p of frequentlyBoughtTogether) {
      if (selectedBundleItems.has(p.id)) {
        items.push({
          productId: p.id,
          productName: p.name,
          price: p.price,
          discountPrice: p.discountPrice,
          quantity: 1,
          unit: p.unit,
          image: p.images?.[0]?.url || '/placeholder.png',
          stock: p.stock,
        })
      }
    }
    if (items.length === 0) {
      toast.error('Please select at least one item')
      return
    }
    try {
      for (const item of items) {
        await addToCart(item)
      }
      toast.success(`${items.length} item${items.length === 1 ? '' : 's'} added to cart`)
    } catch {
      toast.error('Failed to add items to cart')
    }
  }

  const handleShare = (platform: string) => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = `Check out ${product.name} on Khati Khadyo!`

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`)
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please login to write a review')
      navigate('login')
      return
    }
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          userId: user?.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit review')
      toast.success('Review submitted successfully!')
      setReviewComment('')
      setReviewRating(5)
      const reviewsData = await fetch(`/api/reviews?productId=${product.id}`).then((r) => r.json())
      setReviews(extractItems<Review>(reviewsData))
    } catch {
      toast.error('Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* ── Breadcrumb ── */}
      <div className="bg-gradient-to-r from-emerald-50 to-amber-50/50 dark:from-emerald-950/20 dark:to-amber-950/10 py-3 border-b border-emerald-100/50 dark:border-emerald-900/30">
        <div className="container mx-auto px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('home')} className="cursor-pointer flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('products')} className="cursor-pointer text-emerald-700 dark:text-emerald-400 hover:text-emerald-800">Products</BreadcrumbLink>
              </BreadcrumbItem>
              {product.category && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink onClick={() => navigate('products', { category: product.category!.slug })} className="cursor-pointer text-emerald-700 dark:text-emerald-400 hover:text-emerald-800">
                      {product.category.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-foreground font-medium truncate max-w-[200px]">{product.name}</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ══════════════════════════════════════════════════════════════════════
              IMAGE GALLERY SECTION
          ══════════════════════════════════════════════════════════════════════ */}
          <AnimatedSection>
            <div className="flex gap-4 lg:sticky lg:top-24">
              {/* ── Vertical Thumbnail Strip (Desktop, left side) ── */}
              {images.length > 1 && (
                <div className="hidden md:flex flex-col gap-3 flex-shrink-0 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {images.map((img, idx) => (
                    <motion.button
                      key={img.id}
                      className={`relative h-16 w-16 md:h-20 md:w-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-200 ${
                        idx === selectedImage && !showVideo
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => { setSelectedImage(idx); setShowVideo(false) }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={`View image ${idx + 1}`}
                      aria-current={idx === selectedImage ? 'true' : undefined}
                    >
                      <Image src={img.url} alt={img.alt || product.name} fill className="object-cover" sizes="80px" />
                      {idx === selectedImage && !showVideo && (
                        <div className="absolute inset-0 bg-emerald-500/10" />
                      )}
                    </motion.button>
                  ))}
                  {/* Video thumbnail */}
                  {videos.length > 0 && (
                    <button
                      className={`relative h-16 w-16 md:h-20 md:w-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-200 flex items-center justify-center bg-muted ${
                        showVideo
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => { setShowVideo(true); setSelectedImage(0) }}
                      aria-label="Watch product video"
                    >
                      <Play className="h-6 w-6 text-emerald-600" />
                      <span className="absolute bottom-0.5 text-[8px] font-medium text-muted-foreground">VIDEO</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 space-y-4 min-w-0">
                {/* ── Main Image with Zoom-on-Hover ── */}
                <div
                  ref={imageContainerRef}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-muted/40 to-muted/20 cursor-zoom-in group shadow-lg border border-emerald-100/60 dark:border-emerald-900/30"
                  onMouseEnter={() => setIsZooming(true)}
                  onMouseLeave={() => setIsZooming(false)}
                  onMouseMove={handleMouseMove}
                  onClick={() => images.length > 0 && setFullscreenOpen(true)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={(e) => handleTouchEnd(e, images.length)}
                >
                  {images.length === 0 ? (
                    /* Empty state placeholder */
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                      <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                        <ImageOff className="h-9 w-9 text-emerald-500" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground line-clamp-2 max-w-[220px]">{product.name}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">No image available</p>
                    </div>
                  ) : (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={selectedImage}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute inset-0"
                        >
                          <Image
                            src={imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform duration-300 ease-out"
                            style={{
                              transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                              transform: isZooming ? 'scale(2)' : 'scale(1)',
                            }}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                          />
                        </motion.div>
                      </AnimatePresence>

                      {/* Zoom indicator */}
                      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                        <div className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <ZoomIn className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Discount badge */}
                      {hasDiscount && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                          className="absolute top-3 left-3 z-10"
                        >
                          <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white text-sm px-3 py-1 shadow-lg shadow-red-500/30">
                            <Flame className="h-3 w-3 mr-1" />
                            -{discountPercent}%
                          </Badge>
                        </motion.div>
                      )}

                      {/* New/BestSeller badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1 z-10" style={{ left: hasDiscount ? 'auto' : '12px', right: hasDiscount ? 'auto' : undefined, marginLeft: hasDiscount ? '90px' : 0 }}>
                        {product.isNewArrival && (
                          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                            <Badge className="bg-emerald-500 text-white text-xs shadow-md shadow-emerald-500/30">
                              <Sparkles className="h-3 w-3 mr-1" />NEW
                            </Badge>
                          </motion.div>
                        )}
                        {product.isBestSeller && (
                          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                            <Badge className="bg-amber-500 text-white text-xs shadow-md shadow-amber-500/30">
                              <Star className="h-3 w-3 mr-1 fill-current" />BEST SELLER
                            </Badge>
                          </motion.div>
                        )}
                      </div>

                      {/* Origin badge (top-right under zoom indicator) */}
                      {product.origin && (
                        <div className="absolute top-14 right-3 z-10">
                          <Badge className="bg-white/90 dark:bg-black/50 text-emerald-700 dark:text-emerald-400 text-[10px] gap-1 backdrop-blur-sm shadow-sm">
                            <BadgeCheck className="h-3 w-3" />
                            {product.origin}
                          </Badge>
                        </div>
                      )}

                      {/* Image navigation arrows (hover overlay) */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedImage((i) => Math.max(0, i - 1)); setShowVideo(false) }}
                            disabled={selectedImage === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedImage((i) => Math.min(images.length - 1, i + 1)); setShowVideo(false) }}
                            disabled={selectedImage === images.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                            aria-label="Next image"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}

                      {/* Image counter */}
                      {images.length > 1 && (
                        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
                          {selectedImage + 1} / {images.length}
                        </div>
                      )}

                      {/* Mobile dot navigation */}
                      {images.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 md:hidden">
                          {images.map((_, i) => (
                            <button
                              key={i}
                              onClick={(e) => { e.stopPropagation(); setSelectedImage(i); setShowVideo(false) }}
                              className={`h-2 rounded-full transition-all duration-300 ${
                                i === selectedImage ? 'w-6 bg-white' : 'w-2 bg-white/50'
                              }`}
                              aria-label={`Go to image ${i + 1}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Video play overlay if video available */}
                      {videos.length > 0 && !showVideo && selectedImage === 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowVideo(true); setSelectedImage(0) }}
                          className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors z-10 md:bottom-10"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" /> Watch Video
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Video Player */}
                {showVideo && videos.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl overflow-hidden bg-black"
                  >
                    <video
                      src={videos[0].url}
                      controls
                      autoPlay
                      className="w-full aspect-video"
                      poster={videos[0].thumbnail || undefined}
                    />
                    <button
                      onClick={() => setShowVideo(false)}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── Horizontal Thumbnail Strip (Mobile, below main image) ── */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide md:hidden">
                    {images.map((img, idx) => (
                      <motion.button
                        key={img.id}
                        className={`relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-200 ${
                          idx === selectedImage && !showVideo
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        onClick={() => { setSelectedImage(idx); setShowVideo(false) }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={`View image ${idx + 1}`}
                        aria-current={idx === selectedImage ? 'true' : undefined}
                      >
                        <Image src={img.url} alt={img.alt || product.name} fill className="object-cover" sizes="80px" />
                        {idx === selectedImage && !showVideo && (
                          <div className="absolute inset-0 bg-emerald-500/10" />
                        )}
                      </motion.button>
                    ))}
                    {/* Video thumbnail */}
                    {videos.length > 0 && (
                      <button
                        className={`relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-200 flex items-center justify-center bg-muted ${
                          showVideo
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        onClick={() => { setShowVideo(true); setSelectedImage(0) }}
                        aria-label="Watch product video"
                      >
                        <Play className="h-6 w-6 text-emerald-600" />
                        <span className="absolute bottom-0.5 text-[8px] font-medium text-muted-foreground">VIDEO</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </AnimatedSection>

          {/* ══════════════════════════════════════════════════════════════════════
              PRODUCT INFO SECTION
          ══════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-5">
            {/* Category & Title */}
            <AnimatedSection>
              <div>
                {product.category && (
                  <button
                    onClick={() => navigate('products', { category: product.category!.slug })}
                    className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mb-1 hover:underline inline-flex items-center gap-1"
                  >
                    {product.category.name}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{product.name}</h1>
                {product.shortDescription && (
                  <p className="text-muted-foreground mt-2 leading-relaxed">{product.shortDescription}</p>
                )}

                {/* Origin Badge */}
                {product.origin && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      {product.origin}
                    </Badge>
                    {product.isNewArrival && (
                      <Badge className="bg-emerald-500 text-white text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />New Arrival
                      </Badge>
                    )}
                    {product.isBestSeller && (
                      <Badge className="bg-amber-500 text-white text-xs">
                        <Star className="h-3 w-3 mr-1 fill-current" />Best Seller
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </AnimatedSection>

            {/* Rating - Clickable to scroll to reviews */}
            <AnimatedSection delay={0.1}>
              {reviews.length > 0 ? (
                <button
                  onClick={scrollToReviews}
                  className="flex items-center gap-2 group"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 transition-colors ${i < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground group-hover:text-emerald-600 transition-colors">
                    ({reviews.length} review{reviews.length !== 1 ? 's' : ''}) ↓
                  </span>
                </button>
              ) : (
                <button
                  onClick={scrollToReviews}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-600 transition-colors group"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-muted-foreground/30" />
                    ))}
                  </div>
                  <span className="group-hover:underline">Be the first to review</span>
                </button>
              )}
            </AnimatedSection>

            {/* ── Enhanced Price Section ── */}
            <AnimatedSection delay={0.15}>
              <div className="relative bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-amber-50/50 dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-amber-950/10 -mx-4 px-4 py-5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/30 overflow-hidden">
                {/* Decorative background pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <div className="relative">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <motion.span
                      className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400"
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      ৳{(effectivePrice ?? 0).toLocaleString()}
                    </motion.span>
                    {hasDiscount && (
                      <span className="text-lg md:text-xl text-muted-foreground line-through decoration-red-400/60">৳{(product.price ?? 0).toLocaleString()}</span>
                    )}
                    <span className="text-muted-foreground text-sm">/ {product.unit}</span>
                  </div>
                  {hasDiscount && (
                    <motion.div
                      className="flex items-center gap-2 mt-2 flex-wrap"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Badge className="bg-emerald-600 text-white text-xs font-semibold shadow-sm shadow-emerald-600/20">
                        You save ৳{savingsAmount.toLocaleString()}
                      </Badge>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                        {discountPercent}% OFF
                      </span>
                      <span className="text-xs text-muted-foreground">
                        • Limited time deal
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            </AnimatedSection>

            {/* ── Stock Status with Progress Bar ── */}
            <AnimatedSection delay={0.2}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {inStock ? (
                    lowStock ? (
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                        </span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-semibold">
                          Only {product.stock} left in stock!
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold">
                          In Stock ({product.stock} available)
                        </Badge>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold">
                        Out of Stock
                      </Badge>
                    </div>
                  )}
                </div>
                {/* Stock level progress bar */}
                {inStock && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          lowStock
                            ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                            : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${stockLevelPercent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                      />
                    </div>
                    {lowStock && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        🔥 Selling fast! Only {product.stock} left
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AnimatedSection>

            {/* Quick Highlights */}
            {highlights.length > 0 && (
              <AnimatedSection delay={0.22}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {h.icon}
                      <span className="text-muted-foreground">{h.text}</span>
                    </div>
                  ))}
                </div>
              </AnimatedSection>
            )}

            <Separator />

            {/* Quantity & Add to Cart */}
            <AnimatedSection delay={0.25}>
              <div ref={mainCtaRef}>
                {inStock ? (
                  <div className="space-y-3">
                    {/* Quantity Selector */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center border-2 rounded-full overflow-hidden shadow-sm border-emerald-200 dark:border-emerald-800 bg-background">
                        <button
                          className="h-12 w-12 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors active:scale-90"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <Input
                          type="number"
                          min={1}
                          max={product.stock}
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value)
                            if (!isNaN(val) && val >= 1 && val <= product.stock) setQuantity(val)
                          }}
                          className="h-12 w-16 text-center font-semibold border-0 focus-visible:ring-0 bg-muted/30 text-base"
                        />
                        <button
                          className="h-12 w-12 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors active:scale-90"
                          onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                          disabled={quantity >= product.stock}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="text-sm text-muted-foreground">per {product.unit}</span>
                      <span className="text-sm text-muted-foreground ml-auto sm:ml-0">
                        Subtotal: <span className="font-bold text-foreground text-base">৳{(effectivePrice * quantity).toLocaleString()}</span>
                      </span>
                    </div>

                    {/* Add to Cart + Buy Now */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl text-base font-semibold border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 transition-all"
                          size="lg"
                          disabled={adding}
                          onClick={handleAddToCart}
                        >
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          {adding ? 'Adding...' : 'Add to Cart'}
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                        <Button
                          className="w-full h-12 rounded-xl text-base font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-all"
                          size="lg"
                          onClick={handleBuyNow}
                        >
                          Buy Now <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </motion.div>
                    </div>

                    {/* Compact Trust Badges — below Add to Cart + Buy Now */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        { icon: ShieldCheck, label: '100% Authentic', color: 'emerald' },
                        { icon: Truck, label: 'Fast Delivery', color: 'amber' },
                        { icon: RotateCcw, label: 'Easy Returns', color: 'emerald' },
                      ].map(({ icon: Icon, label, color }, idx) => (
                        <motion.div
                          key={label}
                          className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-center hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + idx * 0.05 }}
                        >
                          <Icon className={`h-4 w-4 ${color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`} />
                          <span className="text-[10px] font-semibold leading-tight">{label}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                    <p className="text-sm font-semibold text-destructive">Out of Stock</p>
                    <p className="text-xs text-muted-foreground mt-1">This product is currently unavailable.</p>
                  </div>
                )}
              </div>
            </AnimatedSection>

            {/* Action Buttons Row */}
            <AnimatedSection delay={0.3}>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={handleWishlist}>
                  <motion.div
                    animate={wishlistAnimating ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <Heart className={`h-4 w-4 mr-1.5 transition-colors ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                  </motion.div>
                  <span className="hidden sm:inline">{wishlisted ? 'Wishlisted' : 'Wishlist'}</span>
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 h-11 rounded-xl ${compared ? 'border-emerald-500 text-emerald-600' : ''}`}
                  onClick={handleCompare}
                  disabled={compareProducts.length >= 4 && !compared}
                >
                  <GitCompareArrows className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">{compared ? 'In Compare' : 'Compare'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => handleShare('copy')}
                >
                  {copied ? <Check className="h-4 w-4 mr-1.5 text-emerald-500" /> : <Share2 className="h-4 w-4 mr-1.5" />}
                  <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
                </Button>
              </div>
            </AnimatedSection>

            {/* Estimated Delivery */}
            <AnimatedSection delay={0.32}>
              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Estimated Delivery</p>
                      <p className="text-xs text-muted-foreground">Order by today, get by <span className="font-semibold text-emerald-600">{estimatedDelivery}</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Free Shipping Threshold */}
            <AnimatedSection delay={0.34}>
              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium">
                          {isFreeShipping ? '🎉 Free Shipping!' : `Add ৳${(freeShippingThreshold - cartTotal).toLocaleString()} more for free shipping`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">৳{freeShippingThreshold.toLocaleString()}</span>
                    </div>
                    <Progress
                      value={freeShippingProgress}
                      className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-emerald-600"
                    />
                    {!isFreeShipping && (
                      <p className="text-xs text-muted-foreground">
                        Shipping: ৳{shippingCharge} • Free on orders ৳{freeShippingThreshold.toLocaleString()}+
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* ── Trust Badges ── */}
            <AnimatedSection delay={0.36}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: ShieldCheck, label: '100% Authentic', subtitle: 'Genuine Products', color: 'emerald' },
                  { icon: Truck, label: `Free Delivery`, subtitle: `Over ৳${freeShippingThreshold.toLocaleString()}`, color: 'amber' },
                  { icon: RefreshCw, label: 'Easy Returns', subtitle: `${siteConfig?.returnWindowDays || 7}-Day Policy`, color: 'emerald' },
                  { icon: Lock, label: 'Secure Payment', subtitle: 'SSL Encrypted', color: 'amber' },
                ].map(({ icon: Icon, label, subtitle, color }, idx) => (
                  <motion.div
                    key={label}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30 border border-border/50 text-center group hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-300"
                    whileHover={{ y: -2 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + idx * 0.05 }}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                      color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'
                      }`} />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{subtitle}</span>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>

            {/* Delivery Info Card */}
            <AnimatedSection delay={0.38}>
              <Card className="border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
                    <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <Truck className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Free Shipping</p>
                        <p className="text-xs text-muted-foreground">Orders over ৳{freeShippingThreshold.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Quality Guaranteed</p>
                        <p className="text-xs text-muted-foreground">100% authentic products</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <RefreshCw className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Easy Returns</p>
                        <p className="text-xs text-muted-foreground">{siteConfig?.returnWindowDays || 7}-day return policy</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Share Buttons */}
            <AnimatedSection delay={0.4}>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground mr-1">Share:</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200" onClick={() => handleShare('facebook')} aria-label="Share on Facebook">
                  <Facebook className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" onClick={() => handleShare('whatsapp')} aria-label="Share on WhatsApp">
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs rounded-full" onClick={() => handleShare('copy')}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            </AnimatedSection>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer transition-colors">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FREQUENTLY BOUGHT TOGETHER
        ══════════════════════════════════════════════════════════════════════ */}
        {frequentlyBoughtTogether.length > 0 && (
          <AnimatedSection className="mt-12">
            <section>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold">Frequently Bought Together</h2>
              </div>
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-stretch gap-6">
                    {/* ── Product cards row ── */}
                    <div className="flex items-start gap-3 overflow-x-auto pb-2 scrollbar-hide flex-1">
                      {/* Current product — always selected, not deselectable */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="flex-shrink-0"
                      >
                        <div className="relative w-32 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10 p-2.5 shadow-sm">
                          <div className="absolute -top-2 -left-2 z-10">
                            <Checkbox
                              checked
                              disabled
                              className="h-5 w-5 rounded-md border-emerald-500 bg-emerald-500 text-white data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                            />
                          </div>
                          <div className="relative h-16 w-16 mx-auto rounded-lg overflow-hidden bg-muted/30">
                            <Image
                              src={images[0]?.url || '/placeholder.png'}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          </div>
                          <p className="text-sm font-medium mt-2 line-clamp-2 leading-tight h-8">{product.name}</p>
                          <p className="text-sm text-emerald-600 font-bold">৳{(effectivePrice ?? 0).toLocaleString()}</p>
                          <Badge className="mt-1.5 bg-emerald-600 text-primary-foreground text-[9px] h-4 px-1">This item</Badge>
                        </div>
                      </motion.div>

                      {/* Related products with toggles */}
                      {frequentlyBoughtTogether.map((p, idx) => {
                        const pPrice = p.discountPrice != null ? p.discountPrice : (p.price ?? 0)
                        const pImage = p.images?.[0]?.url
                        const isSelected = selectedBundleItems.has(p.id)
                        return (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.08 + idx * 0.08, ease: 'easeOut' }}
                            className="flex items-start gap-3 flex-shrink-0"
                          >
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mt-6 flex-shrink-0">
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleBundleItem(p.id)}
                              aria-pressed={isSelected}
                              className={`w-32 text-left rounded-xl border-2 p-2.5 transition-all duration-200 ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10 shadow-sm'
                                  : 'border-border/60 opacity-70 hover:opacity-100 hover:border-emerald-500/40'
                              }`}
                            >
                              <div className="flex justify-end -mt-1 mb-1">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleBundleItem(p.id)}
                                  className={`h-5 w-5 rounded-md ${
                                    isSelected
                                      ? 'border-emerald-500 bg-emerald-500 text-white data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600'
                                      : 'border-muted-foreground/40'
                                  }`}
                                />
                              </div>
                              <div className="relative h-16 w-16 mx-auto rounded-lg overflow-hidden bg-muted/30">
                                {pImage ? (
                                  <Image src={pImage} alt={p.name} fill className="object-cover" sizes="64px" />
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <Package className="h-6 w-6 text-muted-foreground/30" />
                                  </div>
                                )}
                              </div>
                              <p className="text-sm font-medium mt-2 line-clamp-2 leading-tight h-8">{p.name}</p>
                              <p className="text-sm text-emerald-600 font-bold">৳{(pPrice ?? 0).toLocaleString()}</p>
                            </button>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* ── Total + Add to cart ── */}
                    <div className="flex-shrink-0 lg:w-60 border-t lg:border-t-0 lg:border-l lg:pl-6 pt-5 lg:pt-0 flex flex-col justify-center">
                      <div className="text-center lg:text-left">
                        <p className="text-sm text-muted-foreground">
                          {selectedBundleCount} item{selectedBundleCount === 1 ? '' : 's'} selected
                        </p>
                        <p className="text-2xl font-bold text-emerald-600 leading-tight">
                          ৳{bundleTotal.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Bundle price for all selected</p>
                      </div>
                      <Button
                        onClick={handleAddBundleToCart}
                        className="h-12 w-full mt-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-base font-semibold"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Add Selected to Cart
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </AnimatedSection>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PRODUCT DETAILS TABS
        ══════════════════════════════════════════════════════════════════════ */}
        <AnimatedSection className="mt-12">
          <div ref={reviewsRef}>
            <Tabs defaultValue="description">
              <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 border-b rounded-none">
                <TabsTrigger
                  value="description"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 px-4 py-2.5 transition-colors gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  Description
                </TabsTrigger>
                <TabsTrigger
                  value="specifications"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 px-4 py-2.5 transition-colors gap-1.5"
                >
                  <ListChecks className="h-4 w-4" />
                  Specifications
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 px-4 py-2.5 transition-colors gap-1.5"
                >
                  <MessageSquare className="h-4 w-4" />
                  Reviews ({reviews.length})
                </TabsTrigger>
                <TabsTrigger
                  value="delivery"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 px-4 py-2.5 transition-colors gap-1.5"
                >
                  <Truck className="h-4 w-4" />
                  Shipping & Returns
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-6">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {product.description ? (
                    <div dangerouslySetInnerHTML={{ __html: product.description }} />
                  ) : (
                    <p className="text-muted-foreground">No detailed description available.</p>
                  )}
                </div>
                <div className="mt-8 grid sm:grid-cols-2 gap-6">
                  {product.ingredients && (
                    <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        Ingredients
                      </h3>
                      <p className="text-sm text-muted-foreground">{product.ingredients}</p>
                    </div>
                  )}
                  {product.storageInstruction && (
                    <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        Storage Instructions
                      </h3>
                      <p className="text-sm text-muted-foreground">{product.storageInstruction}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="specifications" className="mt-6">
                {allSpecs.length > 0 ? (
                  <div className="max-w-2xl rounded-lg overflow-hidden border border-border">
                    <Table>
                      <TableBody>
                        {allSpecs.map((spec, idx) => (
                          <TableRow key={idx} className={idx % 2 === 0 ? 'bg-muted/30 hover:bg-muted/40' : 'hover:bg-muted/40'}>
                            <TableCell className="font-semibold text-muted-foreground w-1/3">{spec.key}</TableCell>
                            <TableCell className="font-medium">{spec.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No specifications available.</p>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Rating Summary */}
                  <div className="space-y-4">
                    <div className="text-center p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50/50 dark:from-emerald-950/20 dark:to-amber-950/10 border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-5xl font-bold text-emerald-700 dark:text-emerald-400">{avgRating.toFixed(1)}</p>
                      <div className="flex gap-0.5 justify-center mt-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Rating Breakdown */}
                    <div className="space-y-2.5 p-4 rounded-xl border bg-background">
                      <h4 className="text-sm font-semibold mb-3">Rating Breakdown</h4>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingBreakdown[star - 1]
                        const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                        return (
                          <div key={star} className="flex items-center gap-2.5 group">
                            <span className="text-sm font-medium w-4 text-right">{star}</span>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                            <span className="text-[10px] text-muted-foreground w-10 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {isAuthenticated && (
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        Write a Review
                      </Button>
                    )}
                  </div>

                  {/* Reviews List */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Prominent "Write a Review" button at top */}
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">
                        {reviews.length > 0 ? `Customer Reviews (${reviews.length})` : 'Customer Reviews'}
                      </h3>
                      {isAuthenticated ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          <MessageSquare className="h-4 w-4 mr-1.5" />
                          Write a Review
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => navigate('login')}
                        >
                          Login to Review
                        </Button>
                      )}
                    </div>
                    {isAuthenticated && (
                      <Card id="review-form" className="shadow-sm border-emerald-100 dark:border-emerald-900/30">
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-3">Write a Review</h3>
                          <form onSubmit={handleSubmitReview} className="space-y-3">
                            <div>
                              <Label>Rating</Label>
                              <div className="flex gap-1 mt-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <motion.button
                                    key={i}
                                    type="button"
                                    onClick={() => setReviewRating(i + 1)}
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <Star className={`h-7 w-7 transition-colors ${i < reviewRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="review-comment">Comment</Label>
                              <Textarea id="review-comment" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Share your experience with this product..." className="mt-1" />
                            </div>
                            <Button type="submit" disabled={submittingReview} className="bg-emerald-600 hover:bg-emerald-700">
                              {submittingReview ? 'Submitting...' : 'Submit Review'}
                            </Button>
                          </form>
                        </CardContent>
                      </Card>
                    )}

                    {!isAuthenticated && (
                      <div className="text-center py-4 px-6 rounded-xl bg-muted/30 border">
                        <p className="text-sm text-muted-foreground mb-2">Please login to write a review</p>
                        <Button variant="outline" size="sm" onClick={() => navigate('login')} className="rounded-full">Login</Button>
                      </div>
                    )}

                    {reviews.length === 0 ? (
                      <div className="text-center py-12">
                        <Star className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-lg font-medium">No reviews yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Be the first to share your experience!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reviews.map((review, reviewIdx) => (
                          <motion.div
                            key={review.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reviewIdx * 0.05 }}
                          >
                            <Card className="shadow-sm hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                                      {(review.user?.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">{review.user?.name || 'Anonymous'}</p>
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex gap-0.5">
                                          {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                                          ))}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(review.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {review.comment && (
                                  <p className="text-sm mt-3 leading-relaxed">{review.comment}</p>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="delivery" className="mt-6">
                <div className="max-w-2xl space-y-4">
                  <div className="flex gap-4 p-5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-sm transition-shadow">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Delivery Information</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {product.deliveryNote || 'We deliver across Bangladesh. Standard delivery takes 2-5 business days depending on your location.'}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm"><span className="text-muted-foreground">Shipping charge:</span> <span className="font-medium">৳{shippingCharge}</span></p>
                        <p className="text-sm"><span className="text-muted-foreground">Free shipping on orders over:</span> <span className="font-medium text-emerald-600">৳{freeShippingThreshold.toLocaleString()}</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 p-5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 hover:shadow-sm transition-shadow">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Return & Refund Policy</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        We offer a {siteConfig?.returnWindowDays || 7}-day hassle-free return policy. If you are not satisfied with the product quality, you can initiate a return within {siteConfig?.returnWindowDays || 7} days of delivery.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-sm transition-shadow">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Quality Guarantee</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All our products are 100% authentic and sourced directly from trusted suppliers. We ensure the highest quality standards for every product we deliver.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-5 rounded-xl bg-muted/30 border hover:shadow-sm transition-shadow">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Secure Payment</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All transactions are secured with SSL encryption. We support Cash on Delivery and online payment via SSLCommerz (bKash, Nagad, Rocket, Visa, Mastercard & more).
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </AnimatedSection>

        {/* ══════════════════════════════════════════════════════════════════════
            CUSTOMERS ALSO VIEWED
        ══════════════════════════════════════════════════════════════════════ */}
        {alsoViewedProducts.length > 0 && (
          <AnimatedSection className="mt-12">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Eye className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold">Customers Also Viewed</h2>
                </div>
                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 rounded-full" onClick={() => navigate('products', { category: product.category?.slug })}>
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              {/* Mobile: horizontal scroll, Desktop: grid */}
              <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 lg:grid-cols-6 md:overflow-x-visible md:pb-0 scrollbar-hide">
                {alsoViewedProducts.map((p, idx) => (
                  <motion.div
                    key={p.id}
                    className="min-w-[180px] md:min-w-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <ProductCard product={p} />
                  </motion.div>
                ))}
              </div>
            </section>
          </AnimatedSection>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            YOU MAY ALSO LIKE (Cross-Category Recommendations)
            Surfaces products from OTHER categories than the current product
            so users can discover more of the catalog. Falls back to
            same-category products when cross-category stock is sparse.
        ══════════════════════════════════════════════════════════════════════ */}
        {relatedProducts.length > 0 && (
          <AnimatedSection className="py-10 md:py-14 bg-muted/20 -mx-4 px-4 sm:rounded-2xl">
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold">You May Also Like</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5 ml-10">
                    Discover products from other categories
                  </p>
                  <div className="ml-10 mt-2 h-1 w-16 rounded-full bg-indigo-500/60" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30 rounded-full self-start sm:self-auto"
                  onClick={() => navigate('products')}
                >
                  View All Products <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                {relatedProducts.map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <ProductCard product={p} />
                  </motion.div>
                ))}
              </div>
            </section>
          </AnimatedSection>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          STICKY ADD TO CART BAR - Mobile Only
      ══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showStickyBar && inStock && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-emerald-200/30 dark:border-emerald-800/30 shadow-2xl z-50 md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="container mx-auto px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-1">{product.name}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-emerald-600">৳{(effectivePrice ?? 0).toLocaleString()}</span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">৳{(product.price ?? 0).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center border-2 rounded-lg overflow-hidden border-emerald-200 dark:border-emerald-800 bg-background">
                  <button
                    className="h-9 w-8 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:scale-90 transition-transform"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="h-9 w-8 flex items-center justify-center text-sm font-semibold border-x border-emerald-200/50 dark:border-emerald-800/50">{quantity}</span>
                  <button
                    className="h-9 w-8 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:scale-90 transition-transform"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                    size="sm"
                    disabled={adding}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image Viewer */}
      {images.length > 0 && (
        <FullscreenViewer
          images={images}
          initialIndex={selectedImage}
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
        />
      )}

      {/* Scroll-to-top button */}
      <ScrollToTopButton />
    </div>
  )
}
