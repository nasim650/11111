'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, ShoppingBag, MapPin, CreditCard } from 'lucide-react'

// ─── Checkout Step Indicator ────────────────────────────────────────────────
// Shared progress indicator for the multi-step checkout flow.
// Reused across all 4 checkout steps. Purely presentational — no logic.

export interface CheckoutStep {
  id: number
  label: string
  description: string
  icon: typeof ShoppingBag
}

export const CHECKOUT_STEPS: CheckoutStep[] = [
  { id: 1, label: 'Delivery & Payment', description: 'Address, shipping & payment', icon: MapPin },
  { id: 2, label: 'Review & Order', description: 'Confirm & place order', icon: CheckCircle2 },
]

interface CheckoutStepIndicatorProps {
  currentStep: number
  onStepClick?: (step: number) => void
  maxReachedStep?: number
}

export default function CheckoutStepIndicator({
  currentStep,
  onStepClick,
  maxReachedStep = 1,
}: CheckoutStepIndicatorProps) {
  return (
    <div className="bg-background border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {CHECKOUT_STEPS.map((step, idx) => {
            const StepIcon = step.icon
            const isCompleted = currentStep > step.id
            const isCurrent = currentStep === step.id
            const isClickable = onStepClick && step.id <= maxReachedStep

            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center font-bold transition-all duration-300 relative ${
                      isCompleted
                        ? 'bg-primary text-white shadow-sm'
                        : isCurrent
                        ? 'bg-primary text-white shadow-md ring-4 ring-primary/15'
                        : 'bg-muted text-muted-foreground border-2 border-border'
                    }`}
                  >
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </motion.div>
                    ) : isCurrent ? (
                      <StepIcon className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`text-[11px] sm:text-xs mt-1.5 font-semibold transition-colors ${
                    isCompleted || isCurrent ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                  <span className={`text-[10px] hidden sm:block mt-0.5 ${
                    isCompleted || isCurrent ? 'text-primary/70' : 'text-muted-foreground/60'
                  }`}>
                    {step.description}
                  </span>
                </button>
                {idx < CHECKOUT_STEPS.length - 1 && (
                  <div className="relative mx-2 sm:mx-3 flex-1 h-0.5 -mt-5 sm:-mt-6">
                    <div className="absolute inset-0 bg-border rounded-full" />
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: isCompleted ? '100%' : isCurrent ? '50%' : '0%' }}
                      transition={{ duration: 0.4, ease: 'easeInOut' }}
                      className="absolute top-0 left-0 h-full bg-primary rounded-full"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
