// Nyu-rrka Mobile API Proxy — Deploy ke Cloudflare Workers
// 1. Buka https://workers.cloudflare.com
// 2. Login, create new Worker
// 3. Copy paste kode ini
// 4. Deploy → dapet URL https://nyu-api.xxx.workers.dev

// Cara pake di app:
// const API = 'https://nyu-api.xxx.workers.dev'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  const search = url.searchParams.get('q')

  if (path === '/search' && search) {
    // Cari dari berbagai source
    const results = await searchVideos(search)
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  if (path.startsWith('/stream/')) {
    const videoId = path.split('/stream/')[1]
    if (!videoId) return new Response('missing id', { status: 400 })

    const streamUrl = await getStream(videoId)
    if (streamUrl) {
      return new Response(JSON.stringify({ streamUrl }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    return new Response('not found', { status: 404 })
  }

  return new Response('ok', { status: 200 })
}

// YouTube search via Invidious + Piped + Google scraping
async function searchVideos(query) {
  // Try Piped first
  const pipedInstances = [
    'https://pipedapi.r4fo.com',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.kavin.rocks',
  ]

  for (const instance of pipedInstances) {
    try {
      const r = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=videos`, {
        headers: { 'Accept': 'application/json' }
      })
      if (r.ok) {
        const data = await r.json()
        if (data?.items?.length > 0) {
          return data.items.slice(0, 10).map(item => ({
            id: item.url?.split('v=')[1] || item.url?.split('/')[3] || '',
            title: item.title || 'Unknown',
            artist: item.uploaderName || 'Unknown',
            albumArt: item.thumbnail || '',
            duration: item.duration || 0,
          }))
        }
      }
    } catch {}
  }

  // Fallback: Invidious
  const invidiousInstances = [
    'https://inv.nadeko.net',
    'https://invidious.projectsegfau.lt',
  ]

  for (const instance of invidiousInstances) {
    try {
      const r = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/json' }
      })
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data) && data.length > 0) {
          return data.filter(i => i.type === 'video').slice(0, 10).map(item => ({
            id: item.videoId || '',
            title: item.title || 'Unknown',
            artist: item.author || 'Unknown',
            albumArt: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            duration: item.lengthSeconds || 0,
          }))
        }
      }
    } catch {}
  }

  return []
}

async function getStream(videoId) {
  // Try Piped stream API
  const pipedInstances = [
    'https://pipedapi.r4fo.com',
    'https://pipedapi.kavin.rocks',
  ]

  for (const instance of pipedInstances) {
    try {
      const r = await fetch(`${instance}/streams/${videoId}`, {
        headers: { 'Accept': 'application/json' }
      })
      if (r.ok) {
        const data = await r.json()
        const audio = data.audioStreams?.filter(s => s.mimeType?.includes('mp4') || s.mimeType?.includes('webm'))
        if (audio?.length > 0) {
          const best = audio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
          if (best?.url) return best.url
        }
      }
    } catch {}
  }

  return null
}
