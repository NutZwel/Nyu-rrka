import { View, Text, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native'

interface Track { id: string; title: string; artist: string; albumArt: string; duration: number; streamUrl?: string }

const fmt = (s: number) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00'
const { width } = Dimensions.get('window')
const coverSize = Math.min(width - 64, 280)

export default function PlayerScreen({
  track, playing, loading, progress, dur, onToggle, onNext,
}: {
  track: Track | null; playing: boolean; loading: boolean; progress: number; dur: number
  onToggle: () => void; onNext: () => void
}) {
  if (!track) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }}>
        <View style={{ width: 80, height: 80, borderRadius: 20, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, color: '#333' }}>♪</Text>
        </View>
        <Text style={{ color: '#555', fontSize: 14, fontWeight: '500', marginTop: 16, letterSpacing: 1 }}>NO TRACK</Text>
      </View>
    )
  }

  const pct = dur > 0 ? Math.min(progress / dur, 1) : 0

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', paddingHorizontal: 32 }}>
      {/* Cover bulat */}
      <View style={{ borderRadius: coverSize / 2, overflow: 'hidden', backgroundColor: '#111' }}>
        <Image source={{ uri: track.albumArt }} style={{ width: coverSize, height: coverSize }} />
      </View>
      {track.albumArt && (
        <View style={{ position: 'absolute', top: '35%', width: 48, height: 48, borderRadius: 24, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#222' }} />
        </View>
      )}

      <View style={{ marginTop: 32, alignItems: 'center', width: '100%' }}>
        <Text numberOfLines={1} style={{ color: '#F5F5F5', fontSize: 20, fontWeight: '600', letterSpacing: -0.3 }}>{track.title}</Text>
        <Text numberOfLines={1} style={{ color: '#666', fontSize: 14, marginTop: 4 }}>{track.artist}</Text>
      </View>

      {loading && <ActivityIndicator color="#666" style={{ marginTop: 20 }} />}

      {/* Progress */}
      <View style={{ width: '100%', marginTop: 28 }}>
        <View style={{ height: 2, backgroundColor: '#1A1A1A', borderRadius: 1 }}>
          <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: '#F5F5F5', borderRadius: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: '#555', fontSize: 11, fontVariant: ['tabular-nums'] }}>{fmt(progress)}</Text>
          <Text style={{ color: '#555', fontSize: 11, fontVariant: ['tabular-nums'] }}>{fmt(dur)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 28, gap: 36 }}>
        <TouchableOpacity style={{ padding: 4, opacity: 0.4 }}><Text style={{ color: '#F5F5F5', fontSize: 20 }}>⏮</Text></TouchableOpacity>
        <TouchableOpacity onPress={onToggle}
          style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#222', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#F5F5F5', fontSize: 24 }}>{playing ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={{ padding: 4, opacity: 0.4 }}><Text style={{ color: '#F5F5F5', fontSize: 20 }}>⏭</Text></TouchableOpacity>
      </View>
    </View>
  )
}
