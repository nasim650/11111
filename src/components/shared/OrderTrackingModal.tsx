'use client'

import { useState } from 'react'
import { Search, Truck, CheckCircle2, Clock, Package, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

interface OrderStatus {
  orderNumber: string
  orderStatus: string
  paymentStatus: string
  createdAt: string
  totalAmount: number
  items: Array<{
    productName: string
    quantity: number
    price: number
  }>
}

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

function getStepIndex(status: string): number {
  const idx = statusSteps.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

export default function OrderTrackingModal() {
  const { isOrderTrackingOpen, orderTrackingId, closeOrderTracking } = useAppStore()
  const [orderNumber, setOrderNumber] = useState(orderTrackingId || '')
  const [order, setOrder] = useState<OrderStatus | null>(null)
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
      setOrder(data)
    } catch {
      setOrder(null)
      toast.error('Order not found. Please check the order number.')
    } finally {
      setLoading(false)
    }
  }

  const currentStep = order ? getStepIndex(order.orderStatus) : 0

  return (
    <Dialog open={isOrderTrackingOpen} onOpenChange={(open) => !open && closeOrderTracking()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Track Your Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter order number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {searched && !order && !loading && (
            <div className="text-center py-6">
              <X className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground">No order found with this number</p>
            </div>
          )}

          {order && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Order #{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={order.orderStatus === 'delivered' ? 'default' : 'secondary'}
                >
                  {order.orderStatus}
                </Badge>
              </div>

              <Separator />

              {/* Status timeline */}
              <div className="relative">
                {statusSteps.map((step, idx) => {
                  const Icon = step.icon
                  const isCompleted = idx <= currentStep
                  const isCurrent = idx === currentStep
                  return (
                    <div key={step.key} className="flex items-start gap-3 mb-4 last:mb-0">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                            isCompleted
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-background border-muted-foreground/30 text-muted-foreground'
                          } ${isCurrent ? 'ring-2 ring-primary/30 ring-offset-2' : ''}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        {idx < statusSteps.length - 1 && (
                          <div
                            className={`w-0.5 h-8 ${
                              idx < currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
                            }`}
                          />
                        )}
                      </div>
                      <div className="pt-1">
                        <p
                          className={`text-sm font-medium ${
                            isCompleted ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Separator />

              <div className="text-sm">
                <p className="text-muted-foreground">
                  Payment: <span className="text-foreground font-medium capitalize">{order.paymentStatus}</span>
                </p>
                <p className="text-muted-foreground">
                  Total: <span className="text-foreground font-medium">৳{order.totalAmount.toLocaleString()}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
