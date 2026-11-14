'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Package,
  Phone,
  ShieldCheck,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAppStore, type PageName } from '@/lib/store'
import { formatPrice } from '@/lib/utils'
import { extractItems } from '@/lib/api'

interface CategoryItem {
  id: string
  name: string
  slug: string
}

interface SearchSuggestion {
  id: string
  name: string
  slug: string
  price: number
  discountPrice?: number | null
  image?: string
}

export default function Navbar() {
  const router = useRouter()
  const {
    siteConfig,
    user,
    isAuthenticated,
    totalItems,
    subtotal,
    wishlistItems,
    toggleCart,
    searchQuery,
    setSearchQuery,
    navigate,
    logout,
  } = useAppStore()

  // Hydration guard for localStorage persisted state
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)

  const searchBoxRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const siteName = siteConfig?.siteName || 'Khati Khadyo'
  const logoUrl = siteConfig?.logo || '/all_logo.png'
  const itemCount = mounted ? totalItems() : 0
  const wishlistCount = mounted ? wishlistItems.length : 0
  const cartSubtotal = mounted ? subtotal() : 0
  const contactPhone = siteConfig?.phone && !siteConfig.phone.includes('XXX') ? siteConfig.phone.trim() : null

  // Fetch top categories for menu
  useEffect(() => {
    let active = true
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories?isActive=true&limit=8')
        if (res.ok) {
          const json = await res.json()
          if (active) setCategories(extractItems<CategoryItem>(json))
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadCategories()
    return () => {
      active = false
    }
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search suggestions
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)

    const q = val.trim()
    if (!q) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=5&status=active`)
        if (res.ok) {
          const json = await res.json()
          const items = extractItems<any>(json).map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug || p.id,
            price: p.price,
            discountPrice: p.discountPrice,
            image: p.images?.[0]?.url,
          }))
          setSuggestions(items)
          setShowSuggestions(true)
        }
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 250)
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = searchInput.trim()
    setShowSuggestions(false)
    setSearchQuery(q)
    router.push(q ? `/products?search=${encodeURIComponent(q)}` : '/products')
  }

  const handleSelectSuggestion = (slug: string) => {
    setShowSuggestions(false)
    router.push(`/products/${slug}`)
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 transition-colors">
      {/* ── Top Micro-Bar ── */}
      <div className="bg-emerald-900 text-emerald-50 text-[11px] sm:text-xs py-1.5 px-4">
        <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-wide">১০০% খাঁটি ও প্রাকৃতিক খাদ্য পণ্য</span>
            <span className="hidden sm:inline text-emerald-300">|</span>
            <span className="hidden sm:inline text-emerald-200">সরাসরি কৃষক ও বিশ্বস্ত খামার থেকে সংগৃহীত</span>
          </div>
          <div className="flex items-center gap-3">
            {contactPhone && (
              <a
                href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                className="hidden md:flex items-center gap-1 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300 rounded px-1"
              >
                <Phone className="h-3 w-3" />
                <span>{contactPhone}</span>
              </a>
            )}
            <Link
              href="/contact"
              className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300 rounded px-1"
            >
              যোগাযোগ ও সহায়তা
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Bar ── */}
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 md:h-18">
          {/* Mobile Menu Trigger & Logo */}
          <div className="flex items-center gap-2.5">
            {/* Mobile Menu Drawer */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-10 w-10 text-stone-700 dark:text-stone-200 focus-visible:ring-2 focus-visible:ring-emerald-600"
                  aria-label="Open mobile navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[360px] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-stone-200 dark:border-stone-800 text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <img src={logoUrl} alt="Logo" className="h-7 w-auto object-contain" />
                    <span className="font-bold text-base">{siteName}</span>
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Mobile Search */}
                  <form onSubmit={(e) => { setMobileMenuOpen(false); handleSearchSubmit(e) }} className="relative">
                    <Input
                      type="search"
                      placeholder="পণ্য খুঁজুন..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pr-10 rounded-xl"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full w-10 text-stone-500"
                      aria-label="Search"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </form>

                  {/* Navigation Links */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">মেনু</p>
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-sm text-stone-900 dark:text-white"
                    >
                      <span>হোম (Home)</span>
                    </Link>
                    <Link
                      href="/products"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-sm text-stone-900 dark:text-white"
                    >
                      <span>সব পণ্য (All Products)</span>
                      <ArrowRight className="h-4 w-4 text-stone-400" />
                    </Link>
                    <Link
                      href="/cart"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-sm text-stone-900 dark:text-white"
                    >
                      <span>কার্ট (Cart)</span>
                      {itemCount > 0 && (
                        <Badge className="bg-emerald-600 text-white font-bold">{itemCount}</Badge>
                      )}
                    </Link>
                    <Link
                      href="/contact"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-sm text-stone-900 dark:text-white"
                    >
                      <span>যোগাযোগ (Contact)</span>
                    </Link>
                  </div>

                  {/* Categories */}
                  {categories.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">ক্যাটাগরি সমূহ</p>
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/products?category=${encodeURIComponent(cat.slug)}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between p-2 rounded-lg text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          <span>{cat.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mobile Bottom Footer */}
                <div className="p-4 border-t border-stone-200 dark:border-stone-800">
                  {isAuthenticated ? (
                    <div className="space-y-2">
                      <div className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                        লগইন করা আছে: <span className="font-bold text-stone-900 dark:text-white">{user?.name || user?.phone || user?.email}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={async () => {
                          setMobileMenuOpen(false)
                          await logout()
                          router.push('/')
                        }}
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1.5" /> লগআউট
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setMobileMenuOpen(false); navigate('login') }}
                      >
                        লগইন
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setMobileMenuOpen(false); navigate('register') }}
                      >
                        রেজিস্টার
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo Link to Homepage */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg p-1"
              aria-label="Khati Khadyo - Go to homepage"
            >
              <img
                src={logoUrl}
                alt="Khati Khadyo"
                className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.includes('all_logo.png')) {
                    target.src = '/all_logo.png'
                  }
                }}
              />
              <span className="font-extrabold text-lg sm:text-xl text-stone-900 dark:text-white tracking-tight">
                {siteName}
              </span>
            </Link>
          </div>

          {/* Desktop Search Bar with Live Suggestions */}
          <div ref={searchBoxRef} className="hidden md:flex flex-1 max-w-xl mx-6 relative">
            <form onSubmit={handleSearchSubmit} className="w-full relative">
              <Input
                type="search"
                placeholder="খাঁটি মধু, সরিষার তেল, ঘি বা অন্য পণ্য খুঁজুন..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                className="w-full h-11 pl-4 pr-11 bg-stone-50 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 rounded-full text-sm focus-visible:ring-2 focus-visible:ring-emerald-600 transition-all"
                aria-label="Search products"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                aria-label="Submit search"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden z-50">
                <div className="p-2 space-y-1">
                  {suggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSuggestion(item.slug)}
                      className="flex items-center gap-3 p-2 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-stone-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs font-bold text-emerald-600">
                          {formatPrice(item.discountPrice ?? item.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div
                    onClick={() => handleSearchSubmit()}
                    className="p-2.5 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg cursor-pointer border-t border-stone-100 dark:border-stone-800 mt-1"
                  >
                    &ldquo;{searchInput}&rdquo; সম্পর্কিত সব পণ্য দেখুন &rarr;
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 mr-2 text-sm font-medium">
              <Link
                href="/products"
                className="px-3 py-2 text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                সব পণ্য
              </Link>
              {categories.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-3 py-2 text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                      <span>ক্যাটাগরি</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 p-1.5 rounded-xl shadow-lg border border-stone-200 dark:border-stone-800">
                    {categories.map((c) => (
                      <DropdownMenuItem key={c.id} asChild>
                        <Link href={`/products?category=${encodeURIComponent(c.slug)}`} className="rounded-lg text-sm font-medium cursor-pointer">
                          {c.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>

            {/* Wishlist Button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full text-stone-700 dark:text-stone-200 hover:text-emerald-700 dark:hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-600"
              onClick={() => navigate('wishlist')}
              aria-label={`Wishlist with ${wishlistCount} items`}
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Button>

            {/* Cart Trigger Button */}
            <Button
              variant="outline"
              className="relative h-10 px-3 sm:px-4 rounded-full border-stone-200 dark:border-stone-700 hover:border-emerald-600 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-600"
              onClick={toggleCart}
              aria-label={`Shopping cart with ${itemCount} items, total ${formatPrice(cartSubtotal)}`}
            >
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline font-bold text-xs text-stone-900 dark:text-white">
                {formatPrice(cartSubtotal)}
              </span>
              {itemCount > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Button>

            {/* Account / Login Dropdown */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-label="Account menu"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl shadow-lg border border-stone-200 dark:border-stone-800">
                  <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800">
                    <p className="text-xs text-stone-500">লগইন করা হয়েছে:</p>
                    <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                      {user?.name || user?.phone || user?.email}
                    </p>
                  </div>
                  {user?.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('admin-dashboard')} className="rounded-lg text-xs font-semibold cursor-pointer">
                      <LayoutDashboard className="h-4 w-4 mr-2 text-amber-600" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('orders')} className="rounded-lg text-xs font-medium cursor-pointer">
                    <Package className="h-4 w-4 mr-2 text-stone-600" />
                    আমার অর্ডারসমূহ (Orders)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('profile')} className="rounded-lg text-xs font-medium cursor-pointer">
                    <User className="h-4 w-4 mr-2 text-stone-600" />
                    প্রোফাইল সেটিংস (Profile)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout()
                      router.push('/')
                    }}
                    className="rounded-lg text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2 text-red-600" />
                    লগআউট (Logout)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-xs font-bold text-stone-800 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-600"
                onClick={() => navigate('login')}
              >
                লগইন
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
