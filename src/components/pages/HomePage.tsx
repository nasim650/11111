'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Leaf,
  ArrowRight,
  Flame,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore, type PageName } from '@/lib/store'
import { extractItems } from '@/lib/api'
import ProductCard from '@/components/shared/ProductCard'

// ── Types ──
interface Banner {
  id: string
  title: string
  subtitle?: string
  desktopImage?: string
  mobileImage?: string
  ctaText?: string
  ctaLink?: string
  bgColor?: string
}

interface Category {
  id: string
  name: string
  slug: string
  image?: string
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
}

interface ReviewItem {
  id: string
  rating: number
  comment?: string | null
  createdAt: string
  isVerified?: boolean
  user?: {
    name?: string | null
  } | null
}

// ── 1. Hero Section ──
function HeroSection({ banners, navigate }: {
  banners: Banner[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) {
    // Clean default brand hero
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 text-white py-14 md:py-20">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-200 text-xs font-semibold border border-emerald-700/60">
              <Leaf className="h-3.5 w-3.5 text-emerald-300" /> খাঁটি ও প্রাকৃতিক খাদ্য পণ্য
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              সরাসরি খামার থেকে <br />
              <span className="text-emerald-300">বিশুদ্ধ খাদ্য সামগ্রী</span>
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-xl">
              খাঁটি মধু, কাঠের ঘানির সরিষার তেল, গাওয়া ঘি এবং প্রিমিয়াম দেশি মশলা — স্বাস্থ্যসম্মত উপায়ে আপনার ঘরে পৌঁছে দিচ্ছি।
            </p>
            <div className="pt-2">
              <Button
                size="lg"
                onClick={() => navigate('products')}
                className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold px-7 h-12 rounded-full shadow-lg transition-transform hover:scale-[1.02]"
              >
                সব পণ্য দেখুন <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const current = banners[index]

  return (
    <section className="relative h-64 sm:h-80 md:h-[420px] lg:h-[480px] overflow-hidden bg-stone-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id || index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {current.desktopImage ? (
            <Image
              src={current.desktopImage}
              alt={current.title}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: current.bgColor || '#064e3b' }}
            />
          )}
          {/* Subtle contrast gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/60 to-transparent" />
          
          {/* Content */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-xl text-white space-y-4">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight line-clamp-2 drop-shadow-md">
                  {current.title}
                </h1>
                {current.subtitle && (
                  <p className="text-xs sm:text-base md:text-lg text-stone-200 line-clamp-2 drop-shadow max-w-md">
                    {current.subtitle}
                  </p>
                )}
                <div>
                  <Button
                    size="lg"
                    onClick={() => {
                      if (current.ctaLink && current.ctaLink.startsWith('http')) {
                        window.open(current.ctaLink, '_blank')
                      } else {
                        navigate('products')
                      }
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold px-6 h-11 sm:h-12 rounded-full shadow-lg"
                  >
                    {current.ctaText || 'অর্ডার করুন'} <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide Navigation Controls */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setIndex((prev) => (prev - 1 + banners.length) % banners.length)}
            aria-label="Previous slide"
            className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIndex((prev) => (prev + 1) % banners.length)}
            aria-label="Next slide"
            className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  )
}

