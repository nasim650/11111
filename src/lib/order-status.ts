// ─── Order Status System (shared) ──────────────────────────────────────────
// Single source of truth for the order status flow, labels, colors, and
// helpers. The Order.orderStatus field is a plain String (not an enum), so
// new status values can be introduced without any database schema change.
//
// Production flow:
//   pending → confirmed → processing → packed → ready_to_ship → shipped → delivered
//
// Terminal states:
//   cancelled, returned
//
// Reused by: AdminOrdersPage, OrderTimeline, OrderDetailPage, OrderTrackingPage.

import {
  Clock,
  CheckCircle2,
  Package,
  Box,
  Send,
  Truck,
  Home,
  XCircle,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'

// ─── Status constants ───────────────────────────────────────────────────────

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  PACKED: 'packed',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
} as const

export type OrderStatusValue = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

/** Linear production flow (excludes terminal states). */
export const PRODUCTION_FLOW: OrderStatusValue[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.READY_TO_SHIP,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
]

/** Terminal states (no further forward progression). */
export const TERMINAL_STATUSES: OrderStatusValue[] = [
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RETURNED,
]

/** All statuses that can be selected in the admin UI. */
export const ALL_STATUSES: OrderStatusValue[] = [...PRODUCTION_FLOW, ...TERMINAL_STATUSES]

// ─── Status metadata ────────────────────────────────────────────────────────

export interface StatusMeta {
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
  /** Badge background + text classes (Tailwind). */
  badgeClass: string
  /** Solid dot color for timeline. */
  dotClass: string
  /** Connector line color for timeline. */
  lineClass: string
  /** Accent color for icons. */
  iconColor: string
}

export const STATUS_META: Record<string, StatusMeta> = {
  [ORDER_STATUS.PENDING]: {
    label: 'New Order',
    shortLabel: 'Pending',
    description: 'Order placed, awaiting confirmation',
    icon: Clock,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500 shadow-amber-200',
    lineClass: 'bg-amber-200',
    iconColor: 'text-amber-600',
  },
  [ORDER_STATUS.CONFIRMED]: {
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    description: 'Order confirmed by admin',
    icon: CheckCircle2,
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    dotClass: 'bg-teal-500 shadow-teal-200',
    lineClass: 'bg-teal-200',
    iconColor: 'text-teal-600',
  },
  [ORDER_STATUS.PROCESSING]: {
    label: 'Processing',
    shortLabel: 'Processing',
    description: 'Order is being prepared',
    icon: Package,
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-500 shadow-purple-200',
    lineClass: 'bg-purple-200',
    iconColor: 'text-purple-600',
  },
  [ORDER_STATUS.PACKED]: {
    label: 'Packed',
    shortLabel: 'Packed',
    description: 'Items packed and labelled',
    icon: Box,
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotClass: 'bg-indigo-500 shadow-indigo-200',
    lineClass: 'bg-indigo-200',
    iconColor: 'text-indigo-600',
  },
  [ORDER_STATUS.READY_TO_SHIP]: {
    label: 'Ready to Ship',
    shortLabel: 'Ready',
    description: 'Ready for courier pickup',
    icon: Send,
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dotClass: 'bg-cyan-500 shadow-cyan-200',
    lineClass: 'bg-cyan-200',
    iconColor: 'text-cyan-600',
  },
  [ORDER_STATUS.SHIPPED]: {
    label: 'Shipped',
    shortLabel: 'Shipped',
    description: 'Handed over to courier',
    icon: Truck,
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500 shadow-orange-200',
    lineClass: 'bg-orange-200',
    iconColor: 'text-orange-600',
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    description: 'Order delivered to customer',
    icon: Home,
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500 shadow-emerald-200',
    lineClass: 'bg-emerald-200',
    iconColor: 'text-emerald-600',
  },
  [ORDER_STATUS.CANCELLED]: {
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    description: 'Order cancelled',
    icon: XCircle,
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500 shadow-red-200',
    lineClass: 'bg-red-200',
    iconColor: 'text-red-600',
  },
  [ORDER_STATUS.RETURNED]: {
    label: 'Returned',
    shortLabel: 'Returned',
    description: 'Order returned by customer',
    icon: RotateCcw,
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
    dotClass: 'bg-gray-500 shadow-gray-200',
    lineClass: 'bg-gray-200',
    iconColor: 'text-gray-600',
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_META: StatusMeta = {
  label: 'Unknown',
  shortLabel: 'Unknown',
  description: 'Unknown status',
  icon: Clock,
  badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  dotClass: 'bg-gray-400 shadow-gray-200',
  lineClass: 'bg-gray-200',
  iconColor: 'text-gray-500',
}

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? DEFAULT_META
}

export function getStatusLabel(status: string): string {
  return STATUS_META[status]?.shortLabel ?? status
}

export function getStatusBadgeClass(status: string): string {
  return STATUS_META[status]?.badgeClass ?? DEFAULT_META.badgeClass
}

/** The next logical status in the production flow, or null if terminal/unknown. */
export function getNextStatus(currentStatus: string): OrderStatusValue | null {
  const idx = PRODUCTION_FLOW.indexOf(currentStatus as OrderStatusValue)
  if (idx === -1 || idx === PRODUCTION_FLOW.length - 1) return null
  return PRODUCTION_FLOW[idx + 1]
}

/** Statuses that can be advanced to from the current status (forward + terminal options). */
export function getAvailableTransitions(currentStatus: string): OrderStatusValue[] {
  // If already terminal, only allow the other terminal option (rare) or staying
  if (TERMINAL_STATUSES.includes(currentStatus as OrderStatusValue)) {
    return TERMINAL_STATUSES
  }
  // Forward: next status + all terminal options
  const next = getNextStatus(currentStatus)
  const result: OrderStatusValue[] = []
  if (next) result.push(next)
  result.push(ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED)
  return result
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as OrderStatusValue)
}

export function isDelivered(status: string): boolean {
  return status === ORDER_STATUS.DELIVERED
}

/** Progress percentage (0-100) through the production flow. */
export function getFlowProgress(status: string): number {
  const idx = PRODUCTION_FLOW.indexOf(status as OrderStatusValue)
  if (idx === -1) return 0
  return Math.round(((idx + 1) / PRODUCTION_FLOW.length) * 100)
}
