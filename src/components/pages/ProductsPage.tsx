'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import {
  SlidersHorizontal, Grid3X3, List, ChevronRight, ChevronLeft, ChevronDown,
  X, Home, Search, Package, ShoppingBag, Leaf, Mic, Star, StarHalf,
  RotateCcw, LayoutGrid, Columns3, Loader2, ArrowUpDown, Clock, TrendingUp,
  Heart
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { extractItems, extractPagination } from '@/lib/api'
import ProductCard from '@/components/shared/ProductCard'
import { toast } from 'sonner'

// ── Types ──

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
  subcategory?: { name: string; slug: string }
  origin?: string
  status?: string
  isNewArrival?: boolean
  isBestSeller?: boolean
  isFeatured?: boolean
  avgRating?: number
  reviewCount?: number
  discountPercentage?: number
  shortDescription?: string
}

interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  bannerImage?: string | null
  icon?: string | null
  subcategories?: Array<{ id: string; name: string; slug: string }>
  _count?: { products: number }
}

interface Subcategory {
  id: string
  name: string
  slug: string
  categoryId: string
}

// ── Constants ──

const ORIGINS = ['Bangladesh', 'India', 'Pakistan', 'Sri Lanka', 'Nepal', 'Myanmar', 'Thailand', 'Middle East']
const DISCOUNT_OPTIONS = [
  { label: '10% or more', value: 10 },
  { label: '20% or more', value: 20 },
  { label: '30% or more', value: 30 },
  { label: '50% or more', value: 50 },
]
const RATING_OPTIONS = [
  { label: '4', value: 4 },
  { label: '3', value: 3 },
  { label: '2', value: 2 },
  { label: '1', value: 1 },
]
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'best_selling', label: 'Best Selling' },
  { value: 'rating', label: 'Top Rated' },
]
const POPULAR_SEARCHES = ['Rice', 'Mustard Oil', 'Spices', 'Honey', 'Tea', 'Lentils', 'Pickles', 'Flour']
const PAGE_SIZE = 12

// ── Star Rating Display ──

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i))
        if (fill >= 1) return <Star key={i} className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} />
        if (fill >= 0.5) return <StarHalf key={i} className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} />
        return <Star key={i} className="text-gray-200" style={{ width: size, height: size }} />
      })}
    </div>
  )
}

// ── Main Component ──

