'use client'

import { useState } from 'react'
import {
  Search, Truck, CheckCircle2, Clock, Package, X, ArrowRight,
  Phone, Mail, Calendar, MapPin, HelpCircle, Box
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Clock, desc: 'Your order has been received' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, desc: 'Your order has been confirmed' },
  { key: 'processing', label: 'Processing', icon: Package, desc: 'Your order is being prepared' },
  { key: 'shipped', label: 'Shipped', icon: Truck, desc: 'Your order is on the way' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Your order has been delivered' },
]

function getStepIndex(status: string): number {
  if (status === 'cancelled') return -1
  const idx = statusSteps.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

interface OrderItem {
  productName: string
  quantity: number
  price: number
  image?: string
}

interface OrderData {
  orderNumber: string
  orderStatus: string
  paymentStatus: string
  createdAt: string
  totalAmount: number
  items: OrderItem[]
  shippingAddress?: string
  estimatedDelivery?: string
}

export default function OrderTrackingPage() {
  const { navigate } = useAppStore()
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!orderNumber.trim()) {
      toast.error('Please enter an order number')
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/orders/${orderNumber.trim()}`)
      if (!res.ok) throw new Error('Order not found')
      const data = await res.json()
      const orderData = data.data || data
      setOrder(orderData)
    } catch {
      setOrder(null)
      toast.error('Order not found')
    } finally {
      setLoading(false)
    }
  }

  const currentStep = order ? getStepIndex(order.orderStatus) : 0
  const isCancelled = order?.orderStatus === 'cancelled'

  // Calculate estimated delivery
  const getEstimatedDelivery = () => {
    if (!order) return null
    if (order.orderStatus === 'delivered') return null
    if (order.orderStatus === 'cancelled') return null
    if (order.estimatedDelivery) return order.estimatedDelivery
    const created = new Date(order.createdAt)
    const estimated = new Date(created)
    estimated.setDate(estimated.getDate() + 5)
    return estimated.toISOString()
  }

  const estimatedDelivery = getEstimatedDelivery()

  return (
    <div className="min-h-screen">
      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-primary via-emerald-700 to-emerald-800 text-white py-12 sm:py-16 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="tracking-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <circle cx="40" cy="40" r="15" fill="none" stroke="white" strokeWidth="0.5" />
                <path d="M40 25 L40 55 M25 40 L55 40" stroke="white" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#tracking-pattern)" />
          </svg>
        </div>
        <div className="absolute top-8 right-12 w-32 h-32 rounded-full border-2 border-white/10" />
        <div className="absolute bottom-8 left-12 w-24 h-24 rounded-full border-2 border-white/10" />

        <div className="container mx-auto px-4 relative z-10 max-w-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Truck className="h-8 w-8 text-secondary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Track Your Order</h1>
          <p className="text-white/70 mb-8 text-lg">Enter your order number to check the delivery status</p>

          {/* Large Search Form */}
          <div className="flex gap-3 max-w-xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <Input
                placeholder="Enter order number (e.g., ORD-2024-001)"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-14 pl-12 pr-4 text-base rounded-xl bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/40 focus-visible:border-white/40"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="h-14 px-8 rounded-xl bg-secondary hover:bg-secondary/90 text-white font-semibold shadow-lg shadow-secondary/20 text-base"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Track
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* No result */}
        {searched && !order && !loading && (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <X className="h-12 w-12 text-red-300" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Order Not Found</h3>
            <p className="text-muted-foreground mb-6">
              Please check the order number and try again
            </p>
            <Button variant="outline" className="rounded-xl" onClick={() => { setSearched(false); setOrderNumber('') }}>
              Try Again
            </Button>
          </div>
        )}

        {/* Order found */}
        {order && (
          <div className="space-y-6">
            {/* Order Header Card */}
            <Card className="rounded-xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-lg flex items-center gap-2">
                      <Box className="h-5 w-5 text-primary" />
                      Order #{order.orderNumber}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <Badge className={`text-sm px-3 py-1 ${isCancelled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                    {order.orderStatus}
                  </Badge>
                </div>

                {/* Estimated Delivery */}
                {estimatedDelivery && !isCancelled && (
                  <div className="bg-primary/5 rounded-xl p-4 flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated Delivery</p>
                      <p className="font-semibold text-primary">
                        {new Date(estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {order.shippingAddress && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{order.shippingAddress}</span>
                  </div>
                )}

                <Separator className="my-5" />

                {/* Animated Timeline */}
                {!isCancelled ? (
                  <div className="space-y-0">
                    {statusSteps.map((step, idx) => {
                      const Icon = step.icon
                      const isCompleted = idx <= currentStep
                      const isCurrent = idx === currentStep
                      return (
                        <div key={step.key} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`h-12 w-12 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${
                                isCompleted
                                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                  : 'bg-background border-muted-foreground/20 text-muted-foreground'
                              } ${isCurrent ? 'scale-110 ring-4 ring-primary/20' : ''}`}
                            >
                              <Icon className={`h-5 w-5 ${isCurrent ? 'animate-pulse' : ''}`} />
                            </div>
                            {idx < statusSteps.length - 1 && (
                              <div
                                className={`w-0.5 h-14 transition-all duration-700 ${
                                  idx < currentStep ? 'bg-primary' : 'bg-muted-foreground/15'
                                }`}
                              >
                                {idx < currentStep && (
                                  <div className="w-0.5 h-full bg-primary animate-in slide-in-from-top duration-500" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="pt-2.5 pb-8">
                            <p className={`font-semibold text-sm ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </p>
                            <p className={`text-xs mt-0.5 ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                              {step.desc}
                            </p>
                            {isCurrent && (
                              <Badge className="mt-2 bg-primary/10 text-primary text-xs border border-primary/20">
                                Current Status
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                      <X className="h-8 w-8 text-red-500" />
                    </div>
                    <p className="font-semibold text-red-700">This order has been cancelled</p>
                    <p className="text-sm text-muted-foreground mt-1">Contact support for more information</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary with Product Images */}
            <Card className="rounded-xl">
              <CardContent className="p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Order Summary
                </h3>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="w-14 h-14 rounded-lg bg-muted/30 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ৳{item.price.toLocaleString()}</p>
                      </div>
                      <p className="font-semibold text-sm flex-shrink-0">৳{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">৳{order.totalAmount.toLocaleString()}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    Payment: {order.paymentStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card className="rounded-xl">
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Need Help?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Having issues with your order? Our support team is here to help.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" className="rounded-xl flex-1" onClick={() => navigate('contact')}>
                    <Phone className="h-4 w-4 mr-2" /> Contact Support
                  </Button>
                  <Button variant="outline" className="rounded-xl flex-1" onClick={() => navigate('contact')}>
                    <Mail className="h-4 w-4 mr-2" /> Email Us
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => navigate('order-detail', { id: order.orderNumber })}
            >
              View Full Order Details <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Initial state */}
        {!searched && !order && (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-6">
              <Truck className="h-12 w-12 text-primary/30" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Track Your Order</h3>
            <p className="text-muted-foreground">Enter your order number above to check its status</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" className="rounded-xl" onClick={() => navigate('orders')}>
                <Package className="h-4 w-4 mr-2" /> View My Orders
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate('contact')}>
                <HelpCircle className="h-4 w-4 mr-2" /> Contact Support
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
