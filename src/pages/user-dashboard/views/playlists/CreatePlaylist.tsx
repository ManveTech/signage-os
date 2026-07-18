import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, X, CheckCircle, Clock, ArrowUp, ArrowDown, GripVertical, 
  Play, Pause, ChevronLeft, ChevronRight, ChevronDown, QrCode, Sun, Eye, 
  Image as ImageIcon, Sparkles, Layout, FolderOpen, Save, HardDrive,
  Shuffle, RotateCcw, Plus, Trash2, Check, Tv, Volume2, CloudRain, CloudSnow, CloudSun, Wind
} from 'lucide-react';
import { mediaStore, MediaItem, Playlist } from '../../../../lib/mediaStore';
import { licensingStore } from '../../../../lib/licensingStore';
import { syncCollection } from '../../../../lib/syncHelper';

type PlaylistItem = {
  id: string;
  mediaId: string;
  duration: number;
  layoutType: 'single' | '50-50' | '70-30' | '30-70';
  secondMediaId?: string;
};

interface Props {
  userEmail: string;
  onNavigate?: (view: string) => void;
}

export default function CreatePlaylist({ userEmail = 'priya@demo.com', onNavigate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Dynamic Media Assets Pool loaded from mediaStore
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [storageLimitGb, setStorageLimitGb] = useState(5);

  // Playlist Sequence Timeline
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);

  // Playlist Metadata
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [category, setCategory] = useState('Advertising');

  // Playlist Settings (Orientation, Transition, Shuffle, Loop)
  const [playlistOrientation, setPlaylistOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [playlistTransition, setPlaylistTransition] = useState<'fade' | 'slide' | 'zoom' | 'slide-up' | 'slide-down' | 'flip' | 'spin' | 'blur' | 'bounce' | 'wipe'>('fade');
  const [showAllTransitions, setShowAllTransitions] = useState(false);
  const [playlistShuffle, setPlaylistShuffle] = useState<boolean>(false);
  const [playlistLoop, setPlaylistLoop] = useState<boolean>(true);
  const [playlistVolume, setPlaylistVolume] = useState<number>(80);

  // Widget Settings
  const [playlistWidgetType, setPlaylistWidgetType] = useState<'weather' | 'clock' | 'rss' | 'qrcode' | undefined>(undefined);
  const [playlistWidgetPlacement, setPlaylistWidgetPlacement] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');
  const [playlistWidgetLink, setPlaylistWidgetLink] = useState('');
  const [tickerBgColor, setTickerBgColor] = useState('#111827');
  const [tickerTextColor, setTickerTextColor] = useState('#ffffff');
  const [tickerParagraphs, setTickerParagraphs] = useState<string[]>(['']);

  // Preview Modal States
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [previewTime, setPreviewTime] = useState(new Date());
  const [simulatedItems, setSimulatedItems] = useState<PlaylistItem[]>([]);

  // Toast Alerts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [existingPlaylists, setExistingPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');

  // Multi-upload sequential progress state
  const [totalFilesToUpload, setTotalFilesToUpload] = useState(0);
  const [uploadingFilesCount, setUploadingFilesCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadMedia();
    loadPlaylists();

    // Check if we navigated here from "Edit Playlist" click
    const cachedEditId = localStorage.getItem('signageos_editing_playlist_id');
    if (cachedEditId) {
      loadPlaylistForEditing(cachedEditId);
      localStorage.removeItem('signageos_editing_playlist_id');
    }
  }, [userEmail]);

  const loadPlaylists = () => {
    const all = mediaStore.getPlaylists();
    setExistingPlaylists(all.filter(p => p.createdBy === userEmail));
  };

  const loadPlaylistForEditing = (id: string) => {
    const playlists = mediaStore.getPlaylists();
    const play = playlists.find(p => p.id === id);
    if (play) {
      setEditingPlaylistId(id);
      setSelectedPlaylistId(id);
      setPlaylistName(play.name);
      setPlaylistDesc(play.slides ? '' : 'Loaded from older layout');
      setPlaylistOrientation(play.orientation || 'horizontal');
      setPlaylistTransition(play.transition || 'fade');
      setPlaylistShuffle(play.shuffle || false);
      setPlaylistLoop(play.loop !== undefined ? play.loop : true);
      setPlaylistVolume(play.volume !== undefined ? play.volume : 80);
      setPlaylistWidgetType(play.widgetType);
      setPlaylistWidgetPlacement(play.widgetPlacement || 'top-right');
      setPlaylistWidgetLink(play.widgetLink || '');

      // Load ticker specific states
      if (play.widgetType === 'rss' && play.widgetLink) {
        try {
          const config = JSON.parse(play.widgetLink);
          if (config && typeof config === 'object') {
            setTickerBgColor(config.bgColor || '#111827');
            setTickerTextColor(config.textColor || '#ffffff');
            setTickerParagraphs(Array.isArray(config.items) ? config.items : ['']);
          } else {
            setTickerParagraphs([play.widgetLink]);
            setTickerBgColor('#111827');
            setTickerTextColor('#ffffff');
          }
        } catch (e) {
          setTickerParagraphs([play.widgetLink]);
          setTickerBgColor('#111827');
          setTickerTextColor('#ffffff');
        }
      } else {
        setTickerBgColor('#111827');
        setTickerTextColor('#ffffff');
        setTickerParagraphs(['']);
      }

      const allMedia = mediaStore.getMedia();
      const clientMedia = allMedia.filter(m => m.uploadedBy === userEmail);
      if (play.slides && play.slides.length > 0) {
        const validSlides = play.slides.filter(slide => clientMedia.some(m => m.id === slide.mediaId));
        setPlaylistItems(validSlides);
      } else {
        const validMediaIds = play.mediaIds.filter(mid => clientMedia.some(m => m.id === mid));
        const mappedSlides = validMediaIds.map(mid => ({
          id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          mediaId: mid,
          duration: 10,
          layoutType: 'single' as const
        }));
        setPlaylistItems(mappedSlides);
      }
      showToast(`Loaded playlist "${play.name}" for editing.`);
    }
  };

  const handleLoadPlaylistForEditing = (id: string) => {
    if (!id) {
      handleStartNewPlaylist();
      return;
    }
    loadPlaylistForEditing(id);
  };

  const handleStartNewPlaylist = () => {
    setEditingPlaylistId(null);
    setSelectedPlaylistId('');
    setPlaylistName('');
    setPlaylistDesc('');
    setPlaylistItems([]);
    setPlaylistOrientation('horizontal');
    setPlaylistTransition('fade');
    setPlaylistShuffle(false);
    setPlaylistLoop(true);
    setPlaylistVolume(80);
    setPlaylistWidgetType(undefined);
    setPlaylistWidgetPlacement('top-right');
    setPlaylistWidgetLink('');
    setTickerBgColor('#111827');
    setTickerTextColor('#ffffff');
    setTickerParagraphs(['']);
    showToast('Starting a new playlist.');
  };

  const loadMedia = () => {
    const all = mediaStore.getMedia();
    const clientMedia = all.filter(m => m.uploadedBy === userEmail);
    setMediaList(clientMedia);

    syncCollection('media_items', 'signageos_media').then(updatedMedia => {
      const updatedClientMedia = updatedMedia.filter(m => m.uploadedBy === userEmail);
      setMediaList(updatedClientMedia);
    });

    // Get current storage usage
    const used = mediaStore.getClientStorageUsedBytes(userEmail);
    setStorageUsedBytes(used);

    // Get current storage limit from license
    const licenses = licensingStore.getLicenses();
    const lic = licenses.find(l => l.assignedUserEmail === userEmail);
    if (lic) {
      setStorageLimitGb(lic.storageLimit);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Clock ticks for digital clock widget in simulator
  useEffect(() => {
    const timer = setInterval(() => setPreviewTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic slideshow playback transition in simulator
  useEffect(() => {
    if (!showPreviewModal || !isPlaying || simulatedItems.length === 0) return;

    const currentSlide = simulatedItems[previewIndex];
    const durationMs = (currentSlide?.duration || 10) * 1000;

    const timeout = setTimeout(() => {
      if (previewIndex === simulatedItems.length - 1) {
        if (playlistLoop) {
          setPreviewIndex(0);
        } else {
          setIsPlaying(false);
        }
      } else {
        setPreviewIndex(prev => prev + 1);
      }
    }, durationMs);

    return () => clearTimeout(timeout);
  }, [showPreviewModal, isPlaying, previewIndex, simulatedItems, playlistLoop]);

  const openPreview = () => {
    if (playlistItems.length > 0) {
      // Handle Shuffle logic for simulator items list
      let itemsToPlay = [...playlistItems];
      if (playlistShuffle) {
        itemsToPlay.sort(() => Math.random() - 0.5);
      }
      setSimulatedItems(itemsToPlay);
      setPreviewIndex(0);
      setIsPlaying(true);
      setShowPreviewModal(true);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= playlistItems.length) return;
    const nextList = [...playlistItems];
    const temp = nextList[index];
    nextList[index] = nextList[nextIndex];
    nextList[nextIndex] = temp;
    setPlaylistItems(nextList);
  };

  const removeItem = (id: string) => {
    setPlaylistItems(p => p.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<PlaylistItem>) => {
    setPlaylistItems(p => p.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // Click asset to directly add to sequence
  const addAssetToTimeline = (asset: MediaItem) => {
    const newSlide: PlaylistItem = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mediaId: asset.id,
      duration: asset.duration || 10,
      layoutType: 'single',
    };
    setPlaylistItems(prev => [...prev, newSlide]);
    showToast(`Added "${asset.title}" to sequence timeline.`);
  };

  // -------------------------------------------------------------
  // DRAG & DROP TIMELINE HANDLERS
  // -------------------------------------------------------------
  const handleSlideDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('type', 'slide');
    e.dataTransfer.setData('slideIndex', index.toString());
    setDraggedIndex(index);
  };

  const handleSlideDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const nextList = [...playlistItems];
    const item = nextList[draggedIndex];
    nextList.splice(draggedIndex, 1);
    nextList.splice(index, 0, item);
    
    setDraggedIndex(index);
    setPlaylistItems(nextList);
  };

  const handleSlideDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleAssetDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('type', 'asset');
    e.dataTransfer.setData('assetId', assetId);
  };

  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const assetId = e.dataTransfer.getData('assetId');

    if (type === 'asset' && assetId) {
      const asset = mediaList.find(m => m.id === assetId);
      if (asset) {
        addAssetToTimeline(asset);
      }
    }
  };

  const handleZone2Drop = (e: React.DragEvent, slideId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('type');
    const assetId = e.dataTransfer.getData('assetId');

    if (type === 'asset' && assetId) {
      const asset = mediaList.find(m => m.id === assetId);
      if (asset) {
        updateItem(slideId, { secondMediaId: asset.id });
        showToast(`Assigned Zone 2 media: "${asset.title}"`);
      }
    }
  };

  // -------------------------------------------------------------
  // REAL FILE UPLOAD HANDLERS
  // -------------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processUploadedFiles(Array.from(files));
    e.target.value = '';
  };

  const uploadSingleFile = (file: File): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const isVideo = file.type.startsWith('video/');
      const maxFileBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
      const limitMb = isVideo ? 50 : 5;

      if (file.size > maxFileBytes) {
        reject(new Error(`"${file.name}" is larger than ${limitMb}MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). All uploaded ${isVideo ? 'video' : 'image'} files must be under ${limitMb}MB.`));
        return;
      }

      const fileSizeMb = file.size / (1024 * 1024);
      const fileSizeBytes = file.size;
      const storageLimitBytes = storageLimitGb * 1024 * 1024 * 1024;

      if (storageUsedBytes + fileSizeBytes > storageLimitBytes) {
        reject(new Error(`This file of ${fileSizeMb.toFixed(1)} MB exceeds your remaining license storage limit. Allowed storage: ${storageLimitGb} GB.`));
        return;
      }

      const fileType = isVideo ? 'video' : 'image';
      const reader = new FileReader();

      reader.onload = (event) => {
        const resultDataUrl = event.target?.result as string;
        const base64Data = resultDataUrl.split(',')[1];

        const saveMediaWithThumb = async (thumbUrl: string, width: number, height: number, duration: number) => {
          try {
            const newMedia = await mediaStore.uploadMedia({
              title: file.name,
              type: fileType,
              duration: duration,
              resolution: `${width}x${height}`,
              fileSize: `${fileSizeMb.toFixed(1)} MB`,
              fileSizeBytes: fileSizeBytes,
              uploadedBy: userEmail,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              tags: ['uploaded', 'playlist-direct'],
              thumbnail: thumbUrl,
              width: width,
              height: height,
              mimeType: file.type,
              fileData: base64Data,
              fileName: file.name
            });

            loadMedia();
            addAssetToTimeline(newMedia);
            showToast(`Media "${file.name}" uploaded and appended to playlist!`);
            resolve();
          } catch (e) {
            reject(e);
          }
        };

        if (fileType === 'image') {
          const img = new Image();
          img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            saveMediaWithThumb(resultDataUrl, width, height, 10);
          };
          img.onerror = () => {
            reject(new Error(`Failed to load image "${file.name}".`));
          };
          img.src = resultDataUrl;
        } else {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const duration = Math.round(video.duration) || 15;
            window.URL.revokeObjectURL(video.src);
            saveMediaWithThumb('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&fit=crop&q=60', width, height, duration);
          };
          video.onerror = () => {
            saveMediaWithThumb('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&fit=crop&q=60', 1920, 1080, 15);
          };
          video.src = URL.createObjectURL(file);
        }
      };

      reader.onerror = () => {
        reject(new Error(`Failed to read file "${file.name}".`));
      };

      reader.readAsDataURL(file);
    });
  };

  const processUploadedFiles = async (files: File[]) => {
    setTotalFilesToUpload(files.length);
    setUploadingFilesCount(0);
    setUploadProgress(0);

    let count = 0;
    let failedCount = 0;
    for (const file of files) {
      count++;
      setUploadingFilesCount(count);
      setUploadProgress(((count - 1) / files.length) * 100);
      try {
        await uploadSingleFile(file);
      } catch (err) {
        console.error(err);
        failedCount++;
        showToast(`⚠️ Failed: ${file.name} — ${err instanceof Error ? err.message : 'Upload error'}`);
      }
      setUploadProgress((count / files.length) * 100);
    }

    if (failedCount === 0) {
      showToast(`✅ All ${files.length} file(s) uploaded successfully!`);
    } else {
      showToast(`⚠️ ${files.length - failedCount} of ${files.length} files uploaded. ${failedCount} failed.`);
    }

    setTimeout(() => {
      setTotalFilesToUpload(0);
      setUploadingFilesCount(0);
      setUploadProgress(0);
    }, 1500);
  };

  const handleFileDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedFiles(Array.from(files));
    }
  };

  // -------------------------------------------------------------
  // SAVE PLAYLIST HANDLER
  // -------------------------------------------------------------
  const handleSavePlaylist = () => {
    if (totalFilesToUpload > 0) {
      showToast('⏳ Please wait for all uploads to finish before saving.');
      return;
    }
    if (!playlistName.trim()) {
      showToast('⚠️ Please enter a playlist name.');
      return;
    }
    if (playlistItems.length === 0) {
      showToast('⚠️ Please add at least one media slide to the sequence.');
      return;
    }

    const finalWidgetLink = playlistWidgetType === 'rss'
      ? JSON.stringify({ items: tickerParagraphs.filter(p => p.trim() !== ''), bgColor: tickerBgColor, textColor: tickerTextColor })
      : playlistWidgetLink;

    if (editingPlaylistId) {
      // Update existing playlist
      mediaStore.updatePlaylist(editingPlaylistId, {
        name: playlistName,
        active: true,
        scheduleStatus: 'Running',
        mediaIds: playlistItems.map(item => item.mediaId),
        orientation: playlistOrientation,
        widgetType: playlistWidgetType,
        widgetPlacement: playlistWidgetPlacement,
        widgetLink: finalWidgetLink,
        transition: playlistTransition,
        shuffle: playlistShuffle,
        loop: playlistLoop,
        volume: playlistVolume,
        slides: playlistItems
      });
      showToast(`✅ Playlist "${playlistName}" updated successfully!`);
    } else {
      // Create new playlist
      mediaStore.createPlaylist({
        name: playlistName,
        active: true,
        scheduleStatus: 'Running',
        createdBy: userEmail,
        mediaIds: playlistItems.map(item => item.mediaId),
        assignedScreenIds: [],
        orientation: playlistOrientation,
        widgetType: playlistWidgetType,
        widgetPlacement: playlistWidgetPlacement,
        widgetLink: finalWidgetLink,
        transition: playlistTransition,
        shuffle: playlistShuffle,
        loop: playlistLoop,
        volume: playlistVolume,
        slides: playlistItems
      });
      showToast(`✅ Playlist "${playlistName}" created successfully!`);
    }

    // Refresh playlists dropdown list
    loadPlaylists();
    
    // Reset inputs
    handleStartNewPlaylist();

    // Navigate to all playlists view after a short delay so user sees the success toast
    if (onNavigate) {
      setTimeout(() => onNavigate('playlists-all'), 900);
    }
  };

  const getMediaItem = (id: string) => mediaList.find(m => m.id === id);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 text-left relative">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="image/*,video/*" 
        className="hidden" 
        multiple
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 z-50 animate-slideIn max-w-xs">
          {toastMessage}
        </div>
      )}

      {/* Full-page Upload Progress Overlay */}
      {totalFilesToUpload > 0 && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-sm mx-4 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Upload size={22} className="text-blue-600 animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Uploading Media Files</p>
                <p className="text-xs text-slate-500 mt-0.5">Please wait — do not close this page</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">
                  File {uploadingFilesCount} of {totalFilesToUpload}
                </span>
                <span className="text-xs font-bold text-blue-600">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Uploading to server and adding to your media library...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Create Dynamic Playlist</h1>
        <p className="text-sm text-gray-500 mt-0.5">Build split-screen layouts, upload files, configure widget overlays, and preview standby standee animations.</p>
      </div>

      {/* Playlist Selector for Editing */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              {editingPlaylistId ? 'Editing Playlist Profile' : 'Start from Scratch or Edit Existing'}
            </p>
            <p className="text-[10px] text-gray-400">
              {editingPlaylistId ? `Modifying "${playlistName}" (ID: ${editingPlaylistId})` : 'Choose a playlist to load and edit, or build a new loop.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 min-w-[240px] w-full sm:w-auto">
          <select
            value={selectedPlaylistId}
            onChange={e => handleLoadPlaylistForEditing(e.target.value)}
            className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 font-bold text-slate-700 cursor-pointer w-full shadow-xs"
          >
            <option value="">-- Create New Playlist --</option>
            {existingPlaylists.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {editingPlaylistId && (
            <button
              type="button"
              onClick={handleStartNewPlaylist}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-750 text-xs font-extrabold uppercase rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT COLUMN: MEDIA ASSETS POOL & UPLOAD ================= */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
          <div>
            <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center justify-between">
              <span>Media Assets</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">{mediaList.length} Items</span>
            </h2>
            <p className="text-[9.5px] text-gray-400 mt-0.5">Select items to add to timeline or drag them directly. Use Zone 2 lists for screen divisions.</p>
          </div>

          {/* Drag and Drop Direct Upload Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleFileDropZone}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
              dragging ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
            }`}
          >
            <Upload size={18} className="text-blue-500 mx-auto mb-1.5" />
            <p className="text-[10.5px] font-bold text-slate-700">Drag files here or click to browse</p>
            <p className="text-[9px] text-gray-400 mt-0.5">Enforces license storage limit ({storageLimitGb} GB). Limits: 5MB image, 50MB video</p>
          </div>

          {/* Asset Scroll Area */}
          <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {mediaList.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleAssetDragStart(e, asset.id)}
                className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50/10 transition-all select-none group relative"
              >
                {/* Instant add to sequence button */}
                <button
                  type="button"
                  onClick={() => addAssetToTimeline(asset)}
                  className="absolute top-1.5 right-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1 shadow hover:scale-105 transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                  title="Add to sequence"
                >
                  <Plus size={10} className="stroke-[3]" />
                </button>

                <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-200 border border-slate-100 relative">
                  {asset.type === 'video' || asset.thumbnail?.toLowerCase().includes('.mp4') || asset.thumbnail?.toLowerCase().includes('.webm') || asset.thumbnail?.toLowerCase().includes('.mov') || asset.thumbnail?.toLowerCase().includes('video/') ? (
                    <video src={asset.thumbnail || asset.fileUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-800 truncate" title={asset.title}>{asset.title}</p>
                  <p className="text-[8.5px] text-gray-400 font-semibold uppercase">{asset.fileSize}</p>
                </div>
              </div>
            ))}

            {mediaList.length === 0 && (
              <div className="col-span-2 py-10 text-center text-slate-400 italic text-[11px] border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                Media bucket is empty. Drag files above to upload them.
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: PLAYLIST SEQUENCE TIMELINE ================= */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Timeline Drop Zone Container */}
          <div 
            onDragOver={e => e.preventDefault()}
            onDrop={handleTimelineDrop}
            className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 min-h-[300px] shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Sequence Timeline</h3>
                <p className="text-[9.5px] text-gray-400 mt-0.5">Drag assets from left pool to populate sequence, or click "+". Set duration in seconds.</p>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-black uppercase">
                Length: {playlistItems.reduce((acc, curr) => acc + curr.duration, 0)}s
              </span>
            </div>

            {totalFilesToUpload > 0 && (
              <div className="bg-blue-50/50 border border-blue-150 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Uploading playlist assets...</span>
                  <span>{uploadingFilesCount} of {totalFilesToUpload} files ({Math.round(uploadProgress)}%)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {playlistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center">
                <ImageIcon size={32} className="text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-650">Timeline sequence is empty</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Drag and drop slides from Left Media Assets to start.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {playlistItems.map((item, index) => {
                  const media = getMediaItem(item.mediaId);
                  const secondMedia = item.secondMediaId ? getMediaItem(item.secondMediaId) : null;
                  if (!media) return null;

                  return (
                    <div 
                      key={item.id} 
                      draggable
                      onDragStart={(e) => handleSlideDragStart(e, index)}
                      onDragOver={(e) => handleSlideDragOver(e, index)}
                      onDragEnd={handleSlideDragEnd}
                      className={`bg-white rounded-xl border p-4 flex flex-col md:flex-row gap-5 items-start md:items-center transition-all duration-200 select-none ${
                        draggedIndex === index 
                          ? 'opacity-50 border-blue-400 bg-blue-50/20 shadow-inner scale-[0.99]' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Reorder Navigator */}
                      <div className="flex flex-row md:flex-col gap-1 items-center justify-center flex-shrink-0">
                        <div className="text-gray-400 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100">
                          <GripVertical size={16} />
                        </div>
                        <button 
                          onClick={() => moveItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-400 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <span className="text-xs font-bold text-gray-500 w-6 text-center">{index + 1}</span>
                        <button 
                          onClick={() => moveItem(index, 'down')}
                          disabled={index === playlistItems.length - 1}
                          className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-400 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>

                      {/* Primary Slide Details */}
                      <div className="flex gap-3 items-center min-w-0 flex-1">
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-slate-200 relative">
                          <img src={media.thumbnail} alt={media.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate" title={media.title}>{media.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase flex items-center gap-1">
                              {media.type === 'image' && '🖼 Image'}
                              {media.type !== 'image' && media.type}
                            </span>
                            <span className="text-[9.5px] text-gray-400 font-semibold">{media.fileSize}</span>
                          </div>
                          
                          {/* Duration input */}
                          <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 w-fit">
                            <Clock size={12} className="text-blue-500" />
                            <span className="text-[10px] text-gray-600 font-bold">Play time:</span>
                            <input 
                              type="number"
                              min={1}
                              value={item.duration}
                              onChange={e => updateItem(item.id, { duration: Math.max(1, parseInt(e.target.value) || 5) })}
                              className="w-10 border border-slate-200 rounded bg-white px-1 py-0.5 text-xs text-center font-bold outline-none focus:border-blue-550 text-gray-800"
                            />
                            <span className="text-[9.5px] text-slate-455 font-bold uppercase">sec</span>
                          </div>
                        </div>
                      </div>

                      {/* Layout & Split Controls */}
                      <div className="flex flex-wrap gap-4 items-center flex-1 min-w-[240px]">
                        <div className="flex-1 min-w-[120px] space-y-2 text-xs">
                          <div>
                            <label className="block text-[9.5px] font-bold text-gray-500 uppercase mb-1">Layout ratio</label>
                            <select 
                              value={item.layoutType}
                              onChange={e => updateItem(item.id, { layoutType: e.target.value as any })}
                              className="w-full text-xs border border-slate-200 bg-white rounded-xl px-2.5 py-2.5 outline-none focus:border-blue-400 cursor-pointer font-bold text-slate-700 shadow-xs"
                            >
                              <option value="single">Single Fullscreen</option>
                              <option value="50-50">50/50 Split Screen</option>
                              <option value="70-30">70/30 Split Screen</option>
                              <option value="30-70">30/70 Split Screen</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[9.5px] font-bold text-gray-500 uppercase mb-1">Scale mode & zoom</label>
                            <div className="flex gap-2 items-center">
                              <select 
                                value={item.objectFit || 'cover'}
                                onChange={e => updateItem(item.id, { objectFit: e.target.value as any })}
                                className="flex-1 text-xs border border-slate-200 bg-white rounded-xl px-2.5 py-2.5 outline-none focus:border-blue-400 cursor-pointer font-bold text-slate-700 shadow-xs"
                              >
                                <option value="cover">Fill Screen (Cover)</option>
                                <option value="contain">Fit to Screen (Contain)</option>
                                <option value="fill">Stretch to Fill (Fill)</option>
                                <option value="none">Original Size (None)</option>
                              </select>
                              {item.objectFit && item.objectFit !== 'cover' && (
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 w-20 flex-shrink-0">
                                  <input 
                                    type="number"
                                    min={10}
                                    max={300}
                                    value={item.scalePercent ?? 100}
                                    onChange={e => updateItem(item.id, { scalePercent: Math.max(10, parseInt(e.target.value) || 100) })}
                                    className="w-10 border border-slate-200 rounded bg-white px-1 text-center text-xs font-bold outline-none focus:border-blue-550 text-gray-800"
                                  />
                                  <span className="text-[10px] text-gray-600 font-bold">%</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {item.layoutType !== 'single' && (
                            <div className="space-y-1">
                              <label className="block text-[9.5px] font-bold text-gray-500 uppercase mb-1">Zone 2 Secondary File</label>
                              <div 
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleZone2Drop(e, item.id)}
                                className={`border rounded-xl p-2 transition-all ${
                                  secondMedia 
                                    ? 'bg-slate-550/10 border-slate-200' 
                                    : 'border-dashed border-blue-300 bg-blue-50/10'
                                }`}
                              >
                                {secondMedia ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden flex-shrink-0 bg-gray-50">
                                      <img src={secondMedia.thumbnail} className="w-full h-full object-cover" alt="secondary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-bold text-slate-800 truncate">{secondMedia.title}</p>
                                    </div>
                                    <button 
                                      onClick={() => updateItem(item.id, { secondMediaId: undefined })}
                                      className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {/* Direct click dropdown selector for Zone 2 */}
                                    <select
                                      value={item.secondMediaId ?? ''}
                                      onChange={e => updateItem(item.id, { secondMediaId: e.target.value || undefined })}
                                      className="w-full text-[10px] border border-slate-200 bg-white rounded px-2 py-1 outline-none focus:border-blue-400 font-bold text-slate-700 cursor-pointer"
                                    >
                                      <option value="">-- Drop or Select Zone 2 --</option>
                                      {mediaList.filter(m => m.id !== item.mediaId).map(m => (
                                        <option key={m.id} value={m.id}>{m.title}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Remove Slide Button */}
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors ml-auto cursor-pointer"
                          title="Remove item"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Playlist Settings Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Broadcasting Settings</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Playlist Name *</label>
                <input 
                  value={playlistName} 
                  onChange={e => setPlaylistName(e.target.value)} 
                  placeholder="e.g. Lobby Entrance Banner" 
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-850" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Content Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white font-bold text-slate-700"
                >
                  {['Advertising', 'Information', 'Entertainment', 'Brand', 'Menu', 'Emergency'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Description</label>
                <textarea 
                  value={playlistDesc} 
                  onChange={e => setPlaylistDesc(e.target.value)} 
                  rows={2} 
                  placeholder="Provide brief notes..." 
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none font-semibold text-slate-850" 
                />
              </div>

              {/* Display orientation */}
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Playlist Orientation</label>
                <div className="flex border border-slate-200 rounded-xl overflow-hidden font-bold h-[42px] bg-white shadow-xs">
                  <button 
                    type="button"
                    onClick={() => setPlaylistOrientation('horizontal')}
                    className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${playlistOrientation === 'horizontal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span>Landscape</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPlaylistOrientation('vertical')}
                    className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${playlistOrientation === 'vertical' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span>Portrait</span>
                  </button>
                </div>
              </div>

              {/* Transition Settings */}
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Slide Transition Effect</label>
                <select
                  value={playlistTransition}
                  onChange={e => setPlaylistTransition(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-550 bg-white font-bold text-slate-700 shadow-xs h-[42px] cursor-pointer"
                >
                  <option value="fade">Fade In</option>
                  <option value="slide">Slide Left</option>
                  <option value="zoom">Zoom In</option>
                  <option value="slide-up">Slide Up ⬆️</option>
                  <option value="slide-down">Slide Down ⬇️</option>
                  <option value="flip">3D Flip 🔄</option>
                  <option value="spin">Spin Rotate 🌀</option>
                  <option value="blur">Focus Blur 🌫️</option>
                  <option value="bounce">Bounce Elastic 🎈</option>
                  <option value="wipe">Linear Wipe ↔️</option>
                </select>
              </div>

              {/* Loop and Shuffle Switches */}
              <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 h-[42px] bg-white shadow-xs">
                <div className="flex items-center gap-2">
                  <Shuffle size={14} className="text-gray-450" />
                  <span className="font-bold text-gray-600">Shuffle Sequence</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPlaylistShuffle(prev => !prev)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${playlistShuffle ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${playlistShuffle ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 h-[42px] bg-white shadow-xs">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-gray-450" />
                  <span className="font-bold text-gray-600">Loop Playback</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPlaylistLoop(prev => !prev)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${playlistLoop ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${playlistLoop ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Playlist Default Volume */}
              <div className="flex flex-col justify-center border border-slate-200 rounded-xl px-4 py-2 bg-white shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-gray-450" />
                    <span className="font-bold text-gray-600">Default Playlist Volume</span>
                  </div>
                  <span className="font-bold text-blue-600">{playlistVolume}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={playlistVolume} 
                  onChange={e => setPlaylistVolume(parseInt(e.target.value))} 
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>


              {/* Widget overlays */}
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Global Widget Overlay</label>
                <select
                  value={playlistWidgetType ?? ''}
                  onChange={e => setPlaylistWidgetType((e.target.value || undefined) as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-550 bg-white font-bold text-slate-700 shadow-xs h-[42px] cursor-pointer"
                >
                  <option value="">No Widget Overlay</option>
                  <option value="weather">Weather Forecast</option>
                  <option value="clock">Live Digital Clock</option>
                  <option value="rss">News RSS Ticker</option>
                  <option value="qrcode">Scan QR Code</option>
                </select>
              </div>

              {playlistWidgetType && (
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Widget Placement</label>
                  <select
                    value={playlistWidgetPlacement}
                    onChange={e => setPlaylistWidgetPlacement(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-550 bg-white font-bold text-slate-700 shadow-xs h-[42px] cursor-pointer"
                  >
                    <option value="top-left">Top Left Corner</option>
                    <option value="top-right">Top Right Corner</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                    <option value="bottom-right">Bottom Right Corner</option>
                  </select>
                </div>
              )}

              {playlistWidgetType && playlistWidgetType === 'rss' && (
                <div className="sm:col-span-2 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                  <span className="block text-[10px] text-slate-455 uppercase tracking-widest font-black">Ticker Configuration</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Background Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={tickerBgColor}
                          onChange={e => setTickerBgColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300"
                        />
                        <input
                          type="text"
                          value={tickerBgColor}
                          onChange={e => setTickerBgColor(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none font-semibold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Text Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={tickerTextColor}
                          onChange={e => setTickerTextColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300"
                        />
                        <input
                          type="text"
                          value={tickerTextColor}
                          onChange={e => setTickerTextColor(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none font-semibold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ticker Paragraphs / List Items</label>
                    <div className="space-y-2">
                      {tickerParagraphs.map((para, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={para}
                            onChange={e => {
                              const newParas = [...tickerParagraphs];
                              newParas[idx] = e.target.value;
                              setTickerParagraphs(newParas);
                            }}
                            placeholder={`Item ${idx + 1}`}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-850 text-sm bg-white"
                          />
                          {tickerParagraphs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newParas = tickerParagraphs.filter((_, i) => i !== idx);
                                setTickerParagraphs(newParas);
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setTickerParagraphs([...tickerParagraphs, ''])}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-blue-200 rounded-xl transition-all cursor-pointer"
                    >
                      <Plus size={13} /> Add Item
                    </button>
                  </div>
                </div>
              )}

              {playlistWidgetType && playlistWidgetType !== 'rss' && (
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">
                    {playlistWidgetType === 'qrcode' ? 'QR Code Link / URL' :
                     playlistWidgetType === 'weather' ? 'Weather Location / City' : 'Clock Label / Header'}
                  </label>
                  <input
                    type={playlistWidgetType === 'qrcode' ? 'url' : 'text'}
                    value={playlistWidgetLink}
                    onChange={e => setPlaylistWidgetLink(e.target.value)}
                    placeholder={
                      playlistWidgetType === 'qrcode' ? 'https://example.com/menu.pdf' :
                      playlistWidgetType === 'weather' ? 'e.g. Bengaluru' : 'e.g. Lobby Clock'
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-550 bg-white font-semibold text-slate-850"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-between items-center pt-3 border-t border-slate-100">
              <button 
                type="button"
                onClick={openPreview}
                disabled={playlistItems.length === 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eye size={13} /> Preview Simulator
              </button>

              <button 
                onClick={handleSavePlaylist}
                disabled={!playlistName.trim() || playlistItems.length === 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={14} /> Save Playlist Profile
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ================= FULLSCREEN SIMULATION PREVIEW MODAL ================= */}
      {showPreviewModal && simulatedItems.length > 0 && (
        <div className="fixed inset-0 bg-slate-50/98 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans animate-fadeIn">
          
          <div className="w-full max-w-5xl flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                <Tv size={16} className="text-blue-600" />
                Live Standee Playback Simulator
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                Simulating screen output: Slide {previewIndex + 1} of {simulatedItems.length} · {getMediaItem(simulatedItems[previewIndex]?.mediaId)?.title}
              </p>
            </div>
            <button 
              onClick={() => { setShowPreviewModal(false); setIsPlaying(false); }}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <X size={14} /> Close Preview
            </button>
          </div>

          {/* Screen Outline Container (Sleek Modern Silver/Aluminum Commercial Display Enclosure) */}
          <div className={`w-full bg-[#f8fafc] rounded-[32px] p-2 border-[12px] border-slate-200 shadow-2xl relative overflow-hidden flex items-center justify-center transition-all duration-300 ${
            playlistOrientation === 'horizontal' ? 'aspect-video max-w-4xl' : 'aspect-[9/16] max-w-[340px] h-[75vh]'
          }`} style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), inset 0 0 10px rgba(0,0,0,0.05)' }}>
            
            {/* Screen Glass Reflection Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none z-20" />
            
            {/* The active slide rendering */}
            {simulatedItems[previewIndex] && (() => {
              const slide = simulatedItems[previewIndex];
              const pMedia = getMediaItem(slide.mediaId);
              const sMedia = slide.secondMediaId ? getMediaItem(slide.secondMediaId) : null;
              if (!pMedia) return null;

              // Transition animations
              const transitionClass = {
                fade: 'animate-fadeIn',
                slide: 'animate-slideIn',
                zoom: 'animate-zoomIn',
                'slide-up': 'animate-slideUp',
                'slide-down': 'animate-slideDown',
                flip: 'animate-flipIn',
                spin: 'animate-spinIn',
                blur: 'animate-blurIn',
                bounce: 'animate-bounceIn',
                wipe: 'animate-wipeIn'
              }[playlistTransition] || 'animate-fadeIn';

              return (
                <div key={previewIndex} className={`w-full h-full relative bg-slate-50 ${transitionClass}`}>
                  {slide.layoutType === 'single' ? (
                    <div className="w-full h-full">
                      {pMedia.type === 'video' ? (
                        <video src={pMedia.thumbnail} autoPlay loop muted className="w-full h-full object-cover" />
                      ) : (
                        <img src={pMedia.thumbnail} className="w-full h-full object-cover" alt="primary fullscreen" />
                      )}
                    </div>
                  ) : (
                    <div className={`w-full h-full flex ${playlistOrientation === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
                      <div 
                        style={{ 
                          width: playlistOrientation === 'horizontal' ? (slide.layoutType === '50-50' ? '50%' : slide.layoutType === '70-30' ? '70%' : '30%') : '100%',
                          height: playlistOrientation === 'vertical' ? (slide.layoutType === '50-50' ? '50%' : slide.layoutType === '70-30' ? '70%' : '30%') : '100%'
                        }} 
                        className={`overflow-hidden flex-shrink-0 border-slate-200 ${playlistOrientation === 'horizontal' ? 'border-r-2' : 'border-b-2'}`}
                      >
                        {pMedia.type === 'video' ? (
                          <video src={pMedia.thumbnail} autoPlay loop muted className="w-full h-full object-cover" />
                        ) : (
                          <img src={pMedia.thumbnail} className="w-full h-full object-cover" alt="primary layout split" />
                        )}
                      </div>
                      <div className="flex-1 bg-slate-100 overflow-hidden">
                        {sMedia ? (
                          sMedia.type === 'video' ? (
                            <video src={sMedia.thumbnail} autoPlay loop muted className="w-full h-full object-cover" />
                          ) : (
                            <img src={sMedia.thumbnail} className="w-full h-full object-cover" alt="secondary layout split" />
                          )
                        ) : (
                          <div className="w-full h-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">
                            Split Zone 2 Empty
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Render Widget Overlay (Clean, Elegant Modern Cards) */}
                  {playlistWidgetType && (() => {
                    const positionClasses = {
                      'top-left': 'top-5 left-5',
                      'top-right': 'top-5 right-5',
                      'bottom-left': 'bottom-5 left-5',
                      'bottom-right': 'bottom-5 right-5',
                    }[playlistWidgetPlacement];

                    return (
                      <div className={`absolute ${positionClasses} z-10 shadow-md bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl p-3 w-48 flex flex-col justify-between animate-fadeIn text-slate-800`}>
                        {playlistWidgetType === 'weather' && (() => {
                          const location = playlistWidgetLink || 'Bengaluru';
                          let temp = 24;
                          let condition = 'Sunny';
                          let WeatherIcon = Sun;
                          let iconColor = 'text-amber-500';
                          let animateClass = 'animate-pulse';
                          
                          const locLower = location.toLowerCase();
                          if (locLower.includes('london') || locLower.includes('rain') || locLower.includes('seattle')) {
                            temp = 14;
                            condition = 'Rainy';
                            WeatherIcon = CloudRain;
                            iconColor = 'text-blue-400';
                            animateClass = 'animate-bounce';
                          } else if (locLower.includes('delhi') || locLower.includes('hot') || locLower.includes('desert') || locLower.includes('chennai')) {
                            temp = 38;
                            condition = 'Hot & Sunny';
                            WeatherIcon = Sun;
                            iconColor = 'text-orange-500';
                            animateClass = 'animate-spin-slow';
                          } else if (locLower.includes('snow') || locLower.includes('cold') || locLower.includes('moscow') || locLower.includes('ice')) {
                            temp = -2;
                            condition = 'Snowing';
                            WeatherIcon = CloudSnow;
                            iconColor = 'text-sky-300';
                            animateClass = 'animate-bounce';
                          } else if (locLower.includes('cloud') || locLower.includes('paris') || locLower.includes('tokyo') || locLower.includes('mumbai')) {
                            temp = 19;
                            condition = 'Partly Cloudy';
                            WeatherIcon = CloudSun;
                            iconColor = 'text-slate-400';
                            animateClass = 'animate-pulse';
                          } else if (locLower.includes('wind') || locLower.includes('storm') || locLower.includes('chicago')) {
                            temp = 16;
                            condition = 'Windy';
                            WeatherIcon = Wind;
                            iconColor = 'text-teal-400';
                            animateClass = 'animate-pulse';
                          }

                          return (
                            <div className="flex flex-col gap-1 text-center font-normal">
                              <span className="text-[7px] font-bold uppercase text-slate-400 tracking-wider text-left">Weather</span>
                              <div className="flex items-center gap-2 mt-1 justify-center">
                                <WeatherIcon className={`${iconColor} w-5 h-5 ${animateClass}`} />
                                <span className="text-base font-extrabold text-slate-800">{temp}°C</span>
                              </div>
                              <div className="text-[9px] font-medium text-slate-600 mt-0.5 truncate max-w-full" title={`${location} · ${condition}`}>
                                {location} · {condition}
                              </div>
                            </div>
                          );
                        })()}

                        {playlistWidgetType === 'clock' && (
                          <div className="text-center font-normal">
                            <span className="text-[7px] font-bold uppercase text-slate-400 tracking-wider text-left block">
                              {playlistWidgetLink || 'Lobby Clock'}
                            </span>
                            <div className="text-base font-mono font-bold text-slate-800 mt-1">
                              {previewTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </div>
                          </div>
                        )}

                        {playlistWidgetType === 'rss' && (() => {
                          let tickerText = '+ + + SignageOS CNC Cabinets + + + Signage Live Broadcast + + +';
                          let bgColor = 'rgba(248, 250, 252, 0.8)';
                          let textColor = '#475569';
                          
                          if (tickerParagraphs.filter(p => p.trim() !== '').length > 0) {
                            tickerText = tickerParagraphs.filter(p => p.trim() !== '').join('  |  ') + '  |';
                            bgColor = tickerBgColor;
                            textColor = tickerTextColor;
                          } else {
                            try {
                              const config = JSON.parse(playlistWidgetLink);
                              if (config && typeof config === 'object') {
                                if (Array.isArray(config.items)) {
                                  tickerText = config.items.filter(item => item && item.trim() !== '').join('  |  ');
                                  if (tickerText) {
                                    tickerText += '  |';
                                  } else {
                                    tickerText = '+ + + SignageOS CNC Cabinets + + + Signage Live Broadcast + + +';
                                  }
                                }
                                if (config.bgColor) bgColor = config.bgColor;
                                if (config.textColor) textColor = config.textColor;
                              }
                            } catch (e) {
                              if (playlistWidgetLink) {
                                tickerText = playlistWidgetLink;
                              }
                            }
                          }

                          return (
                            <div className="text-center space-y-1 font-normal w-full">
                              <span className="text-[7px] font-bold uppercase text-slate-400 tracking-wider text-left block">Live Ticker</span>
                              <div 
                                style={{ backgroundColor: bgColor }}
                                className="border border-slate-200/50 rounded-lg p-1 text-[8.5px] font-semibold overflow-hidden h-5 flex items-center relative w-full"
                              >
                                <div 
                                  style={{ color: textColor }}
                                  className="absolute whitespace-nowrap animate-marquee"
                                >
                                  {tickerText}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {playlistWidgetType === 'qrcode' && (
                          <div className="flex flex-col items-center gap-1.5 text-center font-normal">
                            <span className="text-[7px] font-bold uppercase text-slate-400 tracking-wider text-left w-full">Scan Link</span>
                            <div className="bg-white p-1 rounded-xl border border-slate-100 flex items-center justify-center w-12 h-12 shadow-xs overflow-hidden">
                              {playlistWidgetLink ? (
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(playlistWidgetLink)}`}
                                  alt="QR Code"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <QrCode size={40} className="text-slate-800" />
                              )}
                            </div>
                            {playlistWidgetLink && (
                              <div className="text-[7px] text-slate-500 truncate w-full max-w-[150px] mt-0.5" title={playlistWidgetLink}>
                                {playlistWidgetLink}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Volume overlay indicator */}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-slate-200/80 text-slate-850 shadow-sm">
                    <Volume2 size={12} className="text-slate-500" />
                    <span>Vol: {playlistVolume}%</span>
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Timeline Playback Controls (Sleek Clean Pill Bar) */}
          <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl p-4 mt-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg text-slate-800">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setPreviewIndex(p => (p - 1 + simulatedItems.length) % simulatedItems.length); setIsPlaying(false); }}
                className="p-2 bg-slate-550/10 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition-colors cursor-pointer"
                title="Previous Slide"
              >
                <ChevronLeft size={16} />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2.5 bg-blue-600 hover:bg-blue-750 rounded-full text-white transition-colors cursor-pointer"
                title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button 
                onClick={() => { setPreviewIndex(p => (p + 1) % simulatedItems.length); setIsPlaying(false); }}
                className="p-2 bg-slate-550/10 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition-colors cursor-pointer"
                title="Next Slide"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="text-center md:text-left flex-1 px-4">
              <p className="text-xs font-bold text-slate-900 truncate max-w-[280px]">
                Active: {getMediaItem(simulatedItems[previewIndex]?.mediaId)?.title}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                Layout: <span className="capitalize">{simulatedItems[previewIndex]?.layoutType}</span> split · Duration: {simulatedItems[previewIndex]?.duration}s
              </p>
            </div>

            <div className="flex gap-1 flex-wrap justify-center">
              {simulatedItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { setPreviewIndex(idx); setIsPlaying(false); }}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    previewIndex === idx 
                      ? 'bg-blue-600 text-white shadow border border-blue-600' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