export default function ProductsPage() {
  const { navigate, pageParams, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } = useAppStore()

  // ── State ──
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Filters
  const [sort, setSort] = useState('relevance')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000])
  const [appliedPriceRange, setAppliedPriceRange] = useState<[number, number]>([0, 5000])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([])
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([])
  const [minRating, setMinRating] = useState(0)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [minDiscount, setMinDiscount] = useState(0)

  // UI State
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(3)
  const [searchInput, setSearchInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Collapsible filter sections
  const [categoryOpen, setCategoryOpen] = useState(true)
  const [priceOpen, setPriceOpen] = useState(true)
  const [ratingOpen, setRatingOpen] = useState(true)
  const [originOpen, setOriginOpen] = useState(true)
  const [discountOpen, setDiscountOpen] = useState(false)

  // Price range debounce
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Search debounce
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // ── Initialize from page params ──
  useEffect(() => {
    if (pageParams?.category) {
      setSelectedCategories([String(pageParams.category)])
      setSelectedCategory(String(pageParams.category))
    }
    if (pageParams?.sort) {
      setSort(String(pageParams.sort))
    }
    if (pageParams?.search || searchQuery) {
      const q = String(pageParams.search || searchQuery)
      setSearchInput(q)
      setSearchQuery(q)
    }
  }, [pageParams, searchQuery, setSearchQuery, setSelectedCategory])

  // ── Load recent searches from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kk_recent_searches')
      if (saved) setRecentSearches(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // ── Load categories with subcategories ──
  useEffect(() => {
    fetch('/api/categories?limit=100')
      .then((res) => res.json())
      .then((data) => {
        const cats = extractItems<Category>(data)
        setCategories(cats)
      })
      .catch(() => {})
  }, [])

  // ── Price range slider change with debounce ──
  const handlePriceChange = useCallback((val: number[]) => {
    setPriceRange(val as [number, number])
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current)
    priceDebounceRef.current = setTimeout(() => {
      setAppliedPriceRange(val as [number, number])
      setPage(1)
    }, 500)
  }, [])

  // ── Search with debounce ──
  const handleSearchInput = useCallback((val: string) => {
    setSearchInput(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(val)
      setPage(1)
    }, 300)
  }, [setSearchQuery])

  // ── Save search to recent ──
  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return
    setRecentSearches((prev) => {
      const updated = [term, ...prev.filter((s) => s !== term)].slice(0, 8)
      try { localStorage.setItem('kk_recent_searches', JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
  }, [])

  // ── Clear recent searches ──
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    try { localStorage.removeItem('kk_recent_searches') } catch { /* ignore */ }
  }, [])

  // ── Submit search ──
  const handleSearchSubmit = useCallback(() => {
    if (searchInput.trim()) {
      saveRecentSearch(searchInput.trim())
    }
    setSearchQuery(searchInput)
    setShowSuggestions(false)
    setPage(1)
  }, [searchInput, setSearchQuery, saveRecentSearch])

  // ── Clear search ──
  const clearSearch = useCallback(() => {
    setSearchInput('')
    setSearchQuery('')
    setShowSuggestions(false)
    setPage(1)
  }, [setSearchQuery])

  // ── Toggle category ──
  const toggleCategory = useCallback((slug: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(slug)) return prev.filter((c) => c !== slug)
      return [...prev, slug]
    })
    setSelectedSubcategories([]) // Clear subcategories when category changes
    setPage(1)
  }, [])

  // ── Category chip navigation (quick switching) ──
  const handleCategoryChipClick = useCallback((slug: string | null) => {
    if (slug) {
      // Navigate to products page with the selected category.
      // The pageParams effect (below) will sync selectedCategories state.
      navigate('products', { category: slug })
      setPage(1)
    } else {
      // "All" chip — clear category filter and navigate without a category param.
      setSelectedCategories([])
      setSelectedSubcategories([])
      setSelectedCategory('')
      navigate('products', {})
      setPage(1)
    }
  }, [navigate, setSelectedCategory])

  // ── Toggle subcategory ──
  const toggleSubcategory = useCallback((slug: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
    setPage(1)
  }, [])

  // ── Toggle origin ──
  const toggleOrigin = useCallback((origin: string) => {
    setSelectedOrigins((prev) =>
      prev.includes(origin) ? prev.filter((o) => o !== origin) : [...prev, origin]
    )
    setPage(1)
  }, [])

  // ── Set rating ──
  const handleSetRating = useCallback((rating: number) => {
    setMinRating((prev) => prev === rating ? 0 : rating)
    setPage(1)
  }, [])

  // ── Set discount ──
  const handleSetDiscount = useCallback((discount: number) => {
    setMinDiscount((prev) => prev === discount ? 0 : discount)
    setPage(1)
  }, [])

  // ── Clear all filters ──
  const clearFilters = useCallback(() => {
    setSelectedCategories([])
    setSelectedSubcategories([])
    setPriceRange([0, 5000])
    setAppliedPriceRange([0, 5000])
    setMinRating(0)
    setSelectedOrigins([])
    setInStockOnly(false)
    setMinDiscount(0)
    setSort('relevance')
    setSearchQuery('')
    setSearchInput('')
    setSelectedCategory('')
    setPage(1)
  }, [setSearchQuery, setSelectedCategory])

  // ── Active filter count ──
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedCategories.length > 0) count++
    if (selectedSubcategories.length > 0) count++
    if (appliedPriceRange[0] > 0 || appliedPriceRange[1] < 5000) count++
    if (minRating > 0) count++
    if (selectedOrigins.length > 0) count++
    if (inStockOnly) count++
    if (minDiscount > 0) count++
    if (searchQuery) count++
    return count
  }, [selectedCategories, selectedSubcategories, appliedPriceRange, minRating, selectedOrigins, inStockOnly, minDiscount, searchQuery])

  // ── Build active filter chips ──
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
    selectedCategories.forEach((slug) => {
      const cat = categories.find((c) => c.slug === slug)
      chips.push({ key: `cat-${slug}`, label: cat?.name || slug, onRemove: () => toggleCategory(slug) })
    })
    selectedSubcategories.forEach((slug) => {
      const cat = categories.find((c) => c.subcategories?.some((s) => s.slug === slug))
      const subcat = cat?.subcategories?.find((s) => s.slug === slug)
      chips.push({ key: `subcat-${slug}`, label: subcat?.name || slug, onRemove: () => toggleSubcategory(slug) })
    })
    if (appliedPriceRange[0] > 0 || appliedPriceRange[1] < 5000) {
      chips.push({
        key: 'price',
        label: `৳${appliedPriceRange[0]} – ৳${appliedPriceRange[1]}`,
        onRemove: () => { setPriceRange([0, 5000]); setAppliedPriceRange([0, 5000]); setPage(1) },
      })
    }
    if (minRating > 0) {
      chips.push({
        key: 'rating',
        label: `${minRating}+ Stars`,
        onRemove: () => { setMinRating(0); setPage(1) },
      })
    }
    selectedOrigins.forEach((origin) => {
      chips.push({ key: `origin-${origin}`, label: origin, onRemove: () => toggleOrigin(origin) })
    })
    if (inStockOnly) {
      chips.push({ key: 'instock', label: 'In Stock Only', onRemove: () => { setInStockOnly(false); setPage(1) } })
    }
    if (minDiscount > 0) {
      chips.push({ key: 'discount', label: `${minDiscount}%+ Off`, onRemove: () => { setMinDiscount(0); setPage(1) } })
    }
    if (searchQuery) {
      chips.push({ key: 'search', label: `"${searchQuery}"`, onRemove: clearSearch })
    }
    return chips
  }, [selectedCategories, selectedSubcategories, appliedPriceRange, minRating, selectedOrigins, inStockOnly, minDiscount, searchQuery, categories, toggleCategory, toggleSubcategory, toggleOrigin, clearSearch])

  // ── Load products ──
  const loadProducts = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('page', String(pageNum))
      params.set('limit', String(PAGE_SIZE))
      params.set('status', 'active')

      // Sort
      if (sort === 'relevance' || sort === 'rating') {
        params.set('sort', sort)
      } else if (sort === 'price_asc') params.set('sort', 'price_asc')
      else if (sort === 'price_desc') params.set('sort', 'price_desc')
      else if (sort === 'newest') params.set('sort', 'newest')
      else if (sort === 'best_selling') params.set('sort', 'best_selling')

      // Category
      if (selectedCategories.length > 0) {
        params.set('categories', selectedCategories.join(','))
      }

      // Subcategory
      if (selectedSubcategories.length > 0) {
        params.set('subcategoryId', selectedSubcategories.join(','))
      }

      // Price
      if (appliedPriceRange[0] > 0) params.set('minPrice', String(appliedPriceRange[0]))
      if (appliedPriceRange[1] < 5000) params.set('maxPrice', String(appliedPriceRange[1]))

      // Search
      if (searchQuery) params.set('search', searchQuery)

      // Rating
      if (minRating > 0) params.set('minRating', String(minRating))

      // Origin
      if (selectedOrigins.length > 0) params.set('origin', selectedOrigins.join(','))

      // In stock
      if (inStockOnly) params.set('inStock', 'true')

      // Min discount
      if (minDiscount > 0) params.set('minDiscount', String(minDiscount))

      const res = await fetch(`/api/products?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load products')
      const data = await res.json()

      const prods = extractItems<Product>(data)
      const pagination = extractPagination(data)

      if (append) {
        setProducts((prev) => [...prev, ...prods])
      } else {
        setProducts(prods)
      }
      setTotalProducts(pagination.total || 0)
      setHasMore(pageNum < (pagination.totalPages || 1))
    } catch (error) {
      console.error('Failed to load products:', error)
      if (!append) setProducts([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, selectedCategories, selectedSubcategories, appliedPriceRange, searchQuery, minRating, selectedOrigins, inStockOnly, minDiscount])

  // ── Reload on filter change ──
  useEffect(() => {
    loadProducts(1, false)
  }, [loadProducts])

  // ── Load more ──
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    loadProducts(nextPage, true)
  }, [page, loadProducts])

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Active category ──
  const activeCategory = selectedCategories.length > 0
    ? categories.find((c) => c.slug === selectedCategories[0])
    : null

  // ── Get subcategories for selected categories ──
  const availableSubcategories = useMemo(() => {
    const subs: Array<Subcategory & { categoryName: string }> = []
    categories.forEach((cat) => {
      if (selectedCategories.length === 0 || selectedCategories.includes(cat.slug)) {
        cat.subcategories?.forEach((s) => {
          subs.push({ ...s, categoryId: cat.id, categoryName: cat.name })
        })
      }
    })
    return subs
  }, [categories, selectedCategories])

  // ── Filter Sidebar Content ──
  const FilterContent = () => (
    <div className="space-y-1">
      {/* Category Filter */}
      <Collapsible open={categoryOpen} onOpenChange={setCategoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors">
          <span className="font-semibold text-sm flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
            Categories
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${categoryOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2.5 pb-3 px-1">
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center gap-2.5 group">
                  <Checkbox
                    id={`cat-${cat.id}`}
                    checked={selectedCategories.includes(cat.slug)}
                    onCheckedChange={() => toggleCategory(cat.slug)}
                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer group-hover:text-emerald-700 transition-colors flex-1">
                    {cat.name}
                  </Label>
                  {selectedCategories.includes(cat.slug) && cat.subcategories && cat.subcategories.length > 0 && (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                {/* Nested subcategories */}
                <AnimatePresence>
                  {selectedCategories.includes(cat.slug) && cat.subcategories && cat.subcategories.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="ml-6 mt-1 space-y-2 overflow-hidden"
                    >
                      {cat.subcategories.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 group">
                          <Checkbox
                            id={`subcat-${sub.id}`}
                            checked={selectedSubcategories.includes(sub.slug)}
                            onCheckedChange={() => toggleSubcategory(sub.slug)}
                            className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                          <Label htmlFor={`subcat-${sub.id}`} className="text-xs cursor-pointer group-hover:text-emerald-700 transition-colors">
                            {sub.name}
                          </Label>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Price Range */}
      <Collapsible open={priceOpen} onOpenChange={setPriceOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors">
          <span className="font-semibold text-sm flex items-center gap-2">
            <span className="text-emerald-600 font-bold">৳</span>
            Price Range
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${priceOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-3 px-1 space-y-3">
            <Slider
              value={priceRange}
              min={0}
              max={5000}
              step={50}
              onValueChange={handlePriceChange}
              className="mt-2 [&_[role=slider]]:bg-emerald-600 [&_[role=slider]]:border-emerald-600 [&_.relative>div]:bg-emerald-600"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-md px-2 py-1.5 text-xs font-medium text-center flex-1 text-emerald-800 dark:text-emerald-200">
                ৳{priceRange[0].toLocaleString()}
              </div>
              <span className="text-muted-foreground text-xs">—</span>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-md px-2 py-1.5 text-xs font-medium text-center flex-1 text-emerald-800 dark:text-emerald-200">
                ৳{priceRange[1].toLocaleString()}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Rating Filter */}
      <Collapsible open={ratingOpen} onOpenChange={setRatingOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors">
          <span className="font-semibold text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            Rating
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${ratingOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-3 px-1 space-y-2">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-all text-sm ${
                  minRating === opt.value
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleSetRating(opt.value)}
              >
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < opt.value ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">& up</span>
                {minRating === opt.value && (
                  <Badge className="ml-auto bg-emerald-600 text-white text-[10px] h-5 px-1.5">✓</Badge>
                )}
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Origin Filter */}
      <Collapsible open={originOpen} onOpenChange={setOriginOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors">
          <span className="font-semibold text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            Origin
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${originOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2.5 pb-3 px-1">
            {ORIGINS.map((origin) => (
              <div key={origin} className="flex items-center gap-2.5 group">
                <Checkbox
                  id={`origin-${origin}`}
                  checked={selectedOrigins.includes(origin)}
                  onCheckedChange={() => toggleOrigin(origin)}
                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <Label htmlFor={`origin-${origin}`} className="text-sm cursor-pointer group-hover:text-emerald-700 transition-colors">
                  {origin}
                </Label>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Discount Filter */}
      <Collapsible open={discountOpen} onOpenChange={setDiscountOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition-colors">
          <span className="font-semibold text-sm flex items-center gap-2">
            <span className="text-amber-600 text-base">%</span>
            Discount
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${discountOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-3 px-1 space-y-2">
            {DISCOUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-all text-sm ${
                  minDiscount === opt.value
                    ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleSetDiscount(opt.value)}
              >
                <span className={minDiscount === opt.value ? 'text-amber-700 dark:text-amber-300 font-medium' : ''}>
                  {opt.label}
                </span>
                {minDiscount === opt.value && (
                  <Badge className="ml-auto bg-amber-500 text-white text-[10px] h-5 px-1.5">✓</Badge>
                )}
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Availability Toggle */}
      <div className="flex items-center justify-between py-3 px-1">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          In Stock Only
        </span>
        <Switch
          checked={inStockOnly}
          onCheckedChange={(checked) => { setInStockOnly(checked); setPage(1) }}
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>

      <Separator className="my-2" />

      {/* Clear All Filters */}
      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear All Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-2 bg-red-100 text-red-700 text-[10px] h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  )

  // ── Grid columns class ──
  const gridColsClass = useMemo(() => {
    if (viewMode === 'list') return ''
    switch (gridCols) {
      case 2: return 'grid grid-cols-2 gap-4'
      case 3: return 'grid grid-cols-2 sm:grid-cols-3 gap-4'
      case 4: return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
      default: return 'grid grid-cols-2 sm:grid-cols-3 gap-4'
    }
  }, [viewMode, gridCols])

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-br from-[#2D6A4F] via-[#1B4332] to-[#2D6A4F] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white rounded-full" />
        </div>
        <div className={`relative container mx-auto px-4 text-center ${activeCategory ? 'py-6 md:py-8' : 'py-8 md:py-12'}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Leaf className="h-5 w-5 text-emerald-300" />
            <span className="text-emerald-200 text-sm font-medium tracking-wider uppercase">সবচেয়ে ভালো দামে খাঁটি খাদ্য</span>
            <Leaf className="h-5 w-5 text-emerald-300" />
          </div>
          {!activeCategory && (
            <>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3">
                Our Products
              </h1>
              <p className="text-emerald-100/80 text-base md:text-lg max-w-xl mx-auto mb-2">
                Discover authentic Bangladeshi food products
              </p>
              {totalProducts > 0 && (
                <p className="text-emerald-200/80 text-sm mb-6">
                  <span className="font-semibold text-white">{totalProducts}</span> product{totalProducts !== 1 ? 's' : ''} available
                </p>
              )}
              {totalProducts === 0 && <div className="mb-6" />}
            </>
          )}
          {activeCategory && <div className="mb-4" />}

          {/* ── Advanced Search Bar ── */}
          <div className="max-w-2xl mx-auto relative" ref={suggestionsRef}>
            <div className="flex items-center bg-white dark:bg-card rounded-xl shadow-lg overflow-hidden border-2 border-transparent focus-within:border-emerald-400 transition-colors">
              <div className="pl-4">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                ref={searchInputRef}
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Search products, brands, categories..."
                className="border-0 shadow-none focus-visible:ring-0 h-12 text-base placeholder:text-muted-foreground/60"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="p-2 hover:bg-muted rounded-full transition-colors mr-1"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => toast.info('Voice search coming soon! 🎤')}
                className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-full transition-colors mr-1"
                aria-label="Voice search"
              >
                <Mic className="h-4 w-4 text-emerald-600" />
              </button>
              <Button
                onClick={handleSearchSubmit}
                className="h-12 rounded-none px-6 bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                Search
              </Button>
            </div>

            {/* Search Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-50 w-full mt-2 bg-white dark:bg-card border rounded-xl shadow-xl overflow-hidden"
                >
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Recent
                        </span>
                        <button onClick={clearRecentSearches} className="text-xs text-red-500 hover:text-red-600">Clear</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            onClick={() => {
                              setSearchInput(term)
                              handleSearchInput(term)
                              setShowSuggestions(false)
                            }}
                            className="px-3 py-1.5 bg-muted/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-full text-xs font-medium transition-colors"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Searches */}
                  <div className="p-3 border-t">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                      <TrendingUp className="h-3 w-3" /> Popular
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_SEARCHES.map((term) => (
                        <button
                          key={term}
                          onClick={() => {
                            setSearchInput(term)
                            handleSearchInput(term)
                            setShowSuggestions(false)
                          }}
                          className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-full text-xs font-medium transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Category Banner / All Products Header ── */}
      <div className="bg-white dark:bg-card border-b">
        <div className="container mx-auto px-4 py-4 md:py-6">
          {/* Breadcrumb (always visible, contextual) */}
          <Breadcrumb className="mb-3">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('home')} className="cursor-pointer flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {activeCategory ? (
                  <BreadcrumbLink
                    onClick={() => handleCategoryChipClick(null)}
                    className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Categories
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbLink className="text-foreground font-medium">Products</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {activeCategory && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink className="text-foreground font-medium">{activeCategory.name}</BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          {activeCategory ? (
            /* Rich category banner with image background */
            <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden">
              {(() => {
                const bannerSrc = activeCategory.bannerImage || activeCategory.image
                return bannerSrc ? (
                  <Image
                    src={bannerSrc}
                    alt={activeCategory.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 1200px"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-800 to-emerald-900" />
                )
              })()}
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

              {/* Content positioned at bottom-left */}
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-1.5 drop-shadow-md">
                      {activeCategory.name}
                    </h2>
                    {activeCategory.description && (
                      <p className="text-sm md:text-base text-white/80 line-clamp-2 max-w-2xl drop-shadow">
                        {activeCategory.description}
                      </p>
                    )}
                  </div>
                  {totalProducts > 0 && (
                    <Badge className="bg-white/20 backdrop-blur-sm text-white border border-white/30 shrink-0">
                      <Package className="h-3 w-3 mr-1" />
                      {totalProducts} product{totalProducts !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Simpler "All Products" header when no category selected */
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">All Products</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Browse our complete collection of authentic Bangladeshi food products
                </p>
              </div>
              {totalProducts > 0 && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 shrink-0">
                  <Package className="h-3 w-3 mr-1" />
                  {totalProducts} product{totalProducts !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Category Chips (quick switching) ── */}
      <div className="bg-white dark:bg-card border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] -mx-1 px-1">
            <button
              onClick={() => handleCategoryChipClick(null)}
              aria-pressed={selectedCategories.length === 0}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategories.length === 0
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300'
              }`}
            >
              All
            </button>
            {categories.map((cat) => {
              const isActive = selectedCategories.includes(cat.slug)
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChipClick(cat.slug)}
                  aria-pressed={isActive}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300'
                  }`}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* ── Desktop Sidebar ── */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden lg:block w-72 flex-shrink-0"
          >
            <div className="sticky top-4 bg-white dark:bg-card border rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-auto bg-emerald-600 text-white text-xs h-5 min-w-[20px] flex items-center justify-center">
                    {activeFilterCount}
                  </Badge>
                )}
              </h2>
              <FilterContent />
            </div>
          </motion.aside>

          {/* ── Main Content ── */}
          <div className="flex-1 min-w-0">
            {/* Results Info Bar */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3 bg-white dark:bg-card border rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {/* Mobile filter button */}
                <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="lg:hidden rounded-lg">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge className="ml-2 bg-emerald-600 text-white text-[10px] h-4 min-w-[16px] px-1">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
                        Filters
                      </SheetTitle>
                      <SheetDescription className="sr-only">Filter products by various criteria</SheetDescription>
                    </SheetHeader>
                    <div className="mt-4">
                      <FilterContent />
                    </div>
                  </SheetContent>
                </Sheet>
                <div>
                  <span className="text-sm text-muted-foreground">
                    {totalProducts > 0 ? (
                      <>
                        <span className="font-semibold text-foreground">{totalProducts}</span> product{totalProducts !== 1 ? 's' : ''} found
                        {searchQuery && (
                          <> for <span className="font-semibold text-emerald-700 dark:text-emerald-400">&ldquo;{searchQuery}&rdquo;</span></>
                        )}
                      </>
                    ) : (
                      'No products found'
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View Toggle (grid / list) */}
                <div className="flex items-center border rounded-lg overflow-hidden bg-muted/30">
                  <button
                    className={`h-9 w-9 flex items-center justify-center transition-all ${
                      viewMode === 'grid'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-emerald-700 dark:hover:text-emerald-300'
                    }`}
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <Separator orientation="vertical" className="h-6 bg-border/60" />
                  <button
                    className={`h-9 w-9 flex items-center justify-center transition-all ${
                      viewMode === 'list'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-emerald-700 dark:hover:text-emerald-300'
                    }`}
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                {/* Grid columns toggle (desktop) */}
                {viewMode === 'grid' && (
                  <div className="hidden md:flex items-center border rounded-lg overflow-hidden bg-muted/30">
                    {[2, 3, 4].map((cols, idx) => (
                      <div key={cols} className="flex items-center">
                        {idx > 0 && <Separator orientation="vertical" className="h-6 bg-border/60" />}
                        <button
                          className={`h-9 w-9 flex items-center justify-center transition-all ${
                            gridCols === cols
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-muted-foreground hover:bg-background hover:text-emerald-700 dark:hover:text-emerald-300'
                          }`}
                          onClick={() => setGridCols(cols as 2 | 3 | 4)}
                          aria-label={`${cols} columns`}
                          aria-pressed={gridCols === cols}
                        >
                          {cols === 2 ? <LayoutGrid className="h-4 w-4" /> : <Columns3 className="h-4 w-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sort dropdown — emerald accent on focus / open */}
                <Select value={sort} onValueChange={(val) => { setSort(val); setPage(1) }}>
                  <SelectTrigger className="w-[180px] rounded-lg border-emerald-200 dark:border-emerald-800/60 data-[state=open]:border-emerald-500 data-[state=open]:ring-2 data-[state=open]:ring-emerald-500/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20">
                    <ArrowUpDown className="h-4 w-4 mr-2 text-emerald-600" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            {/* Active Filter Chips */}
            <AnimatePresence>
              {activeFilterChips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-wrap gap-2 mb-5 p-3 bg-white dark:bg-card rounded-xl border shadow-sm overflow-hidden"
                >
                  <span className="text-xs text-muted-foreground font-medium self-center mr-1">Active:</span>
                  {activeFilterChips.map((chip) => (
                    <motion.div
                      key={chip.key}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors pr-1 cursor-default"
                      >
                        {chip.label}
                        <button
                          onClick={chip.onRemove}
                          className="ml-0.5 h-4 w-4 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 flex items-center justify-center transition-colors"
                          aria-label={`Remove ${chip.label} filter`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={clearFilters}
                  >
                    Clear all
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Products Grid / List ── */}
            {loading ? (
              <div className={viewMode === 'grid' ? gridColsClass : 'space-y-4'}>
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Skeleton className={viewMode === 'grid' ? 'h-72 rounded-xl' : 'h-28 rounded-xl'} />
                  </motion.div>
                ))}
              </div>
            ) : products.length === 0 ? (
              /* Empty state */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20 px-4"
              >
                <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mx-auto mb-6">
                  <Search className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No products found</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  We couldn&apos;t find any products matching your current filters. Try adjusting your search or filter criteria.
                </p>

                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {POPULAR_SEARCHES.slice(0, 5).map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setSearchInput(term)
                        handleSearchInput(term)
                      }}
                      className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/30 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={clearFilters} className="rounded-lg bg-emerald-600 hover:bg-emerald-700">
                    Clear All Filters
                  </Button>
                  <Button variant="outline" onClick={() => navigate('home')} className="rounded-lg">
                    Back to Home
                  </Button>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${viewMode}-${sort}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={viewMode === 'grid' ? gridColsClass : 'space-y-3'}
                >
                  {products.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}
                    >
                      {viewMode === 'list' ? (
                        <ListProductCard product={product} />
                      ) : (
                        <ProductCard product={product} />
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Load More Button */}
            {!loading && hasMore && products.length > 0 && (
              <div className="flex justify-center mt-8">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="px-8 py-3 rounded-xl border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 transition-colors"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Products
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            )}

            {/* Showing count */}
            {!loading && products.length > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                Showing {products.length} of {totalProducts} products
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── List View Product Card ──

function ListProductCard({ product }: { product: Product }) {
  const { navigate, addToCart, isInWishlist, toggleWishlist, openQuickView } = useAppStore()
  const [adding, setAdding] = useState(false)
  const [imgError, setImgError] = useState(false)
  const wishlisted = isInWishlist(product.id)
  const imageUrl = product.images?.[0]?.url && !imgError ? product.images[0].url : ''
  const effectivePrice = product.discountPrice != null ? product.discountPrice : product.price
  const hasDiscount = product.discountPrice != null && product.discountPrice < product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0
  const outOfStock = product.stock <= 0

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (outOfStock) return
    setAdding(true)
    try {
      await addToCart({
        productId: product.id,
        productName: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        quantity: 1,
        unit: product.unit,
        image: imageUrl || '/placeholder.png',
        stock: product.stock,
      })
      toast.success('Added to cart')
    } catch {
      toast.error('Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleWishlist({
      productId: product.id,
      productName: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: imageUrl || '/placeholder.png',
    })
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist')
  }

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg rounded-xl"
      onClick={() => navigate('product-detail', { id: product.id })}
    >
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-lg overflow-hidden bg-muted/30 shrink-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="144px"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-50 to-emerald-100/50">
              <Package className="h-8 w-8 text-emerald-300" />
            </div>
          )}
          {hasDiscount && (
            <Badge className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
              -{discountPercent}%
            </Badge>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="text-xs font-semibold text-white bg-black/50 px-2 py-1 rounded">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            {product.category && (
              <p className="text-xs text-emerald-600 font-medium mb-0.5">{product.category.name}</p>
            )}
            <h3 className="font-semibold text-sm sm:text-base line-clamp-2 leading-tight mb-1">{product.name}</h3>
            {product.shortDescription && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2 hidden sm:block">{product.shortDescription}</p>
            )}
            {product.avgRating != null && product.avgRating > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating rating={product.avgRating} size={12} />
                <span className="text-xs text-muted-foreground">({product.reviewCount || 0})</span>
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  ৳{effectivePrice.toLocaleString()}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    ৳{product.price.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">/{product.unit}</span>
              </div>
              {hasDiscount && (
                <p className="text-xs text-emerald-600 font-medium">You save ৳{(product.price - product.discountPrice!).toLocaleString()}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={handleWishlist}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
              <Button
                size="sm"
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 min-h-[36px]"
                disabled={outOfStock || adding}
                onClick={handleAddToCart}
              >
                {adding ? 'Adding...' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
