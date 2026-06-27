import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native'

interface Track {
  id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string
}

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

export default function QueueScreen({
  queue, qIdx, onPlay, onClear, onRemove,
}: {
  queue: Track[]
  qIdx: number
  onPlay: (t: Track, idx: number) => void
  onClear: () => void
  onRemove: (idx: number) => void
}) {
  if (queue.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
        <Text style={{ color: '#94A3B8', fontSize: 15 }}>Queue is empty</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
        <Text style={{ color: '#F1F5F9', fontSize: 16, fontWeight: '700' }}>Queue ({queue.length})</Text>
        <TouchableOpacity onPress={onClear}><Text style={{ color: '#EF4444' }}>Clear</Text></TouchableOpacity>
      </View>
      <FlatList data={queue} keyExtractor={(_, i) => `${i}`} renderItem={({ item, index }) => (
        <TouchableOpacity onPress={() => onPlay(item, index)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, backgroundColor: index === qIdx ? '#3B82F608' : 'transparent', borderRadius: 10 }}>
          <Text style={{ width: 24, textAlign: 'center', color: index === qIdx ? '#3B82F6' : '#64748B', fontSize: 11 }}>{index === qIdx ? '▶' : index + 1}</Text>
          <Image source={{ uri: item.albumArt }} style={{ width: 36, height: 36, borderRadius: 8, marginLeft: 4 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: index === qIdx ? '#3B82F6' : '#F1F5F9', fontSize: 13 }} numberOfLines={1}>{item.title}</Text>
            <Text style={{ color: '#64748B', fontSize: 11 }}>{item.artist} · {fmt(item.duration)}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(index)}><Text style={{ color: '#EF4444', fontSize: 14, padding: 6 }}>🗑</Text></TouchableOpacity>
        </TouchableOpacity>
      )} />
    </View>
  )
}
