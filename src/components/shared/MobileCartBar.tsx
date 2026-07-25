'use client'

import { ShoppingCart, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

/**
 * MobileCartBar
 * -------------
 * A sticky bottom cart bar shown only on mobile (lg:hidden) when the cart has
 * items. Provides quick access to the cart page and checkout flow without
 * requiring the user to open the cart sidebar/drawer.
 *
 * - Left   : cart icon with item count badge (amber, theme-consistent)
 * - Center : "View Cart" label + formatted subtotal (৳ amount)
 * - Right  : emerald "Checkout →" button (rounded-full)
 *
 * The whole bar is clickable (navigates to the cart page) EXCEPT the checkout
 * button which stops propagation and navigates to checkout.
 *
 * Safe-area inset is honored so the bar doesn't get clipped on devices with
 * home indicators (iOS) or gesture nav (Android).
 */
export default function MobileCartBar() {
  const cartItems = useAppStore((s) => s.cartItems)
  const totalItems = useAppStore((s) => s.totalItems)
  const subtotal = useAppStore((s) => s.subtotal)
  const navigate = useAppStore((s) => s.navigate)

  const itemCount = totalItems()
  const cartSubtotal = subtotal()

  return (
    <AnimatePresence>
      {cartItems.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t shadow-lg"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Clickable bar — navigates to cart page */}
          <div
            onClick={() => navigate('cart')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('cart')
              }
            }}
            className="flex items-center justify-between gap-3 px-4 pt-3 pb-3 cursor-pointer select-none"
            aria-label={`View cart with ${itemCount} ${itemCount === 1 ? 'item' : 'items'}, total ৳${cartSubtotal.toLocaleString()}`}
          >
            {/* Left: cart icon + count badge */}
            <div className="relative shrink-0">
              <div className="size-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <ShoppingCart className="size-5 text-emerald-700" />
              </div>
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-amber-500 text-white rounded-full border-2 border-background">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            </div>

            {/* Center: view-cart label + total amount */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[11px] leading-tight text-muted-foreground">
                View Cart
              </p>
              <p className="text-base font-bold leading-tight text-emerald-700 truncate">
                ৳{cartSubtotal.toLocaleString()}
              </p>
            </div>

            {/* Right: checkout button (emerald, rounded-full) */}
            <Button
              onClick={(e) => {
                e.stopPropagation()
                navigate('checkout')
              }}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0 shadow-sm"
              size="sm"
            >
              Checkout
              <ArrowRight className="size-4 ml-0.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
