import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { extractItems } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageName =
  | 'admin-flash-sale'
  | 'home'
  | 'products'
  | 'product-detail'
  | 'cart'
  | 'checkout'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'profile'
  | 'orders'
  | 'order-detail'
  | 'order-confirmation'
  | 'order-tracking'
  | 'wishlist'
  | 'contact'
  | 'terms'
  | 'privacy'
  | 'return-policy'
  | 'delivery-policy'
  | 'policy'
  | 'admin-dashboard'
  | 'admin-products'
  | 'admin-categories'
  | 'admin-orders'
  | 'admin-customers'
  | 'admin-reviews'
  | 'admin-coupons'
  | 'admin-banners'
  | 'admin-policy-pages'
  | 'admin-settings'
  | 'admin-media'
  | 'admin-payments'
  | 'admin-contact-messages'

export interface CartItem {
  id: string
  productId: string
  productName: string
  price: number
  discountPrice?: number | null
  quantity: number
  unit: string
  image: string
  stock: number
}

export interface WishlistItem {
  productId: string
  productName: string
  price: number
  discountPrice?: number | null
  image: string
}

export type NotificationType = 'order_update' | 'promo' | 'restock' | 'price_drop'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  description: string
  timestamp: string
  isRead: boolean
  link?: string
  image?: string
}

export interface User {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  role: string
  isVerified: boolean
  avatar?: string | null
  createdAt: string
}

export interface SiteConfig {

  siteName: string
  tagline: string
  description: string
  logo: string
  favicon: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  currency: string
  currencySymbol: string
  phone: string
  email: string
  address: string
  socialLinks: {
    facebook?: string
    instagram?: string
    twitter?: string
    youtube?: string
  }
  freeShippingThreshold: number
  shippingCharge: number
  taxRate: number
  enableCod: boolean
  enableOnlinePayment: boolean
  minOrderAmount: number
  returnWindowDays: number
  deliveryZones: string[]
  maintenanceMode: boolean
  // ── Homepage business settings (Round 3E) ──
  announcementEnabled: boolean
  announcementText: string
  freeDeliveryEnabled: boolean
  freeDeliveryMinAmount: number
  freeDeliveryMessage: string

  homepagePromoText: string
  flash_sale?: string // Raw JSON config from AdminFlashSalePage
}

// ─── Helper: Session ID ──────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  const KEY = 'kk_session_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(KEY, id)
  }
  return id
}

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('kk_session_id')
}

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface AppStore {
  // ── Navigation ──
  currentPage: PageName
  pageParams: Record<string, unknown>
  navigate: (page: PageName, params?: Record<string, unknown>) => void

  // ── Auth ──
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  login: (credentials: { identifier?: string; email?: string; phone?: string; password: string }) => Promise<void>
  register: (data: { name?: string; identifier?: string; email?: string; phone?: string; password: string }) => Promise<void>
  logout: () => void
  setUser: (user: User | null) => void
  loadUser: () => void

  // ── Cart ──
  cartItems: CartItem[]
  cartLoading: boolean
  totalItems: () => number
  subtotal: () => number
  addToCart: (item: Omit<CartItem, 'id'>) => Promise<void>
  removeFromCart: (cartItemId: string) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  loadCart: () => Promise<void>

  // ── Wishlist ──
  wishlistItems: WishlistItem[]
  wishlistLoading: boolean
  addToWishlist: (item: WishlistItem) => Promise<void>
  removeFromWishlist: (productId: string) => Promise<void>
  toggleWishlist: (item: WishlistItem) => Promise<void>
  loadWishlist: () => Promise<void>
  isInWishlist: (productId: string) => boolean

  // ── UI ──
  searchQuery: string
  selectedCategory: string
  isMobileMenuOpen: boolean
  isCartOpen: boolean
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string) => void
  setMobileMenuOpen: (open: boolean) => void
  setCartOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  toggleCart: () => void

  // ── Quick View ──
  quickViewProductId: string | null
  isQuickViewOpen: boolean
  openQuickView: (productId: string) => void
  closeQuickView: () => void

  // ── Product Comparison ──
  compareProducts: string[]
  isCompareDrawerOpen: boolean
  addToCompare: (productId: string) => void
  removeFromCompare: (productId: string) => void
  clearCompare: () => void
  isInCompare: (productId: string) => boolean
  openCompareDrawer: () => void
  closeCompareDrawer: () => void
  toggleCompareDrawer: () => void

  // ── Notifications ──
  notifications: NotificationItem[]
  unreadCount: () => number
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
  initDemoNotifications: () => void

  // ── Recently Viewed ──
  recentlyViewed: string[]
  addRecentlyViewed: (productId: string) => void
  clearRecentlyViewed: () => void

  // ── Order Tracking Modal ──
  isOrderTrackingOpen: boolean
  orderTrackingId: string | null
  openOrderTracking: (orderId?: string) => void
  closeOrderTracking: () => void

  // ── Wishlist Share ──
  isWishlistShareModalOpen: boolean
  wishlistShareData: {
    shareId: string
    items: WishlistItem[]
    message?: string
  } | null
  openWishlistShareModal: (shareId: string, items: WishlistItem[], message?: string) => void
  closeWishlistShareModal: () => void

  // ── Site Config ──
  siteConfig: SiteConfig | null
  siteConfigLoading: boolean
  loadSiteConfig: () => Promise<void>

  // ── Session ──
  getSessionId: () => string | null
  getOrCreateSessionId: () => string
}

