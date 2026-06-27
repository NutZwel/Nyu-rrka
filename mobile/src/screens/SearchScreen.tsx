import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native'

interface Track {
  id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string
}

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

export default function SearchScreen({ onPlay, onQueue }: { onPlay: (t: Track) => void; onQueue: (t: Track) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const doSearch = useCallback(async () => {
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    try {
      // Server lokal (PC kamu) + Piped fallback
      let data: any = null
      const apis = [
        `http://192.168.100.10:3000/api/search?q=${encodeURIComponent(q)}`,
        `http://192.168.1.1:3000/api/search?q=${encodeURIComponent(q)}`,
        `http://10.0.0.2:3000/api/search?q=${encodeURIComponent(q)}`,
        `https://pipedapi.r4fo.com/search?q=${encodeURIComponent(q)}&filter=videos`,
        `https://pipedapi.leptons.xyz/search?q=${encodeURIComponent(q)}&filter=videos`,
      ]

      for (const api of apis) {
        try {
          const r = await fetch(api)
          if (r.ok) {
            const json = await r.json()
            if (typeof json === 'object' && json.items) {
              data = json
            } else if (Array.isArray(json)) {
              data = { items: json }
            } else {
              data = json
            }
            if (data?.items?.length > 0) break
          }
        } catch {}
      }

      if (!data) { setSearching(false); return }
      const tracks = (data.items || []).slice(0, 15).map((item: any) => ({
        id: item.url?.split('v=')[1] || item.url?.split('/')[3] || '',
        title: item.title || 'Unknown',
        artist: item.uploaderName || 'Unknown',
        albumArt: item.thumbnail || `https://i.ytimg.com/vi/${item.url?.split('v=')[1] || ''}/hqdefault.jpg`,
        duration: item.duration || 0,
      })).filter((t: Track) => t.id)
      setResults(tracks)
    } catch {}
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
