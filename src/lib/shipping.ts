import { db } from '@/lib/db'

export const DEFAULT_FREE_SHIPPING_THRESHOLD = 1500
export const DEFAULT_STANDARD_DELIVERY_CHARGE = 60
export const DEFAULT_EXPRESS_DELIVERY_CHARGE = 120

export interface ShippingSettings {
  freeShippingThreshold: number
  standardDeliveryCharge: number
  expressDeliveryCharge: number
}

/**
 * Single source of truth for shipping configuration.
 * Resolves thresholds and charges consistently across Cart, Orders/Checkout, and SiteConfig.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const configs = await db.siteConfig.findMany({
    where: {
      key: {
        in: [
          'freeShippingThreshold',
          'free_shipping_threshold',
          'free_delivery_min',
          'shippingCharge',
          'standard_delivery_charge',
          'delivery_charge',
          'expressDeliveryCharge',
          'express_delivery_charge',
        ],
      },
    },
  })

  const configMap: Record<string, string> = {}
  for (const item of configs) {
    if (item.value) {
      configMap[item.key] = item.value
    }
  }

  const freeShippingThreshold =
    Number(configMap.freeShippingThreshold || configMap.free_shipping_threshold || configMap.free_delivery_min) ||
    DEFAULT_FREE_SHIPPING_THRESHOLD

  const standardDeliveryCharge =
    Number(configMap.shippingCharge || configMap.standard_delivery_charge || configMap.delivery_charge) ||
    DEFAULT_STANDARD_DELIVERY_CHARGE

  const expressDeliveryCharge =
    Number(configMap.expressDeliveryCharge || configMap.express_delivery_charge) ||
    DEFAULT_EXPRESS_DELIVERY_CHARGE

  return {
    freeShippingThreshold,
    standardDeliveryCharge,
    expressDeliveryCharge,
  }
}
