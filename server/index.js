const express = require('express')
const cors = require('cors')
const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

const app = express()
app.use(cors())
const PORT = process.env.PORT || 3000

// ── yt-dlp setup ──────────────────────────────────────────────
let ytPath
let ytAvailable = false

function findYtDlp() {
  // Coba system PATH dulu
  try {
    execSync('yt-dlp --version', { stdio: 'pipe', timeout: 5000 })
    ytPath = 'yt-dlp'
    ytAvailable = true
    console.log('[Server] yt-dlp found in PATH')
    return
  } catch {}

  // Coba ./temp/ dan ../temp/
  const isWindows = process.platform === 'win32'
  const candidates = [
    path.join(__dirname, 'temp', isWindows ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(__dirname, '..', 'temp', isWindows ? 'yt-dlp.exe' : 'yt-dlp'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        execSync(`"${c}" --version`, { stdio: 'pipe', timeout: 5000 })
        ytPath = c
        ytAvailable = true
        console.log('[Server] yt-dlp found at:', c)
        return
      } catch {}
    }
  }

  // Download
  const dlPath = candidates[0]
  // Ensure temp dir exists
  const tempDir = path.dirname(dlPath)
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
  console.log('[Server] Downloading yt-dlp...')

  // On Linux use the static build (no python3 dependency)
  const dlUrl = isWindows
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'

  try {
    execSync(`curl -#L -o "${dlPath}" "${dlUrl}"`, { timeout: 120000 })
    if (!isWindows) fs.chmodSync(dlPath, 0o755)
    execSync(`"${dlPath}" --version`, { stdio: 'pipe', timeout: 5000 })
    ytPath = dlPath
    ytAvailable = true
    console.log('[Server] yt-dlp downloaded successfully')
  } catch (e) {
    console.error('[Server] Failed to get yt-dlp:', e.message)
  }
}

findYtDlp()

function ytSpawnArgs(extra) {
  if (ytPath === 'yt-dlp') return ['yt-dlp', ...extra]
  return [ytPath, ...extra]
}

function ytExec(args, opts = {}) {
  const cmd = ytPath === 'yt-dlp' ? `yt-dlp ${args}` : `"${ytPath}" ${args}`
  return execSync(cmd, { encoding: 'utf8', timeout: opts.timeout || 30000, ...opts })
}

function spawnOutput(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
      reject(new Error('Timeout'))
    }, timeoutMs)
    proc.stdout.on('data', (d) => stdout.push(d))
    proc.stderr.on('data', (d) => stderr.push(d))
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return
      if (code === 0 || stdout.length > 0) {
        resolve(Buffer.concat(stdout).toString('utf8'))
      } else {
        reject(new Error(`Exit ${code}: ${Buffer.concat(stderr).toString('utf8').slice(0, 200)}`))
      }
    })
    proc.on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

function extractId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function parseDuration(s) {
  if (!s) return 0
  const p = s.split(':').map(Number)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return 0
}

// ── Stream URL cache ── (simpan googlevideo URL, bukan file)
const streamUrlCache = new Map()
const downloadingUrls = new Set()

async function getStreamUrl(videoId) {
  // Coba cache
  if (streamUrlCache.has(videoId)) return streamUrlCache.get(videoId)

  // Lagi proses? tunggu
  if (downloadingUrls.has(videoId)) {
    for (let i = 0; i < 30; i++) { // max 15 detik
      await new Promise(r => setTimeout(r, 500))
      if (streamUrlCache.has(videoId)) return streamUrlCache.get(videoId)
      if (!downloadingUrls.has(videoId)) break
    }
  }

  downloadingUrls.add(videoId)
  try {
    const [cmd, ...args] = ytSpawnArgs(['-f', 'bestaudio/best', '--get-url', '--no-warnings', `https://youtube.com/watch?v=${videoId}`])
    const output = await spawnOutput(cmd, args, 15000)
    const url = output.trim()
    if (url.startsWith('http')) {
      streamUrlCache.set(videoId, url)
      // Auto-clear cache after 10 menit
      setTimeout(() => { streamUrlCache.delete(videoId); downloadingUrls.delete(videoId) }, 600000)
      return url
    }
  } catch (e) {
    console.error('[getStreamUrl]', videoId, e.message)
  } finally {
    downloadingUrls.delete(videoId)
  }
  return null
}

function killActiveServer() {
  if (activeServer) { try { activeServer.close() } catch {}; activeServer = null }
}

function serveFromFile(filePath, fileSize, contentType) {
  return new Promise((resolve, reject) => {
    killActiveServer()
    const server = http.createServer((req, res) => {
      const range = req.headers.range
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1
        const chunkLen = end - start + 1
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkLen,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        })
        const stream = fs.createReadStream(filePath, { start, end })
        stream.pipe(res)
        stream.on('error', () => res.end())
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        })
        const stream = fs.createReadStream(filePath)
        stream.pipe(res)
        stream.on('error', () => res.end())
      }
    })
    server.listen(0, '0.0.0.0', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') { activeServer = server; resolve(addr.port) }
      else reject(new Error('Failed to bind'))
    })
    server.on('error', reject)
  })
}

