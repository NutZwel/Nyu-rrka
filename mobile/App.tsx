import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, StatusBar, ActivityIndicator, Linking } from 'react-native'
import { Audio } from 'expo-av'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── YouTube extraction via Innertube API (gratis, no server) ───
// Kalo ini gagal, fallback ke Piped API (free, public)

const PIPED_API = 'https://pipedapi.kavin.rocks'

interface Track {
  id: string
  title: string
  artist: string
  albumArt: string
  duration: number
  streamUrl?: string
}

// Search via Piped API
async function searchTracks(query: string): Promise<Track[]> {
  try {
    const res = await fetch(`${PIPED_API}/search?q=${encodeURIComponent(query)}&filter=videos`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).slice(0, 15).map((item: any) => ({
      id: item.url?.split('v=')[1] || item.url?.split('/')[3] || '',
      title: item.title || 'Unknown',
      artist: item.uploaderName || 'Unknown',
      albumArt: item.thumbnail || `https://i.ytimg.com/vi/${item.url?.split('v=')[1] || ''}/hqdefault.jpg`,
      duration: item.duration || 0,
    })).filter((t: Track) => t.id)
  } catch { return [] }
}

// Get stream URL via Piped API (direct audio URL)
async function getStreamUrl(videoId: string): Promise<string | null> {
  try {
    // Try Piped streaming endpoint
    const res = await fetch(`${PIPED_API}/streams/${videoId}`)
    if (!res.ok) return null
    const data = await res.json()
    // Get best audio-only stream
    const audio = data.audioStreams?.filter((s: any) => s.mimeType?.includes('mp4') || s.mimeType?.includes('webm'))
    if (audio?.length > 0) {
      // Prefer highest quality audio
      const best = audio.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0]
      return best.url || null
    }
    // Fallback: video stream (audio-only may not be available)
    const video = data.videoStreams?.filter((s: any) => s.mimeType?.includes('mp4'))[0]
    return video?.url || null
  } catch {
    // Last resort: try invidious
    try {
      const r = await fetch(`https://inv.riverside.rocks/api/v1/videos/${videoId}`)
      if (!r.ok) return null
      const d = await r.json()
      return d.formatStream?.find((f: any) => f.type?.includes('audio'))?.url ||
             d.adaptiveFormats?.find((f: any) => f.type?.includes('audio'))?.url || null
    } catch { return null }
  }
}

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

