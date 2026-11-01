'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  MapPin,
  CreditCard,
  ArrowLeft,
  ShoppingBag,
  Info,
  Calendar,
  FileText,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatPrice } from '@/lib/utils'
import type { SafeOrderDetails } from '@/lib/order-authorization'

interface OrderDetailViewProps {
  order: SafeOrderDetails
  paymentCallbackStatus?: string
}

const statusBadgeVariant: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  out_for_delivery: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  returned: 'bg-gray-100 text-gray-800 border-gray-200',
}

const paymentBadgeVariant: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  refunded: 'bg-purple-100 text-purple-800 border-purple-200',
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cod: 'Cash on Delivery (COD)',
    online: 'SSLCOMMERZ Online Payment',
    card: 'Credit / Debit Card',
    bkash: 'bKash Mobile Banking',
    nagad: 'Nagad Mobile Banking',
  }
  return map[method] || method.toUpperCase()
}

export default function OrderDetailView({
  order,
  paymentCallbackStatus,
}: OrderDetailViewProps) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const isCancelled = order.orderStatus === 'cancelled'
  const isDelivered = order.orderStatus === 'delivered'

  // Timeline step calculation
  const timelineSteps = [
    { key: 'pending', label: 'Order Placed', desc: 'Received successfully' },
    { key: 'processing', label: 'Processing', desc: 'Preparing authentic items' },
    { key: 'shipped', label: 'Shipped', desc: 'Handed over for delivery' },
    { key: 'delivered', label: 'Delivered', desc: 'Delivered to your address' },
  ]

  const getStepStatus = (stepKey: string) => {
    if (isCancelled) return 'cancelled'
    const stepOrder = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']
    const currentIndex = stepOrder.indexOf(order.orderStatus)
    const targetIndex = stepOrder.indexOf(stepKey)
    if (currentIndex >= targetIndex) return 'completed'
    return 'upcoming'
  }

  const itemsSubtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-primary transition-colors">
          Catalog
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Order #{order.orderNumber}</span>
      </div>

      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-2xl p-6 shadow-sm mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Order #{order.orderNumber}
            </h1>
            <Badge
              variant="outline"
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                statusBadgeVariant[order.orderStatus] || 'bg-muted text-muted-foreground'
              }`}
            >
              Status: {order.orderStatus.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                paymentBadgeVariant[order.paymentStatus] || 'bg-muted text-muted-foreground'
              }`}
            >
              Payment: {order.paymentStatus.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Placed on {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/products">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
              <ShoppingBag className="h-4 w-4" /> Continue Shopping
            </Button>
          </Link>
        </div>
      </div>

      {/* Payment Gateway Notice / Status Banner */}
      {paymentCallbackStatus === 'success' && order.paymentStatus === 'pending' && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Payment Received — Awaiting Verification</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Your SSLCOMMERZ payment redirect has completed. The order status will automatically transition to Paid upon server-to-server IPN verification. Your reserved inventory remains secured.
            </p>
          </div>
        </div>
      )}

      {(paymentCallbackStatus === 'fail' || order.paymentStatus === 'failed') && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Payment Not Completed</p>
            <p className="text-xs text-red-700 mt-0.5">
              The payment attempt was not completed. Reserved items have been released. You may choose Cash on Delivery or place a new order anytime.
            </p>
          </div>
        </div>
      )}

      {paymentCallbackStatus === 'cancel' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Payment Cancelled</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You cancelled the online payment process. No money was deducted.
            </p>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <Card className="border shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Delivery Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCancelled ? (
            <div className="p-4 rounded-xl bg-red-50 text-red-800 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-semibold">Order Cancelled</p>
                <p className="text-xs text-red-700">This order was cancelled and will not be shipped.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {timelineSteps.map((step, idx) => {
                const status = getStepStatus(step.key)
                const isCompleted = status === 'completed'
                return (
                  <div key={step.key} className="flex flex-col items-center text-center">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                    </div>
                    <p className={`text-xs font-semibold ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {step.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Grid: Items and Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Line Items List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Items in Order ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="py-4 flex items-center gap-4 first:pt-0 last:pb-0">
                  <div className="relative h-16 w-16 rounded-xl bg-muted overflow-hidden flex-shrink-0 border">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.slug ? (
                      <Link
                        href={`/products/${item.slug}`}
                        className="text-sm font-semibold hover:text-primary transition-colors line-clamp-1"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold line-clamp-1">{item.productName}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Unit: {item.unit} | Qty: {item.quantity}
                    </p>
                    <p className="text-xs font-medium text-primary mt-1">
                      {formatPrice(item.price)} each
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Customer Note if exists */}
          {order.orderNote && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Order Instructions / Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground bg-muted/40 p-3 rounded-lg border">
                  &ldquo;{order.orderNote}&rdquo;
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary & Delivery Address */}
        <div className="space-y-4">
          {/* Order Financial Summary */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(itemsSubtotal || order.totalAmount - order.deliveryCharge + order.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Delivery Charge</span>
                <span>{order.deliveryCharge === 0 ? 'FREE' : formatPrice(order.deliveryCharge)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-medium">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold text-foreground pt-1">
                <span>Total Amount</span>
                <span className="text-primary">{formatPrice(order.totalAmount)}</span>
              </div>

              <div className="pt-2 text-xs text-muted-foreground border-t">
                <span className="font-medium text-foreground">Method:</span>{' '}
                {formatPaymentMethod(order.paymentMethod)}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Delivery Destination
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <p className="font-semibold text-sm text-foreground">
                {order.user?.name || order.guestName || 'Customer'}
              </p>
              <p className="text-muted-foreground">
                Phone: {order.user?.phone || order.guestPhone || 'Not provided'}
              </p>
              {(order.user?.email || order.guestEmail) && (
                <p className="text-muted-foreground">
                  Email: {order.user?.email || order.guestEmail}
                </p>
              )}
              <div className="pt-2 border-t mt-2">
                <p className="text-muted-foreground font-medium">Address:</p>
                <p className="text-foreground mt-0.5 whitespace-pre-line">
                  {order.guestAddress || 'Registered delivery address'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
