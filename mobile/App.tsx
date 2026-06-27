import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StatusBar, Linking, Alert } from 'react-native'
import { Audio } from 'expo-av'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PlayerScreen from './src/screens/PlayerScreen'
import SearchScreen from './src/screens/SearchScreen'
import QueueScreen from './src/screens/QueueScreen'

const APP_VERSION = '1.0.2'
const GITHUB_REPO = 'NutZwel/Nyu-rrka'
const WORKER = 'nyu-rka.aditsopo76912.workers.dev'
const CLOUD_SERVER = 'https://nyu-rrka-production.up.railway.app'
const LOCAL_SERVER = 'http://192.168.100.10:3000'

interface Track { id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string }

async function getStreamUrl(videoId: string): Promise<string | null> {
  // Source 1: Server lokal (yt-dlp — work kalo satu WiFi)
  try {
    const r = await fetch(LOCAL_SERVER + '/api/stream/' + videoId, { signal: AbortSignal.timeout(5000) })
    if (r.ok) { const d = await r.json(); if (d.streamUrl) return d.streamUrl }
  } catch {}

  // Source 2: Cloud server (Railway) via hosted yt-dlp
  try {
    const r = await fetch(CLOUD_SERVER + '/api/stream/' + videoId, { signal: AbortSignal.timeout(10000) })
    if (r.ok) { const d = await r.json(); if (d.streamUrl) return d.streamUrl }
  } catch {}

  // Source 3: Cloudflare Worker
  try {
    const r = await fetch('https://' + WORKER + '/stream/' + videoId, { signal: AbortSignal.timeout(5000) })
    if (r.ok) { const d = await r.json(); if (d.streamUrl) return d.streamUrl }
  } catch {}

  // Source 4: Piped API
  for (const inst of ['r4fo.com', 'kavin.rocks', 'leptons.xyz']) {
    try {
      const r = await fetch('https://pipedapi.' + inst + '/streams/' + videoId, { signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const d = await r.json()
        const a = d.audioStreams?.filter((s: any) => s.mimeType?.includes('mp4') || s.mimeType?.includes('webm'))
        if (a?.length > 0) {
          const b = a.sort((x: any, y: any) => (y.bitrate || 0) - (x.bitrate || 0))[0]
          if (b?.url) return b.url
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
    checkForUpdate()
  }, [])

  const checkForUpdate = async () => {
    try {
      const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      if (!r.ok) return
      const d = await r.json()
      const tag = d.tag_name || ''
      const v = tag.replace(/[^0-9.]/g, '')
      if (v && v !== APP_VERSION) {
        Alert.alert('Update Available', `Nyu'rka Mobile v${v} is available!\n\nCurrent: v${APP_VERSION}`, [
          { text: 'Later', style: 'cancel' },
          { text: 'Download', onPress: () => Linking.openURL(d.html_url || `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`) },
        ])
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
    setQueue(q => { const n = [...q, t]; if (q.length === 0 && !track) playTrack(t, 0); return n })
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
      <View style={{ flexDirection: 'row', backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#141414', paddingVertical: 8 }}>
        {[['♩','player'],['⌕','search'],['≡','queue']].map(([icon, key]) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ color: tab === key ? '#F5F5F5' : '#333', fontSize: 20 }}>{icon}</Text>
            <Text style={{ color: tab === key ? '#F5F5F5' : '#333', fontSize: 8, letterSpacing: 1, marginTop: 2 }}>{key.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
