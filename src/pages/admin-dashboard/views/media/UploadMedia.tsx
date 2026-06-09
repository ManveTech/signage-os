import React, { useState, useEffect } from 'react';
import { Upload, X, CheckCircle, Clock, ArrowUp, ArrowDown, GripVertical, Play, Pause, ChevronLeft, ChevronRight, QrCode, Sun, Eye, Image as ImageIcon, Sparkles } from 'lucide-react';
import { mockMedia } from '../../data/mockData';

type PlaylistItem = {
  id: string;
  name: string;
  size: string;
  thumbnail: string;
  duration: number;
  layoutType: 'single' | '50-50' | '70-30' | '30-70';
  secondFile?: string;
};

export default function UploadMedia() {
  const [dragging, setDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Media Assets Pool State
  const [mediaPool, setMediaPool] = useState(mockMedia);

  // Playlist Sequence State
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([
    { 
      id: 'slide_1', 
      name: 'Summer Sale Campaign', 
      size: '45 MB', 
      thumbnail: 'https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?w=150&h=100&fit=crop', 
      duration: 8, 
      layoutType: 'single', 
    },
    { 
      id: 'slide_2', 
      name: 'Brand Logo Loop', 
      size: '2.1 MB', 
      thumbnail: 'https://images.pexels.com/photos/6476808/pexels-photo-6476808.jpeg?w=150&h=100&fit=crop', 
      duration: 10, 
      layoutType: '50-50', 
      secondFile: 'Product Launch Video',
    },
  ]);

  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [category, setCategory] = useState('');
  
  // Playlist-wide Settings: Orientation & Widget Options
  const [playlistOrientation, setPlaylistOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [playlistWidgetType, setPlaylistWidgetType] = useState<'weather' | 'clock' | 'rss' | 'qrcode' | undefined>(undefined);
  const [playlistWidgetPlacement, setPlaylistWidgetPlacement] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');

  // Preview Modal States
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [previewTime, setPreviewTime] = useState(new Date());

  // Clock ticking for live previews
  useEffect(() => {
    const timer = setInterval(() => setPreviewTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic slideshow transition in preview modal
  useEffect(() => {
    if (!showPreviewModal || !isPlaying || playlistItems.length === 0) return;

    const currentSlide = playlistItems[previewIndex];
    const durationMs = (currentSlide?.duration || 10) * 1000;

    const timeout = setTimeout(() => {
      setPreviewIndex(prev => (prev + 1) % playlistItems.length);
    }, durationMs);

    return () => clearTimeout(timeout);
  }, [showPreviewModal, isPlaying, previewIndex, playlistItems]);

  // Reset index when modal opens
  const openPreview = () => {
    if (playlistItems.length > 0) {
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

  // HTML5 Drag and Drop Handlers for Slides
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
      const asset = mediaPool.find(m => m.id === assetId);
      if (asset) {
        const newSlide: PlaylistItem = {
          id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: asset.title,
          size: asset.fileSize,
          thumbnail: asset.thumbnail,
          duration: asset.duration || 10,
          layoutType: 'single',
        };
        setPlaylistItems(prev => [...prev, newSlide]);
      }
    }
  };

  const handleZone2Drop = (e: React.DragEvent, slideId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('type');
    const assetId = e.dataTransfer.getData('assetId');

    if (type === 'asset' && assetId) {
      const asset = mediaPool.find(m => m.id === assetId);
      if (asset) {
        updateItem(slideId, { secondFile: asset.title });
      }
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    const id = `user_asset_${Date.now()}`;
    const newAsset = {
      id,
      title: 'uploaded_kiosk_graphic_' + Math.floor(Math.random() * 100) + '.png',
      type: 'image' as const,
      duration: 10,
      resolution: '1920x1080',
      fileSize: '2.4 MB',
      uploadedBy: 'Client Admin',
      createdDate: new Date().toISOString().split('T')[0],
      expiryDate: '2027-12-31',
      tags: ['user', 'upload'],
      status: 'active' as const,
      thumbnail: 'https://images.pexels.com/photos/3182777/pexels-photo-3182777.jpeg?w=150&h=100&fit=crop'
    };
    setMediaPool(prev => [newAsset, ...prev]);
  };

  const handleBrowseUpload = () => {
    const id = `user_asset_${Date.now()}`;
    const simulated = {
      id,
      title: 'custom_signage_display_' + Math.floor(Math.random() * 100) + '.jpg',
      type: 'image' as const,
      duration: 12,
      resolution: '1920x1080',
      fileSize: '3.1 MB',
      uploadedBy: 'Client Admin',
      createdDate: new Date().toISOString().split('T')[0],
      expiryDate: '2027-12-31',
      tags: ['user', 'upload'],
      status: 'active' as const,
      thumbnail: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?w=150&h=100&fit=crop'
    };
    setMediaPool(prev => [simulated, ...prev]);
  };

  const getSecondaryThumbnail = (secondFile: string | undefined) => {
    if (!secondFile) return '';
    const match = mediaPool.find(m => m.title === secondFile || m.id === secondFile);
    return match ? match.thumbnail : 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?w=150&h=100&fit=crop';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Upload Media & Build Playlist</h1>
        <p className="text-sm text-gray-500 mt-0.5">Drag files to pool, drag assets to timeline to build slides, and configure widgets and orientation at the playlist level.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT PANE: ASSETS LIBRARY POOL ================= */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center justify-between">
              <span>Media Assets Pool</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">{mediaPool.length} Assets</span>
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Drag items to the timeline or onto layout split zones.</p>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleFileDrop}
            onClick={handleBrowseUpload}
            className={`border border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
              dragging ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-blue-300 hover:bg-gray-50/50'
            }`}
          >
            <Upload size={16} className="text-blue-500 mx-auto mb-1.5" />
            <p className="text-[11px] font-semibold text-gray-700">Drag files here or click to browse</p>
            <p className="text-[9px] text-gray-400 font-medium">Uploads to Left Pool</p>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-1">
            {mediaPool.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleAssetDragStart(e, asset.id)}
                className="bg-gray-50 border border-slate-200 rounded-lg p-2 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50/20 transition-all select-none group relative"
              >
                <div className="w-full aspect-video rounded overflow-hidden bg-gray-200 border border-slate-100 relative">
                  <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[7.5px] px-1 rounded font-bold uppercase">{asset.type}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-800 truncate">{asset.title}</p>
                  <p className="text-[8.5px] text-gray-400 font-semibold uppercase">{asset.fileSize}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= RIGHT PANE: PLAYLIST TIMELINE ================= */}
        <div className="lg:col-span-8 space-y-6">
          
          <div 
            onDragOver={e => e.preventDefault()}
            onDrop={handleTimelineDrop}
            className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 min-h-[300px] shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Playlist Timeline</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Reorder slides and configure split layout ratios.</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">
                Total duration: {playlistItems.reduce((a, b) => a + b.duration, 0)}s
              </span>
            </div>

            {playlistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-xl bg-gray-50 text-center">
                <ImageIcon size={32} className="text-gray-300 mb-2" />
                <p className="text-xs font-semibold text-gray-600">Timeline is empty</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Drag assets from the Left Pool and drop here to create slides.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {playlistItems.map((item, index) => (
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
                    {/* 1. Drag & Order Navigation */}
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
                      <span className="text-xs font-semibold text-gray-500 w-6 text-center">{index + 1}</span>
                      <button 
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === playlistItems.length - 1}
                        className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-400 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>

                    {/* 2. Slide Thumbnail & Details */}
                    <div className="flex gap-3 items-center min-w-0 flex-1">
                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-slate-200 relative">
                        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                        <span className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-bold px-1 rounded shadow">Zone 1</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400 font-semibold">{item.size}</p>
                        
                        {/* Duration Input */}
                        <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 w-fit">
                          <Clock size={12} className="text-blue-500" />
                          <span className="text-[11px] text-gray-600 font-medium">Play duration:</span>
                          <input 
                            type="number"
                            min={1}
                            max={3600}
                            value={item.duration}
                            onChange={e => updateItem(item.id, { duration: Math.max(1, parseInt(e.target.value) || 5) })}
                            className="w-12 border border-slate-200 rounded bg-white px-1.5 py-0.5 text-xs text-center font-bold outline-none focus:border-blue-400 text-gray-800"
                          />
                          <span className="text-[10px] text-gray-450 font-bold uppercase">sec</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Layout Configuration & Splits */}
                    <div className="flex flex-wrap gap-4 items-center flex-1 min-w-[280px]">
                      <div className="flex-1 min-w-[120px] space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Layout Configuration</label>
                          <select 
                            value={item.layoutType}
                            onChange={e => updateItem(item.id, { layoutType: e.target.value as any })}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 cursor-pointer font-semibold shadow-sm"
                          >
                            <option value="single">Single Fullscreen</option>
                            <option value="50-50">50/50 Split Screen</option>
                            <option value="70-30">70/30 Split Screen</option>
                            <option value="30-70">30/70 Split Screen</option>
                          </select>
                        </div>

                        {item.layoutType !== 'single' && (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Zone 2 Asset</label>
                            <div 
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => handleZone2Drop(e, item.id)}
                              className={`border rounded-lg p-2 transition-all ${
                                item.secondFile 
                                  ? 'bg-slate-50 border-slate-200' 
                                  : 'border-dashed border-blue-300 bg-blue-50/10'
                              }`}
                            >
                              {item.secondFile ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded border border-slate-250 overflow-hidden flex-shrink-0 bg-gray-50">
                                    <img src={getSecondaryThumbnail(item.secondFile)} className="w-full h-full object-cover" alt="secondary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-gray-800 truncate">{item.secondFile}</p>
                                  </div>
                                  <button 
                                    onClick={() => updateItem(item.id, { secondFile: undefined })}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="py-2 text-center">
                                  <p className="text-[10px] text-blue-500 font-semibold">Drag Zone 2 asset here</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Live Visual Layout Preview */}
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center p-1 bg-gray-50 rounded border border-slate-200 w-16 h-16 flex-shrink-0">
                          <div className={`border border-slate-600 bg-slate-950 rounded relative overflow-hidden transition-all duration-300 ${
                            playlistOrientation === 'horizontal' ? 'w-10 h-7' : 'w-7 h-10'
                          }`}>
                            {item.layoutType === 'single' ? (
                              <div className="w-full h-full bg-slate-900 overflow-hidden">
                                <img src={item.thumbnail} className="w-full h-full object-cover" alt="primary" />
                              </div>
                            ) : (
                              <div className={`w-full h-full flex ${playlistOrientation === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
                                <div 
                                  style={{ 
                                    width: playlistOrientation === 'horizontal' ? (item.layoutType === '50-50' ? '50%' : item.layoutType === '70-30' ? '70%' : '30%') : '100%',
                                    height: playlistOrientation === 'vertical' ? (item.layoutType === '50-50' ? '50%' : item.layoutType === '70-30' ? '70%' : '30%') : '100%'
                                  }} 
                                  className={`bg-slate-900 overflow-hidden flex-shrink-0 border-slate-800 ${playlistOrientation === 'horizontal' ? 'border-r' : 'border-b'}`}
                                >
                                  <img src={item.thumbnail} className="w-full h-full object-cover" alt="primary" />
                                </div>
                                <div className="flex-1 bg-slate-800 overflow-hidden">
                                  {item.secondFile ? (
                                    <img src={getSecondaryThumbnail(item.secondFile)} className="w-full h-full object-cover" alt="secondary" />
                                  ) : (
                                    <div className="w-full h-full bg-slate-905" />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Render small overlay indicators inside layout preview */}
                            {playlistWidgetType && (
                              <div className={`absolute w-2 h-2 rounded-full border border-white/60 bg-blue-600 shadow-sm ${
                                playlistWidgetPlacement === 'top-left' ? 'top-0.5 left-0.5' :
                                playlistWidgetPlacement === 'top-right' ? 'top-0.5 right-0.5' :
                                playlistWidgetPlacement === 'bottom-left' ? 'bottom-0.5 left-0.5' : 'bottom-0.5 right-0.5'
                              }`} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto cursor-pointer"
                        title="Remove item"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Playlist Metadata & Settings */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 select-text shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Playlist Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-750 mb-1.5">Playlist Name <span className="text-red-500">*</span></label>
                <input 
                  value={playlistName} 
                  onChange={e => setPlaylistName(e.target.value)} 
                  placeholder="e.g. Lobby Showcase Sequence" 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 font-normal" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-755 mb-1.5">Content Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white font-normal"
                >
                  <option value="">Select category</option>
                  {['Advertising', 'Information', 'Entertainment', 'Brand', 'Menu', 'Emergency'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-750 mb-1.5">Description</label>
                <textarea 
                  value={playlistDesc} 
                  onChange={e => setPlaylistDesc(e.target.value)} 
                  rows={2} 
                  placeholder="Provide a description for this playing sequence" 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 resize-none font-normal" 
                />
              </div>

              {/* Display Type/Orientation Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-750 mb-1.5 font-semibold">Playlist Orientation</label>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden text-sm font-semibold h-[42px] bg-white shadow-sm">
                  <button 
                    type="button"
                    onClick={() => setPlaylistOrientation('horizontal')}
                    className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${playlistOrientation === 'horizontal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span>Horizontal (Landscape)</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPlaylistOrientation('vertical')}
                    className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${playlistOrientation === 'vertical' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span>Vertical (Portrait)</span>
                  </button>
                </div>
              </div>

              {/* Global Widget Overlay type selection */}
              <div>
                <label className="block text-xs font-medium text-gray-750 mb-1.5 font-semibold">Global Widget Overlay</label>
                <select
                  value={playlistWidgetType ?? ''}
                  onChange={e => setPlaylistWidgetType((e.target.value || undefined) as any)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white font-medium shadow-sm h-[42px]"
                >
                  <option value="">No Widget Overlay</option>
                  <option value="weather">Weather Forecast</option>
                  <option value="clock">Live Digital Clock</option>
                  <option value="rss">News RSS Ticker</option>
                  <option value="qrcode">Scan QR Code</option>
                </select>
              </div>

              {/* Global Widget Placement (visible if widget overlay is active) */}
              {playlistWidgetType && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-750 mb-1.5 font-semibold">Widget Placement</label>
                  <select
                    value={playlistWidgetPlacement}
                    onChange={e => setPlaylistWidgetPlacement(e.target.value as any)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white font-medium shadow-sm h-[42px]"
                  >
                    <option value="top-left">Top Left Corner</option>
                    <option value="top-right">Top Right Corner</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                    <option value="bottom-right">Bottom Right Corner</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button 
                type="button"
                onClick={openPreview}
                disabled={playlistItems.length === 0}
                className="px-5 py-2.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Eye size={14} /> Preview Slideshow
              </button>

              <button 
                disabled={!playlistName.trim() || playlistItems.length === 0}
                className="px-6 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle size={15} /> Save & Publish Playlist
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ================= FULLSCREEN PLAYLIST SIMULATION MODAL ================= */}
      {showPreviewModal && playlistItems.length > 0 && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-6 text-white font-sans animate-fadeIn">
          
          {/* Header Close info */}
          <div className="w-full max-w-5xl flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight flex items-center gap-2 text-cyan-400">
                <Sparkles size={16} className="text-cyan-400 animate-pulse" />
                Live Digital Standee Playback Simulator
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-normal">Simulating screen output: Slide {previewIndex + 1} of {playlistItems.length} · {playlistItems[previewIndex]?.name}</p>
            </div>
            <button 
              onClick={() => { setShowPreviewModal(false); setIsPlaying(false); }}
              className="px-3.5 py-1.5 bg-red-600/90 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 shadow"
            >
              <X size={14} /> Close Preview
            </button>
          </div>

          {/* Screen Outline Container (Adapts dynamically to horizontal or vertical layout orientation) */}
          <div className={`w-full bg-black rounded-2xl border-4 border-slate-700 relative overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-300 ${
            playlistOrientation === 'horizontal' ? 'aspect-video max-w-5xl' : 'aspect-[9/16] max-w-[340px] h-[70vh]'
          }`}>
            
            {/* The active slide rendering */}
            {playlistItems[previewIndex] && (() => {
              const slide = playlistItems[previewIndex];
              return (
                <div className="w-full h-full relative bg-slate-900">
                  {slide.layoutType === 'single' ? (
                    <div className="w-full h-full">
                      <img src={slide.thumbnail} className="w-full h-full object-cover" alt="primary fullscreen" />
                    </div>
                  ) : (
                    <div className={`w-full h-full flex ${playlistOrientation === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
                      <div 
                        style={{ 
                          width: playlistOrientation === 'horizontal' ? (slide.layoutType === '50-50' ? '50%' : slide.layoutType === '70-30' ? '70%' : '30%') : '100%',
                          height: playlistOrientation === 'vertical' ? (slide.layoutType === '50-50' ? '50%' : slide.layoutType === '70-30' ? '70%' : '30%') : '100%'
                        }} 
                        className={`overflow-hidden flex-shrink-0 border-slate-700/50 ${playlistOrientation === 'horizontal' ? 'border-r-4' : 'border-b-4'}`}
                      >
                        <img src={slide.thumbnail} className="w-full h-full object-cover" alt="primary layout split" />
                      </div>
                      <div className="flex-1 bg-slate-800 overflow-hidden">
                        {slide.secondFile ? (
                          <img src={getSecondaryThumbnail(slide.secondFile)} className="w-full h-full object-cover" alt="secondary layout split" />
                        ) : (
                          <div className="w-full h-full bg-slate-950 flex items-center justify-center text-xs font-semibold text-slate-500">
                            No secondary asset bound
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Render Global Widget Overlay on top of the slide */}
                  {playlistWidgetType && (() => {
                    const positionClasses = {
                      'top-left': 'top-6 left-6',
                      'top-right': 'top-6 right-6',
                      'bottom-left': 'bottom-6 left-6',
                      'bottom-right': 'bottom-6 right-6',
                    }[playlistWidgetPlacement];

                    return (
                      <div className={`absolute ${positionClasses} z-10 shadow-2xl backdrop-blur-md bg-slate-950/80 border border-white/10 rounded-xl p-3.5 w-52 flex flex-col justify-between animate-fadeIn`}>
                        {playlistWidgetType === 'weather' && (
                          <div className="flex flex-col gap-1 text-center font-normal">
                            <span className="text-[7.5px] font-bold uppercase text-blue-400 tracking-widest text-left">Weather Live</span>
                            <div className="flex items-center gap-2 mt-1 justify-center">
                              <Sun className="text-yellow-400 w-6 h-6 animate-spin-slow" />
                              <span className="text-xl font-bold">24°C</span>
                            </div>
                            <div className="text-[9.5px] font-semibold text-white mt-0.5">Bengaluru · Sunny Sky</div>
                          </div>
                        )}

                        {playlistWidgetType === 'clock' && (
                          <div className="text-center font-normal">
                            <span className="text-[7.5px] font-bold uppercase text-blue-400 tracking-widest text-left block">Lobby Clock</span>
                            <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                              {previewTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </div>
                        )}

                        {playlistWidgetType === 'rss' && (
                          <div className="text-center space-y-1 font-normal">
                            <span className="text-[7.5px] font-bold uppercase text-blue-400 tracking-widest text-left block">Tech Feed RSS</span>
                            <div className="bg-slate-900 border border-slate-800 rounded p-1 text-[9px] font-semibold text-slate-200 overflow-hidden h-6 flex items-center relative">
                              <div className="absolute whitespace-nowrap animate-marquee">
                                +++ AI Summit reveals signage capabilities +++ SignageOS launches custom CNC enclosure lines +++
                              </div>
                            </div>
                          </div>
                        )}

                        {playlistWidgetType === 'qrcode' && (
                          <div className="flex flex-col items-center gap-1.5 text-center font-normal">
                            <span className="text-[7.5px] font-bold uppercase text-blue-400 tracking-widest text-left w-full">Scan Link</span>
                            <div className="bg-white p-1 rounded flex items-center justify-center w-14 h-14">
                              <QrCode size={48} className="text-slate-950" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

          </div>

          {/* Timeline playback slider & Controls Bar */}
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
            {/* Play controls */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setPreviewIndex(p => (p - 1 + playlistItems.length) % playlistItems.length)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                title="Previous Slide"
              >
                <ChevronLeft size={18} />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors"
                title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <button 
                onClick={() => setPreviewIndex(p => (p + 1) % playlistItems.length)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                title="Next Slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Current Slide Info */}
            <div className="text-center md:text-left">
              <p className="text-xs font-semibold text-slate-100 truncate max-w-[280px]">
                Active: {playlistItems[previewIndex]?.name}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                Layout: <span className="capitalize">{playlistItems[previewIndex]?.layoutType}</span> split · Duration: {playlistItems[previewIndex]?.duration}s
              </p>
            </div>

            {/* Slide Index badges */}
            <div className="flex gap-1.5 flex-wrap justify-center">
              {playlistItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { setPreviewIndex(idx); setIsPlaying(false); }}
                  className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center transition-all ${
                    previewIndex === idx 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
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
