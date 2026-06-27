import { useEffect, useState } from 'react'

export function useAutoUpdate() {
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'downloading' | 'ready' | 'latest' | 'error' | 'idle'>('idle')

  useEffect(() => {
    // Cek update otomatis pas app start
    checkUpdate()
  }, [])

  const checkUpdate = async () => {
    setUpdateStatus('checking')
    try {
      if (window.electronAPI?.checkForUpdates) {
        await window.electronAPI.checkForUpdates()
        setUpdateStatus('latest')
      }
    } catch {
      setUpdateStatus('error')
    }
    setTimeout(() => setUpdateStatus('idle'), 3000)
  }

  const downloadUpdate = async () => {
    setUpdateStatus('downloading')
    try {
      if (window.electronAPI?.checkForUpdates) {
        await window.electronAPI.checkForUpdates()
        setUpdateStatus('ready')
      }
    } catch {
      setUpdateStatus('error')
    }
  }

  return { updateStatus, checkUpdate, downloadUpdate }
}
