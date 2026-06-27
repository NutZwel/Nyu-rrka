import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native'

interface Track { id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string }

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

async function searchYouTube(query: string): Promise<Track[]> {
  try {
    const body = JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20250101', hl: 'en', gl: 'US' } },
      query,
    })
    const res = await fetch('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    if (!res.ok) return []
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
          id: video.videoId,
          title: video.title?.runs?.map((r: any) => r.text).join('') || 'Unknown',
          artist: video.ownerText?.runs?.[0]?.text || 'Unknown',
          albumArt: video.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
          duration,
        })
        if (results.length >= 15) break
      }
      if (results.length >= 15) break
    }
    return results
  } catch {
    try { const r = await fetch(`http://192.168.100.10:3000/api/search?q=${encodeURIComponent(query)}`); if (r.ok) return await r.json() } catch {}
    return []
  }
}

export default function SearchScreen({ onPlay, onQueue }: { onPlay: (t: Track) => void; onQueue: (t: Track) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const doSearch = useCallback(async () => {
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    setResults(await searchYouTube(q))
    setSearching(false)
  }, [query])

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 12, borderWidth: 1, borderColor: '#1A1A1A' }}>
          <Text style={{ color: '#444', paddingLeft: 14, fontSize: 14 }}>⌕</Text>
          <TextInput ref={inputRef} value={query} onChangeText={setQuery} placeholder="Search songs..."
            placeholderTextColor="#333" returnKeyType="search" blurOnSubmit={false} onSubmitEditing={doSearch}
            style={{ flex: 1, padding: 14, fontSize: 15, color: '#F5F5F5', fontWeight: '400' }} />
        </View>
      </View>

      {searching ? <ActivityIndicator color="#666" style={{ marginTop: 60 }} />
      : results.length > 0 ? (
        <FlatList data={results} keyExtractor={i => i.id} style={{ flex: 1, paddingHorizontal: 12 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111' }}>
              <Image source={{ uri: item.albumArt }} style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: '#111' }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#F5F5F5', fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: '#555', fontSize: 12, marginTop: 1 }}>{item.artist} · {fmt(item.duration)}</Text>
              </View>
              <TouchableOpacity onPress={() => onQueue(item)} style={{ padding: 8 }}><Text style={{ color: '#666', fontSize: 16 }}>⊕</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => onPlay(item)}
                style={{ borderWidth: 1, borderColor: '#222', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 4 }}>
                <Text style={{ color: '#F5F5F5', fontSize: 12 }}>▶</Text>
              </TouchableOpacity>
            </View>
          )} />
      ) : query.length > 2 ? <Text style={{ color: '#444', textAlign: 'center', marginTop: 60, fontSize: 13 }}>No results</Text>
      : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#222', fontSize: 48 }}>⌕</Text>
          <Text style={{ color: '#333', fontSize: 13, marginTop: 8, letterSpacing: 1 }}>SEARCH</Text>
        </View>}
    </View>
  )
}
