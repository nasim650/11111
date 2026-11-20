'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminDashboardPage from '@/components/pages/AdminDashboardPage'
import { setAppRouter, useAppStore, type PageName } from '@/lib/store'

const routePages: Record<string, PageName> = {
  '': 'admin-dashboard',
  dashboard: 'admin-dashboard',
  products: 'admin-products',
  categories: 'admin-categories',
  banners: 'admin-banners',
  orders: 'admin-orders',
  payments: 'admin-payments',
  customers: 'admin-customers',
  reviews: 'admin-reviews',
  coupons: 'admin-coupons',
  'flash-sale': 'admin-flash-sale',
  'policy-pages': 'admin-policy-pages',
  settings: 'admin-settings',
  media: 'admin-media',
  'contact-messages': 'admin-contact-messages',
  'homepage-content': 'admin-homepage-content',
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

export default function AdminRoutePage({ route }: { route: string }) {
  const router = useRouter()
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated())
  const user = useAppStore((state) => state.user)
  const accessToken = useAppStore((state) => state.accessToken)
  const loadSiteConfig = useAppStore((state) => state.loadSiteConfig)
  const page = routePages[route] ?? 'admin-dashboard'
  const isAuthorized = user?.role === 'admin' && Boolean(accessToken)

  useEffect(() => {
    setAppRouter(router)
    const unsubscribe = useAppStore.persist.onFinishHydration(() => setHydrated(true))
    if (!useAppStore.persist.hasHydrated()) {
      void useAppStore.persist.rehydrate()
    }
    return unsubscribe
  }, [router])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthorized) {
      router.replace(`/login?next=${encodeURIComponent(`/admin/${route}`.replace(/\/$/, ''))}`)
      return
    }
    useAppStore.setState({ currentPage: page, pageParams: {} })
    void loadSiteConfig()
  }, [hydrated, isAuthorized, loadSiteConfig, page, route, router])

  if (!hydrated || !isAuthorized) {
    return <PageLoader />
  }

  return <AdminDashboardPage />
}
