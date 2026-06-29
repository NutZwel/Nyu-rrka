const express = require('express')
const cors = require('cors')
const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(cors())
const PORT = process.env.PORT || 3000

// ── Serve PWA static files ──
app.use(express.static(path.join(__dirname, 'public')))

// ── yt-dlp setup ──
let ytPath = 'yt-dlp'
try { execSync('yt-dlp --version', { stdio: 'pipe', timeout: 5000 }) }
catch {
  const candidates = [
    path.join(__dirname, 'temp', 'yt-dlp'),
    path.join(__dirname, '..', 'temp', 'yt-dlp'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) { try { execSync(`"${c}" --version`, { stdio: 'pipe', timeout: 5000 }); ytPath = c; break } catch {} }
  }
  if (ytPath === 'yt-dlp' || !fs.existsSync(ytPath)) {
    const tempDir = path.join(__dirname, '..', 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const dlPath = path.join(tempDir, 'yt-dlp')
    const url = process.platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
    try {
      execSync(`curl -#L -o "${dlPath}" "${url}"`, { timeout: 120000 })
      if (process.platform !== 'win32') fs.chmodSync(dlPath, 0o755)
      execSync(`"${dlPath}" --version`, { stdio: 'pipe', timeout: 5000 })
      ytPath = dlPath
    } catch { console.error('[Server] yt-dlp download failed') }
  }
}
console.log('[Server] yt-dlp:', ytPath)

function ytExec(args, opts = {}) {
  const cmd = ytPath === 'yt-dlp' ? `yt-dlp ${args}` : `"${ytPath}" ${args}`
  return execSync(cmd, { encoding: 'utf8', timeout: opts.timeout || 30000, ...opts })
}

// ── Audio download & serve ──
const TEMP_DIR = path.join(__dirname, '..', 'temp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })
const audioCache = new Map()

async function serveAudio(videoId, req, res) {
  const cached = audioCache.get(videoId)
  if (cached) {
    try {
      const stat = fs.statSync(cached)
      if (stat) return streamFile(cached, stat.size, req, res)
    } catch {}
  }

  // Download
  const tmpFile = path.join(TEMP_DIR, `${videoId}_${Date.now()}.m4a`)
  try {
    ytExec(`-f 'bestaudio[ext=m4a]/bestaudio/best' -o "${tmpFile}" --no-warnings "https://youtube.com/watch?v=${videoId}"`, { timeout: 120000 })
    if (!fs.existsSync(tmpFile)) throw new Error('No output')
    const stat = fs.statSync(tmpFile)
    audioCache.set(videoId, tmpFile)
    setTimeout(() => { audioCache.delete(videoId); try { fs.unlinkSync(tmpFile) } catch {} }, 300000)
    streamFile(tmpFile, stat.size, req, res)
  } catch (e) {
    console.error('[Audio]', e.message)
    try { fs.unlinkSync(tmpFile) } catch {}
    if (!res.headersSent) res.status(500).json({ error: 'Download failed', detail: e.message })
  }
}

function streamFile(filePath, fileSize, req, res) {
  const range = req.headers.range
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1
    const chunkLen = end - start + 1
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunkLen,
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Type': 'audio/mp4',
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(filePath).pipe(res)
  }
}

// ── API Routes ──
app.get('/api/ping', (req, res) => res.json({ ok: true }))

app.get('/api/search', (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ error: 'Missing query' })
  try {
    const output = ytExec(`--flat-playlist --dump-json --no-warnings "ytsearch15:${q.replace(/"/g, '\\"')}"`, { timeout: 20000 })
    const results = output.trim().split('\n').filter(Boolean).map(line => {
      try {
        const item = JSON.parse(line)
        return {
          id: item.id, title: item.title || 'Unknown',
          channel: item.uploader || item.channel || 'Unknown',
          duration: item.duration || 0,
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        }
      } catch { return null }
    }).filter(Boolean)
    res.json(results.slice(0, 15))
  } catch (e) {
    res.status(500).json({ error: 'Search failed', detail: e.message })
  }
})

// Audio stream langsung dari server (bukan redirect)
app.get('/api/stream/:id', (req, res) => {
  const videoId = req.params.id
  if (!videoId) return res.status(400).json({ error: 'Missing video ID' })
  serveAudio(videoId, req, res)
})

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Nyu'rka running on port ${PORT}`)
})
