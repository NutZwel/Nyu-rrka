import { useState, useEffect } from 'react'
import { LogIn, LogOut, Monitor, Eye, Music, Key, Check, Palette, Image as ImageIcon, Trash2, RefreshCw } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { useAppStore } from '../store/appStore'

export default function SettingsView() {
  const { theme } = useThemeStore()
  const { alwaysOnTop, setAlwaysOnTop, isLoggedIn, setLoggedIn, isMinimalView, toggleMinimalView } = useAppStore()
  const [loggingIn, setLoggingIn] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle')

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    if (!window.electronAPI) return
    const aot = await window.electronAPI.getAlwaysOnTop()
    setAlwaysOnTop(aot || false)
  }

  const handleSpotifyLogin = async () => {
    setLoggingIn(true)
    try { const r = await window.electronAPI?.spotifyLogin(); setLoggedIn(!!r); if (r) window.electronAPI?.showNotification('Spotify', 'Connected!') }
    catch (e) { console.error(e) }
    finally { setLoggingIn(false) }
  }

  const SettingCard = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="p-3 rounded-2xl flex items-center justify-between" style={{ background: theme.surface, border: `1px solid ${theme.border}30` }}>
      <div><div className="text-sm font-medium" style={{ color: theme.text }}>{label}</div>{description && <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{description}</div>}</div>
      {children}
    </div>
  )

  return (
    <div className="flex flex-col animate-fadeIn space-y-4">
      <div className="text-sm font-semibold" style={{ color: theme.text }}>Settings</div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>SPOTIFY</div>

        <SettingCard label={isLoggedIn ? 'Connected to Spotify' : 'Connect to Spotify'} description={isLoggedIn ? 'Account linked ✓' : 'Login for playlists'}>
          <button className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
            style={{ background: isLoggedIn ? `${theme.error}20` : theme.primary, color: isLoggedIn ? theme.error : '#fff' }}
            onClick={handleSpotifyLogin} disabled={loggingIn}>
            {loggingIn ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isLoggedIn ? <LogOut size={12} /> : <LogIn size={12} />}
            {loggingIn ? '...' : isLoggedIn ? 'Disconnect' : 'Login'}
          </button>
        </SettingCard>

        <SettingCard label="Manual Token" description="Paste API token directly">
          <button className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
            style={{ background: `${theme.primary}15`, color: theme.primary }}
            onClick={() => setShowTokenInput(!showTokenInput)}>
            <Key size={12} />{showTokenInput ? 'Hide' : 'Paste Token'}
          </button>
        </SettingCard>

        {showTokenInput && <div className="p-3 rounded-2xl animate-fadeIn" style={{ background: theme.surface, border: `1px solid ${theme.border}30` }}>
          <div className="text-[10px] mb-2" style={{ color: theme.textSecondary }}>Paste your Spotify access token:</div>
          <textarea value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="BQ..." rows={2}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono outline-none resize-none"
            style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }} />
          <div className="flex items-center gap-2 mt-2">
            <button className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
              style={{ background: theme.primary, color: '#fff' }}
              onClick={async () => {
                if (!tokenInput.trim()) return
                const ok = await window.electronAPI?.spotifySetToken(tokenInput.trim())
                if (ok) { setTokenStatus('success'); setLoggedIn(true); setTimeout(() => setTokenStatus('idle'), 2000) }
                else { setTokenStatus('error'); setTimeout(() => setTokenStatus('idle'), 2000) }
              }}>
              {tokenStatus === 'success' ? <><Check size={12} /> Applied!</> : 'Apply Token'}
            </button>
            {tokenStatus === 'error' && <span className="text-xs" style={{ color: theme.error }}>Invalid token</span>}
          </div>
        </div>}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>DISPLAY</div>

        <SettingCard label="Always on Top" description="Pin window above others">
          <label className="relative cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={alwaysOnTop} onChange={(e) => { setAlwaysOnTop(e.target.checked); window.electronAPI?.setAlwaysOnTop(e.target.checked) }} />
            <div className="w-8 h-4 rounded-full transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
              style={{ background: alwaysOnTop ? theme.primary : theme.surfaceAlt }} />
          </label>
        </SettingCard>

        <SettingCard label="Compact View" description="Minimal spacing">
          <button className={`btn-icon ${isMinimalView ? 'opacity-100' : 'opacity-50'}`} onClick={toggleMinimalView} style={{ color: isMinimalView ? theme.primary : theme.textSecondary }}>
            <Eye size={16} />
          </button>
        </SettingCard>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>MASCOT</div>

        <SettingCard label="Custom GIF" description="Ganti pixel mascot dengan GIF">
          <button className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
            style={{ background: useThemeStore.getState().customMascotPath ? `${theme.error}20` : `${theme.primary}15`, color: useThemeStore.getState().customMascotPath ? theme.error : theme.primary }}
            onClick={async () => {
              const path = await window.electronAPI?.selectGif()
              if (path) useThemeStore.getState().setCustomMascotPath(path)
            }}>
            <ImageIcon size={12} />{useThemeStore.getState().customMascotPath ? 'Ganti GIF' : 'Pilih GIF'}
          </button>
        </SettingCard>

        {useThemeStore.getState().customMascotPath && (
          <SettingCard label="Reset Mascot" description="Kembali ke pixel mascot">
            <button className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
              style={{ background: `${theme.error}20`, color: theme.error }}
              onClick={() => useThemeStore.getState().setCustomMascotPath(null)}>
              <Trash2 size={12} />Reset
            </button>
          </SettingCard>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>AUDIO</div>
        <SettingCard label="Audio Source" description="YouTube streams">
          <Music size={16} style={{ color: theme.secondary }} />
        </SettingCard>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>UPDATE</div>
        <SettingCard label="Check for Updates" description={updateStatus === 'checking' ? 'Checking...' : updateStatus === 'latest' ? 'You have the latest version' : updateStatus === 'available' ? 'Update available!' : 'Auto-updates via GitHub'}>
          <button className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
            style={{ background: `${theme.primary}15`, color: theme.primary }}
            onClick={async () => {
              setUpdateStatus('checking')
              try {
                if (window.electronAPI?.checkForUpdates) {
                  await window.electronAPI.checkForUpdates()
                  setUpdateStatus('latest')
                } else {
                  setUpdateStatus('available')
                }
              } catch { setUpdateStatus('available') }
              setTimeout(() => setUpdateStatus('idle'), 3000)
            }}>
            <RefreshCw size={12} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
            {updateStatus === 'checking' ? '...' : 'Check'}
          </button>
        </SettingCard>
      </div>
    </div>
  )
}
