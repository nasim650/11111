'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
  Search,
  RotateCcw,
  CreditCard,
  Banknote,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import { authFetch } from '@/lib/api'
import { toast } from 'sonner'

interface PaymentItem {
  id: string
  transactionId: string | null
  status: string
  amount: number
  method: string | null
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
    paymentMethod: string | null
    paymentStatus: string | null
    orderStatus: string | null
    totalAmount: number
    createdAt: string
    user?: { id: string; name: string | null; email: string | null; phone: string | null } | null
  } | null
}

interface PaginatedResponse {
  data: PaymentItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const paymentStatusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  paid: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Paid', icon: <CheckCircle className="h-3 w-3" /> },
  pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Pending', icon: <Clock className="h-3 w-3" /> },
  failed: { color: 'bg-rose-100 text-rose-800 border-rose-200', label: 'Failed', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { color: 'bg-stone-100 text-stone-700 border-stone-200', label: 'Cancelled', icon: <AlertCircle className="h-3 w-3" /> },
}

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
  confirmed: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Confirmed' },
  processing: { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Processing' },
  shipped: { color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Shipped' },
  delivered: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Delivered' },
  cancelled: { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelled' },
}

function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search & Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [gatewayFilter, setGatewayFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Details Modal
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)
      if (gatewayFilter !== 'all') params.set('gateway', gatewayFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const response = await authFetch(`/api/payments?${params.toString()}`)
      const json = await response.json()

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Unable to load payment transactions')
      }

      setPayments(Array.isArray(json.data.data) ? json.data.data : [])
      setTotal(Number.isFinite(json.data.pagination?.total) ? json.data.pagination.total : 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payments'
      setError(message)
      setPayments([])
      setTotal(0)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, statusFilter, methodFilter, gatewayFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const handleResetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setMethodFilter('all')
    setGatewayFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleCopy = (text: string, id: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Copied to clipboard')
  }

  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Order Number',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Order Amount (BDT)',
      'Payment Amount (BDT)',
      'Payment Method',
      'Gateway',
      'Payment Status',
      'Order Status',
      'Created Date',
      'Paid Date',
    ]

    const rows = payments.map((p) => {
      const customerName = p.order?.guestName || p.order?.user?.name || 'Guest'
      const customerPhone = p.order?.guestPhone || p.order?.user?.phone || 'N/A'
      const customerEmail = p.order?.guestEmail || p.order?.user?.email || 'N/A'
      const orderAmount = (p.order?.totalAmount ?? p.amount ?? 0).toFixed(2)
      const paymentAmount = (p.amount ?? p.order?.totalAmount ?? 0).toFixed(2)
      const method = p.method || p.order?.paymentMethod || 'COD'
      const gateway = p.gateway || (method === 'online' ? 'SSLCOMMERZ' : 'COD')
      const paymentStatus = p.status || p.order?.paymentStatus || 'pending'
      const orderStatus = p.order?.orderStatus || 'pending'

      return [
        p.transactionId || 'N/A',
        p.order?.orderNumber || 'N/A',
        customerName,
        customerPhone,
        customerEmail,
        orderAmount,
        paymentAmount,
        method.toUpperCase(),
        gateway.toUpperCase(),
        paymentStatus.toUpperCase(),
        orderStatus.toUpperCase(),
        formatDateSafe(p.createdAt),
        formatDateSafe(p.paidAt),
      ]
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `khati-khadyo-payments-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Payments exported to CSV')
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Payment Transactions</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Real-time reconciliation, gateway auditing, and financial settlement records
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="self-start sm:self-auto gap-2">
          <Download className="h-4 w-4" />
          Export Clean CSV
        </Button>
      </div>

      {/* ── Search & Filters Bar ── */}
      <Card className="shadow-xs border-stone-200">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Search order #, tran ID, phone or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9 text-sm"
              />
            </div>

            {/* Payment Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Method Filter */}
            <Select
              value={methodFilter}
              onValueChange={(val) => {
                setMethodFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                <SelectItem value="online">Online Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-stone-100">
            {/* Gateway Filter */}
            <Select
              value={gatewayFilter}
              onValueChange={(val) => {
                setGatewayFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Gateway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Gateways</SelectItem>
                <SelectItem value="sslcommerz">SSLCOMMERZ</SelectItem>
                <SelectItem value="cod">Cash on Delivery</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2 sm:col-span-2">
              <div className="relative flex-1">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setPage(1)
                  }}
                  className="text-xs"
                  aria-label="Date From"
                />
              </div>
              <span className="text-stone-400 text-xs">to</span>
              <div className="relative flex-1">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setPage(1)
                  }}
                  className="text-xs"
                  aria-label="Date To"
                />
              </div>
              {(search || statusFilter !== 'all' || methodFilter !== 'all' || gatewayFilter !== 'all' || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-xs text-stone-500 hover:text-stone-800">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table & List View ── */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow>
              <TableHead className="w-[180px]">Transaction ID</TableHead>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method & Gateway</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-stone-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">Loading transactions...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-rose-600">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-6 w-6" />
                    <p className="text-sm font-semibold">{error}</p>
                    <Button size="sm" variant="outline" onClick={fetchPayments} className="mt-2 text-xs">
                      Try Again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-stone-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-stone-300" />
                    <p className="text-sm font-medium">No payment transactions match your query</p>
                    <p className="text-xs text-stone-400">Try adjusting your filters or date range</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => {
                const statusInfo = paymentStatusConfig[p.status] || paymentStatusConfig.pending
                const orderInfo = orderStatusConfig[p.order?.orderStatus || 'pending'] || orderStatusConfig.pending
                const customerName = p.order?.guestName || p.order?.user?.name || 'Guest Customer'
                const customerPhone = p.order?.guestPhone || p.order?.user?.phone || '—'
                const customerEmail = p.order?.guestEmail || p.order?.user?.email || null
                const safeAmount = p.amount ?? p.order?.totalAmount ?? 0

                return (
                  <TableRow key={p.id} className="hover:bg-stone-50/50">
                    {/* Transaction ID */}
                    <TableCell className="font-mono text-xs">
                      {p.transactionId ? (
                        <div className="flex items-center gap-1.5 group">
                          <span className="truncate max-w-[120px] font-semibold text-stone-800" title={p.transactionId}>
                            {p.transactionId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(p.transactionId!, `tx-${p.id}`)}
                            className="text-stone-400 hover:text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Copy transaction ID"
                          >
                            {copiedId === `tx-${p.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-stone-400">COD / None</span>
                      )}
                    </TableCell>

                    {/* Order Number */}
                    <TableCell className="font-medium text-xs">
                      {p.order?.orderNumber || 'N/A'}
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <div className="text-xs">
                        <p className="font-semibold text-stone-800 truncate max-w-[140px]">{customerName}</p>
                        <p className="text-stone-500 font-mono text-[11px]">{customerPhone}</p>
                        {customerEmail && (
                          <p className="text-stone-400 text-[10px] truncate max-w-[140px]">{customerEmail}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="font-semibold text-sm text-stone-900">
                      ৳{safeAmount.toLocaleString()}
                    </TableCell>

                    {/* Method & Gateway */}
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        {p.method === 'cod' ? (
                          <Banknote className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                        )}
                        <span className="uppercase">{p.method || 'COD'}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                        {p.gateway || (p.method === 'online' ? 'SSLCOMMERZ' : 'COD')}
                      </span>
                    </TableCell>

                    {/* Payment Status */}
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] py-0.5 px-2 font-medium flex items-center gap-1 w-fit ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </Badge>
                    </TableCell>

                    {/* Order Status */}
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] py-0.5 px-2 font-medium w-fit ${orderInfo.color}`}>
                        {orderInfo.label}
                      </Badge>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-xs text-stone-500 whitespace-nowrap">
                      {formatDateSafe(p.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPayment(p)
                          setShowDetails(true)
                        }}
                        className="h-8 w-8 p-0"
                        title="View Payment Details"
                      >
                        <Eye className="h-4 w-4 text-stone-600" />
                        <span className="sr-only">View Details</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* ── Pagination ── */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 bg-stone-50/50 text-xs text-stone-500">
            <div>
              Showing <span className="font-semibold text-stone-800">{payments.length}</span> of{' '}
              <span className="font-semibold text-stone-800">{total}</span> transactions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2.5 text-xs"
              >
                Previous
              </Button>
              <span className="px-1 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2.5 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Payment Details Modal ── */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900 flex items-center justify-between pr-6">
              <span>Transaction Summary</span>
              {selectedPayment && (
                <Badge
                  variant="outline"
                  className={`text-xs ${paymentStatusConfig[selectedPayment.status]?.color || ''}`}
                >
                  {selectedPayment.status.toUpperCase()}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 text-xs">
              {/* Amounts & Overview */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-50 border border-stone-100">
                <div>
                  <span className="text-stone-500 block">Payment Amount</span>
                  <span className="text-lg font-bold text-stone-900">
                    ৳{(selectedPayment.amount ?? selectedPayment.order?.totalAmount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Order Total</span>
                  <span className="text-lg font-bold text-emerald-700">
                    ৳{(selectedPayment.order?.totalAmount ?? selectedPayment.amount ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Identification details */}
              <div className="space-y-2 border-b border-stone-100 pb-3">
                <div className="flex justify-between py-1">
                  <span className="text-stone-500 font-medium">Order Number:</span>
                  <span className="font-semibold text-stone-800">{selectedPayment.order?.orderNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500 font-medium">Transaction ID:</span>
                  <span className="font-mono text-stone-800">{selectedPayment.transactionId || 'None (COD)'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500 font-medium">Payment Method:</span>
                  <span className="uppercase font-semibold text-stone-800">
                    {selectedPayment.method || selectedPayment.order?.paymentMethod || 'COD'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500 font-medium">Gateway:</span>
                  <span className="uppercase text-stone-800">
                    {selectedPayment.gateway || 'COD'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500 font-medium">Order Status:</span>
                  <Badge variant="outline" className={`text-[10px] ${orderStatusConfig[selectedPayment.order?.orderStatus || 'pending']?.color}`}>
                    {(selectedPayment.order?.orderStatus || 'pending').toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Customer details */}
              <div className="space-y-2 border-b border-stone-100 pb-3">
                <p className="font-semibold text-stone-700">Customer Information</p>
                <div className="flex justify-between py-0.5">
                  <span className="text-stone-500">Name:</span>
                  <span className="font-medium text-stone-800">
                    {selectedPayment.order?.guestName || selectedPayment.order?.user?.name || 'Guest Customer'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-stone-500">Phone:</span>
                  <span className="font-mono text-stone-800">
                    {selectedPayment.order?.guestPhone || selectedPayment.order?.user?.phone || '—'}
                  </span>
                </div>
                {(selectedPayment.order?.guestEmail || selectedPayment.order?.user?.email) && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-stone-500">Email:</span>
                    <span className="text-stone-800">
                      {selectedPayment.order?.guestEmail || selectedPayment.order?.user?.email}
                    </span>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="space-y-1.5 text-stone-500">
                <div className="flex justify-between">
                  <span>Created At:</span>
                  <span>{formatDateSafe(selectedPayment.createdAt)}</span>
                </div>
                {selectedPayment.paidAt && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Paid At:</span>
                    <span>{formatDateSafe(selectedPayment.paidAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
