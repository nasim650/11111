'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Phone, MapPin, Truck, CreditCard, type LucideIcon } from 'lucide-react'

export interface CheckoutStep {
  id: number
  label: string
  banglaLabel: string
  description: string
  icon: LucideIcon
}

export const CHECKOUT_STEPS: CheckoutStep[] = [
  { id: 1, label: 'Contact', banglaLabel: 'যোগাযোগ', description: 'Phone & verification', icon: Phone },
  { id: 2, label: 'Address', banglaLabel: 'ঠিকানা', description: 'Delivery location', icon: MapPin },
  { id: 3, label: 'Shipping', banglaLabel: 'ডেলিভারি', description: 'Shipping speed', icon: Truck },
  { id: 4, label: 'Payment', banglaLabel: 'পেমেন্ট', description: 'COD / Online', icon: CreditCard },
  { id: 5, label: 'Review', banglaLabel: 'পর্যালোচনা', description: 'Confirm & place', icon: CheckCircle2 },
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
    <div className="bg-white border-b border-stone-200">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
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
                  aria-label={`Step ${step.id}: ${step.label}`}
                  className={`flex flex-col items-center group w-full ${
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 relative ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-emerald-600 text-white shadow-md ring-4 ring-emerald-600/15'
                        : 'bg-stone-100 text-stone-400 border border-stone-200'
                    }`}
                  >
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </motion.div>
                    ) : (
                      <StepIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs mt-1 sm:mt-1.5 font-semibold transition-colors text-center ${
                      isCompleted || isCurrent ? 'text-emerald-800' : 'text-stone-400'
                    }`}
                  >
                    <span className="hidden sm:inline">{step.banglaLabel}</span>
                    <span className="sm:hidden">{step.id}</span>
                  </span>
                  <span
                    className={`text-[9px] hidden md:block mt-0.5 text-center ${
                      isCompleted || isCurrent ? 'text-emerald-700/70' : 'text-stone-400/60'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {idx < CHECKOUT_STEPS.length - 1 && (
                  <div className="relative mx-1 sm:mx-2 flex-1 h-0.5 -mt-4 sm:-mt-6">
                    <div className="absolute inset-0 bg-stone-200 rounded-full" />
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{
                        width: isCompleted ? '100%' : isCurrent ? '50%' : '0%',
                      }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="absolute top-0 left-0 h-full bg-emerald-600 rounded-full"
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
