import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  hide: () => ipcRenderer.send('window-hide'),

  // Theme
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: any) => ipcRenderer.invoke('set-theme', theme),

  // Always on top
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('set-always-on-top', value),

  // Spotify
  spotifyLogin: () => ipcRenderer.invoke('spotify-login'),
  spotifySearch: (query: string) => ipcRenderer.invoke('spotify-search', query),
  spotifyGetTrack: (id: string) => ipcRenderer.invoke('spotify-get-track', id),
  spotifyGetPlaylist: (id: string) => ipcRenderer.invoke('spotify-get-playlist', id),
  spotifyGetAlbum: (id: string) => ipcRenderer.invoke('spotify-get-album', id),
  spotifyGetRecommendations: (seed: string) => ipcRenderer.invoke('spotify-get-recommendations', seed),
  spotifyGetToken: () => ipcRenderer.invoke('spotify-get-token'),
  spotifyIsLoggedIn: () => ipcRenderer.invoke('spotify-is-logged-in'),
  spotifySetToken: (token: string) => ipcRenderer.invoke('spotify-set-token', token),

  // YouTube
  youtubeSearch: (query: string) => ipcRenderer.invoke('youtube-search', query),
  youtubeGetStream: (url: string) => ipcRenderer.invoke('youtube-get-stream', url),
  youtubeStopStream: () => ipcRenderer.invoke('youtube-stop-stream'),
  youtubePreload: (url: string) => ipcRenderer.invoke('youtube-preload', url),
  ytDlpStatus: () => ipcRenderer.invoke('yt-dlp-status'),

  // Playlist
  playlistExtract: (url: string) => ipcRenderer.invoke('playlist-extract', url),

  // Store
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.send('show-tray-notification', { title, body }),

  // File dialog
  selectGif: () => ipcRenderer.invoke('select-gif'),

  // Lyrics fetch (via main process)
  fetchLyrics: (url: string) => ipcRenderer.invoke('fetch-lyrics', url),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  checkUpdateNow: () => ipcRenderer.send('check-update-now'),
})
