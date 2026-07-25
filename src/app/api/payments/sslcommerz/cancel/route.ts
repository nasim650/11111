import { NextRequest } from 'next/server'
import { handleSSLCommerzCallback } from '../handler'

export async function POST(request: NextRequest) {
  return handleSSLCommerzCallback(request, 'cancel')
}

export async function GET(request: NextRequest) {
  return handleSSLCommerzCallback(request, 'cancel')
}
