'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application runtime error:', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-4">
        <RefreshCw className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        Something went wrong!
      </h2>
      <p className="text-muted-foreground max-w-md mb-6 text-sm">
        An error occurred while loading this page. Please try refreshing or return to the homepage.
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => reset()}
          variant="default"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Button
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('kk-app-store')
              localStorage.removeItem('khati-khadyo-storage')
              window.location.href = '/'
            }
          }}
          variant="outline"
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Reset App State
        </Button>
      </div>
    </div>
  )
}