// ─── Default Site Config ──────────────────────────────────────────────────────

const defaultSiteConfig: SiteConfig = {
  siteName: 'Khati Khadyo',
  tagline: 'Authentic Bangladeshi Food Products',
  description: 'Premium authentic Bangladeshi food products delivered fresh to your doorstep.',
  logo: '/all_logo.png',
  favicon: '/all_logo.png',
  primaryColor: '#2D6A4F',
  secondaryColor: '#B8860B',
  accentColor: '#D4A574',
  currency: 'BDT',
  currencySymbol: '৳',
  phone: '+880 1XXX-XXXXXX',
  email: 'info@khatikhadyo.com',
  address: 'Dhaka, Bangladesh',
  socialLinks: {
    facebook: 'https://facebook.com/khatikhadyo',
    instagram: 'https://instagram.com/khatikhadyo',
  },
  freeShippingThreshold: 1500,
  shippingCharge: 60,
  taxRate: 0,
  enableCod: true,
  enableOnlinePayment: false,
  minOrderAmount: 0,
  returnWindowDays: 7,
  deliveryZones: ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna'],
  maintenanceMode: false,
  // ── Homepage business settings (Round 3E) ──
  announcementEnabled: true,
  announcementText: 'Selected items at special prices',
  freeDeliveryEnabled: true,
  freeDeliveryMinAmount: 1500,
  freeDeliveryMessage: 'Free Delivery on Orders Above ৳1,500',

  homepagePromoText: '100% Authentic Bangladeshi Products',
}

// ─── Store Implementation ─────────────────────────────────────────────────────

