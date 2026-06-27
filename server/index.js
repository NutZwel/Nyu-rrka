const express = require('express')
const cors = require('cors')
const { execSync } = require('child_process')
const path = require('path')

const app = express()
app.use(cors())
const PORT = process.env.PORT || 3000

// Cari yt-dlp - handle both Linux (Railway) and Windows
let ytPath = 'yt-dlp'
try { execSync(`"${ytPath}" --version`, { stdio: 'pipe', timeout: 5000 }) }
catch {
  const tmp = path.join(__dirname, '..', 'temp')
  // Railway/Linux: binary tanpa .exe, Windows: .exe
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const ytPath = path.join(__dirname, '..', 'temp', binaryName)
  
  if (!require('fs').existsSync(ytPath)) {
    console.log('[Server] Downloading yt-dlp...')
    const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
    execSync(`curl -#L -o "${ytPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`, { timeout: 120000 })
    // Linux/Railway: perlu chmod +x
    if (process.platform !== 'win32') {
      require('fs').chmodSync(ytPath, 0o755)
    }
  }
}
console.log('[Server] yt-dlp ready:', ytPath)

function yt(args) {
  return execSync(`"${ytPath}" ${args}`, { encoding: 'utf8', timeout: 30000 })
}
