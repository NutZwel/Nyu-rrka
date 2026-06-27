import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native'

interface Track {
  id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string
}

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'

export default function PlayerScreen({
  track, playing, loading, progress, dur, onToggle, onNext,
}: {
  track: Track | null
  playing: boolean
  loading: boolean
  progress: number
  dur: number
  onToggle: () => void
  onNext: () => void
}) {
  if (!track) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🎵</Text>
        <Text style={{ color: '#94A3B8', fontSize: 16 }}>No music playing</Text>
        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Go to Search tab</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
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
        <TouchableOpacity style={{ padding: 8 }}><Text style={{ fontSize: 28 }}>⏮</Text></TouchableOpacity>
        <TouchableOpacity onPress={onToggle}
          style={{ backgroundColor: '#3B82F6', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28 }}>{playing ? '⏸' : '▶️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={{ padding: 8 }}><Text style={{ fontSize: 28 }}>⏭</Text></TouchableOpacity>
      </View>
    </View>
  )
}
