'use client'

import { useEffect, lazy, Suspense } from 'react'
import { useAppStore, type PageName } from '@/lib/store'
import { toast } from 'sonner'

// Eagerly load HomePage for instant first paint
import HomePage from '@/components/pages/HomePage'

// Lazy-loaded Customer Pages (code splitting)
const ProductsPage = lazy(() => import('@/components/pages/ProductsPage'))
const ProductDetailPage = lazy(() => import('@/components/pages/ProductDetailPage'))
const CartPage = lazy(() => import('@/components/pages/CartPage'))
const CheckoutPage = lazy(() => import('@/components/pages/CheckoutPage'))
const LoginPage = lazy(() => import('@/components/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/components/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/components/pages/ForgotPasswordPage'))
const ProfilePage = lazy(() => import('@/components/pages/ProfilePage'))
const OrdersPage = lazy(() => import('@/components/pages/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/components/pages/OrderDetailPage'))
const OrderConfirmationPage = lazy(() => import('@/components/pages/OrderConfirmationPage'))
const OrderTrackingPage = lazy(() => import('@/components/pages/OrderTrackingPage'))
const WishlistPage = lazy(() => import('@/components/pages/WishlistPage'))
const ContactPage = lazy(() => import('@/components/pages/ContactPage'))
const TermsPage = lazy(() => import('@/components/pages/TermsPage'))
const PrivacyPage = lazy(() => import('@/components/pages/PrivacyPage'))
const ReturnPolicyPage = lazy(() => import('@/components/pages/ReturnPolicyPage'))
const DeliveryPolicyPage = lazy(() => import('@/components/pages/DeliveryPolicyPage'))
const PolicyPage = lazy(() => import('@/components/pages/PolicyPage'))

// Lazy-loaded Admin Pages (heavy deps loaded on demand)
const AdminDashboardPage = lazy(() => import('@/components/pages/AdminDashboardPage'))

// Layout
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

// Shared
import CartSidebar from '@/components/shared/CartSidebar'
import QuickViewModal from '@/components/shared/QuickViewModal'
import OrderTrackingModal from '@/components/shared/OrderTrackingModal'

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
)

const adminPages = new Set<PageName>([
  'admin-dashboard',
  'admin-products',
  'admin-orders',
  'admin-payments',
  'admin-customers',
  'admin-reviews',
  'admin-coupons',
  'admin-banners',
  'admin-policy-pages',
  'admin-settings',
  'admin-media',
  'admin-categories',
  'admin-contact-messages',
])

function CustomerPageRenderer() {
  const currentPage = useAppStore((s) => s.currentPage)

  switch (currentPage) {
    case 'home':
      return <HomePage />
    case 'products':
      return <Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>
    case 'product-detail':
      return <Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense>
    case 'cart':
      return <Suspense fallback={<PageLoader />}><CartPage /></Suspense>
    case 'checkout':
      return <Suspense fallback={<PageLoader />}><CheckoutPage /></Suspense>
    case 'login':
      return <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>
    case 'register':
      return <Suspense fallback={<PageLoader />}><RegisterPage /></Suspense>
    case 'forgot-password':
      return <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense>
    case 'profile':
      return <Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>
    case 'orders':
      return <Suspense fallback={<PageLoader />}><OrdersPage /></Suspense>
    case 'order-detail':
      return <Suspense fallback={<PageLoader />}><OrderDetailPage /></Suspense>
    case 'order-confirmation':
      return <Suspense fallback={<PageLoader />}><OrderConfirmationPage /></Suspense>
    case 'order-tracking':
      return <Suspense fallback={<PageLoader />}><OrderTrackingPage /></Suspense>
    case 'wishlist':
      return <Suspense fallback={<PageLoader />}><WishlistPage /></Suspense>
    case 'contact':
      return <Suspense fallback={<PageLoader />}><ContactPage /></Suspense>
    case 'terms':
      return <Suspense fallback={<PageLoader />}><TermsPage /></Suspense>
    case 'privacy':
      return <Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>
    case 'return-policy':
      return <Suspense fallback={<PageLoader />}><ReturnPolicyPage /></Suspense>
    case 'delivery-policy':
      return <Suspense fallback={<PageLoader />}><DeliveryPolicyPage /></Suspense>
    case 'policy':
      return <Suspense fallback={<PageLoader />}><PolicyPage /></Suspense>
    default:
      return <HomePage />
  }
}

export default function Home() {
  const currentPage = useAppStore((s) => s.currentPage)
  const user = useAppStore((s) => s.user)
  const accessToken = useAppStore((s) => s.accessToken)
  const navigate = useAppStore((s) => s.navigate)
  const loadUser = useAppStore((s) => s.loadUser)
  const clearCart = useAppStore((s) => s.clearCart)
  const loadCart = useAppStore((s) => s.loadCart)
  const loadWishlist = useAppStore((s) => s.loadWishlist)
  const loadSiteConfig = useAppStore((s) => s.loadSiteConfig)

  // Load initial data after mount
  useEffect(() => {
    loadUser()
    loadSiteConfig()
    loadCart()
    loadWishlist()
  }, [loadUser, loadCart, loadWishlist, loadSiteConfig])

  // Handle SSLCommerz payment return
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')
    const orderId = params.get('orderId')

    if (paymentStatus === 'success' && orderId) {
      window.history.replaceState({}, '', '/')
      clearCart?.()
      toast.success('Payment successful! Your order has been placed.')
      navigate('order-confirmation', { orderId })
    } else if (paymentStatus === 'fail') {
      window.history.replaceState({}, '', '/')
      toast.error('Payment failed. Please try again or choose a different payment method.')
      navigate('orders')
    }
  }, [clearCart, navigate])

  useEffect(() => {
    if (adminPages.has(currentPage) && (user?.role !== 'admin' || !accessToken)) {
      navigate('login')
    }
  }, [accessToken, currentPage, navigate, user])

  const isAdminPage = adminPages.has(currentPage)

  if (isAdminPage) {
    if (user?.role !== 'admin' || !accessToken) {
      return null
    }

    return (
      <div className="min-h-screen">
        <Suspense fallback={<PageLoader />}>
          <AdminDashboardPage />
        </Suspense>
        <QuickViewModal />
        <OrderTrackingModal />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          }
        >
          <CustomerPageRenderer />
        </Suspense>
      </main>
      <Footer />

      {/* Global overlays */}
      <CartSidebar />
      <QuickViewModal />
      <OrderTrackingModal />
    </div>
  )
}
