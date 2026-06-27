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
  const candidates = [
    path.join(__dirname, 'temp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(__dirname, '..', 'temp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
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
  try {
    execSync(`curl -#L -o "${dlPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`, { timeout: 120000 })
    if (process.platform !== 'win32') fs.chmodSync(dlPath, 0o755)
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

// ── Streaming cache (save to temp file, serve via range requests) ──
const downloading = new Set()
const streamCache = new Map()
let activeServer = null

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
    const output = ytExec(`--print "%(id)s|%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s" --flat-playlist --no-warnings "ytsearch15:${q.replace(/"/g, '\\"')}"`, { timeout: 20000 })
    const lines = output.trim().split('\n').filter(Boolean)
    const results = lines.map(line => {
      const [id, title, uploader, duration, ...rest] = line.split('|')
      const thumbnail = rest.join('|') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      return {
        id: id || '',
        title: title || 'Unknown',
        channel: uploader || 'Unknown',
        duration: parseInt(duration) || 0,
        thumbnail,
        url: `https://www.youtube.com/watch?v=${id}`,
      }
    }).filter(r => r.id)

    // Try to preload first result
    if (results.length > 0) preloadVideo(results[0].id)

    res.json(results.slice(0, 15))
  } catch (e) {
    console.error('[Search]', e.message)
    res.status(500).json({ error: 'Search failed', detail: e.message })
  }
})

// Stream — get direct audio URL or serve from cache
app.get('/api/stream/:id', async (req, res) => {
  const videoId = req.params.id
  if (!videoId) return res.status(400).json({ error: 'Missing video ID' })
  if (!ytAvailable) return res.status(503).json({ error: 'yt-dlp not available' })

  // Check cache
  const cacheKey = `preload_${videoId}`
  if (streamCache.has(cacheKey)) {
    const cached = streamCache.get(cacheKey)
    try {
      const port = await serveFromFile(cached.filePath, cached.size, cached.contentType)
      return res.json({ streamUrl: `http://0.0.0.0:${port}/`, source: 'cache' })
    } catch {}
  }

  try {
    // Get direct streaming URL
    const [cmd, ...args] = ytSpawnArgs(['-f', 'bestaudio[ext=m4a]/bestaudio', '--get-url', '--no-warnings', `https://youtube.com/watch?v=${videoId}`])
    const streamUrl = await spawnOutput(cmd, args, 15000)
    const url = streamUrl.trim()

    if (!url.startsWith('http')) {
      return res.status(500).json({ error: 'Invalid stream URL' })
    }

    // Also get metadata
    let title = 'Unknown', duration = 0
    try {
      const meta = ytExec(`--print "%(title)s|%(duration)s" --no-warnings "https://youtube.com/watch?v=${videoId}"`, { timeout: 8000 })
      const [t, d] = meta.trim().split('|')
      title = t || 'Unknown'
      duration = parseInt(d) || 0
    } catch {}

    // Preload in background
    preloadVideo(videoId)

    res.json({ streamUrl: url, duration, title, videoId })
  } catch (e) {
    console.error('[Stream]', e.message)
    res.status(500).json({ error: 'Stream failed', detail: e.message })
  }
})

// Stream with preload/download (slower first time, cached subsequent)
app.get('/api/stream-cached/:id', async (req, res) => {
  const videoId = req.params.id
  if (!videoId) return res.status(400).json({ error: 'Missing video ID' })
  if (!ytAvailable) return res.status(503).json({ error: 'yt-dlp not available' })

  const cacheKey = `preload_${videoId}`
  if (streamCache.has(cacheKey)) {
    const cached = streamCache.get(cacheKey)
    try {
      const port = await serveFromFile(cached.filePath, cached.size, cached.contentType)
      return res.json({ streamUrl: `http://0.0.0.0:${port}/`, source: 'cache' })
    } catch {}
  }

  // Download and cache
  const tmpFile = path.join(__dirname, '..', 'temp', `nyu_${videoId}_${Date.now()}.m4a`)
  try {
    const [cmd, ...args] = ytSpawnArgs(['-f', 'bestaudio[ext=m4a]/bestaudio', '-o', tmpFile, '--no-warnings', `https://youtube.com/watch?v=${videoId}`])
    await spawnOutput(cmd, args, 60000)

    if (fs.existsSync(tmpFile)) {
      const stat = fs.statSync(tmpFile)
      const timer = setTimeout(() => { streamCache.delete(cacheKey); try { fs.unlinkSync(tmpFile) } catch {} }, 120000)
      streamCache.set(cacheKey, { filePath: tmpFile, size: stat.size, contentType: 'audio/mp4', timer })
      const port = await serveFromFile(tmpFile, stat.size, 'audio/mp4')
      res.json({ streamUrl: `http://0.0.0.0:${port}/`, source: 'cached-download', duration: 0 })
    } else {
      res.status(500).json({ error: 'Download failed' })
    }
  } catch (e) {
    console.error('[Stream-Cached]', e.message)
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