export default function App() {
  const [tab, setTab] = useState('player')
  const [track, setTrack] = useState<Track | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dur, setDur] = useState(0)
  const [queue, setQueue] = useState<Track[]>([])
  const [qIdx, setQIdx] = useState(-1)
  const [results, setResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const debRef = useRef<ReturnType<typeof setTimeout>>()

  const playTrack = async (t: Track, idx?: number) => {
    setTrack(t); setPlaying(true); setProgress(0); setLoading(true)
    if (idx !== undefined) setQIdx(idx)
    if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null }
    try {
      const url = t.streamUrl || await getStreamUrl(t.id)
      if (!url) { setLoading(false); return }
      const { sound } = await Audio.Sound.createAsync(
        { uri: url }, { progressUpdateIntervalMillis: 250 },
        (s) => {
          if (!s.isLoaded) return
          setDur(s.durationMillis ? s.durationMillis / 1000 : 0)
          setProgress(s.positionMillis ? s.positionMillis / 1000 : 0)
          if (s.didJustFinish) nextTrack()
        }
      )
      soundRef.current = sound
      await sound.playAsync()
    } catch {}
    setLoading(false)
  }

  const nextTrack = () => {
    if (queue.length === 0) return
    const ni = qIdx + 1 >= queue.length ? 0 : qIdx + 1
    playTrack(queue[ni], ni)
  }

  const doSearch = (q: string) => {
    setQuery(q)
    if (debRef.current) clearTimeout(debRef.current)
    if (q.length > 2) {
      setSearching(true)
      debRef.current = setTimeout(async () => {
        setResults(await searchTracks(q)); setSearching(false)
      }, 600)
    } else setResults([])
  }

  const [favs, setFavs] = useState<Track[]>([])
  useEffect(() => {
    AsyncStorage.getItem('@favs').then(r => { if (r) setFavs(JSON.parse(r)) })
    Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true })
  }, [])

  // ─── TABS ───
  const PlayerTab = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
      {track ? (
        <>
          <Image source={{ uri: track.albumArt }} style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: '#1E293B' }} />
          <Text style={{ color: '#F1F5F9', fontSize: 20, fontWeight: '700', marginTop: 20 }} numberOfLines={1}>{track.title}</Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>{track.artist}</Text>
          {loading && <ActivityIndicator color="#3B82F6" style={{ marginTop: 12 }} />}
          <View style={{ width: '100%', marginTop: 24 }}>
            <View style={{ height: 4, backgroundColor: '#1E293B', borderRadius: 4 }}>
              <View style={{ height: '100%', width: `${dur > 0 ? (progress / dur) * 100 : 0}%`, backgroundColor: '#3B82F6', borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'monospace' }}>{fmt(progress)}</Text>
              <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'monospace' }}>{fmt(dur)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 28 }}>
            <TouchableOpacity onPress={() => playTrack(track)}><Text style={{ fontSize: 28 }}>⏮</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => {
              if (playing) { soundRef.current?.pauseAsync(); setPlaying(false) }
              else { soundRef.current?.playAsync(); setPlaying(true) }
            }} style={{ backgroundColor: '#3B82F6', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 28 }}>{playing ? '⏸' : '▶️'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={nextTrack}><Text style={{ fontSize: 28 }}>⏭</Text></TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🎵</Text>
          <Text style={{ color: '#94A3B8', fontSize: 16 }}>No music playing</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Go to Search tab</Text>
        </View>
      )}
    </View>
  )

  const SearchTab = () => (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
      <TextInput value={query} onChangeText={doSearch} placeholder="Search songs..."
        placeholderTextColor="#64748B" style={{ backgroundColor: '#1E293B', borderRadius: 12, padding: 14, fontSize: 15, color: '#F1F5F9' }} />
      {searching ? <ActivityIndicator color="#3B82F6" style={{ marginTop: 40 }} />
      : results.length > 0 ? (
        <FlatList data={results} keyExtractor={i => i.id} style={{ marginTop: 8 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' }}>
              <Image source={{ uri: item.albumArt }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#1E293B' }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: '#F1F5F9', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: '#64748B', fontSize: 12 }}>{item.artist} · {fmt(item.duration)}</Text>
              </View>
              <TouchableOpacity onPress={() => playTrack(item)}
                style={{ backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>▶</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                const nq = [...queue, item]; setQueue(nq)
                if (queue.length === 0 && !track) playTrack(item)
              }} style={{ padding: 8 }}>
                <Text style={{ fontSize: 16 }}>➕</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (favs.some(f => f.id === item.id)) { setFavs(f => { const n = f.filter(x => x.id !== item.id); AsyncStorage.setItem('@favs', JSON.stringify(n)); return n }) }
                else { setFavs(f => { const n = [...f, item]; AsyncStorage.setItem('@favs', JSON.stringify(n)); return n }) }
              }} style={{ padding: 8 }}>
                <Text style={{ fontSize: 16 }}>{favs.some(f => f.id === item.id) ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </View>
          )} />
      ) : query.length > 2 ? <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 40 }}>No results</Text>
      : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8 }}>Search for any song</Text>
        </View>}
    </View>
  )

  const QueueTab = () => (
    <View style={{ flex: 1, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
        <Text style={{ color: '#F1F5F9', fontSize: 16, fontWeight: '700' }}>Queue ({queue.length})</Text>
        <TouchableOpacity onPress={() => { setQueue([]); soundRef.current?.unloadAsync(); setTrack(null) }}>
          <Text style={{ color: '#EF4444' }}>Clear</Text>
        </TouchableOpacity>
      </View>
      {queue.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
          <Text style={{ color: '#94A3B8', fontSize: 15 }}>Queue is empty</Text>
        </View>
      ) : (
        <FlatList data={queue} keyExtractor={(_, i) => `${i}`} renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => playTrack(item, index)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, backgroundColor: index === qIdx ? '#3B82F608' : 'transparent', borderRadius: 10 }}>
            <Text style={{ width: 24, textAlign: 'center', color: index === qIdx ? '#3B82F6' : '#64748B', fontSize: 11 }}>{index === qIdx ? '▶' : index + 1}</Text>
            <Image source={{ uri: item.albumArt }} style={{ width: 36, height: 36, borderRadius: 8, marginLeft: 4 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: index === qIdx ? '#3B82F6' : '#F1F5F9', fontSize: 13 }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: '#64748B', fontSize: 11 }}>{item.artist} · {fmt(item.duration)}</Text>
            </View>
            <TouchableOpacity onPress={() => setQueue(q => q.filter((_, i) => i !== index))}>
              <Text style={{ color: '#EF4444', fontSize: 14, padding: 6 }}>🗑</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )} />
      )}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', paddingTop: 36 }}>
      <StatusBar barStyle="light-content" />
      {tab === 'player' && <PlayerTab />}
      {tab === 'search' && <SearchTab />}
      {tab === 'queue' && <QueueTab />}

      {/* Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155', paddingVertical: 6 }}>
        {[['🎵','player','Player'],['🔍','search','Search'],['📋','queue','Queue']].map(([icon, key, label]) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 22, opacity: tab === key ? 1 : 0.5 }}>{icon}</Text>
            <Text style={{ color: tab === key ? '#3B82F6' : '#64748B', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
