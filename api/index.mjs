let server

try {
  const mod = await import('../dist/server/server.js')
  server = mod.default
} catch (e) {
  console.error('Failed to import server:', e)
}

export default async function handler(req, res) {
  if (!server) {
    res.statusCode = 500
    res.end('Server module failed to load')
    return
  }

  try {
    // Convert Node.js IncomingMessage to Web Request
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
    const url = new URL(req.url || '/', `${protocol}://${host}`)

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }

    let body = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
      })
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
      duplex: 'half',
    })

    const response = await server.fetch(request)

    // Write response back
    res.statusCode = response.status
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value)
    }

    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
      res.end()
    } else {
      const text = await response.text()
      res.end(text)
    }
  } catch (e) {
    console.error('SSR error:', e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end(`SSR Error: ${e.message}`)
    }
  }
}

export const config = {
  includeFiles: ['dist/server/**'],
  maxDuration: 30,
}