// Module-level flag to prevent persist middleware from writing before rehydration
let _storeRehydrated = false

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Navigation ────────────────────────────────────────────────────────
      currentPage: 'home' as PageName,
      pageParams: {},

      navigate: (page, params = {}) => {
        set({ currentPage: page, pageParams: params })
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },

      // ── Auth ──────────────────────────────────────────────────────────────
      user: null,
      isAuthenticated: false,
      accessToken: null,

      login: async (credentials) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Login failed')
        }

        const data = await res.json()
        const user = (data.data?.user || data.user) as User
        const token = data.data?.token || data.accessToken || null
        set({ user, accessToken: token, isAuthenticated: true })

        // Persist user and token for loadUser
        // Removed manual localStorage set, Zustand persist handles this

        // After login, merge guest cart into user cart and reload
        await get().loadCart()
        await get().loadWishlist()
      },

      register: async (registerData) => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registerData),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Registration failed')
        }

        const data = await res.json()
        const user = (data.data?.user || data.user) as User
        const token = data.data?.token || data.accessToken || null
        set({ user, accessToken: token, isAuthenticated: true })

        // Persist user and token for loadUser
        // Removed manual localStorage set, Zustand persist handles this

        // After registration, reload cart and wishlist
        await get().loadCart()
        await get().loadWishlist()
      },

      logout: () => {
        // Clear the HttpOnly server session as well as local client state.
        // `keepalive` lets this complete even when navigation follows logout.
        if (typeof window !== 'undefined') {
          void fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
            keepalive: true,
          })
        }
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          cartItems: [],
          wishlistItems: [],
        })
        // Clear persisted user data but keep session id for guest cart
        if (typeof window !== 'undefined') {
          localStorage.removeItem('kk_user')
          localStorage.removeItem('kk_token')
        }
      },

      setUser: (user) => {
        set({ user, isAuthenticated: !!user })
      },

      loadUser: () => {
        // Zustand persist handles hydration automatically via useAppStore.persist.rehydrate()
      },

      // ── Cart ──────────────────────────────────────────────────────────────
      cartItems: [],
      cartLoading: false,

      totalItems: () => {
        return get().cartItems.reduce((sum, item) => {
          const qty = Number(item.quantity)
          return sum + (Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0)
        }, 0)
      },

      subtotal: () => {
        const rawSubtotal = get().cartItems.reduce((sum, item) => {
          const price = item.discountPrice != null ? item.discountPrice : item.price
          const p = Number(price)
          const q = Number(item.quantity)
          const validP = Number.isFinite(p) && p >= 0 ? p : 0
          const validQ = Number.isFinite(q) && q > 0 ? q : 0
          return sum + (validP * validQ)
        }, 0)
        return Number.isFinite(rawSubtotal) ? Math.max(0, Math.round(rawSubtotal)) : 0
      },

      addToCart: async (item) => {
        const state = get()
        const userId = state.user?.id
        const sessionId = userId ? undefined : getOrCreateSessionId()

        // Sanitize incoming prices and quantities
        const safePrice = Number.isFinite(Number(item.price)) ? Number(item.price) : 0
        const safeDiscountPrice = item.discountPrice != null && Number.isFinite(Number(item.discountPrice))
          ? Number(item.discountPrice)
          : null
        const safeQuantity = Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
          ? Math.floor(Number(item.quantity))
          : 1

        try {
          const token = get().accessToken
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) headers['Authorization'] = `Bearer ${token}`
          const res = await fetch('/api/cart', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              productId: item.productId,
              quantity: safeQuantity,
              unit: item.unit,
              ...(userId ? { userId } : { sessionId }),
            }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to add to cart')
          }

          const savedItem = await res.json()
          const savedQty = Number.isFinite(Number(savedItem.quantity)) && Number(savedItem.quantity) > 0
            ? Number(savedItem.quantity)
            : safeQuantity

          // Update local state immediately
          set((s) => {
            const existingIndex = s.cartItems.findIndex(
              (ci) => ci.productId === item.productId
            )
            if (existingIndex >= 0) {
              const updated = [...s.cartItems]
              updated[existingIndex] = {
                ...updated[existingIndex],
                id: savedItem.id,
                price: safePrice,
                discountPrice: safeDiscountPrice,
                quantity: savedQty,
              }
              return { cartItems: updated }
            }
            return {
              cartItems: [
                {
                  id: savedItem.id,
                  productId: item.productId,
                  productName: item.productName || 'Product',
                  price: safePrice,
                  discountPrice: safeDiscountPrice,
                  quantity: savedQty,
                  unit: item.unit || 'kg',
                  image: item.image || '/placeholder.png',
                  stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : 0,
                },
                ...s.cartItems,
              ],
            }
          })

        } catch (error) {
          console.error('Failed to add to cart:', error)
          // Fallback: add locally without server sync
          set((s) => {
            const existingIndex = s.cartItems.findIndex(
              (ci) => ci.productId === item.productId
            )
            if (existingIndex >= 0) {
              const updated = [...s.cartItems]
              const currentQty = Number(updated[existingIndex].quantity) || 1
              updated[existingIndex] = {
                ...updated[existingIndex],
                price: safePrice,
                discountPrice: safeDiscountPrice,
                quantity: currentQty + safeQuantity,
              }
              return { cartItems: updated }
            }
            return {
              cartItems: [
                {
                  ...item,
                  price: safePrice,
                  discountPrice: safeDiscountPrice,
                  id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  quantity: safeQuantity,
                },
                ...s.cartItems,
              ],
            }
          })
        }
      },

      removeFromCart: async (cartItemId) => {
        // Optimistic update
        const previous = get().cartItems
        set((s) => ({
          cartItems: s.cartItems.filter((ci) => ci.id !== cartItemId),
        }))

        try {
          const token = get().accessToken
          const delHeaders: Record<string, string> = {}
          if (token) delHeaders['Authorization'] = `Bearer ${token}`
          const res = await fetch(`/api/cart/${encodeURIComponent(cartItemId)}`, {
            method: 'DELETE',
            headers: delHeaders,
          })
          if (!res.ok) {
            // Revert on failure
            set({ cartItems: previous })
            const data = await res.json()
            throw new Error(data.error || 'Failed to remove item')
          }
        } catch (error) {
          console.error('Failed to remove from cart:', error)
          set({ cartItems: previous })
        }
      },

      updateQuantity: async (cartItemId, quantity) => {
        if (quantity < 1) return

        const previous = get().cartItems
        // Optimistic update
        set((s) => ({
          cartItems: s.cartItems.map((ci) =>
            ci.id === cartItemId ? { ...ci, quantity } : ci
          ),
        }))

        try {
          const token = get().accessToken
          const updateHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) updateHeaders['Authorization'] = `Bearer ${token}`
          const res = await fetch(`/api/cart/${encodeURIComponent(cartItemId)}`, {
            method: 'PUT',
            headers: updateHeaders,
            body: JSON.stringify({ quantity }),
          })
          if (!res.ok) {
            set({ cartItems: previous })
            const data = await res.json()
            throw new Error(data.error || 'Failed to update quantity')
          }
        } catch (error) {
          console.error('Failed to update cart quantity:', error)
          set({ cartItems: previous })
        }
      },

      clearCart: async () => {
        const previous = get().cartItems
        set({ cartItems: [] })

        // Delete all items from server
        try {
          const token = get().accessToken
          const clearHeaders: Record<string, string> = {}
          if (token) clearHeaders['Authorization'] = `Bearer ${token}`
          await Promise.all(
            previous.map((item) =>
              fetch(`/api/cart/${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
                headers: clearHeaders,
              })
            )
          )
        } catch (error) {
          console.error('Failed to clear cart on server:', error)
          // Don't revert - user explicitly cleared
        }
      },

      loadCart: async () => {
        const state = get()
        const userId = state.user?.id
        const sessionId = userId ? undefined : getSessionId()

        if (!userId && !sessionId) return

        set({ cartLoading: true })
        try {
          const params = new URLSearchParams()
          if (userId) {
            params.set('userId', userId)
          } else if (sessionId) {
            params.set('sessionId', sessionId)
          }

          const token = get().accessToken
          const headers: Record<string, string> = {}
          if (token) headers['Authorization'] = `Bearer ${token}`
          const res = await fetch(`/api/cart?${params.toString()}`, { headers })
          if (!res.ok) throw new Error('Failed to load cart')

          const data = await res.json()

          // Map API response to our CartItem shape
          const rawItems = extractItems<Record<string, unknown>>(data)
          const cartItems: CartItem[] = rawItems.map(
            (item: Record<string, unknown>) => {
              const product = item.product as Record<string, unknown>
              const images = product?.images as Array<Record<string, unknown>> | undefined
              return {
                id: item.id as string,
                productId: product?.id as string,
                productName: product?.name as string,
                price: Number(product?.price) || 0,
                discountPrice: product?.discountPrice != null ? Number(product.discountPrice) : null,
                quantity: item.quantity as number,
                unit: (item.unit as string) || (product?.unit as string) || 'kg',
                image: (images?.[0]?.url as string) || '/placeholder.png',
                stock: Number(product?.stock) || 0,
              }
            }
          )

          set({ cartItems, cartLoading: false })
        } catch (error) {
          console.error('Failed to load cart:', error)
          set({ cartLoading: false })
        }
      },

      // ── Wishlist ──────────────────────────────────────────────────────────
      wishlistItems: [],
      wishlistLoading: false,

      addToWishlist: async (item) => {
        const state = get()
        if (!state.user?.id) {
          // For guests, just add locally
          set((s) => ({
            wishlistItems: [item, ...s.wishlistItems],
          }))
          return
        }

        try {
          const res = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: state.user.id,
              productId: item.productId,
            }),
          })

          if (!res.ok) {
            const data = await res.json()
            if (res.status !== 409) {
              throw new Error(data.error || 'Failed to add to wishlist')
            }
            // 409 = already exists, that's fine
          }

          // Add to local state if not already there
          set((s) => {
            if (s.wishlistItems.some((wi) => wi.productId === item.productId)) {
              return s
            }
            return { wishlistItems: [item, ...s.wishlistItems] }
          })
        } catch (error) {
          console.error('Failed to add to wishlist:', error)
          // Fallback: add locally
          set((s) => {
            if (s.wishlistItems.some((wi) => wi.productId === item.productId)) {
              return s
            }
            return { wishlistItems: [item, ...s.wishlistItems] }
          })
        }
      },

      removeFromWishlist: async (productId) => {
        const state = get()
        const previous = state.wishlistItems

        // Optimistic update
        set((s) => ({
          wishlistItems: s.wishlistItems.filter((wi) => wi.productId !== productId),
        }))

        if (!state.user?.id) return // Guest: only local state

        try {
          const params = new URLSearchParams({
            userId: state.user.id,
            productId,
          })
          const res = await fetch(`/api/wishlist?${params.toString()}`, {
            method: 'DELETE',
          })
          if (!res.ok) {
            set({ wishlistItems: previous })
            const data = await res.json()
            throw new Error(data.error || 'Failed to remove from wishlist')
          }
        } catch (error) {
          console.error('Failed to remove from wishlist:', error)
          set({ wishlistItems: previous })
        }
      },

      toggleWishlist: async (item) => {
        const state = get()
        const exists = state.wishlistItems.some(
          (wi) => wi.productId === item.productId
        )
        if (exists) {
          await state.removeFromWishlist(item.productId)
        } else {
          await state.addToWishlist(item)
        }
      },

      loadWishlist: async () => {
        const state = get()
        if (!state.user?.id) return

        set({ wishlistLoading: true })
        try {
          const params = new URLSearchParams({ userId: state.user.id })
          const res = await fetch(`/api/wishlist?${params.toString()}`)
          if (!res.ok) throw new Error('Failed to load wishlist')

          const data = await res.json()

          // Map API response to WishlistItem shape
          const rawWishlist = extractItems<Record<string, unknown>>(data)
          const wishlistItems: WishlistItem[] = rawWishlist.map(
            (entry: Record<string, unknown>) => {
              const product = entry.product as Record<string, unknown>
              const images = product?.images as Array<Record<string, unknown>> | undefined
              return {
                productId: product?.id as string,
                productName: product?.name as string,
                price: Number(product?.price) || 0,
                discountPrice: product?.discountPrice != null ? Number(product.discountPrice) : null,
                image: (images?.[0]?.url as string) || '/placeholder.png',
              }
            }
          )

          set({ wishlistItems, wishlistLoading: false })
        } catch (error) {
          console.error('Failed to load wishlist:', error)
          set({ wishlistLoading: false })
        }
      },

      isInWishlist: (productId) => {
        return get().wishlistItems.some((wi) => wi.productId === productId)
      },

      // ── UI ────────────────────────────────────────────────────────────────
      searchQuery: '',
      selectedCategory: '',
      isMobileMenuOpen: false,
      isCartOpen: false,
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
      setCartOpen: (open) => set({ isCartOpen: open }),
      toggleMobileMenu: () => set((s) => ({ isMobileMenuOpen: !s.isMobileMenuOpen })),
      toggleCart: () => set((s) => ({ isCartOpen: !s.isCartOpen })),

      // ── Quick View ────────────────────────────────────────────────────────
      quickViewProductId: null,
      isQuickViewOpen: false,

      openQuickView: (productId) => set({
        quickViewProductId: productId,
        isQuickViewOpen: true,
      }),

      closeQuickView: () => set({
        isQuickViewOpen: false,
        quickViewProductId: null,
      }),

      // ── Product Comparison ──────────────────────────────────────────────────
      compareProducts: [],
      isCompareDrawerOpen: false,

      addToCompare: (productId) => set((s) => {
        if (s.compareProducts.length >= 4) return s
        if (s.compareProducts.includes(productId)) return s
        return { compareProducts: [...s.compareProducts, productId] }
      }),

      removeFromCompare: (productId) => set((s) => ({
        compareProducts: s.compareProducts.filter((id) => id !== productId),
      })),

      clearCompare: () => set({ compareProducts: [], isCompareDrawerOpen: false }),

      isInCompare: (productId) => get().compareProducts.includes(productId),

      openCompareDrawer: () => set({ isCompareDrawerOpen: true }),

      closeCompareDrawer: () => set({ isCompareDrawerOpen: false }),

      toggleCompareDrawer: () => set((s) => ({ isCompareDrawerOpen: !s.isCompareDrawerOpen })),

      // ── Notifications ────────────────────────────────────────────────────
      notifications: [],

      unreadCount: () => get().notifications.filter((n) => !n.isRead).length,

      addNotification: (notification) => set((s) => ({
        notifications: [
          {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            isRead: false,
          },
          ...s.notifications,
        ],
      })),

      markAsRead: (notificationId) => set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
      })),

      markAllAsRead: () => set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      })),

      clearNotifications: () => set({ notifications: [] }),

      initDemoNotifications: () => {
        const existing = get().notifications
        if (existing.length > 0) return
        const now = Date.now()
        const demos: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>[] = [
          {
            type: 'order_update',
            title: 'Order Shipped!',
            description: 'Your order #KK-2847 has been shipped and is on its way to Dhaka.',
            link: 'orders',
          },
          {
            type: 'promo',
            title: 'ঈদ স্পেশাল অফার! 🎉',
            description: 'Get 25% off on all premium spices. Use code: EID25',
            link: 'offers',
          },
          {
            type: 'restock',
            title: 'Back in Stock: Aromatic Basmati Rice',
            description: 'The premium Basmati rice you bookmarked is back in stock. Order now!',
            link: 'products',
          },
          {
            type: 'price_drop',
            title: 'Price Drop Alert! 📉',
            description: 'Sundarban Honey price dropped from ৳850 to ৳650. Grab it now!',
            link: 'products',
          },
          {
            type: 'order_update',
            title: 'Order Delivered',
            description: 'Your order #KK-2791 has been delivered successfully. Enjoy!',
            link: 'orders',
          },
          {
            type: 'promo',
            title: 'Free Delivery Weekend',
            description: 'Free delivery on orders above ৳500 this weekend. Don\'t miss out!',
            link: 'offers',
          },
        ]
        const notifications: NotificationItem[] = demos.map((d, i) => ({
          ...d,
          id: `demo_notif_${i}`,
          timestamp: new Date(now - i * 3600000 * (i + 1)).toISOString(),
          isRead: i >= 3,
        }))
        set({ notifications })
      },

      // ── Recently Viewed ──────────────────────────────────────────────────────
      recentlyViewed: [],

      addRecentlyViewed: (productId) => set((s) => {
        // Remove existing entry to avoid duplicates, prepend to front, cap at 8 items
        const filtered = s.recentlyViewed.filter((id) => id !== productId)
        return { recentlyViewed: [productId, ...filtered].slice(0, 8) }
      }),

      clearRecentlyViewed: () => set({ recentlyViewed: [] }),

      // ── Order Tracking Modal ──────────────────────────────────────────────────────
      isOrderTrackingOpen: false,
      orderTrackingId: null,

      openOrderTracking: (orderId) => set({
        isOrderTrackingOpen: true,
        orderTrackingId: orderId || null,
      }),

      closeOrderTracking: () => set({
        isOrderTrackingOpen: false,
        orderTrackingId: null,
      }),

      // ── Wishlist Share ──────────────────────────────────────────────────────
      isWishlistShareModalOpen: false,
      wishlistShareData: null,

      openWishlistShareModal: (shareId, items, message) => set({
        isWishlistShareModalOpen: true,
        wishlistShareData: { shareId, items, message },
      }),

      closeWishlistShareModal: () => set({
        isWishlistShareModalOpen: false,
        wishlistShareData: null,
      }),

      // ── Site Config ────────────────────────────────────────────────────────
      siteConfig: null,
      siteConfigLoading: false,

      loadSiteConfig: async () => {
        set({ siteConfigLoading: true })
        try {
          const res = await fetch('/api/site-config')
          if (!res.ok) throw new Error('Failed to load site config')

          const response = await res.json()
          // API returns { success: true, data: [{ key, value, type, group }, ...] }
          const configs: Array<{ key: string; value: string; type: string; group: string }> =
            Array.isArray(response) ? response :
            response.data && Array.isArray(response.data) ? response.data :
            Array.isArray((response as Record<string, unknown>).items) ? (response as Record<string, unknown>).items as Array<{ key: string; value: string; type: string; group: string }> :
            []

          // Transform array of config items into a SiteConfig object
          const configMap: Record<string, string> = {}
          for (const item of configs) {
            configMap[item.key] = item.value
          }

          const siteConfig: SiteConfig = {
            siteName: configMap.site_name || defaultSiteConfig.siteName,
            tagline: configMap.tagline || defaultSiteConfig.tagline,
            description: configMap.description || defaultSiteConfig.description,
            logo: configMap.logo || defaultSiteConfig.logo,
            favicon: configMap.favicon || defaultSiteConfig.favicon,
            primaryColor: configMap.primary_color || defaultSiteConfig.primaryColor,
            secondaryColor: configMap.secondary_color || defaultSiteConfig.secondaryColor,
            accentColor: configMap.accent_color || defaultSiteConfig.accentColor,
            currency: configMap.currency || defaultSiteConfig.currency,
            currencySymbol: configMap.currency_symbol || defaultSiteConfig.currencySymbol,
            phone: configMap.phone || defaultSiteConfig.phone,
            email: configMap.email || defaultSiteConfig.email,
            address: configMap.address || defaultSiteConfig.address,
            socialLinks: {
              facebook: configMap.facebook || defaultSiteConfig.socialLinks.facebook,
              instagram: configMap.instagram || defaultSiteConfig.socialLinks.instagram,
              twitter: configMap.twitter || defaultSiteConfig.socialLinks.twitter,
              youtube: configMap.youtube || defaultSiteConfig.socialLinks.youtube,
            },
            freeShippingThreshold: Number(configMap.freeShippingThreshold || configMap.free_shipping_threshold || configMap.free_delivery_min) || defaultSiteConfig.freeShippingThreshold,
            shippingCharge: Number(configMap.shippingCharge || configMap.standard_delivery_charge || configMap.delivery_charge) || defaultSiteConfig.shippingCharge,
            taxRate: Number(configMap.taxRate) || defaultSiteConfig.taxRate,
            enableCod: configMap.cod_enabled === 'true' || defaultSiteConfig.enableCod,
            enableOnlinePayment: configMap.enableOnlinePayment === 'true' || defaultSiteConfig.enableOnlinePayment,
            minOrderAmount: Number(configMap.minOrderAmount) || defaultSiteConfig.minOrderAmount,
            returnWindowDays: Number(configMap.returnWindowDays) || defaultSiteConfig.returnWindowDays,
            deliveryZones: configMap.deliveryZones ? configMap.deliveryZones.split(',').map((z: string) => z.trim()) : defaultSiteConfig.deliveryZones,
            maintenanceMode: configMap.maintenance_mode === 'true' || defaultSiteConfig.maintenanceMode,
            // ── Homepage business settings (Round 3E) ──
            announcementEnabled: configMap.announcement_enabled === undefined ? defaultSiteConfig.announcementEnabled : configMap.announcement_enabled === 'true',
            announcementText: configMap.announcement_text || defaultSiteConfig.announcementText,
            freeDeliveryEnabled: configMap.free_delivery_enabled === undefined ? defaultSiteConfig.freeDeliveryEnabled : configMap.free_delivery_enabled === 'true',
            freeDeliveryMinAmount: Number(configMap.free_delivery_min_amount) || defaultSiteConfig.freeDeliveryMinAmount,
            freeDeliveryMessage: configMap.free_delivery_message || defaultSiteConfig.freeDeliveryMessage,

            homepagePromoText: configMap.homepage_promo_text || defaultSiteConfig.homepagePromoText,
            flash_sale: configMap.flash_sale, // Raw JSON config from AdminFlashSalePage
          }

          set({ siteConfig, siteConfigLoading: false })
        } catch (error) {
          // Silently fall back to defaults — this fires during dev hot-reloads
          // when the server is briefly unavailable. Logging it spams the console.
          if (process.env.NODE_ENV === 'production') {
            console.error('Failed to load site config:', error)
          }
          set({ siteConfig: defaultSiteConfig, siteConfigLoading: false })
        }
      },

      // ── Session ────────────────────────────────────────────────────────────
      getSessionId: () => getSessionId(),

      getOrCreateSessionId: () => getOrCreateSessionId(),
    }),
    {
      name: 'kk-app-store',
      skipHydration: true,
      storage: createJSONStorage(() => {
        // SSR-safe: return a mock on server side
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
        
        // Client-side: defer writes until after rehydration to prevent
        // overwriting persisted auth data with default state
        return {
          getItem: (name: string) => localStorage.getItem(name),
          setItem: (name: string, value: string) => {
            if (!_storeRehydrated) {
              // Skip writes before rehydration to prevent overwriting persisted data
              return
            }
            localStorage.setItem(name, value)
          },
          removeItem: (name: string) => {
            if (!_storeRehydrated) return
            localStorage.removeItem(name)
          },
        }
      }),
      partialize: (state) => ({
        // Only persist essential fields
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        cartItems: state.cartItems,
        wishlistItems: state.wishlistItems,
        currentPage: state.currentPage,
        pageParams: state.pageParams,
        selectedCategory: state.selectedCategory,
        compareProducts: state.compareProducts,
        recentlyViewed: state.recentlyViewed,
        siteConfig: state.siteConfig,
        notifications: state.notifications,
      }),
    }
  )
)

// Rehydrate synchronously on client side BEFORE any React renders
// This is critical for auth persistence - without this, the default state
// gets written to localStorage before rehydrate() can read the persisted data
if (typeof window !== 'undefined') {
  useAppStore.persist.rehydrate()
  
  // Mark as rehydrated so future writes are allowed
  _storeRehydrated = true
  
  // Write the rehydrated state to localStorage to ensure consistency
  const state = useAppStore.getState()
  const partialState = (useAppStore.persist.getOptions().partialize as any)(state)
  localStorage.setItem('kk-app-store', JSON.stringify({ state: partialState, version: 0 }))
  
  // Expose store for debugging
  ;(window as any).__APP_STORE__ = useAppStore
}
