import { pushToDatabase, generatePocketBaseId, memoryMedia, setMemoryMedia } from './syncHelper';

// Purge the old bloated local storage key immediately on load to free up space
try {
  localStorage.removeItem('signageos_media');
} catch (e) {
  console.warn('Failed to clear signageos_media from localStorage:', e);
}

export interface MediaItem {
  id: string;
  title: string;
  type: 'image' | 'video' | 'layout' | 'ticker';
  duration: number;
  resolution: string;
  fileSize: string; // Friendly text (e.g. "45 MB")
  fileSizeBytes: number; // Raw size in bytes for storage limits calculations
  uploadedBy: string; // client email or 'admin'
  createdDate: string;
  expiryDate: string;
  tags: string[];
  status: 'active' | 'archived' | 'expired';
  thumbnail: string;
  fileUrl?: string; // Direct R2/S3 URL when using external storage
  width?: number;
  height?: number;
  mimeType?: string;
  fileData?: string;
  fileName?: string;
}

export interface Playlist {
  id: string;
  name: string;
  mediaCount: number;
  assignedScreens: number;
  active: boolean;
  scheduleStatus: 'Running' | 'Scheduled' | 'Paused';
  createdDate: string;
  createdBy: string; // client email or 'admin'
  mediaIds: string[];
  assignedScreenIds: string[];
  orientation?: 'horizontal' | 'vertical';
  widgetType?: 'weather' | 'clock' | 'rss' | 'qrcode';
  widgetPlacement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  widgetLink?: string;
  transition?: 'fade' | 'slide' | 'zoom' | 'slide-up' | 'slide-down' | 'flip' | 'spin' | 'blur' | 'bounce' | 'wipe';
  shuffle?: boolean;
  loop?: boolean;
  volume?: number;
  slides?: {
    id: string;
    mediaId: string;
    duration: number;
    layoutType: 'single' | '50-50' | '70-30' | '30-70';
    secondMediaId?: string;
  }[];
}

export interface Screen {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'active' | 'suspended' | 'pairing';
  playlist: string; // Playlist name
  playlistId?: string; // Assigned playlist ID
  location: string;
  licenseType: string; // 'Lite' | 'Pro'
  lastHeartbeat: string;
  onlineSince?: string;
  playerVersion: string;
  storageUsed: number; // Percentage
  thumbnail: string;
  groupId?: string;
  schedulePlaylist?: string;
  scheduleDate?: string;
  scheduleTime?: string;
  assignedToUserEmail?: string; // client email
  clear_cache?: boolean;
  volume?: number;
  force_sync?: boolean;
}

const INITIAL_MEDIA: MediaItem[] = [];

const INITIAL_PLAYLISTS: Playlist[] = [];

const INITIAL_SCREENS: Screen[] = [];

