'use client'

import React, { useEffect, useState, useRef } from 'react'
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
  Printer,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Tag,
  Receipt,
  Truck,
  Loader2,
  XCircle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

interface PrintQueueRecentItem {
  id: string
  documentType: string
  status: string
  createdAt: string
  orderNumber: string
  customerName: string
}

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
  printQueue?: {
    pending: number
    printing: number
    printed: number
    failed: number
    total: number
    recentItems: PrintQueueRecentItem[]
  }
  loyaltyPoints?: {
    totalIssued: number
    totalRedeemed: number
    totalBalance: number
  }
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

const PRINT_QUEUE_STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
  PENDING: { color: 'text-yellow-700', icon: Clock, bg: 'bg-yellow-50 border-yellow-200' },
  PRINTING: { color: 'text-blue-700', icon: Loader2, bg: 'bg-blue-50 border-blue-200' },
  PRINTED: { color: 'text-emerald-700', icon: CheckCircle, bg: 'bg-emerald-50 border-emerald-200' },
  FAILED: { color: 'text-red-700', icon: XCircle, bg: 'bg-red-50 border-red-200' },
}

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  'invoice': FileText,
  'packing-slip': Package,
  'delivery-label': Tag,
  'thermal-receipt': Receipt,
  'courier-label': Truck,
}

const DOC_TYPE_LABELS: Record<string, string> = {
  'invoice': 'Invoice',
  'packing-slip': 'Packing Slip',
  'delivery-label': 'Delivery Label',
  'thermal-receipt': 'Thermal Receipt',
  'courier-label': 'Courier Label',
}

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 800) {
  const [count, setCount] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target

    const start = 0
    const diff = target - start
    const startTime = performance.now()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + diff * eased))
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [target, duration])

  return count
}

export default function DashboardHome() {
  const { navigate } = useAppStore()
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [loading, setLoading] = useState(true)

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

  // Animated loyalty points values
  const animatedIssued = useAnimatedCounter(stats.loyaltyPoints?.totalIssued || 0)
  const animatedBalance = useAnimatedCounter(stats.loyaltyPoints?.totalBalance || 0)

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

  const printQueue = stats.printQueue || { pending: 0, printing: 0, printed: 0, failed: 0, total: 0, recentItems: [] }
  const loyaltyPts = stats.loyaltyPoints || { totalIssued: 0, totalRedeemed: 0, totalBalance: 0 }

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

      {/* Print Queue Summary + Loyalty Points Summary Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Print Queue Summary Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Printer className="size-5 text-emerald-600" />
                  Print Queue Summary
                </CardTitle>
                <CardDescription className="text-xs mt-1">Document queue status overview</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center p-2 bg-yellow-50 rounded-lg">
                  <p className="text-lg font-bold text-yellow-700">{printQueue.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-700">{printQueue.printing}</p>
                  <p className="text-[10px] text-muted-foreground">Printing</p>
                </div>
                <div className="text-center p-2 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-bold text-emerald-700">{printQueue.printed}</p>
                  <p className="text-[10px] text-muted-foreground">Printed</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-700">{printQueue.failed}</p>
                  <p className="text-[10px] text-muted-foreground">Failed</p>
                </div>
              </div>

              {/* Warning for pending items */}
              {printQueue.pending > 0 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-700">
                    {printQueue.pending} document{printQueue.pending !== 1 ? 's' : ''} pending in queue
                  </span>
                </div>
              )}

              {/* Recent Queue Items */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recent Activity</p>
                {printQueue.recentItems && printQueue.recentItems.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    <AnimatePresence>
                      {printQueue.recentItems.map((item, index) => {
                        const statusCfg = PRINT_QUEUE_STATUS_CONFIG[item.status] || PRINT_QUEUE_STATUS_CONFIG.PENDING
                        const StatusIcon = statusCfg.icon
                        const DocIcon = DOC_TYPE_ICONS[item.documentType] || FileText
                        const docLabel = DOC_TYPE_LABELS[item.documentType] || item.documentType

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-xs"
                          >
                            <DocIcon className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium shrink-0">{item.orderNumber}</span>
                            <span className="text-muted-foreground truncate">{docLabel}</span>
                            <Badge
                              variant="outline"
                              className={`${statusCfg.bg} ${statusCfg.color} border-0 text-[10px] ml-auto px-1.5 py-0 gap-0.5 shrink-0`}
                            >
                              <StatusIcon className={`size-2.5 ${item.status === 'PRINTING' ? 'animate-spin' : ''}`} />
                              {item.status}
                            </Badge>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    <Printer className="size-6 mx-auto mb-1 text-gray-300" />
                    No items in print queue
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loyalty Points Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="h-full bg-gradient-to-br from-amber-50/50 to-yellow-50/50 border-amber-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="size-5 text-amber-500" />
                Loyalty Points Summary
              </CardTitle>
              <CardDescription className="text-xs mt-1">Customer rewards program overview</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Main stat */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200">
                  <Star className="size-8 text-white fill-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-700">{animatedBalance.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Points Active</p>
                  <p className="text-sm font-medium text-amber-600">≈ ৳{animatedBalance.toLocaleString()} value</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/70 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="size-3 text-emerald-600" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Total Issued</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700">{animatedIssued.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">points earned by customers</p>
                </div>
                <div className="p-3 bg-white/70 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                      <ShoppingCart className="size-3 text-rose-600" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Total Redeemed</span>
                  </div>
                  <p className="text-lg font-bold text-rose-700">{(loyaltyPts.totalRedeemed || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">points used at checkout</p>
                </div>
              </div>

              {/* Earning rule info */}
              <div className="mt-4 p-2 bg-amber-100/50 rounded-md">
                <p className="text-[10px] text-amber-700">
                  💡 1 point per ৳100 spent on delivered orders • 50 bonus points on first order
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
