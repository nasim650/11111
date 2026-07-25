'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'
import { authFetch, extractItems } from '@/lib/api'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  TrendingUp,
  Plus,
  Eye,
  Image as ImageIcon,
  Zap,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalCustomers?: number
  totalUsers?: number
  totalCategories?: number
  totalReviews?: number
  pendingOrders?: number
  completedOrders?: number
  newsletterSubscribers?: number
  revenueChange?: number
  ordersChange?: number
  recentOrders: Array<{
    id: string
    orderNumber: string
    customerName: string
    total: number
    status: string
    paymentStatus: string
    createdAt: string
  }>
  lowStockProducts: number | Array<{
    id: string
    name: string
    stock: number
    price: number
  }>
  orderStatusBreakdown?: Array<{ status: string; count: number }>
  revenueChart?: Array<{ month: string; revenue: number }>
  monthlyRevenue?: Record<string, number>
  pendingReviews?: number
}

const defaultStats: DashboardStats = {
  totalRevenue: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalCustomers: 0,
  recentOrders: [],
  lowStockProducts: [],
  revenueChart: [],
  pendingReviews: 0,
  monthlyRevenue: {},
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string
  value: string
  icon: React.ElementType
  description?: string
  trend?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend && <span className="text-green-600 font-medium">{trend}</span>}{' '}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function DashboardHome() {
  const { navigate } = useAppStore()
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/dashboard')
        if (res.ok) {
          const data = await res.json()
          setStats(data.data || data)
        }
      } catch {
        // Use default stats on error
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  useEffect(() => {
    authFetch('/api/orders?limit=5')
      .then((r) => r.json())
      .then((d) => {
        setRecentOrders(extractItems<any>(d))
      })
      .catch(() => {})
    authFetch('/api/products?status=active&limit=50')
      .then((r) => r.json())
      .then((d) => {
        const items = extractItems<any>(d)
        setLowStockProducts(items.filter((p: any) => Number(p.stock ?? 0) <= 10).slice(0, 5))
      })
      .catch(() => {})
  }, [])

  // Convert monthlyRevenue object to chart data array
  const chartData = React.useMemo(() => {
    if (stats?.revenueChart && stats.revenueChart.length > 0) return stats.revenueChart
    const monthly = stats?.monthlyRevenue as Record<string, number> | undefined
    if (monthly && typeof monthly === 'object' && Object.keys(monthly).length > 0) {
      return Object.entries(monthly).map(([month, revenue]) => ({ month, revenue: revenue ?? 0 }))
    }
    return [
      { month: 'Jan', revenue: 0 },
      { month: 'Feb', revenue: 0 },
      { month: 'Mar', revenue: 0 },
      { month: 'Apr', revenue: 0 },
      { month: 'May', revenue: 0 },
      { month: 'Jun', revenue: 0 },
    ]
  }, [stats])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`৳${(stats.totalRevenue ?? 0).toLocaleString()}`}
          icon={DollarSign}
          trend={stats.revenueChange ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}%` : undefined}
          description="from last month"
        />
        <StatCard
          title="Total Orders"
          value={(stats.totalOrders ?? 0).toLocaleString()}
          icon={ShoppingCart}
          trend={stats.ordersChange ? `${stats.ordersChange > 0 ? '+' : ''}${stats.ordersChange}%` : undefined}
          description="from last month"
        />
        <StatCard
          title="Pending Orders"
          value={(stats.pendingOrders ?? 0).toLocaleString()}
          icon={AlertTriangle}
          description="Awaiting processing"
        />
        <StatCard
          title="Total Customers"
          value={(stats.totalCustomers ?? stats.totalUsers ?? 0).toLocaleString()}
          icon={Users}
          description="Registered users"
        />
      </div>
      {/* Second row stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Products"
          value={(stats.totalProducts ?? 0).toLocaleString()}
          icon={Package}
          description="Active products"
        />
        <StatCard
          title="Categories"
          value={(stats.totalCategories ?? 0).toLocaleString()}
          icon={Package}
          description="Product categories"
        />
        <StatCard
          title="Completed Orders"
          value={(stats.completedOrders ?? 0).toLocaleString()}
          icon={ShoppingCart}
          description="Delivered orders"
        />
      </div>

      {/* Recent Orders + Low Stock Alert Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="size-5 text-emerald-600" />
                Recent Orders
              </CardTitle>
              <CardDescription className="text-xs mt-1">Latest 5 customer orders</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('admin-orders')}>
              View All Orders
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                <ShoppingCart className="size-6 mx-auto mb-1 text-gray-300" />
                No recent orders
              </div>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => {
                  const customerName = order?.user?.name || order?.guestName || 'Guest'
                  const statusClass = statusColors[order?.orderStatus] ?? 'bg-gray-100 text-gray-800'
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{order.orderNumber}</span>
                          <Badge
                            variant="outline"
                            className={`${statusClass} border-0 text-[10px] px-1.5 py-0 shrink-0`}
                          >
                            {order.orderStatus}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {customerName} · {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-700 shrink-0">
                        ৳{Number(order.totalAmount ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="h-full border-amber-200 bg-gradient-to-br from-amber-50/40 to-yellow-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                Low Stock Alert
              </CardTitle>
              <CardDescription className="text-xs mt-1">Products with stock ≤ 10</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('admin-products')}>
              View All Products
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                <CheckCircle className="size-6 mx-auto mb-1 text-emerald-400" />
                All products well stocked
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((product) => {
                  const imageUrl = product?.images?.[0]?.url
                  const stock = Number(product.stock ?? 0)
                  const stockColor = stock <= 5 ? 'text-red-600' : 'text-amber-600'
                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
                    >
                      <div className="h-8 w-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.name ?? 'Product'} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">৳{Number(product.price ?? 0).toLocaleString()}</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${stockColor}`}>
                        {stock} left
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart + Low Stock */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" /> Revenue Overview
            </CardTitle>
            <CardDescription>Monthly revenue for the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [`৳${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="oklch(0.44 0.1 155)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-yellow-500" /> Low Stock Alerts
            </CardTitle>
            <CardDescription>Products with stock below 10</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {(Array.isArray(stats.lowStockProducts) ? stats.lowStockProducts : []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {typeof stats.lowStockProducts === 'number' ? `${stats.lowStockProducts} products with low stock` : 'No low stock products'}
                </p>
              ) : (
                (Array.isArray(stats.lowStockProducts) ? stats.lowStockProducts : []).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">৳{product.price}</p>
                    </div>
                    <Badge
                      variant={product.stock <= 0 ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {product.stock} left
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from customers</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('admin-orders')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Array.isArray(stats.recentOrders) ? stats.recentOrders : []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No orders yet
                  </TableCell>
                </TableRow>
              ) : (
                (Array.isArray(stats.recentOrders) ? stats.recentOrders : []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>৳{(order.total ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[order.status] ?? 'bg-gray-100 text-gray-800'}
                        variant="secondary"
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.paymentStatus === 'PAID' ? 'default' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5 text-secondary" />
            Quick Actions
          </CardTitle>
          <CardDescription>Jump to common admin tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group"
              onClick={() => navigate('admin-products')}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plus className="size-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Add Product</p>
                <p className="text-xs text-muted-foreground">Create new product</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group"
              onClick={() => navigate('admin-orders')}
            >
              <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                <Eye className="size-4 text-sky-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">View Orders</p>
                <p className="text-xs text-muted-foreground">Manage orders</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group"
              onClick={() => navigate('admin-banners')}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <ImageIcon className="size-4 text-secondary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Manage Banners</p>
                <p className="text-xs text-muted-foreground">Update hero banners</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