export const mediaStore = {
  getMedia(): MediaItem[] {
    return memoryMedia;
  },

  saveMedia(media: MediaItem[]) {
    setMemoryMedia(media);
  },

  async uploadMedia(media: Omit<MediaItem, 'id' | 'createdDate' | 'status'>): Promise<MediaItem> {
    const all = this.getMedia();
    const newItem: MediaItem = {
      ...media,
      id: generatePocketBaseId(),
      createdDate: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    all.unshift(newItem);
    this.saveMedia(all);

    // Upload to server and update thumbnail with the real R2 URL from the response
    const result = await pushToDatabase('media_items', newItem.id, newItem, 'POST');
    if (result.ok && result.data) {
      const serverRecord = result.data;
      // Update our local copy with the authoritative URL from the server (R2 or PocketBase)
      const currentAll = this.getMedia();
      const idx = currentAll.findIndex(m => m.id === newItem.id);
      if (idx !== -1) {
        if (serverRecord.thumbnail) currentAll[idx].thumbnail = serverRecord.thumbnail;
        if (serverRecord.fileUrl) currentAll[idx].fileUrl = serverRecord.fileUrl;
        if (serverRecord.id) currentAll[idx].id = serverRecord.id;
        this.saveMedia(currentAll);
        return currentAll[idx];
      }
    }

    return newItem;
  },

  deleteMedia(id: string) {
    const all = this.getMedia();
    const filtered = all.filter(m => m.id !== id);
    this.saveMedia(filtered);
    pushToDatabase('media_items', id, null, 'DELETE');
  },

  getPlaylists(): Playlist[] {
    const data = localStorage.getItem('signageos_playlists');
    if (!data) {
      localStorage.setItem('signageos_playlists', JSON.stringify(INITIAL_PLAYLISTS));
      return INITIAL_PLAYLISTS;
    }
    return JSON.parse(data);
  },

  savePlaylists(playlists: Playlist[]) {
    localStorage.setItem('signageos_playlists', JSON.stringify(playlists));
  },

  createPlaylist(playlist: Omit<Playlist, 'id' | 'createdDate' | 'mediaCount' | 'assignedScreens'>): Playlist {
    const all = this.getPlaylists();
    const newItem: Playlist = {
      ...playlist,
      id: generatePocketBaseId(),
      createdDate: new Date().toISOString().split('T')[0],
      mediaCount: playlist.mediaIds.length,
      assignedScreens: playlist.assignedScreenIds.length
    };
    all.unshift(newItem);
    this.savePlaylists(all);
    pushToDatabase('playlists', newItem.id, newItem, 'POST');

    // If screen IDs are assigned, link them in screen objects
    if (playlist.assignedScreenIds.length > 0) {
      playlist.assignedScreenIds.forEach(screenId => {
        this.assignPlaylistToScreen(screenId, newItem.id);
      });
    }

    return newItem;
  },

  updatePlaylist(id: string, updates: Partial<Omit<Playlist, 'id' | 'createdDate'>>) {
    const all = this.getPlaylists();
    const index = all.findIndex(p => p.id === id);
    if (index !== -1) {
      const merged = { ...all[index], ...updates };
      if (updates.mediaIds) {
        merged.mediaCount = updates.mediaIds.length;
      }
      if (updates.assignedScreenIds) {
        merged.assignedScreens = updates.assignedScreenIds.length;
      }
      all[index] = merged;
      this.savePlaylists(all);
      pushToDatabase('playlists', id, merged, 'PUT');

      // Clean up previous screen assignments and apply new ones
      if (updates.assignedScreenIds) {
        const screens = this.getScreens();
        const updatedScreens = screens.map(s => {
          if (s.playlistId === id && !updates.assignedScreenIds?.includes(s.id)) {
            const updatedScreen = { ...s, playlist: 'Normal', playlistId: '' };
            pushToDatabase('screens', s.id, updatedScreen, 'PUT');
            return updatedScreen;
          }
          if (updates.assignedScreenIds?.includes(s.id)) {
            const updatedScreen = { ...s, playlist: merged.name, playlistId: id };
            pushToDatabase('screens', s.id, updatedScreen, 'PUT');
            return updatedScreen;
          }
          return s;
        });
        this.saveScreens(updatedScreens);
      }
    }
  },

  deletePlaylist(id: string) {
    const all = this.getPlaylists();
    const filtered = all.filter(p => p.id !== id);
    this.savePlaylists(filtered);
    pushToDatabase('playlists', id, null, 'DELETE');

    // Unassign screens
    const screens = this.getScreens();
    const updatedScreens = screens.map(s => {
      if (s.playlistId === id) {
        const updatedScreen = { ...s, playlist: 'Normal', playlistId: '' };
        pushToDatabase('screens', s.id, updatedScreen, 'PUT');
        return updatedScreen;
      }
      return s;
    });
    this.saveScreens(updatedScreens);
  },

  getScreens(): Screen[] {
    const data = localStorage.getItem('signageos_screens');
    if (!data) {
      localStorage.setItem('signageos_screens', JSON.stringify(INITIAL_SCREENS));
      return INITIAL_SCREENS;
    }
    try {
      const parsed = JSON.parse(data);
      let dirty = false;
      const migrated = parsed.map((s: any) => {
        const updated = { ...s };
        if (updated.playlist === 'Unassigned') {
          updated.playlist = 'Normal';
          dirty = true;
        }
        return updated;
      });
      if (dirty) {
        localStorage.setItem('signageos_screens', JSON.stringify(migrated));
      }
      return migrated;
    } catch (e) {
      localStorage.setItem('signageos_screens', JSON.stringify(INITIAL_SCREENS));
      return INITIAL_SCREENS;
    }
  },

  saveScreens(screens: Screen[]) {
    localStorage.setItem('signageos_screens', JSON.stringify(screens));
  },

  assignPlaylistToScreen(screenId: string, playlistId?: string) {
    const screens = this.getScreens();
    const screenIndex = screens.findIndex(s => s.id === screenId);
    if (screenIndex !== -1) {
      if (playlistId) {
        const playlists = this.getPlaylists();
        const play = playlists.find(p => p.id === playlistId);
        screens[screenIndex].playlistId = playlistId;
        screens[screenIndex].playlist = play ? play.name : 'Normal';
      } else {
        screens[screenIndex].playlistId = '';
        screens[screenIndex].playlist = 'Normal';
      }
      this.saveScreens(screens);
      pushToDatabase('screens', screenId, screens[screenIndex], 'PUT');

      // Keep playlist's assignedScreenIds in sync
      const playlists = this.getPlaylists();
      const updatedPlaylists = playlists.map(p => {
        let screenIds = p.assignedScreenIds || [];
        if (p.id === playlistId) {
          if (!screenIds.includes(screenId)) screenIds.push(screenId);
        } else {
          screenIds = screenIds.filter(sid => sid !== screenId);
        }
        const updatedPl = { ...p, assignedScreenIds: screenIds, assignedScreens: screenIds.length };
        pushToDatabase('playlists', p.id, updatedPl, 'PUT');
        return updatedPl;
      });
      this.savePlaylists(updatedPlaylists);
    }
  },

  getClientStorageUsedBytes(clientEmail: string): number {
    const media = this.getMedia();
    return media
      .filter(m => m.uploadedBy === clientEmail)
      .reduce((acc, curr) => acc + curr.fileSizeBytes, 0);
  },

  getClientScreensCount(clientEmail: string): number {
    const screens = this.getScreens();
    return screens.filter(s => s.assignedToUserEmail === clientEmail).length;
  },

  getScreenGroups(): any[] {
    const data = localStorage.getItem('signageos_groups');
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
};
