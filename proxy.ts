import {access} from 'fs/promises'
import {NextRequest, NextResponse} from 'next/server'

export const proxy = async (request: NextRequest) => {
  // Only GET requests
  if (request.method !== 'GET') return NextResponse.next()

  const url = new URL(request.url)

  // Only run on development & localhost
  const isLocalhost =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (process.env.NODE_ENV !== 'development' || !isLocalhost)
    return NextResponse.next()

  // Only image extensions
  if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname))
    return NextResponse.next()

  const localFile = `${process.cwd()}/public${url.pathname}`
  const exists = await access(localFile)
    .then(() => true)
    .catch(() => false)
  if (exists) {
    // File exists → let Next serve it normally
    return NextResponse.next()
  }

  const fallbackUrl = `https://collection.cards${url.pathname}`
  const upstream = await fetch(fallbackUrl, {
    headers: {
      accept: request.headers.get('accept') ?? '*/*',
      'if-none-match': request.headers.get('if-none-match') ?? '',
      'if-modified-since': request.headers.get('if-modified-since') ?? '',
      referer: `${url.protocol}//${url.hostname}:${url.port}/`
    },
    cache: 'no-store'
  })

  // Return upstream as response (preserve status/headers)
  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers
  })
  res.headers.set('Cache-Control', 'public, max-age=86400, immutable') // 1 day
  return res
}

export const config = {
  matcher: ['/media/:path*', '/patterns/:path*']
}
