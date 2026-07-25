'use client'

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, Download } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/api'

interface Payment {
  id: string
  transactionId: string | null
  status: string
  amount: number
  gateway: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
  gatewayResponse: string | null
  order: {
    id: string
    orderNumber: string
    guestName: string | null
    guestEmail: string | null
    guestPhone: string | null
    totalAmount: number
    user?: { id: string; name: string | null; email: string | null; phone: string | null } | null
  }
}

interface PaginatedResponse {
  items: Payment[]
  total: number
  page: number
  pages: number
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  paid: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-100 text-green-800', label: 'Paid' },
  pending: { icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'bg-red-100 text-red-800', label: 'Failed' },
  cancelled: { icon: <AlertCircle className="h-4 w-4" />, color: 'bg-orange-100 text-orange-800', label: 'Cancelled' },
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [logs, setLogs] = useState<Array<{ at: string; event: string; status?: string; transactionId?: string; message?: string }>>([])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(status && { status }),
      })
      const response = await fetch(`/api/payments?${params}`)
      const data = (await response.json()) as { success: boolean; data?: PaginatedResponse }
      if (data.success && data.data) {
        setPayments(data.data.items)
        setTotal(data.data.total)
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [page, limit, status])

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment)
    try {
      if (payment.gatewayResponse) {
        const parsed = JSON.parse(payment.gatewayResponse) as { logs?: Array<{ at: string; event: string; status?: string; transactionId?: string; message?: string }> }
        setLogs(parsed.logs || [])
      }
    } catch {
      setLogs([])
    }
    setShowDetails(true)
  }

  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Order Number', 'Amount', 'Status', 'Gateway', 'Date', 'Customer']
    const rows = payments.map((p) => [
      p.transactionId || 'N/A',
      p.order.orderNumber,
      p.amount,
      p.status,
      p.gateway || 'N/A',
      format(new Date(p.createdAt), 'yyyy-MM-dd HH:mm'),
      p.order.guestName || p.order.user?.name || 'N/A',
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${Date.now()}.csv`
    a.click()
  }

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const pages = Math.ceil(total / limit)
  const config = statusConfig[status] || statusConfig.pending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Transactions</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor all payment transactions</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          Total: {total} transactions
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const statusInfo = statusConfig[payment.status] || statusConfig.pending
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">
                      {payment.transactionId ? payment.transactionId.slice(0, 16) + '...' : 'N/A'}
                    </TableCell>
                    <TableCell>{payment.order.orderNumber}</TableCell>
                    <TableCell>৳{payment.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={statusInfo.color} variant="outline">
                        <span className="mr-1">{statusInfo.icon}</span>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.gateway || 'N/A'}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{payment.order.guestName || payment.order.user?.name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{payment.order.guestEmail || payment.order.user?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(payment)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <ScrollArea className="h-full">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="logs">Gateway Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                      <p className="font-mono text-sm break-all">{selectedPayment.transactionId || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Order ID</label>
                      <p className="font-mono text-sm">{selectedPayment.order.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Order Number</label>
                      <p className="font-medium">{selectedPayment.order.orderNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Amount</label>
                      <p className="font-medium">৳{selectedPayment.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p>
                        <Badge className={statusConfig[selectedPayment.status]?.color || statusConfig.pending.color}>
                          {statusConfig[selectedPayment.status]?.label || 'Unknown'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Gateway</label>
                      <p className="font-medium">{selectedPayment.gateway || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Payment Date</label>
                      <p>{selectedPayment.paidAt ? format(new Date(selectedPayment.paidAt), 'PPpp') : 'Not paid'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <p>{format(new Date(selectedPayment.createdAt), 'PPpp')}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Customer</label>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium">{selectedPayment.order.guestName || selectedPayment.order.user?.name || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">{selectedPayment.order.guestEmail || selectedPayment.order.user?.email}</p>
                      <p className="text-sm text-muted-foreground">{selectedPayment.order.guestPhone || selectedPayment.order.user?.phone}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4 mt-4">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No gateway logs available</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log, idx) => (
                        <div key={idx} className="border rounded p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground">{new Date(log.at).toLocaleString()}</span>
                            <Badge variant="outline">{log.event}</Badge>
                          </div>
                          {log.status && <p className="text-sm"><span className="font-medium">Status:</span> {log.status}</p>}
                          {log.transactionId && <p className="text-sm font-mono"><span className="font-medium">TID:</span> {log.transactionId}</p>}
                          {log.message && <p className="text-sm text-muted-foreground">{log.message}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
