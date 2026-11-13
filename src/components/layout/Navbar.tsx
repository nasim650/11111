'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  Globe,
  ChevronDown,
  ShieldCheck,
  Package,
  LogOut,
  LayoutDashboard,
  Phone,
  Mail,
  Trash2,
  Flame,
  MapPin,
  Clock,
  TrendingUp,
  ArrowRight,
  ShoppingBag,
  ChevronRight,
  Grid3X3,
  Eye,
  Star,
  Bell,
  Tag,
  Sparkles,
  Truck,
  Headphones,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { useAppStore, type PageName } from '@/lib/store'
import { formatPrice } from '@/lib/utils'
import { extractItems } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItemChild {
  id: string
  label: string
  url: string
  icon?: string | null
  sortOrder: number
}

interface MenuItemData {
  id: string
  label: string
  url: string
  icon?: string | null
  sortOrder: number
  openInNew?: boolean
  children?: MenuItemChild[]
}

interface CategoryData {
  id: string
  name: string
  slug: string
  image?: string
  description?: string
  subcategories?: SubcategoryData[]
}

interface SubcategoryData {
  id: string
  name: string
  slug: string
  image?: string
}

interface AnnouncementBanner {
  id: string
  title: string
  subtitle?: string
  ctaText?: string
  ctaLink?: string
}

interface SearchSuggestion {
  id: string
  name: string
  slug: string
  image?: string
  price: number
  discountPrice?: number | null
  category?: { name: string; slug: string }
}

