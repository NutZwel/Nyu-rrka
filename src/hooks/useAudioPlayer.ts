import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const loadingRef = useRef(false)

  const {
    currentTrack, isPlaying, volume, loopMode,
    setPlaying, setProgress, setDuration, nextTrack,
  } = usePlayerStore()

  /** Stop audio segera — synchronous, paksa berhenti */
  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    cleanupRef.current?.()
    cleanupRef.current = null
    audio.pause()
    audio.src = ''
    audio.load()
    window.electronAPI?.youtubeStopStream()
  }, [])

  // Init audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'none'
    }
    return () => {
      stopAudio()
      if (audioRef.current) {
        audioRef.current.src = ''
        audioRef.current.load()
      }
    }
  }, [stopAudio])

  // Load and play track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!currentTrack) {
      stopAudio()
      currentTrackIdRef.current = null
      return
    }

    if (currentTrack.id === currentTrackIdRef.current) return
    currentTrackIdRef.current = currentTrack.id

    stopAudio()

    let cancelled = false

    const run = async () => {
      loadingRef.current = true

      try {
        let ytUrl = currentTrack.youtubeUrl
        let ytId = currentTrack.youtubeId
        if (!ytUrl && ytId) {
          ytUrl = `https://youtube.com/watch?v=${ytId}`
        }
        if (!ytUrl) {
          console.log('Searching YouTube:', currentTrack.title, currentTrack.artist)
          const q = `${currentTrack.title} ${currentTrack.artist} music`
          const results = await window.electronAPI?.youtubeSearch(q)
          if (Array.isArray(results) && results.length > 0) {
            ytUrl = results[0].url
            ytId = results[0].id
          }
        }
        if (!ytUrl || cancelled) { setPlaying(false); loadingRef.current = false; return }

        const result = await window.electronAPI?.youtubeGetStream(ytUrl)
        if (!result || result.error || !result.streamUrl || cancelled) {
          console.error('Stream error:', result?.error || 'No URL')
          // Auto-skip kalo stream error
          const trackTitle = currentTrack.title
          setPlaying(false)
          loadingRef.current = false
          // Skip ke next track setelah error
          setTimeout(() => {
            usePlayerStore.getState().nextTrack()
            // Notifikasi error
            try {
              window.electronAPI?.showNotification?.('Playback Error',
                `Could not play "${trackTitle}". Skipping to next track.`)
            } catch {}
          }, 300)
          return
        }

        if (result.duration) setDuration(result.duration)
        audio.preload = 'auto'
        audio.src = result.streamUrl

        let recoveryAttempts = 0
        let recoveryTimer: ReturnType<typeof setTimeout> | null = null

        const tryRecover = () => {
          if (recoveryAttempts >= 3) {
            // Skip ke next setelah 3x gagal
            usePlayerStore.getState().nextTrack()
            return
          }
          recoveryAttempts++
          // Reload stream URL
          const currentId = usePlayerStore.getState().currentTrack?.id
          if (!currentId) return
          const ytUrl = currentTrack.youtubeUrl || (currentTrack.youtubeId ? `https://youtube.com/watch?v=${currentTrack.youtubeId}` : '')
          if (!ytUrl) return
          window.electronAPI?.youtubeGetStream(ytUrl).then(r => {
            if (r?.streamUrl) {
              audio.src = r.streamUrl
              audio.play().catch(() => {})
            }
          })
        }

        const onCanPlay = () => {
          if (usePlayerStore.getState().isPlaying && audio.paused) {
            audio.play().catch(() => {})
          }
        }
        const onMeta = () => {
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration)
          }
        }
        const onTimeUpdate = () => {
          setProgress(audio.currentTime)
        }
        const onEnded = async () => {
          const loop = usePlayerStore.getState().loopMode
          if (loop === 'one') { audio.currentTime = 0; audio.play() }
          else { await nextTrack() }
        }
        const onError = () => {
          console.error('Audio error:', audio.error?.code)
          setPlaying(false)
          loadingRef.current = false
          // Coba recover dulu, kalo gagal skip
          tryRecover()
        }
        const onStalled = () => {
          // Stalled — coba recover
          if (usePlayerStore.getState().isPlaying) {
            audio.play().catch(() => {})
          }
        }
        // Monitor: kalo isPlaying true tapi audio diam > 5 detik, coba recover
        const monitorInterval = setInterval(() => {
          if (usePlayerStore.getState().isPlaying && audio.paused && audio.currentTime > 0 && !audio.ended) {
            // Audio berhenti sendiri — coba play ulang
            audio.play().catch(() => {
              if (recoveryAttempts < 2) tryRecover()
            })
          }
        }, 3000)

        audio.addEventListener('canplay', onCanPlay)
        audio.addEventListener('loadedmetadata', onMeta)
        audio.addEventListener('timeupdate', onTimeUpdate)
        audio.addEventListener('ended', onEnded)
        audio.addEventListener('error', onError)
        audio.addEventListener('stalled', onStalled)
        audio.addEventListener('suspend', onStalled)

        cleanupRef.current = () => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('loadedmetadata', onMeta)
          audio.removeEventListener('timeupdate', onTimeUpdate)
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
          audio.removeEventListener('stalled', onStalled)
          audio.removeEventListener('suspend', onStalled)
          if (recoveryTimer) clearTimeout(recoveryTimer)
          clearInterval(monitorInterval)
        }

        try {
          await audio.play()
          setPlaying(true)
        } catch {
          setPlaying(false)
        }

        loadingRef.current = false
      } catch (err) {
        setPlaying(false)
        loadingRef.current = false
        // Auto-skip on general error
        setTimeout(() => {
          usePlayerStore.getState().nextTrack()
          try {
            window.electronAPI?.showNotification?.('Playback Error',
              'Unable to play this track. Skipping.')
          } catch {}
        }, 300)
      }
    }

    run()
    return () => { cancelled = true }
  }, [currentTrack, stopAudio])

  // Recover: monitor kalo isPlaying tapi audio berhenti sendiri
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    const id = setInterval(() => {
      if (usePlayerStore.getState().isPlaying && audio.paused && audio.currentTime > 0 && !audio.ended && !audio.error) {
        audio.play().catch(() => {})
      }
    }, 2000)

    return () => clearInterval(id)
  }, [currentTrack])

  // Play/Pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.play().catch(() => setPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const seek = useCallback((t: number) => {
    if (audioRef.current) { audioRef.current.currentTime = t; setProgress(t) }
  }, [setProgress])

  useEffect(() => {
    (window as any).__seekAudio = seek
    return () => { delete (window as any).__seekAudio }
  }, [seek])

  const stop = useCallback(() => {
    stopAudio()
    setPlaying(false)
  }, [stopAudio, setPlaying])

  return { seek, stop }
}