// ── 2. Key Categories ──
function CategoriesSection({ categories, navigate }: {
  categories: Category[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
}) {
  if (categories.length === 0) return null

  return (
    <section className="py-8 md:py-12 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
              জনপ্রিয় ক্যাটাগরি
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">প্রাকৃতিক ও বিশুদ্ধ পণ্যের সমাহার</p>
          </div>
          <Link
            href="/products"
            className="text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded"
          >
            সব দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
          {categories.slice(0, 8).map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${encodeURIComponent(cat.slug)}`}
              className="group flex flex-col items-center text-center p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-stone-200/60 dark:border-stone-800 hover:border-emerald-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden bg-white dark:bg-stone-800 p-2 mb-2 shadow-xs group-hover:scale-105 transition-transform flex items-center justify-center">
                {cat.image ? (
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-contain p-1"
                    sizes="64px"
                  />
                ) : (
                  <span className="text-2xl">🍯</span>
                )}
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 group-hover:text-emerald-700 transition-colors line-clamp-1">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 3. Flash Sale (Conditional) ──
function FlashSaleSection({ products, navigate, siteConfig }: {
  products: Product[]
  navigate: (page: PageName, params?: Record<string, unknown>) => void
  siteConfig: any
}) {
  if (products.length === 0) return null

  return (
    <section className="py-8 bg-stone-900 text-white">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-stone-950 text-xs font-bold">
              <Flame className="h-3.5 w-3.5" /> স্পেশাল অফার
            </span>
            <span className="text-sm font-semibold text-stone-300 hidden sm:inline">সীমিত সময়ের বিশেষ মূল্যছাড়</span>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            অফারের সব পণ্য <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.slice(0, 5).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 4. Brand & Trust Pillars (1 Single Concise Section) ──
function TrustPillarsSection() {
  const pillars = [
    {
      icon: ShieldCheck,
      title: '১০০% খাঁটি ও নিরাপদ',
      desc: 'কোনো কৃত্রিম রং বা ক্ষতিকর প্রিজারভেটিভ নেই। সরাসরি বিশ্বস্ত উৎপাদনকারী থেকে সংগৃহীত।',
    },
    {
      icon: Truck,
      title: 'দ্রুত ও নিরাপদ ডেলিভারি',
      desc: 'ঢাকা ও সারাদেশের যেকোনো প্রান্তে দ্রুত এবং যত্নসহকারে পণ্য ডেলিভারি সম্পন্ন করা হয়।',
    },
    {
      icon: RotateCcw,
      title: 'সহজ রিটার্ন গ্যারান্টি',
      desc: 'পণ্যের গুণমানে কোনো সংশয় থাকলে দ্রুত অভিযোগ গ্রহণ ও সমাধানের নিশ্চয়তা।',
    },
    {
      icon: CheckCircle2,
      title: 'সহজ ও নিরাপদ পেমেন্ট',
      desc: 'ক্যাশ অন ডেলিভারিতে দেখে মূল্য পরিশোধ অথবা নিরাপদ ডিজিটাল পেমেন্ট সুবিধা।',
    },
  ]

  return (
    <section className="py-10 md:py-14 bg-stone-50 dark:bg-stone-950/60 border-y border-stone-200/60 dark:border-stone-800">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
            কেন খাঁটি খাদ্য বেছে নেবেন?
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            পরিবারের সুস্থতা ও পুষ্টি নিশ্চিত করতে আমাদের বিশেষ অঙ্গীকার
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col items-center text-center space-y-2.5"
              >
                <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── 5. Real Customer Reviews (Zero Fake Reviews) ──
function CustomerReviewsSection() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function loadReviews() {
      try {
        const res = await fetch('/api/reviews?limit=3')
        if (res.ok) {
          const json = await res.json()
          const items = extractItems<ReviewItem>(json).filter((r) => r.comment && r.comment.trim())
          if (active) setReviews(items)
        }
      } catch {
        if (active) setReviews([])
      } finally {
        if (active) setLoading(false)
      }
    }
    loadReviews()
    return () => {
      active = false
    }
  }, [])

  // If no approved real reviews exist in database, do not render this section (strict no fake reviews rule)
  if (loading || reviews.length === 0) return null

  return (
    <section className="py-10 md:py-14 bg-white dark:bg-stone-900 border-b border-stone-200/60 dark:border-stone-800">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
            গ্রাহকদের সন্তুষ্টি ও মতামত
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">আমাদের নিয়মিত গ্রাহকদের প্রকৃত অভিজ্ঞতা</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: r.rating || 5 }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 italic leading-relaxed">
                  &ldquo;{r.comment}&rdquo;
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200/60 dark:border-stone-700/60 text-xs font-semibold text-stone-900 dark:text-white">
                {r.user?.name || 'ভেরিফাইড ক্রেতা'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 6. Compact Final CTA Banner ──
function FinalCtaSection({ navigate }: { navigate: (page: PageName) => void }) {
  return (
    <section className="py-10 bg-emerald-950 text-white">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          খাঁটি খাদ্যের নিশ্চয়তা আপনার দরজায়
        </h2>
        <p className="text-xs sm:text-sm text-emerald-200/80 max-w-lg mx-auto">
          আজই অর্ডার করুন এবং উপভোগ করুন ১০০% বিশুদ্ধ দেশি খাদ্যপণ্যের আসল স্বাদ ও পুষ্টি।
        </p>
        <div className="pt-2">
          <Button
            size="lg"
            onClick={() => navigate('products')}
            className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold px-8 h-12 rounded-full shadow-lg"
          >
            পণ্যসমূহ দেখুন ও অর্ডার করুন <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </section>
  )
}

// ── Main HomePage Component ──
export default function HomePage() {
  const { navigate, siteConfig } = useAppStore()
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [flashProducts, setFlashProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function loadData() {
      try {
        const [bannersRes, catsRes, prodsRes] = await Promise.all([
          fetch('/api/banners?isActive=true'),
          fetch('/api/categories?isActive=true&limit=12'),
          fetch('/api/products?limit=24&status=active'),
        ])

        if (bannersRes.ok && active) {
          const b = await bannersRes.json()
          setBanners(extractItems<Banner>(b))
        }
        if (catsRes.ok && active) {
          const c = await catsRes.json()
          setCategories(extractItems<Category>(c))
        }
        if (prodsRes.ok && active) {
          const p = await prodsRes.json()
          const items = extractItems<Product>(p)
          setFeaturedProducts(items.slice(0, 10))

          // Flash sale parsing
          if (siteConfig?.flash_sale) {
            try {
              const cfg = JSON.parse(siteConfig.flash_sale)
              if (cfg.enabled && cfg.productIds?.length > 0) {
                const flash = cfg.productIds
                  .map((id: string) => items.find((prod) => prod.id === id))
                  .filter(Boolean) as Product[]
                setFlashProducts(flash)
              }
            } catch {
              setFlashProducts([])
            }
          }
        }
      } catch (e) {
        console.error('Home load error:', e)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [siteConfig?.flash_sale])

  if (loading) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 py-8 space-y-8 animate-pulse">
        <Skeleton className="h-64 sm:h-80 w-full rounded-2xl" />
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 flex flex-col">
      {/* 1. Clean Hero Section */}
      <HeroSection banners={banners} navigate={navigate} />

      {/* 2. Key Categories */}
      <CategoriesSection categories={categories} navigate={navigate} />

      {/* 3. Flash Sale (if active) */}
      {flashProducts.length > 0 && (
        <FlashSaleSection products={flashProducts} navigate={navigate} siteConfig={siteConfig} />
      )}

      {/* 4. Featured / Best Selling Products */}
      {featuredProducts.length > 0 && (
        <section className="py-8 md:py-14 bg-white dark:bg-stone-900">
          <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
                  জনপ্রিয় ও নির্বাচিত পণ্য
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">আমাদের সর্বাধিক সমাদৃত খাঁটি খাদ্য সামগ্রী</p>
              </div>
              <Link
                href="/products"
                className="text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded"
              >
                সব পণ্য দেখুন <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
              {featuredProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. One Concise Trust Pillars Section */}
      <TrustPillarsSection />

      {/* 6. Real Customer Reviews (Zero fake reviews) */}
      <CustomerReviewsSection />

      {/* 7. Compact Final CTA */}
      <FinalCtaSection navigate={navigate} />
    </div>
  )
}
