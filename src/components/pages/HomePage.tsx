'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Truck,
  RefreshCw,
  Leaf,
  Star,
  ArrowRight,
  Sparkles,
  Clock,
  Zap,
  X,
  Smartphone,
  Flame,
  Gift,
  GripHorizontal,
  TrendingUp,
  ShoppingCart,
  Loader2,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore, type PageName } from '@/lib/store'
import { extractItems } from '@/lib/api'
import ProductCard from '@/components/shared/ProductCard'
import { toast } from 'sonner'

// ── Types ──
interface Banner {
  id: string
  title: string
  subtitle?: string
  desktopImage?: string
  mobileImage?: string
  ctaText?: string
  ctaLink?: string
  link?: string
  bgColor?: string
  location?: string
}

interface Category {
  id: string
  name: string
  slug: string
  image?: string
  icon?: string
  description?: string
  showInHome?: boolean
  bengaliName?: string
}

interface Product {
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
  isFeatured?: boolean
  shortDescription?: string
}

// Bengali category names mapping
const bengaliCategoryNames: Record<string, string> = {
  'Honey & Jaggery': 'মধু ও গুড়',
  'Ghee & Oils': 'ঘি ও তেল',
  'Rice & Grains': 'চাল ও শস্য',
  'Spices & Masala': 'মশলা',
  'Sweets & Snacks': 'মিষ্টি ও স্ন্যাকস',
  'Tea & Beverages': 'চা ও পানীয়',
  'Pickles & Chutney': 'আচার ও চাটনি',
  'Dry Fruits & Nuts': 'শুকনো ফল ও বাদাম',
  'Deshi Gur': 'দেশি গুড়',
  'Organic Products': 'জৈব পণ্য',
  'Special Combos': 'স্পেশাল কম্বো',
}

