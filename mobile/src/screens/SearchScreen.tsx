import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native'

interface Track { id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string }
const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

const WORKER_DOMAIN = 'nyu-rka.aditsopo76912.workers.dev'
const CLOUD_SERVER = 'https://nyu-rrka-production.up.railway.app'
const LOCAL_SERVER = 'http://192.168.100.10:3000'

async function searchYouTube(query: string): Promise<Track[]> {
  // Source 1: Cloudflare Worker (fastest)
  try {
    const r = await fetch(`https://${WORKER_DOMAIN}/search?q=${encodeURIComponent(query)}`)
    if (r.ok) { const json = await r.json(); if (Array.isArray(json) && json.length > 0) return json }
  } catch {}

  // Source 2: Cloud server (Railway)
  try {
    const r = await fetch(`${CLOUD_SERVER}/api/search?q=${encodeURIComponent(query)}`)
    if (r.ok) { const json = await r.json(); if (Array.isArray(json) && json.length > 0) return json }
  } catch {}

  // Source 3: InnerTube langsung
  try {
    const body = JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20250101', hl: 'en', gl: 'US' } }, query })
    const res = await fetch('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    if (res.ok) {
      const data = await res.json()
      const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || []
      const results: Track[] = []
      for (const section of sections) {
        for (const item of (section?.itemSectionRenderer?.contents || [])) {
          const video = item?.videoRenderer
          if (!video?.videoId) continue
          const parts = (video.lengthText?.simpleText || '').split(':').map(Number)
          let duration = 0
          if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2]
          else if (parts.length === 2) duration = parts[0] * 60 + parts[1]
          results.push({
            id: video.videoId, title: video.title?.runs?.map((r: any) => r.text).join('') || 'Unknown',
            artist: video.ownerText?.runs?.[0]?.text || 'Unknown',
            albumArt: video.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`, duration,
          })
          if (results.length >= 15) break
        }
        if (results.length >= 15) break
      }
      if (results.length > 0) return results
    }
  } catch {}
  // Source 4: Server lokal
  try { const r = await fetch(`${LOCAL_SERVER}/api/search?q=${encodeURIComponent(query)}`); if (r.ok) return await r.json() } catch {}
  return []
}