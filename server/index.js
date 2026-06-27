const express = require('express')
const cors = require('cors')
const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
const PORT = process.env.PORT || 3000

// ─── yt-dlp: cari atau download ───
let ytPath = 'yt-dlp'

function findYtDlp() {
  try {
    execSync(`"${ytPath}" --version`, { stdio: 'pipe', timeout: 10000 })
    return true
  } catch {
    // Di Railway/Linux biasanya pake pip
    try {
      execSync('which yt-dlp || pip install yt-dlp || pip3 install yt-dlp', { stdio: 'pipe', timeout: 30000 })
      execSync(`"${ytPath}" --version`, { stdio: 'pipe', timeout: 10000 })
      return true
    } catch {
      // Download dari GitHub
      const dest = '/tmp/yt-dlp'
      try {
        execSync(`curl -#L -o ${dest} https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && chmod +x ${dest}`, { timeout: 120000 })
        ytPath = dest
        return true
      } catch { return false }
    }
  }
}

console.log('[Server] Setting up yt-dlp...')
findYtDlp()
console.log('[Server] yt-dlp ready:', ytPath)

function yt(args) {
  return execSync(`"${ytPath}" ${args}`, { encoding: 'utf8', timeout: 30000 })
}

function ytSpawn(args) {
  const [cmd, ...rest] = [ytPath, ...args]
  return spawn(cmd, rest)
}

// ─── Cache ───
const streamCache = new Map()
const CACHE_TTL = 120_000

// ─── Routes ───
app.head('/api/ping', (_, r) => r.sendStatus(200))
app.get('/api/ping', (_, r) => r.json({ ok: true }))

app.get('/api/search', (req, res) => {
  const q = req.query.q
  if (!q) return res.status(400).json({ error: 'no query' })
  try {
    const raw = yt(`--print "%(id)s|%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s" --no-warnings --default-search "ytsearch10" "${q.replace(/"/g,'\\"')}"`)
    const results = raw.trim().split('\n').filter(Boolean).map(l => {
      const [id, title, artist, duration, thumbnail] = l.split('|')
      return { id, title: title || 'Unknown', artist: artist || 'Unknown', duration: parseInt(duration) || 0, albumArt: thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, url: `https://youtube.com/watch?v=${id}` }
    })
    res.json(results.slice(0, 10))
  } catch { res.status(500).json({ error: 'search failed' }) }
})

app.get('/api/stream/:id', (req, res) => {
  const id = req.params.id
  const cached = streamCache.get(id)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json({ streamUrl: cached.url, id })

  try {
    const url = yt(`-f "bestaudio[ext=m4a]/bestaudio" --get-url --no-warnings "https://youtube.com/watch?v=${id}"`).trim()
    if (url.startsWith('http')) {
      streamCache.set(id, { url, ts: Date.now() })
      res.json({ streamUrl: url, id })
    } else res.status(500).json({ error: 'invalid url' })
  } catch { res.status(500).json({ error: 'stream failed' }) }
})

app.listen(PORT, '0.0.0.0', () => console.log(`[Server] Nyu'rka API running on port ${PORT}`))
