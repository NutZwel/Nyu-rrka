const express = require('express')
const cors = require('cors')
const { execSync } = require('child_process')
const path = require('path')

const app = express()
app.use(cors())
const PORT = process.env.PORT || 3000

// Cari yt-dlp
let ytPath = 'yt-dlp'
try { execSync(`"${ytPath}" --version`, { stdio: 'pipe', timeout: 5000 }) }
catch {
  const tmp = path.join(__dirname, '..', 'temp')
  ytPath = path.join(tmp, 'yt-dlp.exe')
  if (!require('fs').existsSync(ytPath)) {
    console.log('Downloading yt-dlp...')
    execSync(`curl -#L -o "${ytPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe`, { timeout: 120000 })
  }
}
console.log('[Server] yt-dlp ready')

function yt(args) {
  return execSync(`"${ytPath}" ${args}`, { encoding: 'utf8', timeout: 30000 })
}

app.head('/api/ping', (_, r) => r.sendStatus(200))

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

const streamCache = new Map()
app.get('/api/stream/:id', (req, res) => {
  const id = req.params.id
  const cached = streamCache.get(id)
  if (cached && Date.now() - cached.ts < 120000) return res.json({ streamUrl: cached.url, id })
  try {
    const url = yt(`-f "bestaudio[ext=m4a]/bestaudio" --get-url --no-warnings "https://youtube.com/watch?v=${id}"`).trim()
    if (url.startsWith('http')) {
      streamCache.set(id, { url, ts: Date.now() })
      res.json({ streamUrl: url, id })
    } else res.status(500).json({ error: 'invalid url' })
  } catch { res.status(500).json({ error: 'stream failed' }) }
})

app.listen(PORT, '0.0.0.0', () => console.log(`[Server] http://localhost:${PORT}`))
