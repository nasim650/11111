import { NextRequest } from 'next/server'
import { handleSSLCommerzCallback } from '../handler'

export async function POST(request: NextRequest) {
  return handleSSLCommerzCallback(request, 'ipn')
}
