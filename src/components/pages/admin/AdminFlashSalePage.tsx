'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { extractItems } from '@/lib/api'
interface Product {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  salePrice?: number
  discountPrice?: number
  images: { url: string }[]
  category: { name: string; slug: string }
}
import { ArrowUp, ArrowDown, Save, Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FlashSaleConfig {
  enabled: boolean
  title: string
  subtitle: string
  endDate: string
  productIds: string[]
}

export default function AdminFlashSalePage() {
  const [config, setConfig] = useState<FlashSaleConfig>({
    enabled: false,
    title: 'Flash Sale',
    subtitle: 'Grab them before they\'re gone!',
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    productIds: []
  })
  
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const accessToken = useAppStore((s) => s.accessToken)
  const loadSiteConfig = useAppStore((s) => s.loadSiteConfig)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        
        // Fetch all products for selection
        const pRes = await fetch('/api/products?limit=1000')
        if (pRes.ok) {
          const pData = await pRes.json()
          setProducts(extractItems(pData))
        }

        // Fetch current flash sale config
        const cRes = await fetch('/api/site-config/flash_sale', {
          headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }
        })
        
        if (cRes.ok) {
          const cData = await cRes.json()
          if (cData.success && cData.data && cData.data.value) {
            try {
              const parsed = JSON.parse(cData.data.value)
              setConfig({
                enabled: parsed.enabled ?? false,
                title: parsed.title || 'Flash Sale',
                subtitle: parsed.subtitle || '',
                endDate: parsed.endDate ? new Date(parsed.endDate).toISOString().slice(0, 16) : new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                productIds: parsed.productIds || []
              })
            } catch (e) {
              console.error('Failed to parse flash sale config', e)
            }
          }
        }
      } catch (error) {
        console.error('Error loading data', error)
        toast.error('Failed to load flash sale data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [accessToken])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const payload = {
        key: 'flash_sale',
        value: JSON.stringify({
          ...config,
          endDate: (() => {
            const date = new Date(config.endDate)
            return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
          })()
        }),
        group: 'marketing',
        label: 'Flash Sale Configuration',
        type: 'json'
      }

      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Failed to save config')
      
      toast.success('Flash sale configuration saved successfully')
      loadSiteConfig() // Refresh global store
    } catch (error) {
      console.error(error)
      toast.error('Failed to save flash sale configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleProduct = (productId: string) => {
    setConfig(prev => {
      const isSelected = prev.productIds.includes(productId)
      if (isSelected) {
        return { ...prev, productIds: prev.productIds.filter(id => id !== productId) }
      } else {
        return { ...prev, productIds: [...prev.productIds, productId] }
      }
    })
  }

  const moveProduct = (index: number, direction: 'up' | 'down') => {
    setConfig(prev => {
      const newOrder = [...prev.productIds]
      if (direction === 'up' && index > 0) {
        ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
      } else if (direction === 'down' && index < newOrder.length - 1) {
        ;[newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]]
      }
      return { ...prev, productIds: newOrder }
    })
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedProducts = config.productIds
    .map(id => products.find(p => p.id === id))
    .filter(Boolean) as Product[]

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Flash Sale</h2>
          <p className="text-muted-foreground">Manage your flash sale event and selected products.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Configuration
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Flash Sale Settings</CardTitle>
              <CardDescription>Configure the display and timing of the flash sale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Flash Sale</Label>
                  <p className="text-sm text-muted-foreground">
                    Show the flash sale section on the homepage.
                  </p>
                </div>
                <Switch 
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="e.g. Flash Sale"
                />
              </div>

              <div className="space-y-2">
                <Label>Subtitle (Optional)</Label>
                <Input 
                  value={config.subtitle}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  placeholder="e.g. Hurry up! Offers end soon."
                />
              </div>

              <div className="space-y-2">
                <Label>End Date & Time</Label>
                <Input 
                  type="datetime-local"
                  value={config.endDate}
                  onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">The flash sale will automatically hide after this time.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected Products ({selectedProducts.length})</CardTitle>
              <CardDescription>Order the products exactly as they should appear on the homepage.</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProducts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                  No products selected.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-md border">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img 
                          src={product.images?.[0]?.url || '/placeholder.png'} 
                          alt={product.name}
                          className="h-10 w-10 object-cover rounded bg-white"
                        />
                        <div className="truncate">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">৳{product.salePrice || product.price}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveProduct(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveProduct(index, 'down')}
                          disabled={index === selectedProducts.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>Select products to include in the flash sale.</CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-[600px] border-t">
                <div className="p-4 space-y-2">
                  {filteredProducts.map(product => {
                    const isSelected = config.productIds.includes(product.id)
                    return (
                      <div 
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                        onClick={() => toggleProduct(product.id)}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleProduct(product.id)} />
                        <img 
                          src={product.images?.[0]?.url || '/placeholder.png'} 
                          alt={product.name}
                          className="h-10 w-10 object-cover rounded bg-white"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category?.name}</p>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="text-[10px]">Selected</Badge>
                        )}
                      </div>
                    )
                  })}
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      No products found.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
