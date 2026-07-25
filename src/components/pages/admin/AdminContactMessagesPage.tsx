'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { extractItems, extractPagination, authFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  Mail, Eye, Trash2, Search, MailOpen, MailX,
  Inbox, ChevronLeft, ChevronRight, Phone, User, Clock,
} from 'lucide-react'

interface ContactMessage {
  id: string
  name: string
  email: string
  phone?: string | null
  subject?: string | null
  message: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const token = useAppStore((state) => state.accessToken)

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }, [token])

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '10')
      if (readFilter === 'unread') params.set('isRead', 'false')
      else if (readFilter === 'read') params.set('isRead', 'true')

      const res = await fetch(`/api/contact?${params.toString()}`, {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(extractItems<ContactMessage>(data))
        const pagination = extractPagination(data)
        setTotalPages(pagination.totalPages || 1)
        setTotal(pagination.total)
      }
    } catch {
      toast.error('Failed to fetch messages')
    } finally {
      setLoading(false)
    }
  }, [page, readFilter, getHeaders])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/contact?limit=1&isRead=false', {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        const pagination = extractPagination(data)
        setUnreadCount(pagination.total)
      }
    } catch {
      // silent
    }
  }, [getHeaders])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  // Refetch unread count when messages change
  useEffect(() => {
    fetchUnreadCount()
  }, [messages, fetchUnreadCount])

  async function toggleReadStatus(msg: ContactMessage) {
    setMarkingId(msg.id)
    try {
      const res = await authFetch(`/api/contact/${msg.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ isRead: !msg.isRead }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(msg.isRead ? 'Marked as unread' : 'Marked as read')
      fetchMessages()
    } catch {
      toast.error('Failed to update message status')
    } finally {
      setMarkingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/contact/${deleteId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Message deleted')
      fetchMessages()
    } catch {
      toast.error('Failed to delete message')
    } finally {
      setDeleteId(null)
    }
  }

  function openDetail(msg: ContactMessage) {
    setSelectedMessage(msg)
    setDetailOpen(true)
    // Auto-mark as read when opened
    if (!msg.isRead) {
      authFetch(`/api/contact/${msg.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ isRead: true }),
      }).then(() => {
        fetchMessages()
      }).catch(() => {
        // silent
      })
    }
  }

  // Client-side search filtering
  const filteredMessages = messages.filter((msg) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      msg.name.toLowerCase().includes(q) ||
      msg.email.toLowerCase().includes(q) ||
      (msg.subject && msg.subject.toLowerCase().includes(q))
    )
  })

  const readCount = total - unreadCount

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return minutes <= 1 ? 'Just now' : `${minutes}m ago`
      }
      return `${hours}h ago`
    }
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-600">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Inbox className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Messages</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Mail className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">Unread</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MailOpen className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readCount}</p>
              <p className="text-xs text-muted-foreground">Read</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={readFilter} onValueChange={(v) => { setReadFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="unread">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />
                Unread
              </span>
            </SelectItem>
            <SelectItem value="read">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-500" />
                Read
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Messages Table / Cards */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="mx-auto size-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No messages found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {search ? 'Try adjusting your search terms' : 'Contact messages will appear here'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Sender</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.map((msg) => (
                      <TableRow
                        key={msg.id}
                        className={`cursor-pointer hover:bg-muted/50 ${!msg.isRead ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}
                        onClick={() => openDetail(msg)}
                      >
                        <TableCell>
                          {!msg.isRead && (
                            <span className="flex size-2.5 rounded-full bg-amber-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={!msg.isRead ? 'font-semibold' : ''}>
                            <p className={`text-sm ${!msg.isRead ? 'font-semibold' : ''}`}>
                              {msg.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{msg.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className={`text-sm max-w-xs truncate ${!msg.isRead ? 'font-semibold' : ''}`}>
                            {msg.subject || 'No subject'}
                          </p>
                          <p className="text-xs text-muted-foreground max-w-xs truncate">
                            {msg.message.substring(0, 60)}{msg.message.length > 60 ? '...' : ''}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(msg.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              !msg.isRead
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            }
                          >
                            {!msg.isRead ? 'Unread' : 'Read'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openDetail(msg)}
                              title="View details"
                            >
                              <Eye className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={markingId === msg.id}
                              onClick={() => toggleReadStatus(msg)}
                              title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                            >
                              {msg.isRead ? (
                                <MailX className="size-3 text-amber-600" />
                              ) : (
                                <MailOpen className="size-3 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={() => setDeleteId(msg.id)}
                              title="Delete"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 cursor-pointer active:bg-muted/50 ${!msg.isRead ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}
                    onClick={() => openDetail(msg)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="pt-1.5">
                        {!msg.isRead ? (
                          <span className="flex size-2.5 rounded-full bg-amber-500" />
                        ) : (
                          <span className="flex size-2.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${!msg.isRead ? 'font-semibold' : ''}`}>
                            {msg.name}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.email}</p>
                        <p className={`text-sm mt-1 truncate ${!msg.isRead ? 'font-semibold' : ''}`}>
                          {msg.subject || 'No subject'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {msg.message.substring(0, 80)}{msg.message.length > 80 ? '...' : ''}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge
                            variant="secondary"
                            className={
                              !msg.isRead
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]'
                            }
                          >
                            {!msg.isRead ? 'Unread' : 'Read'}
                          </Badge>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={markingId === msg.id}
                              onClick={() => toggleReadStatus(msg)}
                              title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                            >
                              {msg.isRead ? (
                                <MailX className="size-3 text-amber-600" />
                              ) : (
                                <MailOpen className="size-3 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={() => setDeleteId(msg.id)}
                              title="Delete"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} message{total !== 1 ? 's' : ''})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Message Details
            </DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={
                    !selectedMessage.isRead
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }
                >
                  {!selectedMessage.isRead ? 'Unread' : 'Read'}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(selectedMessage.createdAt).toLocaleString()}
                </span>
              </div>

              <Separator />

              {/* Sender Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <User className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">{selectedMessage.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <a
                      href={`mailto:${selectedMessage.email}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {selectedMessage.email}
                    </a>
                  </div>
                </div>
                {selectedMessage.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="size-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <a
                        href={`tel:${selectedMessage.phone}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {selectedMessage.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Subject */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject</p>
                <p className="text-sm font-semibold">
                  {selectedMessage.subject || 'No subject'}
                </p>
              </div>

              {/* Message */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Message</p>
                <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    toggleReadStatus(selectedMessage)
                    setDetailOpen(false)
                  }}
                  disabled={markingId === selectedMessage.id}
                >
                  {selectedMessage.isRead ? (
                    <>
                      <MailX className="size-3" /> Mark Unread
                    </>
                  ) : (
                    <>
                      <MailOpen className="size-3" /> Mark Read
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    window.open(`mailto:${selectedMessage.email}`, '_blank')
                  }}
                >
                  <Mail className="size-3" /> Reply via Email
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1 ml-auto"
                  onClick={() => {
                    setDeleteId(selectedMessage.id)
                    setDetailOpen(false)
                  }}
                >
                  <Trash2 className="size-3" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
