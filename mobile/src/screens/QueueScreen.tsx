import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native'

interface Track { id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string }
const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

export default function QueueScreen({
  queue, qIdx, onPlay, onClear, onRemove,
}: {
  queue: Track[]; qIdx: number
  onPlay: (t: Track, idx: number) => void; onClear: () => void; onRemove: (idx: number) => void
}) {
  if (queue.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' }}>
        <View style={{ width: 64, height: 64, borderRadius: 16, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#222', fontSize: 28 }}>⊕</Text>
        </View>
        <Text style={{ color: '#444', fontSize: 13, marginTop: 12, letterSpacing: 1 }}>QUEUE EMPTY</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 }}>
        <Text style={{ color: '#F5F5F5', fontSize: 14, fontWeight: '500', letterSpacing: 0.5 }}>Queue · {queue.length}</Text>
        <TouchableOpacity onPress={onClear}><Text style={{ color: '#444', fontSize: 13 }}>Clear</Text></TouchableOpacity>
      </View>
      <FlatList data={queue} keyExtractor={(_, i) => `${i}`} renderItem={({ item, index }) => (
        <TouchableOpacity onPress={() => onPlay(item, index)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ width: 22, textAlign: 'center', color: index === qIdx ? '#F5F5F5' : '#333', fontSize: 10, fontWeight: index === qIdx ? '600' : '400' }}>
            {index === qIdx ? '▶' : index + 1}
          </Text>
          <Image source={{ uri: item.albumArt }} style={{ width: 36, height: 36, borderRadius: 6, marginLeft: 6, backgroundColor: '#111' }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: index === qIdx ? '#F5F5F5' : '#888', fontSize: 13, fontWeight: index === qIdx ? '500' : '400' }} numberOfLines={1}>{item.title}</Text>
            <Text style={{ color: '#444', fontSize: 11, marginTop: 1 }}>{item.artist} · {fmt(item.duration)}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(index)} style={{ padding: 6 }}><Text style={{ color: '#333', fontSize: 14 }}>✕</Text></TouchableOpacity>
        </TouchableOpacity>
      )} />
    </View>
  )
}
