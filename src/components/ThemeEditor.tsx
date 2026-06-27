import { useState } from 'react'
import { Palette, RefreshCw, ChevronDown, ChevronUp, Check, Link } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { Theme } from '../types'
import PixelMascot from './PixelMascot'

type ColorKey = keyof Pick<Theme, 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'surfaceAlt' | 'text' | 'textSecondary' | 'border' | 'error' | 'success' | 'warning'>

const colorLabels: Record<ColorKey, string> = {
  primary: 'Primary', secondary: 'Secondary', accent: 'Accent',
  background: 'Background', surface: 'Surface', surfaceAlt: 'Surface Alt',
  text: 'Text', textSecondary: 'Text Secondary', border: 'Border',
  error: 'Error', success: 'Success', warning: 'Warning',
}

const colorGroups: { label: string; keys: ColorKey[] }[] = [
  { label: 'Brand Colors', keys: ['primary', 'secondary', 'accent'] },
  { label: 'Backgrounds', keys: ['background', 'surface', 'surfaceAlt'] },
  { label: 'Text', keys: ['text', 'textSecondary'] },
  { label: 'Utility', keys: ['border', 'error', 'success', 'warning'] },
]

const fontOptions = [
  'Inter, system-ui, sans-serif', 'SF Pro Display, system-ui, sans-serif',
  'JetBrains Mono, monospace', 'Poppins, sans-serif',
  'Space Grotesk, sans-serif', 'Outfit, sans-serif', 'system-ui, sans-serif',
]

