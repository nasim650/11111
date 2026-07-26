'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, Package } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Package className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">404</h1>
      <h2 className="text-xl font-semibold text-foreground mb-3">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8 text-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button asChild variant="default" className="gap-2">
        <Link href="/">
          <Home className="h-4 w-4" />
          Back to Homepage
        </Link>
      </Button>
    </div>
  )
}
