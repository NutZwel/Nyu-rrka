// Nyu'rka Mobile API Proxy — Cloudflare Worker
// Search: InnerTube API (works 100%)
// Stream: Multiple strategies (InnerTube + fallback to Piped)

const YT_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
const YT_URL = 'https://www.youtube.com/youtubei/v1'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(req.url)

    if (url.pathname === '/search') {
      const q = url.searchParams.get('q')
      if (!q) return err(400)
      return json(await doSearch(q))
    }

    if (url.pathname.startsWith('/stream/')) {
      const id = url.pathname.split('/')[2]
      if (!id) return err(400)
      const s = await doStream(id)
      return s ? json({ streamUrl: s }) : err(404)
    }

    // New: proxy stream langsung (passthrough audio)
    if (url.pathname.startsWith('/proxy/')) {
      const target = url.searchParams.get('url')
      if (!target) return err(400)
      return proxyStream(target)
    }

    return json({ ok: true })
  }
}

async function doSearch(q) {
  try {
    const r = await fetch(YT_URL + '/search?key=' + YT_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20250101', hl: 'en', gl: 'US' } },
        query: q
      })
    })
    if (!r.ok) return []
    const d = await r.json()
    const sec = d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || []
    const results = []
    for (const s of sec) {
      const items = s?.itemSectionRenderer?.contents || []
      for (let i = 0; i < items.length; i++) {
        const v = items[i]?.videoRenderer
        if (!v || !v.videoId) continue
        const dur = parseDur(v.lengthText?.simpleText || '')
        const thumb = v.thumbnail?.thumbnails?.[0]?.url || ''
        results.push({
          id: v.videoId,
          title: (v.title?.runs || []).map(function(r) { return r.text }).join('') || 'Unknown',
          artist: v.ownerText?.runs?.[0]?.text || 'Unknown',
          albumArt: thumb || ('https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg'),
          duration: dur
        })
        if (results.length >= 15) return results
      }
    }
    return results
  } catch (e) {
    return []
  }
}

function parseDur(s) {
  const p = s.split(':').map(Number)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return 0
}

async function doStream(id) {
  // Strategy 1: InnerTube Android client (most permissive)
  try {
    const r = await fetch(YT_URL + '/player?key=' + YT_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 34 } },
        videoId: id,
        playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } }
      })
    })
    if (r.ok) {
      const d = await r.json()
      const fmts = (d?.streamingData?.formats || []).concat(d?.streamingData?.adaptiveFormats || [])

      // Sort by bitrate descending
      fmts.sort(function(a, b) { return (b.bitrate || 0) - (a.bitrate || 0) })

      // Try formats with direct URL first
      for (let i = 0; i < fmts.length; i++) {
        if (fmts[i].mimeType && (fmts[i].mimeType.indexOf('audio/mp4') >= 0 || fmts[i].mimeType.indexOf('audio/webm') >= 0)) {
          if (fmts[i].url) return fmts[i].url
        }
      }

      // Try any format with direct URL
      for (let i = 0; i < fmts.length; i++) {
        if (fmts[i].url) return fmts[i].url
      }

      // Try signatureCipher
      for (let i = 0; i < fmts.length; i++) {
        if (fmts[i].signatureCipher || fmts[i].cipher) {
          const cipher = fmts[i].signatureCipher || fmts[i].cipher
          const params = new URLSearchParams(cipher)
          const url = params.get('url')
          const sp = params.get('sp') || 'signature'
          const sig = params.get('s')
          if (url && sig) {
            // Try both sp and signature param
            const result = url + '&' + sp + '=' + sig
            // Also try adding sig param as backup
            if (sp !== 'sig') return result + '&sig=' + sig
            return result
          }
        }
      }
    }
  } catch (e) {}

  // Strategy 2: InnerTube WEB client with different params
  try {
    const r = await fetch(YT_URL + '/player?key=' + YT_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20250101', hl: 'en' } },
        videoId: id,
        params: '8AEB' // Enable adaptive formats
      })
    })
    if (r.ok) {
      const d = await r.json()
      const fmts = (d?.streamingData?.formats || []).concat(d?.streamingData?.adaptiveFormats || [])
      for (let i = 0; i < fmts.length; i++) {
        if (fmts[i].url) return fmts[i].url
        if (fmts[i].signatureCipher || fmts[i].cipher) {
          const cipher = fmts[i].signatureCipher || fmts[i].cipher
          const params = new URLSearchParams(cipher)
          const url = params.get('url')
          const sp = params.get('sp') || 'signature'
          const sig = params.get('s')
          if (url && sig) return url + '&' + sp + '=' + sig + '&sig=' + sig
        }
      }
    }
  } catch (e) {}

  // Strategy 3: Piped API
  for (const inst of ['r4fo.com', 'kavin.rocks']) {
    try {
      const r = await fetch('https://pipedapi.' + inst + '/streams/' + id)
      if (r.ok) {
        const d = await r.json()
        const audioStreams = d.audioStreams || []
        const videoStreams = d.videoStreams || []
        const all = audioStreams.concat(videoStreams)
        all.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        for (let i = 0; i < all.length; i++) {
          if (all[i].url) return all[i].url
        }
      }
    } catch (e) {}
  }

  return null
}

// Proxy a stream through the worker (helps with CORS/mixed content)
async function proxyStream(targetUrl) {
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Range': 'bytes=0-'
      }
    })
    if (!response.ok) return err(502)

    // Forward the response with proper headers
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  } catch (e) {
    return err(502)
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: CORS
  })
}

function err(status) {
  return new Response(JSON.stringify({ error: 'Error' }), {
    status: status,
    headers: CORS
  })
}
