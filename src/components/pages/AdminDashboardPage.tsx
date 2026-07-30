'use client'

import React, { useEffect, useState } from 'react'
import { useAppStore, type PageName } from '@/lib/store'
import { extractItems, extractPagination } from '@/lib/api'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image,
  ShoppingCart,
  Users,
  Star,
  Ticket,
  FileText,
  Settings,
  Camera,
  ArrowLeft,
  ChevronDown,
  Mail,
Flame,} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DashboardHome from './admin/DashboardHome'
import AdminProductsPage from './admin/AdminProductsPage'
import AdminCategoriesPage from './admin/AdminCategoriesPage'
import AdminBannersPage from './admin/AdminBannersPage'
import AdminOrdersPage from './admin/AdminOrdersPage'
import AdminCustomersPage from './admin/AdminCustomersPage'
import AdminReviewsPage from './admin/AdminReviewsPage'
import AdminCouponsPage from './admin/AdminCouponsPage'
import AdminPolicyPagesPage from './admin/AdminPolicyPagesPage'
import AdminSettingsPage from './admin/AdminSettingsPage'
import AdminMediaPage from './admin/AdminMediaPage'
import AdminPaymentsPage from './admin/AdminPaymentsPage'
import AdminContactMessagesPage from './admin/AdminContactMessagesPage'
import AdminFlashSalePage from './admin/AdminFlashSalePage'

interface NavItem {
  label: string
  page: PageName
  icon: React.ElementType
  badge?: string
}

const mainNav: NavItem[] = [
  { label: 'Dashboard', page: 'admin-dashboard', icon: LayoutDashboard },
  { label: 'Products', page: 'admin-products', icon: Package },
  { label: 'Categories', page: 'admin-categories', icon: FolderTree },
  { label: 'Banners', page: 'admin-banners', icon: Image },
  { label: 'Orders', page: 'admin-orders', icon: ShoppingCart },
  { label: 'Payments', page: 'admin-payments', icon: Ticket },
  { label: 'Customers', page: 'admin-customers', icon: Users },
  { label: 'Reviews', page: 'admin-reviews', icon: Star },
  { label: 'Coupons', page: 'admin-coupons', icon: Ticket },
  { label: 'Flash Sale', page: 'admin-flash-sale', icon: Flame },
  { label: 'Policy Pages', page: 'admin-policy-pages', icon: FileText },
  { label: 'Media Library', page: 'admin-media', icon: Camera },
  { label: 'Messages', page: 'admin-contact-messages', icon: Mail },
  { label: 'Site Settings', page: 'admin-settings', icon: Settings },
]

function renderPage(page: PageName) {
  switch (page) {
    case 'admin-dashboard':
      return <DashboardHome />
    case 'admin-products':
      return <AdminProductsPage />
    case 'admin-categories':
      return <AdminCategoriesPage />
    case 'admin-banners':
      return <AdminBannersPage />
    case 'admin-orders':
      return <AdminOrdersPage />
    case 'admin-payments':
      return <AdminPaymentsPage />
    case 'admin-customers':
      return <AdminCustomersPage />
    case 'admin-reviews':
      return <AdminReviewsPage />
    case 'admin-coupons':
      return <AdminCouponsPage />
    case 'admin-flash-sale':
      return <AdminFlashSalePage />
    case 'admin-policy-pages':
      return <AdminPolicyPagesPage />
    case 'admin-settings':
      return <AdminSettingsPage />
    case 'admin-media':
      return <AdminMediaPage />
    case 'admin-contact-messages':
      return <AdminContactMessagesPage />
    default:
      return <DashboardHome />
  }
}

function getPageTitle(page: PageName): string {
  const item = mainNav.find((n) => n.page === page)
  return item?.label ?? 'Dashboard'
}

export default function AdminDashboardPage() {
  const { currentPage, navigate, user, siteConfig } = useAppStore()
  const [contactUnreadCount, setContactUnreadCount] = useState(0)

  useEffect(() => {
    async function fetchContactUnread() {
      try {
        const token = useAppStore.getState().accessToken
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/contact?limit=1&isRead=false', { headers })
        if (res.ok) {
          const data = await res.json()
          const pagination = extractPagination(data)
          setContactUnreadCount(pagination.total)
        }
      } catch {
        // silent
      }
    }
    fetchContactUnread()
    const interval = setInterval(fetchContactUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SidebarProvider>
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r-0">
        <SidebarHeader className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            {siteConfig?.logo ? (
              <img
                src={siteConfig.logo}
                alt="Khati Khadyo"
                className="h-8 w-auto object-contain rounded-md group-data-[collapsible=icon]:mx-auto"
              />
            ) : (
              <img
                src="/all_logo.png"
                alt="Khati Khadyo"
                className="h-8 w-auto object-contain rounded-md group-data-[collapsible=icon]:mx-auto"
              />
            )}
            <div className="group-data-[collapsible=icon]:hidden">
              <h2 className="text-sm font-bold leading-tight">Khati Khadyo</h2>
              <p className="text-xs text-primary-foreground/70">Admin Panel</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator className="bg-primary-foreground/20" />

        <SidebarContent className="bg-primary text-primary-foreground px-2">
          <SidebarGroup>
            <SidebarGroupLabel className="text-primary-foreground/60 group-data-[collapsible=icon]:hidden">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNav.map((item) => {
                  const isActive = currentPage === item.page
                  const dynamicBadge = item.page === 'admin-contact-messages' && contactUnreadCount > 0
                    ? String(contactUnreadCount)
                    : item.badge
                  return (
                    <SidebarMenuItem key={item.page}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => navigate(item.page)}
                        tooltip={item.label}
                        className={`${
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30'
                            : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'
                        } transition-colors`}
                      >
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                        {dynamicBadge && (
                          <Badge variant="secondary" className="ml-auto text-xs bg-amber-500 text-white hover:bg-amber-600">
                            {dynamicBadge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator className="bg-primary-foreground/20" />

        <SidebarFooter className="bg-primary text-primary-foreground p-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="User"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-medium">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
              </div>
            )}
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-medium truncate">
                {user?.name ?? 'Admin'}
              </p>
              <p className="text-xs text-primary-foreground/60 truncate">
                {user?.email ?? 'admin@khatikhadyo.com'}
              </p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 sticky top-0 z-20">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">{getPageTitle(currentPage)}</h1>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('home')}
              className="gap-1"
              title="Back to Site"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline text-sm">View Site</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
                  </div>
                  <span className="hidden sm:inline text-sm">{user?.name ?? 'Admin'}</span>
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('admin-settings')}>
                  <Settings className="mr-2 size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('home')}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Site
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {renderPage(currentPage)}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
