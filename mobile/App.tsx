import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StatusBar, Linking, Alert } from 'react-native'
import { Audio } from 'expo-av'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PlayerScreen from './src/screens/PlayerScreen'
import SearchScreen from './src/screens/SearchScreen'
import QueueScreen from './src/screens/QueueScreen'

const APP_VERSION = '1.0.2'
const GITHUB_REPO = 'NutZwel/Nyu-rrka'

interface Track { id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string }

// Decode URL-encoded query string
function decodeQuery(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  str.split('&').forEach(p => {
    const [k, ...v] = p.split('=')
    result[decodeURIComponent(k)] = decodeURIComponent(v.join('='))
  })
  return result
}

// Stream URL — dari YouTube get_video_info + Piped + server lokal
async function getStreamUrl(videoId: string): Promise<string | null> {
  // Source 1: YouTube get_video_info (langsung, tanpa server)
  try {
    const r = await fetch(
      `https://www.youtube.com/get_video_info?video_id=${videoId}&hl=en&el=detailpage`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    )
    if (r.ok) {
      const text = await r.text()
      const params = decodeQuery(text)
      const playerResponse = JSON.parse(params.player_response || '{}')
      const formats = playerResponse?.streamingData?.formats || []
      const adaptiveFormats = playerResponse?.streamingData?.adaptiveFormats || []
      const all = [...formats, ...adaptiveFormats]

      // Cari audio stream (prefer url langsung, bukan cipher)
      const audioStreams = all.filter((f: any) => f.mimeType?.includes('audio/mp4'))
      if (audioStreams.length > 0) {
        // Coba cari yang gak pake cipher dulu
        for (const s of audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))) {
          if (s.url) return s.url
        }
      }
    }
  } catch {}

  // Source 2: Server lokal
  try {
    const r = await fetch(`http://192.168.100.10:3000/api/stream/${videoId}`)
    if (r.ok) { const d = await r.json(); if (d.streamUrl) return d.streamUrl }
  } catch {}

  // Source 3: Piped API
  for (const inst of ['r4fo.com', 'kavin.rocks', 'leptons.xyz']) {
    try {
      const r = await fetch(`https://pipedapi.${inst}/streams/${videoId}`)
      if (r.ok) {
        const d = await r.json()
        const audio = d.audioStreams?.filter((s: any) => s.mimeType?.includes('mp4') || s.mimeType?.includes('webm'))
        if (audio?.length > 0) {
          const best = audio.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0]
          if (best?.url) return best.url
        }
      }
    } catch {}
  }

  return null
}

export default function App() {
  const [tab, setTab] = useState('player')
  const [track, setTrack] = useState<Track | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dur, setDur] = useState(0)
  const [queue, setQueue] = useState<Track[]>([])
  const [qIdx, setQIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const [favs, setFavs] = useState<Track[]>([])

  useEffect(() => {
    AsyncStorage.getItem('@favs').then(r => { if (r) setFavs(JSON.parse(r)) })
    Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true })

    // Check for update
    checkForUpdate()
  }, [])

  const checkForUpdate = async () => {
    try {
      const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      if (!r.ok) return
      const d = await r.json()
      const tag = d.tag_name || ''
      const latestVer = tag.replace(/[^0-9.]/g, '')
      if (latestVer && latestVer !== APP_VERSION) {
        Alert.alert(
          'Update Available',
          `Nyu'rka Mobile v${latestVer} is available!\n\nCurrent: v${APP_VERSION}\n\nDownload the latest APK from GitHub?`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Download', onPress: () => {
              const url = d.html_url || `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`
              Linking.openURL(url)
            }}
          ]
        )
      }
    } catch {}
  }

  const playTrack = async (t: Track, idx?: number) => {
    setTrack(t); setPlaying(true); setProgress(0); setLoading(true)
    if (idx !== undefined) setQIdx(idx)
    if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null }
    try {
      const url = t.streamUrl || await getStreamUrl(t.id)
      if (!url) { setLoading(false); return }
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { progressUpdateIntervalMillis: 250 },
        (s) => {
          if (!s.isLoaded) return
          setDur(s.durationMillis ? s.durationMillis / 1000 : 0)
          setProgress(s.positionMillis ? s.positionMillis / 1000 : 0)
          if (s.didJustFinish) nextTrack()
        })
      soundRef.current = sound
      await sound.playAsync()
    } catch {}
    setLoading(false)
  }

  const nextTrack = () => { if (queue.length) playTrack(queue[qIdx + 1 >= queue.length ? 0 : qIdx + 1], qIdx + 1 >= queue.length ? 0 : qIdx + 1) }

  const handlePlay = (t: Track) => {
    const idx = queue.findIndex(q => q.id === t.id)
    if (idx >= 0) playTrack(t, idx)
    else { setQueue([t]); playTrack(t, 0) }
  }

  const handleQueue = (t: Track) => {
    setQueue(q => {
      const n = [...q, t]
      if (q.length === 0 && !track) playTrack(t, 0)
      return n
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', paddingTop: 36 }}>
      <StatusBar barStyle="light-content" />
      {tab === 'player' && (
        <PlayerScreen track={track} playing={playing} loading={loading} progress={progress} dur={dur}
          onToggle={() => { if (playing) { soundRef.current?.pauseAsync(); setPlaying(false) } else { soundRef.current?.playAsync(); setPlaying(true) } }}
          onNext={nextTrack} />
      )}
      {tab === 'search' && <SearchScreen onPlay={handlePlay} onQueue={handleQueue} />}
      {tab === 'queue' && (
        <QueueScreen queue={queue} qIdx={qIdx} onPlay={playTrack} onClear={() => { setQueue([]); soundRef.current?.unloadAsync(); setTrack(null) }}
          onRemove={(i) => setQueue(q => q.filter((_, idx) => idx !== i))} />
      )}

      {/* Zen Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#141414', paddingVertical: 8 }}>
        {[['♩','player'],['⌕','search'],['≡','queue']].map(([icon, key]) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ color: tab === key ? '#F5F5F5' : '#333', fontSize: 20 }}>{icon}</Text>
            <Text style={{ color: tab === key ? '#F5F5F5' : '#333', fontSize: 8, letterSpacing: 1, marginTop: 2 }}>
              {key.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
