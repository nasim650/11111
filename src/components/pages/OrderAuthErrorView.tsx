'use client'

import Link from 'next/link'
import { ShieldAlert, Lock, ArrowLeft, LogIn, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'

interface OrderAuthErrorViewProps {
  status: 401 | 403
  error: string
  orderNumber: string
}

export default function OrderAuthErrorView({
  status,
  error,
  orderNumber,
}: OrderAuthErrorViewProps) {
  const navigate = useAppStore((s) => s.navigate)

  const is401 = status === 401

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border shadow-sm text-center">
        <CardHeader className="pb-3 flex flex-col items-center">
          <div
            className={`h-16 w-16 rounded-full flex items-center justify-center mb-3 ${
              is401 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {is401 ? <Lock className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
          </div>
          <CardTitle className="text-xl font-bold">
            {is401 ? 'Sign In Required' : 'Access Denied'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {is401
              ? `Order #${orderNumber} requires authentication. Please sign in with the customer account used to place this order.`
              : `You do not have permission to view Order #${orderNumber}. This order is protected and cannot be viewed by other customer accounts.`}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            {is401 ? (
              <Button
                className="w-full sm:w-auto font-semibold gap-1.5"
                onClick={() => navigate('login')}
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Button>
            ) : (
              <Link href="/products" className="w-full sm:w-auto">
                <Button className="w-full font-semibold gap-1.5" variant="default">
                  <ShoppingBag className="h-4 w-4" /> Browse Catalog
                </Button>
              </Link>
            )}

            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full font-semibold gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