// ── Download & cache a video ──
async function preloadVideo(videoId) {
  const idKey = `preload_${videoId}`
  if (downloading.has(idKey) || streamCache.has(idKey)) return
  downloading.add(idKey)
  const tmpFile = path.join(__dirname, '..', 'temp', `nyu_${videoId}_${Date.now()}.m4a`)
  try {
    const [cmd, ...args] = ytSpawnArgs(['-f', 'bestaudio[ext=m4a]/bestaudio', '-o', tmpFile, '--no-warnings', `https://youtube.com/watch?v=${videoId}`])
    const proc = spawn(cmd, args)
    await new Promise((resolve, reject) => {
      proc.on('exit', (code) => { if (code === 0) resolve(); else reject(new Error(`exit ${code}`)) })
      proc.on('error', reject)
    })
    if (fs.existsSync(tmpFile)) {
      const stat = fs.statSync(tmpFile)
      streamCache.set(idKey, { filePath: tmpFile, size: stat.size, contentType: 'audio/mp4', timer: setTimeout(() => { streamCache.delete(idKey); try { fs.unlinkSync(tmpFile) } catch {} }, 120000) })
      if (streamCache.size > 5) {
        const first = streamCache.keys().next().value
        if (first) {
          const old = streamCache.get(first)
          if (old) { clearTimeout(old.timer); try { fs.unlinkSync(old.filePath) } catch {}; streamCache.delete(first) }
        }
      }
    }
  } catch (e) { console.error('[Preload]', e.message) }
  finally { downloading.delete(idKey) }
}

// ── Routes ────────────────────────────────────────────────────

// Healthcheck
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ytAvailable, version: '1.0.2' })
})

// Search
app.get('/api/search', async (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ error: 'Missing query' })
  if (!ytAvailable) return res.status(503).json({ error: 'yt-dlp not available' })

  try {
    const output = ytExec(`--flat-playlist --dump-json --no-warnings "ytsearch15:${q.replace(/"/g, '\\"')}"`, { timeout: 20000 })
    const results = []
    const lines = output.trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        results.push({
          id: item.id || '',
          title: item.title || 'Unknown',
          channel: item.uploader || item.channel || 'Unknown',
          duration: item.duration || 0,
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
          url: item.url || item.webpage_url || `https://www.youtube.com/watch?v=${item.id}`,
        })
      } catch {}
    }

    // Preload streaming URL untuk result pertama — biar play cepet
    if (results.length > 0) {
      getStreamUrl(results[0].id).catch(() => {})
    }

    res.json(results.slice(0, 15))
  } catch (e) {
    console.error('[Search]', e.message)
    res.status(500).json({ error: 'Search failed', detail: e.message })
  }
})

// Stream — get direct audio URL (dari cache kalo udah ada)
app.get('/api/stream/:id', async (req, res) => {
  const videoId = req.params.id
  if (!videoId) return res.status(400).json({ error: 'Missing video ID' })
  if (!ytAvailable) return res.status(503).json({ error: 'yt-dlp not available' })

  try {
    const url = await getStreamUrl(videoId)
    if (!url) return res.status(500).json({ error: 'Failed to get stream URL' })

    let title = 'Unknown', duration = 0
    try {
      const meta = ytExec(`--print "%(title)s|%(duration)s" --no-warnings "https://youtube.com/watch?v=${videoId}"`, { timeout: 8000 })
      const [t, d] = meta.trim().split('|')
      title = t || 'Unknown'
      duration = parseInt(d) || 0
    } catch {}

    res.json({ streamUrl: url, duration, title, videoId })
  } catch (e) {
    res.status(500).json({ error: 'Stream failed', detail: e.message })
  }
})

// Stream with preload/download (slower first time, cached subsequent)
// Legacy redirect — pake endpoint /api/stream/:id aja
app.get('/api/stream-cached/:id', async (req, res) => {
  const videoId = req.params.id
  if (!videoId) return res.status(400).json({ error: 'Missing video ID' })
  if (!ytAvailable) return res.status(503).json({ error: 'yt-dlp not available' })
  try {
    const url = await getStreamUrl(videoId)
    if (!url) return res.status(500).json({ error: 'Failed to get stream URL' })
    res.json({ streamUrl: url, source: 'cached', duration: 0 })
  } catch (e) {
    res.status(500).json({ error: 'Stream failed', detail: e.message })
  }
})

// yt-dlp status
app.get('/api/status', (req, res) => {
  let version = ''
  try {
    version = execSync(ytPath === 'yt-dlp' ? 'yt-dlp --version' : `"${ytPath}" --version`, { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {}
  res.json({ available: ytAvailable, path: ytPath, version })
})

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Nyu'rka server running on port ${PORT}`)
  console.log(`[Server] yt-dlp: ${ytAvailable ? '✓' : '✗'}`)
})

