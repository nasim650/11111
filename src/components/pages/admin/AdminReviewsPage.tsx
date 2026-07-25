'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { extractItems, authFetch } from '@/lib/api'
import { Star, Eye, CheckCircle, XCircle, Trash2 } from 'lucide-react'

interface Review {
  id: string
  productId: string
  productName?: string
  userId: string
  userName?: string
  rating: number
  title?: string
  comment: string
  status: string
  createdAt: string
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/reviews?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReviews(extractItems(data))
      }
    } catch {
      toast.error('Failed to fetch reviews')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  async function updateStatus(id: string, status: string) {
    try {
      const res = await authFetch(`/api/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(`Review ${status === 'approved' ? 'approved' : 'rejected'}`)
      fetchReviews()
    } catch {
      toast.error('Failed to update review')
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/reviews/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Review deleted')
      fetchReviews()
    } catch {
      toast.error('Failed to delete review')
    } finally {
      setDeleteId(null)
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`size-3 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    )
  }

  const counts = {
    all: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-4">
      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setLoading(true) }}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No reviews found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.productName ?? 'Product'}</TableCell>
                    <TableCell className="text-sm">{r.userName ?? 'User'}</TableCell>
                    <TableCell>{renderStars(r.rating)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{r.comment}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          r.status === 'approved' ? 'bg-green-100 text-green-800' :
                          r.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="icon" className="size-7 text-green-600" onClick={() => updateStatus(r.id, 'approved')} title="Approve">
                              <CheckCircle className="size-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-red-600" onClick={() => updateStatus(r.id, 'rejected')} title="Reject">
                              <XCircle className="size-3" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => { setSelectedReview(r); setDetailOpen(true) }}>
                          <Eye className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review Details</DialogTitle></DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Product</p>
                <p className="font-medium">{selectedReview.productName ?? 'Product'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p>{selectedReview.userName ?? 'User'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rating</p>
                {renderStars(selectedReview.rating)}
              </div>
              {selectedReview.title && (
                <div>
                  <p className="text-sm text-muted-foreground">Title</p>
                  <p className="font-medium">{selectedReview.title}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Comment</p>
                <p className="text-sm">{selectedReview.comment}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={
                    selectedReview.status === 'approved' ? 'bg-green-100 text-green-800' :
                    selectedReview.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }
                >
                  {selectedReview.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{new Date(selectedReview.createdAt).toLocaleDateString()}</span>
              </div>
              {selectedReview.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-1" onClick={() => { updateStatus(selectedReview.id, 'approved'); setDetailOpen(false) }}>
                    <CheckCircle className="size-3" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => { updateStatus(selectedReview.id, 'rejected'); setDetailOpen(false) }}>
                    <XCircle className="size-3" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Review</AlertDialogTitle><AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