export default function ThemeEditor() {
  const { theme, availableThemes, updateTheme, resetTheme, applyPreset } = useThemeStore()
  const [expandedGroup, setExpandedGroup] = useState('Brand Colors')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [colorHuntUrl, setColorHuntUrl] = useState('')
  const [colorHuntStatus, setColorHuntStatus] = useState<string | null>(null)

  const extractColorHuntColors = (url: string): string[] | null => {
    // Color Hunt URL format: https://colorhunt.co/palette/0f28541c4d8d4988c4bde8f5
    const match = url.match(/palette\/([a-fA-F0-9]{24,32})/)
    if (!match) return null
    const hex = match[1]
    // 6 hex chars per color = 4 colors, or 8 per color = 3 colors
    const colors: string[] = []
    if (hex.length === 24) {
      // 6 chars per color × 4
      for (let i = 0; i < 24; i += 6) {
        colors.push(`#${hex.slice(i, i + 6)}`)
      }
    } else if (hex.length === 32) {
      // 8 chars per color × 4 (ignore alpha = take first 6)
      for (let i = 0; i < 32; i += 8) {
        colors.push(`#${hex.slice(i, i + 6)}`)
      }
    }
    return colors.length >= 3 ? colors : null
  }

  const handleColorHuntUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setColorHuntUrl(url)
    setColorHuntStatus(null)
  }

  const applyColorHunt = () => {
    if (colorHuntUrl.length < 10) {
      setColorHuntStatus('invalid')
      setTimeout(() => setColorHuntStatus(null), 2000)
      return
    }
    const colors = extractColorHuntColors(colorHuntUrl)
    if (colors && colors.length >= 3) {
      // Color Hunt: [warna1, warna2, warna3, warna4] → kiri ke kanan
      // Map: paling kiri = background, ke kanan = sisanya, paling kanan = accent
      const cBg = colors[0] // background (paling kiri)
      const cAccent = colors.length > 3 ? colors[3] : colors[2] // accent (paling kanan)
      const cPrimary = colors.length > 3 ? colors[2] : colors[1] // primary = 1 tingkat lebih gelap dari accent
      const cSecondary = colors.length > 3 ? colors[1] : colors[0] // secondary = 2 tingkat lebih gelap

      const newTheme: Partial<Theme> = {
        background: cBg,
        surface: lightenHex(cBg, 0.08) || cBg,
        surfaceAlt: lightenHex(cBg, 0.15) || cBg,
        primary: darkenHex(cAccent, 0.7) || cAccent,
        secondary: darkenHex(cAccent, 0.5) || cAccent,
        accent: cAccent,
        text: cAccent,
        textSecondary: darkenHex(cAccent, 0.65) || cAccent,
        border: lightenHex(cBg, 0.5) || cBg,
      }
      updateTheme(newTheme)
      setColorHuntStatus('ok')
    } else {
      setColorHuntStatus('invalid')
    }
    setTimeout(() => setColorHuntStatus(null), 3000)
  }

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="w-7 h-7 rounded-xl border-2 cursor-pointer" style={{ background: value, borderColor: theme.border }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium" style={{ color: theme.textSecondary }}>{label}</div>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xs outline-none font-mono" style={{ color: theme.text }} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full animate-fadeIn space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Palette size={16} style={{ color: theme.primary }} /><span className="text-sm font-semibold" style={{ color: theme.text }}>Themes</span></div>
        <button className="px-2.5 py-1.5 rounded-xl text-[10px] font-medium flex items-center gap-1 transition-all" style={{ background: `${theme.error}15`, color: theme.error }} onClick={resetTheme}><RefreshCw size={10} />Reset</button>
      </div>

      {/* Color Hunt import */}
      <div className="p-3 rounded-2xl" style={{ background: theme.surface, border: `1px solid ${theme.border}30` }}>
        <div className="flex items-center gap-2 mb-2">
          <Link size={12} style={{ color: theme.primary }} />
          <span className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>IMPORT FROM COLOR HUNT</span>
        </div>
        <div className="text-[9px] mb-2" style={{ color: theme.textSecondary + '90' }}>
          Paste Color Hunt URL to extract palette
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={colorHuntUrl}
            onChange={handleColorHuntUrl}
            placeholder="https://colorhunt.co/palette/..."
            className="flex-1 px-2.5 py-1.5 rounded-xl text-xs outline-none"
            style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }}
          />
          <button
            onClick={applyColorHunt}
            className="px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all"
            style={{ background: theme.primary, color: '#fff' }}
          >
            Apply
          </button>
        </div>
        {colorHuntStatus && (
          <div className="text-[10px]" style={{ color: colorHuntStatus === 'ok' ? theme.success : theme.error }}>
            {colorHuntStatus === 'ok' ? '✓ Palette imported!' : colorHuntStatus === 'invalid' ? '✗ Invalid URL' : colorHuntStatus}
          </div>
        )}
      </div>

      {/* Presets */}
      <div>
        <div className="text-[10px] font-semibold tracking-wider mb-2.5" style={{ color: theme.textSecondary }}>PRESETS</div>
        <div className="grid grid-cols-2 gap-2">
          {availableThemes.map(p => (
            <button key={p.name} className="p-3 rounded-xl text-[10px] font-medium transition-all relative flex items-center gap-2"
              style={{ background: theme.name === p.name ? `${theme.primary}20` : theme.surface, border: `1px solid ${theme.name === p.name ? theme.primary : theme.border}30`, color: theme.name === p.name ? theme.primary : theme.textSecondary }}
              onClick={() => applyPreset(p.name)}>
              {theme.name === p.name && <Check size={10} className="absolute top-1 right-1" style={{ color: theme.primary }} />}
              <PixelMascot type={p.mascot} size={28} />
              <div className="text-left">
                <div className="text-xs font-semibold">{p.icon} {p.name}</div>
                <div className="text-[8px] opacity-60">{p.mascot}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {colorGroups.map(group => (
          <div key={group.label}>
            <button className="flex items-center justify-between w-full py-1.5" onClick={() => setExpandedGroup(expandedGroup === group.label ? '' : group.label)}>
              <span className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>{group.label.toUpperCase()}</span>
              {expandedGroup === group.label ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedGroup === group.label && <div className="space-y-2.5 mt-1.5">{group.keys.map(key => <ColorPicker key={key} label={colorLabels[key]} value={theme[key]} onChange={(v) => updateTheme({ [key]: v })} />)}</div>}
          </div>
        ))}

        <div className="my-2" style={{ borderTop: `1px solid ${theme.border}30` }} />

        <button className="flex items-center justify-between w-full py-1.5" onClick={() => setShowAdvanced(!showAdvanced)}>
          <span className="text-[10px] font-semibold tracking-wider" style={{ color: theme.textSecondary }}>ADVANCED</span>
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdvanced && <div className="space-y-3 animate-fadeIn">
          <div>
            <div className="flex items-center justify-between mb-1"><span className="text-[10px]" style={{ color: theme.textSecondary }}>Border Radius</span><span className="text-[10px] font-mono" style={{ color: theme.text }}>{theme.borderRadius}px</span></div>
            <input type="range" min={0} max={24} value={theme.borderRadius} onChange={(e) => updateTheme({ borderRadius: parseInt(e.target.value) })} className="w-full" style={{ background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${(theme.borderRadius / 24) * 100}%, ${theme.surfaceAlt} ${(theme.borderRadius / 24) * 100}%, ${theme.surfaceAlt} 100%)` }} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><span className="text-[10px]" style={{ color: theme.textSecondary }}>Spacing</span><span className="text-[10px] font-mono" style={{ color: theme.text }}>{theme.spacing}px</span></div>
            <input type="range" min={0} max={12} value={theme.spacing} onChange={(e) => updateTheme({ spacing: parseInt(e.target.value) })} className="w-full" style={{ background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${(theme.spacing / 12) * 100}%, ${theme.surfaceAlt} ${(theme.spacing / 12) * 100}%, ${theme.surfaceAlt} 100%)` }} />
          </div>
          <div>
            <span className="text-[10px]" style={{ color: theme.textSecondary }}>Font</span>
            <select value={theme.fontFamily} onChange={(e) => updateTheme({ fontFamily: e.target.value })} className="w-full px-2.5 py-1.5 rounded-xl text-xs outline-none mt-1" style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }}>
              {fontOptions.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
            </select>
          </div>
          {[ {key: 'compact', icon: '▫', label: 'Compact Mode'}, {key: 'blur', icon: '💫', label: 'Blur Effect'}, {key: 'animations', icon: '✨', label: 'Animations'} ].map(({key, icon, label}) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-[10px]" style={{ color: theme.textSecondary }}>{icon} {label}</span>
              <input type="checkbox" checked={!!(theme as any)[key]} onChange={(e) => updateTheme({ [key]: e.target.checked } as any)} className="toggle" />
            </label>
          ))}
          {theme.blur && <div className="pl-4">
            <div className="flex items-center justify-between mb-1"><span className="text-[10px]" style={{ color: theme.textSecondary }}>Blur Amount</span><span className="text-[10px] font-mono" style={{ color: theme.text }}>{theme.blurAmount}px</span></div>
            <input type="range" min={4} max={40} value={theme.blurAmount} onChange={(e) => updateTheme({ blurAmount: parseInt(e.target.value) })} className="w-full" style={{ background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} ${(theme.blurAmount / 40) * 100}%, ${theme.surfaceAlt} ${(theme.blurAmount / 40) * 100}%, ${theme.surfaceAlt} 100%)` }} />
          </div>}

          {/* Preview */}
          <div className="p-4 rounded-2xl mt-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="text-[10px] font-medium mb-2" style={{ color: theme.textSecondary }}>PREVIEW</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.primary, color: '#fff' }}>Primary</div>
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.secondary, color: '#fff' }}>Secondary</div>
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.accent, color: '#000' }}>Accent</div>
              <div className="px-2.5 py-1 rounded-xl text-[10px]" style={{ background: theme.surfaceAlt, color: theme.text }}>Surface</div>
            </div>
            <div className="text-xs" style={{ color: theme.text }}>The quick brown fox jumps over the lazy dog.</div>
            <div className="text-[10px]" style={{ color: theme.textSecondary }}>Secondary text example</div>
          </div>
        </div>}
      </div>
    </div>
  )
}

// ─── Color helpers ───
function darkenHex(hex: string, factor: number): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return hex
  const r = Math.round(parseInt(c.substring(0,2), 16) * factor)
  const g = Math.round(parseInt(c.substring(2,4), 16) * factor)
  const b = Math.round(parseInt(c.substring(4,6), 16) * factor)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

function lightenHex(hex: string, percent: number): string {
  // percent 0-1: seberapa terang (1 = putih sepenuhnya)
  const c = hex.replace('#', '')
  if (c.length < 6) return hex
  const r = Math.min(255, Math.round(parseInt(c.substring(0,2), 16) + (255 - parseInt(c.substring(0,2), 16)) * percent))
  const g = Math.min(255, Math.round(parseInt(c.substring(2,4), 16) + (255 - parseInt(c.substring(2,4), 16)) * percent))
  const b = Math.min(255, Math.round(parseInt(c.substring(4,6), 16) + (255 - parseInt(c.substring(4,6), 16)) * percent))
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}