interface SuggestionCategory {
  id: string
  name: string
  slug: string
  image?: string | null
  icon?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapUrlToPage(url: string): { page: PageName; params?: Record<string, unknown> } {
  const clean = url.replace(/^\/#?/, '').replace(/\/$/, '')
  const pageMap: Record<string, PageName> = {
    '': 'home',
    home: 'home',
    products: 'products',
    categories: 'products',
    offers: 'products',
    about: 'home',
    contact: 'contact',
    cart: 'cart',
    checkout: 'checkout',
    login: 'login',
    register: 'register',
    wishlist: 'wishlist',
    profile: 'profile',
    orders: 'orders',
    faq: 'contact',
    'quality-promise': 'home',
    'delivery-policy': 'delivery-policy',
    'return-policy': 'return-policy',
    terms: 'terms',
    privacy: 'privacy',
    compare: 'products',
  }

  if (clean.startsWith('product/')) {
    return { page: 'product-detail', params: { slug: clean.split('/')[1] } }
  }
  if (clean.startsWith('category/')) {
    return { page: 'products', params: { category: clean.split('/')[1] } }
  }
  if (clean.startsWith('order/')) {
    return { page: 'order-detail', params: { id: clean.split('/')[1] } }
  }

  return { page: pageMap[clean] || 'home' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Navbar() {
  const router = useRouter()
  const {
    siteConfig,
    loadSiteConfig,
    currentPage,
    navigate,
    user,
    isAuthenticated,
    cartItems,
    totalItems,
    subtotal,
    removeFromCart,
    wishlistItems,
    isMobileMenuOpen,
    setMobileMenuOpen,
    toggleCart,
    searchQuery,
    setSearchQuery,
    logout,
  } = useAppStore()

  const [scrolled, setScrolled] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItemData[]>(defaultMenuItems)
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [announcementBanner, setAnnouncementBanner] =
    useState<AnnouncementBanner | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [suggestionCategories, setSuggestionCategories] = useState<SuggestionCategory[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [miniCartOpen, setMiniCartOpen] = useState(false)
  const [topBarVisible, setTopBarVisible] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [selectedSearchCategory, setSelectedSearchCategory] = useState<string>('all')
  const [searchCategoryOpen, setSearchCategoryOpen] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  // Hydration guard: persisted store values (cart/wishlist) come from localStorage
  // and differ between server (0) and client (persisted). Render 0 on first paint
  // to keep SSR HTML identical to the first client render, then swap to real values.
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const searchRef = useRef<HTMLDivElement>(null)
  const megaMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const miniCartRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  const itemCount = mounted ? totalItems() : 0
  const wishlistCount = mounted ? wishlistItems.length : 0
  const cartSubtotal = mounted ? subtotal() : 0
  const siteName = siteConfig?.siteName || 'Khati Khadyo'

  // ── Announcement promos ──
  const promoTexts = useMemo(() => [
    '🎉 Free Delivery on orders over ৳1,500!',
    '🔥 Use code KHATI20 for 20% off your first order!',
    '🚚 Same-day delivery in Dhaka!',
    '⭐ 100% Authentic Bangladeshi Products',
    '💰 Special prices on bulk orders',
  ], [])

  // ── Popular search categories ──
  const popularCategories = useMemo(() => [
    { name: 'Honey & Jaggery', slug: 'honey-jaggery', emoji: '🍯' },
    { name: 'Ghee & Oils', slug: 'ghee-oils', emoji: '🫕' },
    { name: 'Spices', slug: 'spices-masala', emoji: '🌶️' },
    { name: 'Rice & Grains', slug: 'rice-grains', emoji: '🍚' },
    { name: 'Tea', slug: 'tea-beverages', emoji: '🍵' },
    { name: 'Sweets', slug: 'sweets-snacks', emoji: '🍬' },
  ], [])

  // ── Scroll listener with compact mode ──
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrolled(scrollY > 10)
      setCompactMode(scrollY > 100)
      if (scrollY > 60) {
        setTopBarVisible(false)
      } else {
        setTopBarVisible(true)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // ── Close suggestions on click outside ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setShowSearchDropdown(false)
      }
      if (miniCartRef.current && !miniCartRef.current.contains(e.target as Node)) {
        setMiniCartOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Initialize recent searches from localStorage (lazy init) ──
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('kk_recent_searches')
      return saved ? JSON.parse(saved).slice(0, 5) : []
    } catch {
      return []
    }
  })

  // ── Load site config ──
  useEffect(() => {
    if (!siteConfig) loadSiteConfig()
  }, [siteConfig, loadSiteConfig])

  // ── Load categories ──
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories?isActive=true&showInMenu=true&limit=20')
        if (res.ok) {
          const json = await res.json()
          const cats = extractItems<CategoryData>(json)
          setCategories(cats)
        }
      } catch {
        // Use defaults
      }
    }
    fetchCategories()
  }, [])

  // ── Load announcement banners ──
  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const res = await fetch('/api/banners?status=active&location=announcement')
        if (res.ok) {
          const json = await res.json()
          const banners = extractItems<AnnouncementBanner>(json)
          if (banners.length > 0) setAnnouncementBanner(banners[0])
        }
      } catch {
        // No announcement
      }
    }
    fetchAnnouncements()
  }, [])

  // ── Debounced search suggestions from API (using /api/products/suggestions) ──
  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchSuggestions([])
      setSuggestionCategories([])
      return
    }
    try {
      const res = await fetch(`/api/products/suggestions?q=${encodeURIComponent(query)}&limit=5`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setSearchSuggestions(json.data.products || [])
          setSuggestionCategories(json.data.categories || [])
        } else {
          // Fallback to products API if suggestions doesn't return expected format
          const fallbackRes = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=5`)
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json()
            const items = extractItems<SearchSuggestion>(fallbackJson)
            setSearchSuggestions(items)
            setSuggestionCategories([])
          }
        }
      }
    } catch {
      setSearchSuggestions([])
      setSuggestionCategories([])
    }
  }, [])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (searchQuery.trim()) {
        const params: Record<string, unknown> = { search: searchQuery.trim() }
        if (selectedSearchCategory !== 'all') {
          params.category = selectedSearchCategory
        }
        navigate('products', params)
        setSearchOpen(false)
        setShowSuggestions(false)
        setShowSearchDropdown(false)
        // Save to recent searches
        try {
          const saved = JSON.parse(localStorage.getItem('kk_recent_searches') || '[]')
          const updated = [searchQuery.trim(), ...saved.filter((s: string) => s !== searchQuery.trim())].slice(0, 5)
          localStorage.setItem('kk_recent_searches', JSON.stringify(updated))
          setRecentSearches(updated)
        } catch {
          // ignore
        }
      }
    },
    [searchQuery, navigate, selectedSearchCategory]
  )

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (value.trim().length > 0) {
      setShowSearchDropdown(true)
      setShowSuggestions(true)
    } else {
      setShowSearchDropdown(true)
      setShowSuggestions(false)
    }
    // Debounced API call
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSearchSuggestions(value)
    }, 300)
  }, [setSearchQuery, fetchSearchSuggestions])

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    navigate('product-detail', { slug: suggestion.slug })
    setShowSuggestions(false)
    setShowSearchDropdown(false)
    setSearchOpen(false)
  }, [navigate])

  const handleRecentSearchClick = useCallback((term: string) => {
    setSearchQuery(term)
    navigate('products', { search: term })
    setShowSearchDropdown(false)
    setSearchOpen(false)
  }, [setSearchQuery, navigate])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem('kk_recent_searches')
  }, [])

  const handleNavClick = (url: string) => {
    const { page, params } = mapUrlToPage(url)
    navigate(page, params)
    setMobileMenuOpen(false)
    setCategoriesOpen(false)
    setMiniCartOpen(false)
  }

  // ── Mega menu hover handlers ──
  const handleCategoryEnter = useCallback((catId: string) => {
    if (megaMenuTimeoutRef.current) clearTimeout(megaMenuTimeoutRef.current)
    setActiveCategory(catId)
    setMegaMenuOpen(true)
  }, [])

  const handleCategoryLeave = useCallback(() => {
    megaMenuTimeoutRef.current = setTimeout(() => {
      setActiveCategory(null)
      setMegaMenuOpen(false)
    }, 200)
  }, [])

  const handleMegaMenuEnter = useCallback(() => {
    if (megaMenuTimeoutRef.current) clearTimeout(megaMenuTimeoutRef.current)
  }, [])

  const handleMegaMenuLeave = useCallback(() => {
    megaMenuTimeoutRef.current = setTimeout(() => {
      setActiveCategory(null)
      setMegaMenuOpen(false)
    }, 200)
  }, [])

  // ── Active category data for mega menu ──
  const activeCategoryData = useMemo(
    () => categories.find(c => c.id === activeCategory),
    [categories, activeCategory]
  )

  // ── Render search dropdown ──
  const renderSearchDropdown = () => {
    if (!showSearchDropdown) return null
    const hasResults = searchSuggestions.length > 0
    const hasCategoryResults = suggestionCategories.length > 0
    const hasRecent = recentSearches.length > 0
    const hasQuery = searchQuery.trim().length > 0

    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="absolute top-full left-0 right-0 mt-1.5 bg-background border rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        {/* Category matches from suggestions API */}
        {hasQuery && hasCategoryResults && (
          <div className="p-2 border-b">
            <p className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Grid3X3 className="size-3" />
              Categories
            </p>
            {suggestionCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors flex items-center gap-3 rounded-lg group"
                onClick={() => {
                  setShowSearchDropdown(false)
                  setShowSuggestions(false)
                }}
              >
                <div className="size-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {cat.image ? (
                    <img src={cat.image} alt="" className="size-full object-cover" />
                  ) : (
                    <Tag className="size-3.5 text-emerald-600" />
                  )}
                </div>
                <span className="font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{cat.name}</span>
                <ChevronRight className="size-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}

        {/* Search results */}
        {hasQuery && hasResults && (
          <div className="p-2">
            <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-3" />
              Products
            </p>
            {searchSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors flex items-center gap-3 rounded-lg group"
                onClick={() => handleSuggestionClick(item)}
              >
                <div className="size-11 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border/50 group-hover:border-emerald-200 dark:group-hover:border-emerald-800 transition-colors">
                  {item.image ? (
                    <img src={item.image} alt="" className="size-full object-cover" />
                  ) : (
                    <ShoppingBag className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{item.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold text-xs">
                      {formatPrice(item.discountPrice != null ? item.discountPrice : item.price)}
                    </span>
                    {item.discountPrice != null && item.discountPrice < item.price && (
                      <span className="text-muted-foreground text-xs line-through">
                        {formatPrice(item.price)}
                      </span>
                    )}
                    {item.category && (
                      <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                        {item.category.name}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Recent searches */}
        {!hasQuery && hasRecent && (
          <div className="p-2 border-b">
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3" />
                Recent Searches
              </p>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
              >
                Clear All
              </button>
            </div>
            {recentSearches.map((term, idx) => (
              <button
                key={`recent-${idx}`}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors flex items-center gap-2 rounded-lg group"
                onClick={() => handleRecentSearchClick(term)}
              >
                <Clock className="size-3.5 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                <span className="group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{term}</span>
                <ArrowRight className="size-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Popular categories */}
        {!hasQuery && (
          <div className="p-2">
            <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="size-3 text-amber-500" />
              Popular Categories
            </p>
            <div className="grid grid-cols-3 gap-1 px-2">
              {popularCategories.map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  className="flex items-center gap-1.5 p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all text-xs text-left group"
                  onClick={() => {
                    navigate('products', { category: cat.slug })
                    setShowSearchDropdown(false)
                  }}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span className="truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors font-medium">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {hasQuery && !hasResults && !hasCategoryResults && (
          <div className="p-8 text-center">
            <Search className="size-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No products found for &quot;{searchQuery}&quot;</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try different keywords or browse categories</p>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="mt-3 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <Link
                href="/products"
                onClick={() => setShowSearchDropdown(false)}
              >
                Browse All Products
              </Link>
            </Button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* ═══════════════════════════════════════════════════════════════════════════
          1. TOP BAR (Announcement Strip) - Desktop Only
          ═══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {topBarVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="hidden md:block overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 text-white relative">
              {/* Decorative stripe pattern */}
              <div className="absolute inset-0 opacity-[0.07]" style={{
                backgroundImage: 'repeating-linear-gradient(120deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 42px)',
              }} />
              <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between px-4 py-1.5 text-xs relative">
                {/* Single clean static announcement */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide">
                    <Truck className="size-3.5 text-amber-300" />
                    Free Delivery on orders above ৳1,500
                    <span className="text-amber-300 font-bold mx-1.5">|</span>
                    <Sparkles className="size-3.5 text-amber-300" />
                    Use Code: <span className="font-bold text-amber-300">KHATI20</span> for 20% OFF
                  </span>
                </div>

                {/* Right: Contact info + Language + Close */}
                <div className="hidden md:flex items-center gap-3 shrink-0 ml-4">
                  {siteConfig?.phone && (
                    <a
                      href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <Phone className="size-3" />
                      <span className="text-[11px] font-medium">{siteConfig.phone}</span>
                    </a>
                  )}
                  {siteConfig?.email && (
                    <a
                      href={`mailto:${siteConfig.email}`}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <Mail className="size-3" />
                      <span className="text-[11px] font-medium">{siteConfig.email}</span>
                    </a>
                  )}
                  
                  <button
                    onClick={() => setTopBarVisible(false)}
                    className="hover:opacity-80 transition-opacity ml-1 p-0.5 rounded hover:bg-white/10"
                    aria-label="Close announcement bar"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════════
          2. MAIN NAVIGATION BAR
          ═══════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        className={`bg-background transition-all duration-500 ${
          scrolled
            ? 'shadow-lg shadow-black/8 border-b border-border/50'
            : 'shadow-sm'
        }`}
        animate={{
          paddingTop: compactMode ? 0 : 0,
        }}
      >
        <div className={`w-full max-w-[1600px] mx-auto flex items-center justify-between px-4 gap-3 transition-all duration-300 ${
          compactMode ? 'py-1.5' : 'py-3'
        }`}>
          {/* ── Logo ── */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 group transition-transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label={`${siteName} - Go to homepage`}
          >
            {siteConfig?.logo ? (
              <img
                src={siteConfig.logo}
                alt={siteName}
                className={`object-contain transition-all duration-300 group-hover:drop-shadow-lg ${
                  compactMode ? 'h-7' : 'h-9'
                }`}
              />
            ) : (
              <img
                src="/all_logo.png"
                alt={siteName}
                className={`object-contain transition-all duration-300 group-hover:drop-shadow-lg ${
                  compactMode ? 'h-7' : 'h-9'
                }`}
              />
            )}
            <span className={`hidden lg:block font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors duration-300 ${
              compactMode ? 'text-base' : 'text-lg'
            }`}>
              {siteName}
            </span>
          </Link>

          {/* ── Search Bar (Desktop) ── */}
          <div className="hidden md:flex items-center flex-1 max-w-2xl mx-4 relative" ref={searchRef}>
            <form onSubmit={handleSearch} className="flex items-center w-full relative">
              {/* Category dropdown in search */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSearchCategoryOpen(!searchCategoryOpen)}
                  className={`flex items-center gap-1 border border-r-0 border-input rounded-l-xl bg-muted/40 hover:bg-muted transition-colors text-xs font-medium whitespace-nowrap ${
                    compactMode ? 'h-9 pl-3 pr-2' : 'h-11 pl-3 pr-2'
                  }`}
                >
                  <Grid3X3 className="size-3.5 text-muted-foreground" />
                  <span className="max-w-[80px] truncate">
                    {selectedSearchCategory === 'all'
                      ? 'All'
                      : categories.find(c => c.slug === selectedSearchCategory)?.name || 'All'}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>
                <AnimatePresence>
                  {searchCategoryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1.5 w-52 bg-background border rounded-xl shadow-xl z-50 py-1.5 max-h-64 overflow-y-auto"
                    >
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors font-semibold flex items-center gap-2"
                        onClick={() => { setSelectedSearchCategory('all'); setSearchCategoryOpen(false) }}
                      >
                        <Sparkles className="size-3.5 text-emerald-600" />
                        All Categories
                      </button>
                      <div className="h-px bg-border/50 mx-2 my-0.5" />
                      {categories.slice(0, 12).map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors flex items-center gap-2.5 ${
                            selectedSearchCategory === cat.slug ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-medium' : ''
                          }`}
                          onClick={() => { setSelectedSearchCategory(cat.slug); setSearchCategoryOpen(false) }}
                        >
                          {cat.image ? (
                            <img src={cat.image} alt="" className="size-5 rounded-full object-cover" />
                          ) : (
                            <div className="size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <Tag className="size-2.5 text-emerald-600" />
                            </div>
                          )}
                          {cat.name}
                          {selectedSearchCategory === cat.slug && (
                            <ChevronRight className="size-3 text-emerald-600 ml-auto" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Search input */}
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Search for products..."
                aria-label="Search products"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => {
                  setShowSearchDropdown(true)
                }}
                className={`rounded-none border-x-0 text-sm flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-emerald-400 transition-colors ${
                  compactMode ? 'h-9' : 'h-11'
                }`}
              />

              {/* Search button */}
              <Button
                type="submit"
                aria-label="Submit search"
                className={`rounded-r-xl rounded-l-none px-5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 transition-all duration-200 hover:shadow-md hover:shadow-emerald-600/20 ${
                  compactMode ? 'h-9' : 'h-11'
                }`}
              >
                <Search className="size-4" />
              </Button>
            </form>

            {/* Search dropdown */}
            <AnimatePresence>
              {showSearchDropdown && renderSearchDropdown()}
            </AnimatePresence>
          </div>

          {/* ── Right Action Icons ── */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-10 md:hidden relative"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              aria-label="Search"
            >
              <Search className="size-5" />
            </Button>

            {/* Wishlist with badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  className="size-10 relative group flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
                  onClick={() => navigate('wishlist')}
                  aria-label={`Wishlist (${wishlistCount} items)`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart className="size-5 transition-all group-hover:scale-110 group-hover:text-rose-500" />
                  {wishlistCount > 0 && (
                    <motion.span
                      key={wishlistCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.25, 1] }}
                      transition={{ duration: 0.3, times: [0, 0.6, 1] }}
                      className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center text-[10px] font-bold bg-amber-500 text-white rounded-full border-2 border-background"
                    >
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </motion.span>
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Wishlist {wishlistCount > 0 && `(${wishlistCount})`}</p>
              </TooltipContent>
            </Tooltip>

            {/* Cart with mini dropdown */}
            <div className="relative" ref={miniCartRef}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    className="size-10 relative group flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
                    onClick={() => setMiniCartOpen(!miniCartOpen)}
                    aria-label={`Shopping cart (${itemCount} items)`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ShoppingCart className="size-5 transition-all group-hover:scale-110 group-hover:text-emerald-600" />
                    {itemCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-emerald-600 text-white rounded-full border-2 border-background"
                      >
                        {itemCount}
                      </motion.span>
                    )}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Cart {itemCount > 0 && `(${formatPrice(cartSubtotal)})`}</p>
                </TooltipContent>
              </Tooltip>

              {/* ── Mini Cart Dropdown ── */}
              <AnimatePresence>
                {miniCartOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    {cartItems.length > 0 ? (
                      <>
                        {/* Cart header */}
                        <div className="p-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold flex items-center gap-1.5">
                              <ShoppingCart className="size-4 text-emerald-600" />
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                              {formatPrice(cartSubtotal)}
                            </p>
                          </div>
                        </div>
                        {/* Cart items */}
                        <div className="max-h-64 overflow-y-auto divide-y">
                          {cartItems.slice(0, 4).map((item, index) => {
                            const effectiveP = item.discountPrice != null ? item.discountPrice : item.price
                            const linePrice = effectiveP * (Number(item.quantity) || 1)
                            return (
                              <motion.div
                                key={`mini-cart-${item.productId}-${index}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group"
                              >
                                <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border/50 group-hover:border-emerald-200 dark:group-hover:border-emerald-800 transition-colors">
                                  {item.image ? (
                                    <img src={item.image} alt="" className="size-full object-cover" />
                                  ) : (
                                    <ShoppingBag className="size-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{item.productName}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                      {formatPrice(linePrice)}
                                    </span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                      ×{item.quantity}
                                    </Badge>
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                                  onClick={() => removeFromCart(item.id)}
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                </button>
                              </motion.div>
                            )
                          })}
                          {cartItems.length > 4 && (
                            <div className="px-3 py-2 text-center">
                              <p className="text-xs text-muted-foreground">
                                +{cartItems.length - 4} more items
                              </p>
                            </div>
                          )}
                        </div>
                        {/* Cart footer */}
                        <div className="p-3 border-t bg-muted/20 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatPrice(cartSubtotal)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs h-9 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              onClick={() => {
                                router.push('/cart')
                                navigate('cart')
                                setMiniCartOpen(false)
                              }}
                            >
                              View Cart
                            </Button>
                            <Button
                              size="sm"
                              className="w-full text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all"
                              onClick={() => {
                                router.push('/checkout')
                                navigate('checkout')
                                setMiniCartOpen(false)
                              }}
                            >
                              Checkout
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                          <ShoppingBag className="size-8 text-muted-foreground/30" />
                        </div>
                        <p className="font-semibold text-sm text-muted-foreground">Your cart is empty</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Add items to get started</p>
                        <Button
                          size="sm"
                          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                          onClick={() => { navigate('products'); setMiniCartOpen(false) }}
                        >
                          <ShoppingBag className="size-3.5 mr-1.5" />
                          Start Shopping
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User account dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      className="size-10 group flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
                      aria-label="User menu"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isAuthenticated && user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name || 'User'}
                          className="size-7 rounded-full object-cover ring-2 ring-emerald-200 dark:ring-emerald-800 transition-all group-hover:ring-emerald-400"
                        />
                      ) : (
                        <User className="size-5 transition-all group-hover:scale-110 group-hover:text-emerald-600" />
                      )}
                    </motion.button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isAuthenticated ? 'My Account' : 'Login / Register'}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl">
                {isAuthenticated && user ? (
                  <>
                    <DropdownMenuLabel className="font-normal p-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{user.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email || user.phone}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate('profile')}
                      className="cursor-pointer py-2.5 rounded-lg"
                    >
                      <User className="size-4 mr-2 text-emerald-600" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('orders')}
                      className="cursor-pointer py-2.5 rounded-lg"
                    >
                      <Package className="size-4 mr-2 text-emerald-600" />
                      My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('wishlist')}
                      className="cursor-pointer py-2.5 rounded-lg"
                    >
                      <Heart className="size-4 mr-2 text-rose-500" />
                      Wishlist
                      {wishlistCount > 0 && (
                        <Badge className="ml-auto text-[10px] bg-amber-100 text-amber-700 border-0 h-5">
                          {wishlistCount}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                    {user.role === 'admin' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => navigate('admin-dashboard')}
                          className="cursor-pointer py-2.5 rounded-lg"
                        >
                          <LayoutDashboard className="size-4 mr-2 text-amber-600" />
                          Admin Dashboard
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        logout()
                        navigate('home')
                      }}
                      className="cursor-pointer text-destructive focus:text-destructive py-2.5 rounded-lg"
                    >
                      <LogOut className="size-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <div className="p-4 text-center">
                      <div className="size-14 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mx-auto mb-2.5">
                        <User className="size-6 text-emerald-600" />
                      </div>
                      <p className="text-sm font-semibold">Welcome to {siteName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Sign in for the best experience</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate('login')}
                      className="cursor-pointer py-2.5 font-medium rounded-lg"
                    >
                      <User className="size-4 mr-2 text-emerald-600" />
                      Login
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('register')}
                      className="cursor-pointer py-2.5 font-medium rounded-lg"
                    >
                      <ShieldCheck className="size-4 mr-2 text-emerald-600" />
                      Create Account
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu toggle */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 lg:hidden"
                  aria-label="Open menu"
                >
                  <div className="relative w-5 h-4 flex flex-col justify-between">
                    <span className={`block h-0.5 w-5 bg-current transition-all duration-300 origin-center ${isMobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                    <span className={`block h-0.5 w-5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0 scale-0' : ''}`} />
                    <span className={`block h-0.5 w-5 bg-current transition-all duration-300 origin-center ${isMobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
                  </div>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col h-full">
                  {/* ── Mobile User Greeting ── */}
                  <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 relative overflow-hidden">
                    {/* Decorative pattern */}
                    <div className="absolute inset-0 opacity-[0.06]" style={{
                      backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }} />
                    <div className="flex items-center gap-3 relative">
                      {isAuthenticated && user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt=""
                          className="size-12 rounded-full object-cover ring-2 ring-white/30"
                        />
                      ) : (
                        <div className="size-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold shrink-0 ring-2 ring-white/30">
                          {isAuthenticated && user?.name
                            ? user.name.charAt(0).toUpperCase()
                            : '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {isAuthenticated && user ? (
                          <>
                            <p className="font-bold text-base truncate">
                              Hello, {user.name?.split(' ')[0] || 'User'}!
                            </p>
                            <p className="text-xs text-white/70 truncate mt-0.5">
                              {user.email || user.phone}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-base">Welcome!</p>
                            <p className="text-xs text-white/70">Sign in for the best experience</p>
                          </>
                        )}
                      </div>
                    </div>
                    {!isAuthenticated && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-white/30 text-white hover:bg-white/15 h-9 text-xs font-medium"
                          onClick={() => { navigate('login'); setMobileMenuOpen(false) }}
                        >
                          Login
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-white text-emerald-700 hover:bg-white/90 h-9 text-xs font-semibold"
                          onClick={() => { navigate('register'); setMobileMenuOpen(false) }}
                        >
                          Register
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ── Mobile Search ── */}
                  <div className="p-3 border-b">
                    <form onSubmit={handleSearch} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Search products..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 text-sm pl-8"
                        />
                      </div>
                      <Button type="submit" size="sm" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3">
                        <Search className="size-3.5" />
                      </Button>
                    </form>
                  </div>

                  {/* ── Mobile Quick Links ── */}
                  <div className="border-b">
                    {[
                      { icon: <ShoppingBag className="size-4" />, label: 'Home', page: 'home' as PageName },
                      { icon: <Grid3X3 className="size-4" />, label: 'Products', page: 'products' as PageName },
                      { icon: <Flame className="size-4 text-orange-500" />, label: 'Offers 🔥', page: 'products' as PageName },
                      { icon: <Heart className="size-4 text-rose-500" />, label: 'Wishlist', page: 'wishlist' as PageName },
                      { icon: <Truck className="size-4" />, label: 'Track Order', page: 'orders' as PageName },
                    ].map((link) => (
                      <button
                        key={link.page}
                        onClick={() => { navigate(link.page); setMobileMenuOpen(false) }}
                        className={`flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all duration-200 ${
                          currentPage === link.page
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/15 border-r-2 border-emerald-600'
                            : ''
                        }`}
                      >
                        <span className={`p-1.5 rounded-lg ${currentPage === link.page ? 'bg-emerald-100 dark:bg-emerald-900/30' : ''}`}>
                          {link.icon}
                        </span>
                        {link.label}
                        <ChevronRight className="size-4 ml-auto text-muted-foreground/50" />
                      </button>
                    ))}
                  </div>

                  {/* ── Mobile Category Accordion ── */}
                  <nav className="flex-1 overflow-y-auto" aria-label="Mobile navigation">
                    {categories.length > 0 && (
                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="categories" className="border-b-0">
                          <AccordionTrigger className="px-4 py-3.5 text-sm font-semibold hover:no-underline hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors">
                            <span className="flex items-center gap-3">
                              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <Grid3X3 className="size-4 text-emerald-600" />
                              </span>
                              All Categories
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-1">
                            {categories.map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  navigate('products', { category: cat.slug })
                                  setMobileMenuOpen(false)
                                }}
                                className="flex items-center gap-3 w-full px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                              >
                                <div className="size-8 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 overflow-hidden">
                                  {cat.image ? (
                                    <img src={cat.image} alt="" className="size-full object-cover rounded-lg" />
                                  ) : (
                                    <span className="text-sm">🍽️</span>
                                  )}
                                </div>
                                {cat.name}
                              </button>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}

                    {/* Menu items */}
                    {menuItems.map((item) =>
                      item.children && item.children.length > 0 ? (
                        <Accordion key={item.id} type="multiple" className="w-full">
                          <AccordionItem value={item.id} className="border-b-0">
                            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors">
                              {item.label}
                            </AccordionTrigger>
                            <AccordionContent className="pb-1">
                              {item.children.map((child) => (
                                <button
                                  key={child.id}
                                  onClick={() => handleNavClick(child.url)}
                                  className="flex items-center w-full px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                                >
                                  {child.label}
                                </button>
                              ))}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      ) : (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.url)}
                          className={`flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors ${
                            currentPage === mapUrlToPage(item.url).page
                              ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/15 border-r-2 border-emerald-600'
                              : ''
                          }`}
                        >
                          {item.label}
                        </button>
                      )
                    )}
                  </nav>

                  {/* ── Mobile Account Section ── */}
                  <div className="border-t p-4 space-y-2 bg-muted/10">
                    {isAuthenticated ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-start h-10 border-border/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-800"
                          onClick={() => { navigate('profile'); setMobileMenuOpen(false) }}
                        >
                          <User className="size-4 mr-2 text-emerald-600" />
                          My Profile
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start h-10 border-border/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-800"
                          onClick={() => { navigate('orders'); setMobileMenuOpen(false) }}
                        >
                          <Package className="size-4 mr-2 text-emerald-600" />
                          My Orders
                        </Button>
                        {user?.role === 'admin' && (
                          <Button
                            variant="outline"
                            className="w-full justify-start h-10 border-border/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-800"
                            onClick={() => { navigate('admin-dashboard'); setMobileMenuOpen(false) }}
                          >
                            <LayoutDashboard className="size-4 mr-2 text-amber-600" />
                            Admin Dashboard
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="w-full justify-start text-destructive hover:text-destructive h-10 border-destructive/20 hover:bg-destructive/5"
                          onClick={() => { logout(); navigate('home'); setMobileMenuOpen(false) }}
                        >
                          <LogOut className="size-4 mr-2" />
                          Logout
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 h-10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                          onClick={() => { navigate('login'); setMobileMenuOpen(false) }}
                        >
                          Login
                        </Button>
                        <Button
                          className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => { navigate('register'); setMobileMenuOpen(false) }}
                        >
                          Register
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* ── Mobile Search Bar (when toggled) ── */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-background">
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search for products..."
                      aria-label="Search products"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 text-sm pl-8"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" size="sm" aria-label="Submit search" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4">
                    <Search className="size-4" />
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          3. CATEGORY NAVIGATION BAR
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div
        className={`hidden lg:block bg-gradient-to-r from-emerald-800 via-emerald-800 to-emerald-900 text-white transition-all duration-300 ${
          compactMode ? 'py-0' : 'py-0'
        }`}
      >
        <div className="w-full max-w-[1600px] mx-auto flex items-center px-4 gap-1">
          {/* All Categories Button */}
          <DropdownMenu open={categoriesOpen} onOpenChange={setCategoriesOpen}>
            <DropdownMenuTrigger asChild>
              <motion.button
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-10 rounded-lg gap-2 text-sm font-semibold px-4 shrink-0 flex items-center transition-colors shadow-sm shadow-emerald-900/50"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <Menu className="size-4" />
                All Categories
                <ChevronDown className="size-3.5 ml-1" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-xl">
              {categories.slice(0, 15).map((cat) => (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => {
                    navigate('products', { category: cat.slug })
                    setCategoriesOpen(false)
                  }}
                  className="cursor-pointer py-2.5 flex items-center gap-2.5 rounded-lg"
                >
                  <div className="size-8 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {cat.image ? (
                      <img src={cat.image} alt="" className="size-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-xs">🍽️</span>
                    )}
                  </div>
                  <span className="text-sm font-medium">{cat.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { navigate('products'); setCategoriesOpen(false) }}
                className="cursor-pointer font-semibold text-emerald-700 dark:text-emerald-400 rounded-lg"
              >
                View All Categories
                <ArrowRight className="size-3.5 ml-auto" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Horizontal Category Links */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 ml-2" ref={categoryScrollRef}>
            {categories.slice(0, 8).map((cat) => (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => handleCategoryEnter(cat.id)}
                onMouseLeave={handleCategoryLeave}
              >
                <button
                  onClick={() => navigate('products', { category: cat.slug })}
                  className={`px-3 py-2.5 text-[13px] font-medium rounded-md transition-all duration-200 whitespace-nowrap relative ${
                    activeCategory === cat.id
                      ? 'bg-white/15 text-white'
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat.name}
                  {/* Active underline indicator */}
                  {activeCategory === cat.id && (
                    <motion.div
                      layoutId="categoryUnderline"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </button>
              </div>
            ))}

            {/* Offers link with flame */}
            <button
              onClick={() => navigate('products')}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-bold rounded-md text-amber-300 hover:text-amber-200 hover:bg-white/10 transition-all duration-200 whitespace-nowrap"
            >
              <Flame className="size-3.5" />
              Offers
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">HOT</span>
            </button>
          </div>

          {/* Track Order link */}
          <button
            onClick={() => navigate('orders')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 whitespace-nowrap shrink-0"
          >
            <MapPin className="size-3.5" />
            Track Order
          </button>

          {/* Help/Support link */}
          <button
            onClick={() => navigate('contact')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 whitespace-nowrap shrink-0"
          >
            <Headphones className="size-3.5" />
            Help
          </button>
        </div>
      </div>

      {/* ── Mega Menu Dropdown ── */}
      <AnimatePresence>
        {megaMenuOpen && activeCategoryData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="hidden lg:block absolute left-0 right-0 z-40 bg-background border-b shadow-2xl overflow-hidden"
            onMouseEnter={handleMegaMenuEnter}
            onMouseLeave={handleMegaMenuLeave}
          >
            <div className="w-full max-w-[1600px] mx-auto py-6">
              <div className="grid grid-cols-4 gap-8">
                {/* Category info */}
                <div className="col-span-1">
                  <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-emerald-950/40 rounded-xl p-5 text-center relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute -top-4 -right-4 size-20 rounded-full bg-emerald-200/30 dark:bg-emerald-800/20" />
                    <div className="absolute -bottom-2 -left-2 size-12 rounded-full bg-teal-200/30 dark:bg-teal-800/20" />
                    <div className="relative">
                      {activeCategoryData.image && (
                        <img
                          src={activeCategoryData.image}
                          alt={activeCategoryData.name}
                          className="size-28 mx-auto object-contain mb-3 drop-shadow-md"
                        />
                      )}
                      <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-300">
                        {activeCategoryData.name}
                      </h3>
                      {activeCategoryData.description && (
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-1 line-clamp-2">
                          {activeCategoryData.description}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-sm shadow-emerald-600/20"
                        onClick={() => {
                          navigate('products', { category: activeCategoryData.slug })
                          setMegaMenuOpen(false)
                          setActiveCategory(null)
                        }}
                      >
                        View All
                        <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Subcategory grid */}
                <div className="col-span-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Grid3X3 className="size-3" />
                    Shop by Subcategory
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {activeCategoryData.subcategories?.map((sub) => (
                      <motion.button
                        key={sub.id}
                        onClick={() => {
                          navigate('products', { category: activeCategoryData.slug, subcategory: sub.slug })
                          setMegaMenuOpen(false)
                          setActiveCategory(null)
                        }}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-left group"
                        whileHover={{ x: 4 }}
                      >
                        <div className="size-9 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 overflow-hidden group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                          {sub.image ? (
                            <img src={sub.image} alt="" className="size-full object-cover rounded-lg" />
                          ) : (
                            <span className="text-sm">📦</span>
                          )}
                        </div>
                        <span className="text-sm font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {sub.name}
                        </span>
                      </motion.button>
                    )) || (
                      // Fallback: show category name variations
                      [1, 2, 3, 4].map((i) => (
                        <button
                          key={i}
                          onClick={() => {
                            navigate('products', { category: activeCategoryData.slug })
                            setMegaMenuOpen(false)
                            setActiveCategory(null)
                          }}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-left group"
                        >
                          <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <Star className="size-3.5 text-emerald-600" />
                          </div>
                          <span className="text-sm font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {activeCategoryData.name} - Collection {i}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Featured / promotional content */}
                <div className="col-span-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Sparkles className="size-3 text-amber-500" />
                    Popular in {activeCategoryData.name}
                  </h4>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Best Sellers', desc: 'Most popular picks', icon: TrendingUp, color: 'amber' },
                      { label: 'New Arrivals', desc: 'Fresh arrivals', icon: Star, color: 'emerald' },
                      { label: 'Top Rated', desc: 'Customer favorites', icon: Eye, color: 'emerald' },
                      { label: 'Sale Items', desc: 'Great discounts', icon: Flame, color: 'rose' },
                    ].map((item, idx) => {
                      const IconComp = item.icon
                      const colorMap: Record<string, string> = {
                        amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
                        emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
                      }
                      return (
                        <motion.button
                          key={item.label}
                          onClick={() => {
                            navigate('products', { category: activeCategoryData.slug, sort: idx === 0 ? 'best-selling' : idx === 1 ? 'newest' : idx === 2 ? 'rating' : 'discount' })
                            setMegaMenuOpen(false)
                            setActiveCategory(null)
                          }}
                          className="flex items-center gap-2.5 w-full p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-left group"
                          whileHover={{ x: 4 }}
                        >
                          <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${colorMap[item.color] || colorMap.emerald}`}>
                            <IconComp className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-sm font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                              {item.label}
                            </span>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {item.desc}
                            </p>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile Floating Cart Button ── */}
      <AnimatePresence>
        {itemCount > 0 && !isMobileMenuOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
            onClick={toggleCart}
            className="lg:hidden fixed bottom-6 right-6 z-40 size-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label="Open cart"
          >
            <ShoppingCart className="size-6" />
            <Badge className="absolute -top-1 -right-1 min-w-[20px] h-[20px] p-0 flex items-center justify-center text-[10px] bg-amber-500 text-white border-2 border-white font-bold">
              {itemCount}
            </Badge>
          </motion.button>
        )}
      </AnimatePresence>
    </header>
  )
}

// ─── Default Menu Items (fallback) ───────────────────────────────────────────

const defaultMenuItems: MenuItemData[] = [
  { id: 'home', label: 'Home', url: '/', sortOrder: 0 },
  { id: 'products', label: 'Products', url: '/products', sortOrder: 1 },
  {
    id: 'categories',
    label: 'Categories',
    url: '/products',
    sortOrder: 2,
    children: [
      { id: 'cat-honey', label: 'Honey & Jaggery', url: '/category/honey-jaggery', sortOrder: 0 },
      { id: 'cat-ghee', label: 'Ghee & Oils', url: '/category/ghee-oils', sortOrder: 1 },
      { id: 'cat-rice', label: 'Rice & Grains', url: '/category/rice-grains', sortOrder: 2 },
      { id: 'cat-spices', label: 'Spices & Masala', url: '/category/spices-masala', sortOrder: 3 },
      { id: 'cat-sweets', label: 'Sweets & Snacks', url: '/category/sweets-snacks', sortOrder: 4 },
      { id: 'cat-tea', label: 'Tea & Beverages', url: '/category/tea-beverages', sortOrder: 5 },
    ],
  },
  { id: 'offers', label: 'Offers', url: '/offers', sortOrder: 3 },
  { id: 'contact', label: 'Contact', url: '/contact', sortOrder: 5 },
]