// ── Animated Section Wrapper ──
function AnimatedSection({ children, className, delay = 0, style }: {
  children: React.ReactNode
  className?: string
  delay?: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ── Flip Digit Component ──
function FlipDigit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden rounded-lg">
        <div className="bg-white text-red-600 px-2.5 py-1.5 min-w-[40px] text-center font-bold text-xl tabular-nums shadow-md">
          {value}
        </div>
        {/* Flip effect overlay */}
        <motion.div
          key={value}
          initial={{ rotateX: -90, opacity: 0.5 }}
          animate={{ rotateX: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 bg-white/60 origin-top"
        />
      </div>
      <span className="text-[9px] text-white/70 mt-0.5 font-medium">{label}</span>
    </div>
  )
}

// ── Flash Sale Countdown ──
function FlashSaleCountdown() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const getTargetTime = () => {
      const now = new Date()
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return end.getTime()
    }

    const updateCountdown = () => {
      const target = getTargetTime()
      const now = Date.now()
      const diff = Math.max(target - now, 0)

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [])

  const pad = (n: number) => n.toString().padStart(2, '0')
  const isEndingSoon = timeLeft.hours === 0 && timeLeft.minutes < 60

  return (
    <div className="flex items-center gap-2">
      {isEndingSoon && (
        <span
          className="text-[10px] font-medium bg-white/15 text-white px-2 py-0.5 rounded-full mr-1"
        >
          Ending soon
        </span>
      )}
      <div className="flex items-center gap-1">
        <FlipDigit value={pad(timeLeft.hours)} label="ঘণ্টা" />
        <span className="text-white font-bold text-xl mx-0.5 animate-pulse">:</span>
        <FlipDigit value={pad(timeLeft.minutes)} label="মিনিট" />
        <span className="text-white font-bold text-xl mx-0.5 animate-pulse">:</span>
        <FlipDigit value={pad(timeLeft.seconds)} label="সেকেন্ড" />
      </div>
    </div>
  )
}

// ── Announcement Bar ──
function AnnouncementBar({ siteConfig }: { siteConfig: import('@/lib/store').SiteConfig | null }) {
  const [isVisible, setIsVisible] = useState(true)

  // Round 3E: admin-controlled enable/disable
  if (!isVisible) return null
  if (siteConfig && siteConfig.announcementEnabled === false) return null

  // Round 3E: admin-controlled text (with safe fallbacks to existing copy)
  const announcementText = siteConfig?.announcementText || 'Selected items at special prices'
  const freeDeliveryEnabled = siteConfig ? siteConfig.freeDeliveryEnabled !== false : true
  const freeDeliveryMessage = siteConfig?.freeDeliveryMessage || 'Free Delivery on Orders Above ৳1,500'
  const promoText = siteConfig?.homepagePromoText || '100% Authentic Bangladeshi Products'

  return (
    <div className="relative bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 text-white overflow-hidden">
      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`,
          }}
        />
      </div>
      <div className="relative flex items-center">
        {/* Marquee container */}
        <div className="flex-1 overflow-hidden py-2">
          <div className="flex animate-marquee whitespace-nowrap">
            {[1, 2].map((set) => (
              <div key={set} className="flex items-center gap-8 mr-8">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  {announcementText}
                </span>
                <span className="text-amber-300 font-bold text-sm">|</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Gift className="h-3.5 w-3.5 text-amber-300" />
                  Use code <span className="bg-white/20 px-2 py-0.5 rounded font-medium text-amber-300">KHATI20</span> for 20% off
                </span>
                <span className="text-amber-300 font-bold text-sm">|</span>
                {freeDeliveryEnabled && (
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Truck className="h-3.5 w-3.5 text-amber-300" />
                    {freeDeliveryMessage}
                  </span>
                )}
                {freeDeliveryEnabled && <span className="text-amber-300 font-bold text-sm">|</span>}
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Leaf className="h-3.5 w-3.5 text-amber-300" />
                  {promoText}
                </span>
                <span className="text-amber-300 font-bold text-sm">|</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  সতেজ ও খাঁটি পণ্য — সরাসরি কৃষক থেকে
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded-full transition-colors z-10"
          aria-label="Close announcement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Hero Banner Carousel ──
function HeroBannerCarousel({ banners, navigate }: {
  banners: Banner[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  const [currentBanner, setCurrentBanner] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Parallax scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-play with progress
  useEffect(() => {
    if (banners.length <= 1 || isPaused) return

    const SLIDE_DURATION = 5000
    const TICK = 50
    let elapsed = 0

    intervalRef.current = setInterval(() => {
      elapsed += TICK
      setProgress((elapsed / SLIDE_DURATION) * 100)

      if (elapsed >= SLIDE_DURATION) {
        elapsed = 0
        setCurrentBanner((prev) => (prev + 1) % banners.length)
        setProgress(0)
      }
    }, TICK)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [banners.length, isPaused, currentBanner])

  const handlePrev = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
    setProgress(0)
  }

  const handleNext = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
    setProgress(0)
  }

  const handleDotClick = (idx: number) => {
    setCurrentBanner(idx)
    setProgress(0)
  }

  if (banners.length === 0) return null

  // Parallax offset - capped at 60px
  const parallaxOffset = Math.min(scrollY * 0.3, 60)

  return (
    <div
      className="relative h-64 sm:h-80 md:h-[440px] lg:h-[520px] overflow-hidden bg-muted"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {banners[currentBanner].desktopImage ? (
            <>
              {/* Parallax image container */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{ transform: `translateY(${parallaxOffset}px) scale(1.1)` }}
              >
                <Image
                  src={banners[currentBanner].desktopImage}
                  alt={banners[currentBanner].title}
                  fill
                  className="object-cover"
                  priority={currentBanner === 0}
                  sizes="100vw"
                />
              </div>
              {/* Gradient overlays - enhanced for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
              {/* Subtle emerald tint */}
              <div className="absolute inset-0 bg-emerald-900/10" />
              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="p-6 md:p-12 lg:p-16 max-w-2xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-3 leading-tight drop-shadow-lg">
                      {banners[currentBanner].title}
                    </h1>
                  </motion.div>
                  {banners[currentBanner].subtitle && (
                    <motion.p
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35, duration: 0.5 }}
                      className="text-sm sm:text-lg md:text-xl text-white/90 mb-6 drop-shadow max-w-lg"
                    >
                      {banners[currentBanner].subtitle}
                    </motion.p>
                  )}
                  {banners[currentBanner].ctaText && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                    >
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all hover:scale-105 rounded-full"
                        onClick={() => {
                          const banner = banners[currentBanner]
                          if (banner.ctaLink) {
                            if (banner.ctaLink.startsWith('/')) {
                              navigate('products')
                            } else {
                              window.open(banner.ctaLink, '_blank')
                            }
                          } else {
                            navigate('products')
                          }
                        }}
                      >
                        {banners[currentBanner].ctaText}
                        <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: banners[currentBanner].bgColor || '#1B4332' }}
            >
              <div className="text-center text-white px-6">
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3">
                  {banners[currentBanner].title}
                </h1>
                {banners[currentBanner].subtitle && (
                  <p className="text-base sm:text-xl opacity-90 mb-4">
                    {banners[currentBanner].subtitle}
                  </p>
                )}
                {banners[currentBanner].ctaText && (
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold mt-2 rounded-full"
                    onClick={() => {
                      const banner = banners[currentBanner]
                      if (banner.ctaLink) {
                        if (banner.ctaLink.startsWith('/')) {
                          navigate('products')
                        } else {
                          window.open(banner.ctaLink, '_blank')
                        }
                      }
                    }}
                  >
                    {banners[currentBanner].ctaText}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Carousel Controls */}
      {banners.length > 1 && (
        <>
          <button
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 bg-black/20 backdrop-blur-sm hover:bg-black/40 rounded-full p-2 md:p-3 shadow-lg transition-all hover:scale-110 z-20"
            onClick={handlePrev}
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </button>
          <button
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 bg-black/20 backdrop-blur-sm hover:bg-black/40 rounded-full p-2 md:p-3 shadow-lg transition-all hover:scale-110 z-20"
            onClick={handleNext}
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </button>
          {/* Dot indicators with progress */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                className="relative h-2.5 rounded-full transition-all duration-300 overflow-hidden"
                style={{
                  width: idx === currentBanner ? '32px' : '10px',
                }}
                onClick={() => handleDotClick(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              >
                <div className={`absolute inset-0 rounded-full ${idx === currentBanner ? 'bg-white/40' : 'bg-white/40'}`} />
                {idx === currentBanner && (
                  <motion.div
                    className="absolute inset-0 bg-white rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.05 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Mobile Swipe Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="sm:hidden absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1"
          >
            <GripHorizontal className="h-3 w-3 text-white/70" />
            <span className="text-[10px] text-white/70 font-medium">Swipe</span>
          </motion.div>
        </>
      )}
    </div>
  )
}

// ── Category Section ──
function CategorySection({ categories, navigate }: {
  categories: Category[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll, { passive: true })
    return () => { if (el) el.removeEventListener('scroll', checkScroll) }
  }, [checkScroll])

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    })
  }

  if (categories.length === 0) return null

  // Grid layout when ≤6 categories, horizontal scroll otherwise
  const useGridLayout = categories.length <= 6
  const visibleCategories = useGridLayout ? categories : categories.slice(0, 12)

  // Shared card renderer — large card in grid mode, compact in scroll mode
  const renderCard = (cat: Category, idx: number) =>
    useGridLayout ? (
      <motion.button
        key={cat.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05, duration: 0.4 }}
        className="group flex flex-col items-center text-center p-3 rounded-2xl hover:bg-emerald-50/80 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 w-full"
        onClick={() => navigate('products', { category: cat.slug })}
      >
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-50 shadow-md group-hover:shadow-xl group-hover:shadow-emerald-500/20 transition-all duration-500 ring-2 ring-transparent group-hover:ring-emerald-400/60">
          {cat.image ? (
            <Image
              src={cat.image}
              alt={cat.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-125"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-3xl">
              🍽️
            </div>
          )}
          {/* Emerald glow overlay on hover */}
          <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-all duration-500 rounded-2xl" />
        </div>
        <h3 className="font-semibold text-sm mt-3 text-center line-clamp-1 group-hover:text-emerald-700 transition-colors duration-300">
          {cat.name}
        </h3>
        {(bengaliCategoryNames[cat.name] || cat.bengaliName) && (
          <p className="text-[11px] text-emerald-600/60 text-center -mt-0.5 font-medium">
            {bengaliCategoryNames[cat.name] || cat.bengaliName}
          </p>
        )}
        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700/80 group-hover:text-emerald-700 transition-colors">
          Shop Now
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </motion.button>
    ) : (
      <motion.button
        key={cat.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05, duration: 0.4 }}
        className="group flex flex-col items-center gap-2.5 p-3 rounded-2xl hover:bg-emerald-50/80 transition-all duration-300 snap-start shrink-0 w-[100px] md:w-[120px]"
        onClick={() => navigate('products', { category: cat.slug })}
      >
        <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-50 shadow-md group-hover:shadow-xl group-hover:shadow-emerald-500/20 transition-all duration-500 ring-2 ring-transparent group-hover:ring-emerald-400/60 group-hover:scale-110">
          {cat.image ? (
            <Image
              src={cat.image}
              alt={cat.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-125"
              sizes="96px"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-3xl">
              🍽️
            </div>
          )}
          {/* Emerald glow overlay on hover */}
          <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-all duration-500 rounded-2xl" />
        </div>
        <h3 className="font-semibold text-xs md:text-sm text-center line-clamp-1 group-hover:text-emerald-700 transition-colors duration-300 tracking-tight">
          {cat.name}
        </h3>
        {(bengaliCategoryNames[cat.name] || cat.bengaliName) && (
          <p className="text-[10px] text-emerald-600/50 text-center -mt-1 font-medium">
            {bengaliCategoryNames[cat.name] || cat.bengaliName}
          </p>
        )}
      </motion.button>
    )

  return (
    <section className="py-14 bg-gradient-to-b from-emerald-50/60 via-white to-white relative">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" />

      <div className="container mx-auto px-4">
        {/* Section Header */}
        <AnimatedSection>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-amber-600 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Explore</span>
              <div className="h-[2px] w-8 bg-amber-600/30" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Shop by Category</h2>
            <p className="text-sm text-emerald-700/60 font-medium mt-1">ক্যাটাগরি অনুযায়ী কিনুন</p>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
              Discover our authentic Bangladeshi food categories, sourced directly from trusted producers
            </p>
          </div>
        </AnimatedSection>

        {useGridLayout ? (
          // Grid layout for ≤6 categories — larger, more visually appealing cards
          <AnimatedSection delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visibleCategories.map((cat, idx) => renderCard(cat, idx))}
            </div>
          </AnimatedSection>
        ) : (
          // Scrollable Category Row (>6 categories)
          <div className="relative">
            {/* Mobile scroll indicators */}
            {canScrollLeft && (
              <button
                onClick={() => handleScroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-lg rounded-full p-2 hover:bg-white transition-all -translate-x-1 hidden sm:block"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-5 w-5 text-emerald-700" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => handleScroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-lg rounded-full p-2 hover:bg-white transition-all translate-x-1 hidden sm:block"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-5 w-5 text-emerald-700" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex gap-5 md:gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {visibleCategories.map((cat, idx) => renderCard(cat, idx))}
            </div>
          </div>
        )}

        {/* View All Button */}
        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={() => navigate('products')}
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-full px-6"
          >
            View All Categories
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

// ── Deal of the Day Section ──
// Single featured product with a live HH:MM:SS countdown until midnight.
// Highlights the highest-discount product from `discountProducts`, falling back
// to the first featured product when no discounted products are available.
function DealOfTheDaySection({ product, navigate }: {
  product: Product
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  const addToCart = useAppStore((s) => s.addToCart)
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  // Stable "X% claimed" demo value (60–90%) picked once per mount
  const claimedPct = useRef<number>(Math.floor(Math.random() * 31) + 60)

  // Live countdown — tick every second until 23:59:59.999 today
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      const diff = Math.max(end.getTime() - now.getTime(), 0)
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [])

  const hasDiscount =
    product.discountPrice != null && product.discountPrice < product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0
  const effectivePrice = hasDiscount ? product.discountPrice! : product.price
  const savingsAmount = hasDiscount ? product.price - product.discountPrice! : 0
  const imageUrl = product.images?.[0]?.url || '/placeholder.png'
  const outOfStock = product.stock <= 0
  const pad = (n: number) => n.toString().padStart(2, '0')

  const handleAddToCart = async () => {
    if (adding || outOfStock) return
    setAdding(true)
    try {
      await addToCart({
        productId: product.id,
        productName: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity: 1,
        unit: product.unit,
        image: imageUrl,
        stock: product.stock,
      })
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    } finally {
      setAdding(false)
    }
  }

  const countdownUnits = [
    { label: 'Hours', value: pad(timeLeft.hours) },
    { label: 'Min', value: pad(timeLeft.minutes) },
    { label: 'Sec', value: pad(timeLeft.seconds) },
  ]

  return (
    <section className="py-8 md:py-10 bg-white">
      <div className="container mx-auto px-4">
        <AnimatedSection>
          <div className="relative rounded-3xl overflow-hidden border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 shadow-sm">
            {/* Decorative dotted pattern background */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgba(245,158,11,0.18) 1px, transparent 0)`,
                backgroundSize: '24px 24px',
              }}
            />
            {/* Floating decorative blobs */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-200/40 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-orange-200/40 rounded-full translate-y-1/2 blur-2xl pointer-events-none" />

            <div className="relative grid md:grid-cols-2 gap-6 md:gap-10 p-5 md:p-10 items-center">
              {/* ── Left column: Product image with discount badge ── */}
              <div className="relative">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="relative aspect-square w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-white shadow-xl ring-1 ring-amber-100"
                >
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  {/* Discount badge overlay */}
                  {hasDiscount && (
                    <div className="absolute top-3 left-3 bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5" />
                      {discountPercent}% OFF
                    </div>
                  )}
                  {/* Featured ribbon */}
                  <div className="absolute top-3 right-3 bg-emerald-700 text-white text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md">
                    Featured
                  </div>
                </motion.div>
              </div>

              {/* ── Right column: Details + countdown + CTAs ── */}
              <div className="flex flex-col gap-4">
                {/* "DEAL OF THE DAY" label */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="inline-flex items-center gap-1.5 self-start bg-amber-100 px-3 py-1 rounded-full"
                >
                  <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Deal of the Day
                  </span>
                </motion.div>

                {/* Product name + short description */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
                    {product.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {product.shortDescription ||
                      'Limited-time offer on this authentic Bangladeshi favorite.'}
                  </p>
                </div>

                {/* Price block */}
                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-3xl md:text-4xl font-extrabold text-emerald-700">
                    ৳{effectivePrice.toLocaleString()}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-lg text-muted-foreground line-through">
                        ৳{product.price.toLocaleString()}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs">
                        Save ৳{savingsAmount.toLocaleString()}
                      </Badge>
                    </>
                  )}
                </div>

                {/* Countdown timer (HH:MM:SS) */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Ends in
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {countdownUnits.map((unit, idx) => (
                      <div key={unit.label} className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <div className="bg-slate-900 text-white rounded-lg px-3 py-2 min-w-[56px] text-center text-2xl font-bold tabular-nums shadow-md">
                            {unit.value}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">
                            {unit.label}
                          </span>
                        </div>
                        {idx < countdownUnits.length - 1 && (
                          <span className="text-2xl font-bold text-slate-900 -mt-4">:</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stock progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-medium">Stock status</span>
                    <span className="font-semibold text-amber-700">
                      {claimedPct.current}% claimed
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-amber-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${claimedPct.current}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                    />
                  </div>
                </div>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <Button
                    size="lg"
                    onClick={handleAddToCart}
                    disabled={adding || outOfStock}
                    className="h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-2 sm:flex-1 shadow-md disabled:opacity-60"
                  >
                    {adding ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : added ? (
                      <>
                        <Check className="h-4 w-4" />
                        Added to Cart
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => navigate('product-detail', { id: product.id })}
                    className="h-12 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 hover:text-amber-900 font-semibold gap-2"
                  >
                    View Details
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}

// ── Flash Sale Section ──
function FlashSaleSection({ products, navigate, siteConfig }: {
  products: Product[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
  siteConfig: import('@/lib/store').SiteConfig | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Round 3E: admin-controlled enable/disable + title/subtitle (with safe fallbacks)
  if (siteConfig && siteConfig.flashSaleEnabled === false) return null
  if (products.length === 0) return null

  const flashSaleTitle = siteConfig?.flashSaleTitle || 'Flash Sale'
  const flashSaleSubtitle = siteConfig?.flashSaleSubtitle || 'Today'

  return (
    <section className="py-8 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white relative overflow-hidden border-y border-emerald-800/60 shadow-2xl">
      {/* Subtle gold glow accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-emerald-800/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Flame className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">{flashSaleTitle}</h2>
                <Badge className="bg-amber-400 text-emerald-950 font-bold text-xs px-2.5 py-0.5">
                  {flashSaleSubtitle}
                </Badge>
              </div>
              <p className="text-xs text-emerald-200/70 mt-0.5">Limited stock deals at discounted prices</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-emerald-900/60 backdrop-blur-md border border-emerald-700/50 rounded-2xl px-4 py-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-emerald-100 font-medium">Offer ends in:</span>
            <FlashSaleCountdown />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold rounded-full shadow-lg gap-1 px-5"
            onClick={() => navigate('products')}
          >
            View All Deals <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Product cards with deal styling */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.slice(0, 8).map((product, idx) => {
            const hasDiscount = product.discountPrice != null && product.discountPrice < product.price
            const discountPercent = hasDiscount
              ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
              : 0
            const soldCount = Math.floor(Math.random() * 70 + 30) // Simulated sold percentage
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.08, duration: 0.4 }}
                className="min-w-[200px] sm:min-w-[220px] snap-start"
              >
                <div className="relative bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow group">
                  {/* Discount Badge */}
                  {discountPercent > 20 && (
                    <div className="absolute top-2 left-2 z-20">
                      <div className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {discountPercent}% off
                      </div>
                    </div>
                  )}
                  <div className="min-w-[200px] sm:min-w-[220px]">
                    <ProductCard product={product} />
                  </div>
                  {/* Progress bar showing items sold */}
                  <div className="px-3 pb-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Sold: {soldCount}%</span>
                      <span className="text-muted-foreground">In demand</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${soldCount}%` }}
                        transition={{ delay: 0.5 + idx * 0.1, duration: 0.8 }}
                        className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Best Sellers Section ──
function BestSellersSection({ products, navigate }: {
  products: Product[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  if (products.length === 0) return null

  return (
    <AnimatedSection className="py-10 md:py-14 bg-gradient-to-b from-teal-50/50 via-white to-white">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-teal-600 mb-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Top Rated</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Best Sellers</h2>
            <p className="text-sm text-muted-foreground mt-1">Most-loved products by our customers</p>
            {/* Decorative teal underline */}
            <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-cyan-400" />
          </div>
          <Button
            variant="ghost"
            className="hidden sm:flex items-center gap-1 text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-full"
            onClick={() => navigate('products')}
          >
            View All <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {/* Mobile View All */}
        <div className="mt-6 text-center sm:hidden">
          <Button
            variant="outline"
            className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800 rounded-full px-6"
            onClick={() => navigate('products')}
          >
            View All Best Sellers <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AnimatedSection>
  )
}

// ── New Arrivals Section ──
function NewArrivalsSection({ products, navigate }: {
  products: Product[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  if (products.length === 0) return null

  return (
    <AnimatedSection className="py-10 md:py-14 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-amber-600 mb-1.5">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Just Arrived</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">New Arrivals</h2>
            <p className="text-sm text-muted-foreground mt-1">Latest additions to our authentic collection</p>
            {/* Decorative accent line */}
            <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
          </div>
          <Button
            variant="ghost"
            className="hidden sm:flex items-center gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-full"
            onClick={() => navigate('products')}
          >
            View All <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {/* Mobile View All */}
        <div className="mt-6 text-center sm:hidden">
          <Button
            variant="outline"
            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 rounded-full px-6"
            onClick={() => navigate('products')}
          >
            View All New Arrivals <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AnimatedSection>
  )
}

// ── Recently Viewed Section ──
// Uses a neutral slate accent (not emerald/amber) to distinguish from
// Featured (emerald) and New Arrivals (amber). Powered by localStorage
// via the Zustand persist store.
function RecentlyViewedSection({ products, navigate }: {
  products: Product[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  if (products.length === 0) return null

  return (
    <AnimatedSection className="py-10 md:py-14 bg-gradient-to-b from-slate-50/60 via-white to-white">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-slate-500 mb-1.5">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Recently Viewed</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Recently Viewed</h2>
            <p className="text-sm text-muted-foreground mt-1">Pick up where you left off</p>
            {/* Decorative slate underline */}
            <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-slate-400 to-slate-300" />
          </div>
          <Button
            variant="ghost"
            className="hidden sm:flex items-center gap-1 text-slate-600 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            onClick={() => navigate('products')}
          >
            View All <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {/* Mobile View All */}
        <div className="mt-6 text-center sm:hidden">
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-700 rounded-full px-6"
            onClick={() => navigate('products')}
          >
            View All Recently Viewed <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AnimatedSection>
  )
}

// ── Trust & Guarantees Section ──
function TrustSection() {
  const guarantees = [
    {
      icon: ShieldCheck,
      title: '100% Authentic',
      bengaliTitle: '১০০% খাঁটি',
      description: 'Every product is verified for authenticity. We source directly from trusted Bangladeshi producers.',
      color: 'emerald',
    },
    {
      icon: Truck,
      title: 'Fast Delivery',
      bengaliTitle: 'দ্রুত ডেলিভারি',
      description: 'Same-day delivery in Dhaka. Nationwide delivery within 2-3 business days.',
      color: 'teal',
    },
    {
      icon: RefreshCw,
      title: 'Easy Returns',
      bengaliTitle: 'সহজ রিটার্ন',
      description: '7-day hassle-free return policy. If you\'re not satisfied, we\'ll make it right.',
      color: 'amber',
    },
    {
      icon: Leaf,
      title: 'Organic & Natural',
      bengaliTitle: 'জৈব ও প্রাকৃতিক',
      description: 'Carefully selected organic products. No artificial preservatives or additives.',
      color: 'green',
    },
  ]

  const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
    emerald: { bg: 'from-emerald-100 to-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-200' },
    teal: { bg: 'from-teal-100 to-teal-50', icon: 'text-teal-600', ring: 'ring-teal-200' },
    amber: { bg: 'from-amber-100 to-amber-50', icon: 'text-amber-600', ring: 'ring-amber-200' },
    green: { bg: 'from-green-100 to-green-50', icon: 'text-green-600', ring: 'ring-green-200' },
  }

  return (
    <section className="py-14 bg-white relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
      <div className="container mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-emerald-600 mb-2">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Our Promise</span>
              <div className="h-[2px] w-8 bg-emerald-600/30" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Why Choose Khati Khadyo?</h2>
            <p className="text-sm text-emerald-700/60 font-medium mt-1">কেন খাঁটি খাদ্য বেছে নেবেন?</p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {guarantees.map((item, idx) => {
            const Icon = item.icon
            const colors = colorMap[item.color]
            return (
              <AnimatedSection key={item.title} delay={idx * 0.1}>
                <div className="group text-center p-5 md:p-6 rounded-2xl border border-border/30 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 bg-white hover:-translate-y-1">
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${colors.bg} flex items-center justify-center mx-auto mb-4 ring-2 ${colors.ring} group-hover:scale-110 transition-transform duration-300 relative`}>
                    <Icon className={`h-8 w-8 ${colors.icon}`} />
                    {/* Subtle pulse ring on hover */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl ring-2 ring-current opacity-0 group-hover:opacity-20"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    />
                  </div>
                  <h3 className="font-bold text-sm md:text-base mb-0.5">{item.title}</h3>
                  <p className="text-[11px] text-emerald-600/60 font-medium mb-2">{item.bengaliTitle}</p>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </AnimatedSection>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Mobile App CTA ──
function MobileAppCTA({ navigate }: {
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  return (
    <section className="py-14 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400 rounded-full translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-300 rounded-full -translate-x-1/4 translate-y-1/4" />
      </div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-amber-400 mb-3">
              <Smartphone className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Mobile App</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Get the Khati Khadyo App
            </h2>
            <p className="text-white/80 mb-2 max-w-lg text-sm md:text-base">
              Shop on the go! Get exclusive app-only deals, faster checkout, and real-time order tracking.
            </p>
            <p className="text-amber-300/80 text-sm mb-6">
              অ্যাপ থেকে কিনুন — এক্সক্লুসিভ ডিসকাউন্ট পান!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button
                size="lg"
                className="bg-white text-emerald-800 hover:bg-white/90 font-semibold gap-2 rounded-full h-12 px-6 shadow-lg"
                onClick={() => navigate('products')}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                App Store
              </Button>
              <Button
                size="lg"
                className="bg-white text-emerald-800 hover:bg-white/90 font-semibold gap-2 rounded-full h-12 px-6 shadow-lg"
                onClick={() => navigate('products')}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M3.18 23.49c.34.44.95.58 1.44.3L12 19.87l7.38 3.92c.49.28 1.1.14 1.44-.3.34-.44.28-1.06-.13-1.43L13 13.77V2.5c0-.83-.67-1.5-1.5-1.5S10 1.67 10 2.5v11.27L2.31 22.06c-.41.37-.47.99-.13 1.43z" />
                </svg>
                Google Play
              </Button>
            </div>
          </div>
          {/* Phone mockup */}
          <div className="flex-shrink-0 relative">
            <div className="relative w-48 h-80 md:w-56 md:h-96">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-[2rem] shadow-2xl border-4 border-white/20" />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-black/30 rounded-full" />
              <div className="absolute inset-4 rounded-[1.5rem] bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                  <Leaf className="h-10 w-10 text-white/80 mx-auto mb-2" />
                  <p className="text-white/90 font-bold text-sm">Khati Khadyo</p>
                  <p className="text-white/60 text-[10px]">খাঁটি খাদ্য</p>
                </div>
              </div>
            </div>
            {/* Floating notification */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl px-3 py-2 flex items-center gap-2"
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Gift className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-foreground">App Only!</p>
                <p className="text-[9px] text-emerald-600 font-semibold">15% Extra Off</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Seasonal Collection Section ──
function SeasonalCollectionSection({ navigate }: { navigate: (page: PageName, params?: Record<string, unknown>) => void }) {
  const collections = [
    {
      title: 'সুন্দরবনের প্রাকৃতিক মধু',
      subtitle: 'Pure Sundarbans Wild Honey',
      tag: 'Seasonal Special',
      bg: 'from-amber-50 to-orange-50 border-amber-200',
      icon: '🍯',
      link: 'honey-jaggery',
    },
    {
      title: 'কাঠের ঘানির সরিষার তেল',
      subtitle: 'Cold-Pressed Mustard Oil',
      tag: 'Traditional',
      bg: 'from-yellow-50 to-amber-50 border-yellow-200',
      icon: '🫒',
      link: 'ghee-oils',
    },
    {
      title: 'খাঁটি খেজুরের পাটালি গুড়',
      subtitle: 'Pure Date Palm Jaggery',
      tag: 'Winter Harvest',
      bg: 'from-orange-50 to-amber-100/50 border-orange-200',
      icon: '🪵',
      link: 'honey-jaggery',
    },
    {
      title: 'প্রিমিয়াম দেশি স্পেশাল কম্বো',
      subtitle: 'Organic Family Gift Pack',
      tag: 'Best Value',
      bg: 'from-emerald-50 to-teal-50 border-emerald-200',
      icon: '🎁',
      link: 'special-combos',
    },
  ]

  return (
    <AnimatedSection className="py-12 md:py-16 bg-white border-t border-emerald-100/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 mb-2 font-semibold">
            বাংলাদেশি বিশেষ কালেকশন
          </Badge>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
            Seasonal & Signature Collections
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Handcrafted traditional food essentials prepared with care
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {collections.map((item) => (
            <motion.div
              key={item.title}
              whileHover={{ y: -4 }}
              className={`p-6 rounded-2xl bg-gradient-to-br ${item.bg} border shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer`}
              onClick={() => navigate('products', { category: item.link })}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{item.icon}</span>
                  <Badge variant="outline" className="bg-white/80 backdrop-blur-sm text-[10px] font-bold">
                    {item.tag}
                  </Badge>
                </div>
                <h3 className="font-bold text-lg text-foreground line-clamp-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">{item.subtitle}</p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-xs font-bold text-emerald-800">
                Explore Collection <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  )
}

// ── Customer Reviews Section ──
function CustomerReviewsSection() {
  const reviews = [
    {
      name: 'Dr. Rafiqul Islam',
      location: 'Dhanmondi, Dhaka',
      rating: 5,
      comment: 'খাঁটি খাদ্যের আখের গুড় এবং সরিষার তেলের কোয়ালিটি সত্যিই দারুণ। পরিবারের জন্য নিয়মিত অর্ডার করি।',
      date: '2 days ago',
    },
    {
      name: 'Nusrat Jahan',
      location: 'Gulshan, Dhaka',
      rating: 5,
      comment: 'Sundarbans honey is 100% pure! Fast delivery and exceptional customer support.',
      date: '1 week ago',
    },
    {
      name: 'Mahmudul Hasan',
      location: 'Panchlaish, Chittagong',
      rating: 5,
      comment: 'পণ্য হাতে পাওয়ার পর দেখে টাকা দেয়ার সুবিধা সত্যিই ভরসা জাগায়। ঘি-এর অরিজিনাল ঘ্রাণ পাওয়া যায়।',
      date: '2 weeks ago',
    },
  ]

  return (
    <AnimatedSection className="py-12 md:py-16 bg-gradient-to-b from-stone-50 to-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-xl mx-auto mb-10">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 mb-2 font-semibold">
            গ্রাহকদের সন্তুষ্টি
          </Badge>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
            What Our Customers Say
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Over 10,000+ happy Bangladeshi families trust Khati Khadyo
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground/90 italic leading-relaxed">&ldquo;{r.comment}&rdquo;</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1">
                    {r.name}
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </h4>
                  <p className="text-[11px] text-muted-foreground">{r.location}</p>
                </div>
                <span className="text-[10px] text-muted-foreground bg-stone-100 px-2 py-0.5 rounded-full">{r.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  )
}

// ── FAQ Section ──
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      q: 'পণ্যের ১০০% খাঁটি হওয়ার নিশ্চয়তা কী?',
      a: 'আমরা সরাসরি নিবন্ধিত কৃষক ও বিশ্বস্ত প্রস্তুতকারকদের কাছ থেকে পণ্য সংগ্রহ করি। ক্ষতিকারক কেমিক্যাল বা ভেজালমুক্ত তা নিশ্চিত করতে নিজস্ব কোয়ালিটি কন্ট্রোল টিম কাজ করে।',
    },
    {
      q: 'ডেলিভারি চার্জ এবং সময় কতদিন?',
      a: 'ঢাকা সিটিতে ২৪–৪৮ ঘণ্টার মধ্যে হোম ডেলিভারি এবং ঢাকার বাইরে ২–৩ কার্যদিবসের মধ্যে পৌঁছায়। ৳১,৫০০ বা তার বেশি অর্ডারে সারা বাংলাদেশে ডেলিভারি একদম ফ্রি!',
    },
    {
      q: 'ক্যাশ অন ডেলিভারিতে পণ্য দেখে মূল্য পরিশোধ করা যাবে?',
      a: 'হ্যাঁ, আমাদের প্রতিটি অর্ডারে ক্যাশ অন ডেলিভারি (Cash on Delivery) সুবিধা রয়েছে। পণ্য হাতে পেয়ে চেক করে নেওয়ার সুযোগ রয়েছে।',
    },
    {
      q: 'পণ্য পছন্দ না হলে বা কোন সমস্যা থাকলে কীভাবে রিটার্ন করব?',
      a: 'পণ্য রিসিভ করার ২৪ ঘণ্টার মধ্যে আমাদের হেল্পলাইন বা ফেসবুক পেজে জানালে দ্রুততম সময়ে বিনামূল্যে পণ্য রিপ্লেস বা রিফান্ড দেয়া হয়।',
    },
  ]

  return (
    <AnimatedSection className="py-12 md:py-16 bg-white border-t border-stone-100">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 mb-2 font-semibold">
            সাধারণ প্রশ্ন উত্তর
          </Badge>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Everything you need to know about shopping with us</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/50 transition-colors"
              >
                <button
                  type="button"
                  className="w-full p-4 text-left font-bold text-sm md:text-base text-foreground flex items-center justify-between gap-4"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span className={`h-6 w-6 rounded-full bg-white flex items-center justify-center border text-xs transition-transform ${isOpen ? 'rotate-180 bg-emerald-50 text-emerald-700' : ''}`}>
                    ▼
                  </span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-stone-200/60 bg-white">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </AnimatedSection>
  )
}

// ── Newsletter Section ──
function NewsletterSection() {
  const [input, setInput] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      setSubscribed(true)
      toast.success('Thank you for subscribing! Check your inbox for a discount coupon.')
    }
  }

  return (
    <section className="py-12 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
        <Sparkles className="h-8 w-8 text-amber-400 mx-auto mb-3" />
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">
          বিশেষ অফার ও ডিসকাউন্ট পেতে সাবস্ক্রাইব করুন
        </h2>
        <p className="text-emerald-100/80 text-sm max-w-xl mx-auto mb-6">
          Subscribe to our newsletter to receive exclusive offers, new arrivals, and purity guarantee updates.
        </p>

        {subscribed ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 inline-flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Check className="h-5 w-5" /> You are subscribed! Discount code: KHATI20
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Input
              type="text"
              placeholder="Enter your email or phone"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="bg-white text-foreground h-12 rounded-full px-5 placeholder:text-muted-foreground text-sm flex-1 shadow-md border-0"
            />
            <Button type="submit" className="h-12 px-7 rounded-full bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold shadow-lg">
              Subscribe
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}

// ── Loading Skeleton ──
function HomeLoadingSkeleton() {
  return (
    <div className="space-y-0">
      {/* Announcement bar skeleton */}
      <Skeleton className="h-9 w-full rounded-none" />
      {/* Hero skeleton */}
      <Skeleton className="h-64 md:h-[440px] w-full rounded-none" />
      {/* Search skeleton */}
      <div className="py-8 px-4">
        <Skeleton className="h-12 max-w-2xl mx-auto rounded-full" />
      </div>
      {/* Category skeleton */}
      <div className="py-14">
        <div className="container mx-auto px-4">
          <div className="flex gap-5 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-2xl" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Flash sale skeleton */}
      <Skeleton className="h-72 w-full rounded-none" />
      {/* Products skeleton */}
      <div className="py-14">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──
export default function HomePage() {
  const { navigate, setSearchQuery, siteConfig } = useAppStore()
  const recentlyViewed = useAppStore((s) => s.recentlyViewed || [])
  const [heroBanners, setHeroBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [discountProducts, setDiscountProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [recentProducts, setRecentProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAll() {
      try {
        const [bannersRes, catsRes, prodsRes] = await Promise.all([
          fetch('/api/banners'),
          fetch('/api/categories'),
          fetch('/api/products?limit=50'),
        ])

        if (bannersRes.ok) {
          const bData = await bannersRes.json()
          setHeroBanners(extractItems<Banner>(bData))
        }
        if (catsRes.ok) {
          const cData = await catsRes.json()
          setCategories(extractItems<Category>(cData))
        }
        if (prodsRes.ok) {
          const pData = await prodsRes.json()
          const allProds = extractItems<Product>(pData)

          setFeaturedProducts(allProds.filter((p) => p.isFeatured || p.status === 'active').slice(0, 8))
          setDiscountProducts(allProds.filter((p) => p.discountPrice != null && p.discountPrice < p.price))
          setBestSellers(allProds.filter((p) => p.isBestSeller).slice(0, 8))
          setNewArrivals(allProds.filter((p) => p.isNewArrival).slice(0, 8))
        }
      } catch (error) {
        console.error('Failed to load homepage data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  useEffect(() => {
    if (!recentlyViewed || recentlyViewed.length === 0) {
      setRecentProducts([])
      return
    }
    let cancelled = false
    const ids = recentlyViewed.slice(0, 4)
    Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/products/${id}`)
          .then((r) => r.json())
          .then((d) => (d?.data ?? d) as Product | null)
      )
    ).then((results) => {
      if (cancelled) return
      const valid = results
        .filter((r): r is PromiseFulfilledResult<Product> =>
          r.status === 'fulfilled' && Boolean(r.value)
        )
        .map((r) => r.value)
      setRecentProducts(valid)
    })
    return () => {
      cancelled = true
    }
  }, [recentlyViewed])

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query)
    navigate('products')
  }

  const dealProduct = useMemo<Product | null>(() => {
    if (discountProducts.length > 0) {
      const discountPct = (p: Product) =>
        p.discountPrice != null && p.discountPrice < p.price
          ? (p.price - p.discountPrice) / p.price
          : 0
      return [...discountProducts].sort(
        (a, b) => discountPct(b) - discountPct(a)
      )[0]
    }
    if (featuredProducts.length > 0) return featuredProducts[0]
    return null
  }, [discountProducts, featuredProducts])

  if (loading) {
    return <HomeLoadingSkeleton />
  }

  return (
    <div className="min-h-screen bg-stone-50/30 text-foreground">
      {/* ── 1. Announcement Bar ── */}
      <AnnouncementBar siteConfig={siteConfig} />

      {/* ── 2. Search Bar ── */}
      <div className="bg-gradient-to-b from-emerald-50/40 to-transparent py-6 md:py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const input = form.querySelector('input') as HTMLInputElement
              if (input.value.trim()) handleSearchSubmit(input.value)
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
              <Input
                placeholder="Search for authentic Bangladeshi food products..."
                className="pl-11 h-12 bg-white shadow-md border-emerald-200/50 focus:border-emerald-400 rounded-full text-sm"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 px-6 shadow-md bg-emerald-700 hover:bg-emerald-800 rounded-full text-white font-bold"
            >
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* ── 3. Large Hero Banner Carousel ── */}
      <HeroBannerCarousel banners={heroBanners} navigate={navigate} />

      {/* ── 4. Featured Categories (Large Premium Cards, Bengali Primary) ── */}
      <CategorySection categories={categories} navigate={navigate} />

      {/* ── 5. Flash Sale (Elegantly Redesigned Dark Forest Theme) ── */}
      <FlashSaleSection products={discountProducts} navigate={navigate} siteConfig={siteConfig} />

      {/* ── 6. Featured Products ── */}
      {featuredProducts.length > 0 && (
        <AnimatedSection className="py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-6 md:mb-8">
              <div>
                <div className="inline-flex items-center gap-2 text-emerald-600 mb-1.5">
                  <Star className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Handpicked</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">Featured Products</h2>
                <p className="text-sm text-muted-foreground mt-1">Premium picks our customers love</p>
                <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
              </div>
              <Button
                variant="ghost"
                className="hidden sm:flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-full"
                onClick={() => navigate('products')}
              >
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {featuredProducts.map((p: Product) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* ── 7. Best Sellers ── */}
      <BestSellersSection products={bestSellers} navigate={navigate} />

      {/* ── 8. Deal of the Day ── */}
      {dealProduct && (
        <DealOfTheDaySection product={dealProduct} navigate={navigate} />
      )}

      {/* ── 9. Seasonal Collection ── */}
      <SeasonalCollectionSection navigate={navigate} />

      {/* ── 10. Why Choose Khati Khadyo (Trust Pillars) ── */}
      <TrustSection />

      {/* ── 11. Customer Reviews ── */}
      <CustomerReviewsSection />

      {/* ── 12. Frequently Asked Questions (FAQ Accordion) ── */}
      <FAQSection />

      {/* ── 13. Newsletter & Mobile App Download ── */}
      <NewsletterSection />
      <MobileAppCTA navigate={navigate} />
    </div>
  )
}
