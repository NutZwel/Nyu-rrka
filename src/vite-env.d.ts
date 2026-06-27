/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  hide: () => void
  getTheme: () => Promise<any>
  setTheme: (theme: any) => Promise<boolean>
  getAlwaysOnTop: () => Promise<boolean>
  setAlwaysOnTop: (value: boolean) => void
  spotifyLogin: () => Promise<boolean>
  spotifySearch: (query: string) => Promise<any>
  spotifyGetTrack: (id: string) => Promise<any>
  spotifyGetPlaylist: (id: string) => Promise<any>
  spotifyGetAlbum: (id: string) => Promise<any>
  spotifyGetRecommendations: (seed: string) => Promise<any>
  spotifyGetToken: () => Promise<string | null>
  spotifyIsLoggedIn: () => Promise<boolean>
  spotifySetToken: (token: string) => Promise<boolean>
  youtubeSearch: (query: string) => Promise<any>
  youtubeGetStream: (url: string) => Promise<any>
  youtubeStopStream: () => Promise<boolean>
  youtubePreload: (url: string) => Promise<boolean>
  ytDlpStatus: () => Promise<{ available: boolean; path: string }>
  playlistExtract: (url: string) => Promise<{ tracks?: any[]; error?: string }>
  storeGet: (key: string) => Promise<any>
  storeSet: (key: string, value: any) => Promise<boolean>
  showNotification: (title: string, body: string) => void
  selectGif: () => Promise<string | null>
  fetchLyrics: (url: string) => Promise<{ data?: any; error?: string; status: number }>
  checkForUpdates: () => Promise<any>
  checkUpdateNow: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
