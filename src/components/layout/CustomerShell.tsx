'use client'

import { useEffect, ReactNode } from 'react'
import { useAppStore } from '@/lib/store'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CartSidebar from '@/components/shared/CartSidebar'
import MobileCartBar from '@/components/shared/MobileCartBar'
import QuickViewModal from '@/components/shared/QuickViewModal'
import OrderTrackingModal from '@/components/shared/OrderTrackingModal'

export interface CustomerShellProps {
  children: ReactNode
}

/**
 * Common Shell for customer-facing pages (Navbar, Content, Footer, Overlays, and Store Initialization).
 */
export default function CustomerShell({ children }: CustomerShellProps) {
  const loadUser = useAppStore((s) => s.loadUser)
  const loadCart = useAppStore((s) => s.loadCart)
  const loadWishlist = useAppStore((s) => s.loadWishlist)
  const loadSiteConfig = useAppStore((s) => s.loadSiteConfig)

  useEffect(() => {
    loadUser()
    loadSiteConfig()
    loadCart()
    loadWishlist()
  }, [loadUser, loadCart, loadWishlist, loadSiteConfig])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />

      {/* Global Overlays */}
      <CartSidebar />
      <MobileCartBar />
      <QuickViewModal />
      <OrderTrackingModal />
    </div>
  )
}
