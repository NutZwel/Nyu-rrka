import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native'

interface Track {
  id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string
}

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

// ─── YouTube search langsung scraping dari YouTube ───
// Gak perlu API key, server, atau library tambahan
async function searchYouTube(query: string): Promise<Track[]> {
  try {
    const html = await (await fetch(
      `https://www.youtube.com/results?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' } }
    )).text()

    // Ambil ytInitialData dari HTML
    const match = html.match(/ytInitialData[^{]*({.*"adSafetyReason":[^;]*});/s)
        || html.match(/ytInitialData"[^{]*({.*});\s*window\["ytInitialPlayerResponse"\]/s)

    if (!match) return []

    const data = JSON.parse(match[1])
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents
    if (!contents) return []

    const results: Track[] = []

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || []
      for (const item of items) {
        const video = item?.videoRenderer
        if (!video || !video?.videoId || !video?.lengthText) continue

        // Duration parse: "3:45" or "1:02:30" → detik
        const durStr = video.lengthText?.simpleText || ''
        const durParts = durStr.split(':').map(Number)
        let duration = 0
        if (durParts.length === 3) duration = durParts[0] * 3600 + durParts[1] * 60 + durParts[2]
        else if (durParts.length === 2) duration = durParts[0] * 60 + durParts[1]

        results.push({
          id: video.videoId,
          title: video.title?.runs?.map((r: any) => r.text).join('') || 'Unknown',
          artist: video.ownerText?.runs?.[0]?.text || 'Unknown',
          albumArt: video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url || '',
          duration,
        })

        if (results.length >= 10) break
      }
      if (results.length >= 10) break
    }

    return results
  } catch {
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
    const tracks = await searchYouTube(q)
    setResults(tracks)
    setSearching(false)
  }, [query])

  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
      <TextInput ref={inputRef} value={query} onChangeText={setQuery} placeholder="Search songs..."
        placeholderTextColor="#64748B" returnKeyType="search" blurOnSubmit={false}
        onSubmitEditing={doSearch}
        style={{ backgroundColor: '#1E293B', borderRadius: 12, padding: 14, fontSize: 15, color: '#F1F5F9' }} />
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
              <TouchableOpacity onPress={() => onPlay(item)}
                style={{ backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>▶</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onQueue(item)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 16 }}>➕</Text>
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
}
