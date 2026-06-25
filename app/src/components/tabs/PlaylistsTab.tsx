import React, { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Text, StyleSheet, Modal, Alert } from 'react-native';
import { ThemedText } from '../themed-text';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Add,
  DocumentText,
  Eye,
  Trash,
  VideoPlay,
  Gallery,
  TickSquare,
  Refresh,
  Edit2,
} from 'iconsax-react-native';

export type PlaylistsTabProps = {
  playlistsList: any[];
  setPlaylistsList: React.Dispatch<React.SetStateAction<any[]>>;
  mediaList: any[];
  setMediaList: React.Dispatch<React.SetStateAction<any[]>>;
  isAdmin?: boolean;
};

const MEDIA_PRESETS = [
  { id: 'pres1', name: 'Lobby Retail Loop (Commercial)', type: 'Video', size: '18.4MB', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800' },
  { id: 'pres2', name: 'Summer Campaign Poster', type: 'Image', size: '2.1MB', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800' },
  { id: 'pres3', name: 'Corporate Announcements Template', type: 'Layout', size: '1.2MB', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800' }
];

export function PlaylistsTab({
  playlistsList,
  setPlaylistsList,
  mediaList,
  setMediaList,
  isAdmin = false,
}: PlaylistsTabProps) {
  // Modal States
  const [activeModal, setActiveModal] = useState<null | 'create-playlist' | 'preview-playlist'>(null);
  const [showAddMediaPopup, setShowAddMediaPopup] = useState(false);
  const [showAllAssetsModal, setShowAllAssetsModal] = useState(false);
  const [isMediaLibraryVisible, setIsMediaLibraryVisible] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [mediaFilterType, setMediaFilterType] = useState<'All' | 'Image' | 'Video' | 'Layout'>('All');
  const [mediaSortBy, setMediaSortBy] = useState<'Name' | 'Size'>('Name');
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  // Editing State
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);

  // Form Fields - Create/Edit Playlist
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [createdSlides, setCreatedSlides] = useState<any[]>([]);
  const [playlistWidgetType, setPlaylistWidgetType] = useState('none');
  const [playlistWidgetLink, setPlaylistWidgetLink] = useState('');
  const [playlistWidgetPlacement, setPlaylistWidgetPlacement] = useState('Top-Right');
  const [playlistLayoutType, setPlaylistLayoutType] = useState('Single');

  const [playlistSecondMediaId, setPlaylistSecondMediaId] = useState('');
  const [playlistThirdMediaId, setPlaylistThirdMediaId] = useState('');
  const [playlistFourthMediaId, setPlaylistFourthMediaId] = useState('');
  const [playlistCustomSplitOrientation, setPlaylistCustomSplitOrientation] = useState<'horizontal' | 'vertical'>('vertical');
  const [playlistCustomSplitPercentage, setPlaylistCustomSplitPercentage] = useState(50);

  // Form Fields - Add Media
  const [mediaName, setMediaName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('pres1');
  const [mediaType, setMediaType] = useState<'Video' | 'Image' | 'Layout'>('Image');
  const [mediaSize, setMediaSize] = useState('2.4MB');

  // Preview State
  const [previewPlaylist, setPreviewPlaylist] = useState<any | null>(null);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  const getMediaUrl = (mediaId: string) => {
    const media = mediaList.find(m => m.id === mediaId);
    return media ? media.url : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
  };

  const getStorageUsedMB = () => {
    return mediaList.reduce((acc, m) => {
      const numeric = parseFloat(m.size);
      if (isNaN(numeric)) return acc;
      if (m.size.toUpperCase().includes('GB')) {
        return acc + numeric * 1024;
      }
      return acc + numeric;
    }, 0);
  };

  const getFilteredAndSortedMedia = () => {
    let list = [...mediaList];
    if (mediaSearchQuery.trim() !== '') {
      list = list.filter(m => {
        const name = m.name || m.title || '';
        return name.toLowerCase().includes(mediaSearchQuery.toLowerCase());
      });
    }
    if (mediaFilterType !== 'All') {
      list = list.filter(m => m.type === mediaFilterType);
    }
    if (mediaSortBy === 'Name') {
      list.sort((a, b) => {
        const nameA = a.name || a.title || '';
        const nameB = b.name || b.title || '';
        return nameA.localeCompare(nameB);
      });
    } else if (mediaSortBy === 'Size') {
      list.sort((a, b) => {
        const sizeA = parseFloat(a.size) || 0;
        const sizeB = parseFloat(b.size) || 0;
        return sizeB - sizeA;
      });
    }
    return list;
  };

  const handleAddSlideToCreatedPlaylist = (assetId: string) => {
    const newSlide = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mediaId: assetId,
      duration: 10,
      layoutType: 'Single' as const,
      secondMediaId: '',
    };
    setCreatedSlides(prev => [...prev, newSlide]);
  };

  const handleDirectUploadMedia = () => {
    const randomUrls = [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
      'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800',
      'https://images.unsplash.com/photo-1472851294608-062f824d296e?w=800',
      'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800'
    ];
    const url = randomUrls[Math.floor(Math.random() * randomUrls.length)];
    const newId = 'm' + (mediaList.length + 1);
    const newMedia = {
      id: newId,
      name: `Promo_Asset_${mediaList.length + 1}.jpg`,
      size: '1.8MB',
      type: 'Image',
      url: url
    };
    
    // Add to mediaList
    setMediaList(prev => [...prev, newMedia]);
    
    // Also directly add to sequence timeline!
    const newSlide = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mediaId: newId,
      duration: 10,
      layoutType: 'Single' as const,
      secondMediaId: '',
    };
    setCreatedSlides(prev => [...prev, newSlide]);
    Alert.alert('Asset Added', 'A new promotional image asset has been generated and added to your sequence timeline.');
  };

  const handleUpdateCreatedSlide = (id: string, updates: any) => {
    setCreatedSlides(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleMoveCreatedSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= createdSlides.length) return;
    const newList = [...createdSlides];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setCreatedSlides(newList);
  };

  const handleRemoveCreatedSlide = (id: string) => {
    setCreatedSlides(prev => prev.filter(s => s.id !== id));
  };

  const handleAddMedia = () => {
    const selectedPreset = MEDIA_PRESETS.find(p => p.id === selectedPresetId);
    const finalName = mediaName.trim() || (selectedPreset ? selectedPreset.name : 'new_asset.png');
    const finalType = selectedPreset ? selectedPreset.type : mediaType;
    const finalSize = selectedPreset ? selectedPreset.size : mediaSize;
    const finalUrl = selectedPreset ? selectedPreset.url : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';

    const newMedia = {
      id: 'm' + (mediaList.length + 1),
      name: finalName,
      size: finalSize,
      type: finalType,
      url: finalUrl
    };
    setMediaList(prev => [...prev, newMedia]);
    setActiveModal(null);
    setMediaName('');
  };

  const handleEditPlaylist = (p: any) => {
    setEditingPlaylistId(p.id);
    setPlaylistName(p.name);
    setPlaylistDescription(p.description || '');
    
    // Parse widget
    const widgetStr = p.widget || 'None';
    if (widgetStr === 'None') {
      setPlaylistWidgetType('none');
      setPlaylistWidgetPlacement('Top-Right');
    } else {
      const match = widgetStr.match(/^(\w+)\s*\(([^)]+)\)$/);
      if (match) {
        setPlaylistWidgetType(match[1].toLowerCase());
        setPlaylistWidgetPlacement(match[2]);
      } else {
        setPlaylistWidgetType(widgetStr.toLowerCase());
        setPlaylistWidgetPlacement('Top-Right');
      }
    }

    // Map slides
    const mappedSlides = p.slides.map((s: any) => ({
      id: s.id || `slide_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mediaId: s.mediaId,
      duration: s.duration || 10,
      layoutType: s.layoutType === '50-50' ? '50-50 Split' : s.layoutType === '70-30' ? '70-30 Split' : 'Single',
      secondMediaId: s.secondMediaId || '',
    }));
    setCreatedSlides(mappedSlides);
    setActiveModal('create-playlist');
  };

  const handleSavePlaylist = () => {
    if (!playlistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }
    if (createdSlides.length === 0) {
      Alert.alert('Error', 'Please add at least one media asset to the timeline sequence');
      return;
    }

    const playlistData = {
      name: playlistName,
      description: playlistDescription || 'Signage Playlist Loop',
      slides: createdSlides.map(s => ({
        id: s.id,
        mediaId: s.mediaId,
        duration: s.duration,
        layoutType: s.layoutType.toLowerCase() === 'single' ? 'single' : s.layoutType === '50-50 Split' ? '50-50' : '70-30',
        secondMediaId: s.secondMediaId
      })),
      widget: playlistWidgetType === 'none' ? 'None' : `${playlistWidgetType.charAt(0).toUpperCase() + playlistWidgetType.slice(1)} (${playlistWidgetPlacement})`,
      layout: createdSlides[0]?.layoutType || 'Single',
      secondaryMediaId: createdSlides[0]?.secondMediaId || '',
      thirdMediaId: '',
      fourthMediaId: '',
      customSplitOrientation: 'vertical' as const,
      customSplitPercentage: 50,
    };

    if (editingPlaylistId) {
      setPlaylistsList(prev => prev.map(p => p.id === editingPlaylistId ? { ...p, ...playlistData } : p));
      Alert.alert('Success', 'Playlist updated successfully');
    } else {
      const newPlaylist = {
        id: 'p' + (playlistsList.length + 1),
        type: 'my' as const,
        syncStatus: 'pending' as const,
        orientation: 'horizontal',
        ...playlistData
      };
      setPlaylistsList(prev => [...prev, newPlaylist]);
      Alert.alert('Success', 'Playlist created successfully');
    }

    setActiveModal(null);
    setPlaylistName('');
    setPlaylistDescription('');
    setCreatedSlides([]);
    setEditingPlaylistId(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Media Hub Big Banner card */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={{ height: 180, borderRadius: 24, overflow: 'hidden', position: 'relative', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4 }}
          onPress={() => setIsMediaLibraryVisible(true)}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800' }}
            style={{ width: '100%', height: '100%' }}
          />
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(24, 28, 35, 0.45)' }} />
          <View style={{ position: 'absolute', bottom: 20, left: 20 }}>
            <ThemedText style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>MEDIA HUB</ThemedText>
            <ThemedText style={{ color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 4 }}>Digital Display{'\n'}Manager</ThemedText>
          </View>
        </TouchableOpacity>

        {/* Two buttons */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <TouchableOpacity
            style={{ flex: 1, height: 56, borderRadius: 20, backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 }}
            onPress={() => {
              setPlaylistName('');
              setPlaylistDescription('');
              setSelectedMediaIds([]);
              setPlaylistWidgetType('none');
              setPlaylistLayoutType('Single');
              setActiveModal('create-playlist');
            }}
          >
            <DocumentText size={18} color="#ffffff" variant="Linear" />
            <ThemedText style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>Create Playlist</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1, height: 56, borderRadius: 20, backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e0e2ed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onPress={() => {
              setIsMediaLibraryVisible(true);
            }}
          >
            <Gallery size={18} color="#7c3aed" variant="Linear" />
            <ThemedText style={{ color: '#7c3aed', fontSize: 13, fontWeight: 'bold' }}>View Media</ThemedText>
          </TouchableOpacity>
        </View>

        {/* My Playlists section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#181c23' }}>My Playlists</ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#717786', fontWeight: 'bold' }}>{playlistsList.length} Total</ThemedText>
        </View>

        <View style={{ gap: 12, marginBottom: 24 }}>
          {playlistsList.map(p => (
            <View key={p.id} style={{ backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e2ed', padding: 14, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: p.id === 'p1' ? '#7c3aed' : p.id === 'p2' ? '#10B981' : '#EF4444' }}>
              <Image
                source={{ uri: p.slides.length > 0 ? getMediaUrl(p.slides[0]?.mediaId) : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100' }}
                style={{ width: 48, height: 48, borderRadius: 12 }}
              />
              <View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '900', color: '#181c23' }}>{p.name}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: '#717786', marginTop: 2 }}>{p.slides.length} Slides • {p.slides.length * 3}:00 Duration</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124, 58, 237, 0.08)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    setPreviewPlaylist(p);
                    setPreviewSlideIndex(0);
                    setActiveModal('preview-playlist');
                  }}
                >
                  <Eye size={16} color="#7c3aed" variant="Linear" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(14, 165, 233, 0.08)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => handleEditPlaylist(p)}
                >
                  <Edit2 size={16} color="#0EA5E9" variant="Linear" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    Alert.alert(
                      'Delete Playlist',
                      `Are you sure you want to delete the playlist "${p.name}"? It will be unassigned from all client screens.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => {
                          setPlaylistsList(prev => prev.filter(item => item.id !== p.id));
                        }}
                      ]
                    );
                  }}
                >
                  <Trash size={16} color="#EF4444" variant="Linear" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Media Asset Manager section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#181c23' }}>Media Asset Manager</ThemedText>
          <TouchableOpacity onPress={() => setIsMediaLibraryVisible(true)}>
            <ThemedText style={{ fontSize: 12, color: '#7c3aed', fontWeight: 'bold' }}>View All</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#e0e2ed', padding: 16, gap: 16 }}>
          {mediaList.slice(0, 3).map((m, index) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: m.type === 'Video' ? 'rgba(245, 158, 11, 0.08)' : m.type === 'Image' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(124, 58, 237, 0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  {m.type === 'Video' ? (
                    <VideoPlay size={20} color="#F59E0B" variant="Bulk" />
                  ) : m.type === 'Image' ? (
                    <Gallery size={20} color="#10B981" variant="Bulk" />
                  ) : (
                    <DocumentText size={20} color="#7c3aed" variant="Bulk" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#181c23' }} numberOfLines={1}>{m.name}</ThemedText>
                  <ThemedText style={{ fontSize: 11, color: '#717786', marginTop: 2 }}>{m.size} • {m.type}</ThemedText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ThemedText style={{ fontSize: 11, color: '#717786' }}>{index === 0 ? '10m ago' : index === 1 ? '1h ago' : '3h ago'}</ThemedText>
                <TouchableOpacity
                  style={{ padding: 4 }}
                  onPress={() => {
                    Alert.alert(
                      'Delete Media',
                      `Are you sure you want to delete "${m.name}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => {
                          setMediaList(prev => prev.filter(item => item.id !== m.id));
                        }}
                      ]
                    );
                  }}
                >
                  <View style={{ flexDirection: 'column', gap: 2.5 }}>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#717786' }} />
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#717786' }} />
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#717786' }} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ================= MODAL 4: CREATE PLAYLIST FORM ================= */}
      <Modal
        visible={activeModal === 'create-playlist'}
        animationType="slide"
        onRequestClose={() => { setActiveModal(null); setEditingPlaylistId(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#ffffff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
            <TouchableOpacity onPress={() => { setActiveModal(null); setEditingPlaylistId(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText style={{ fontSize: 18, color: '#7c3aed', fontWeight: 'bold' }}>←</ThemedText>
              <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{editingPlaylistId ? 'Edit Playlist' : 'New Playlist'}</ThemedText>
            </TouchableOpacity>
            <ThemedText style={{ fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 }}>SIGNAGE OS</ThemedText>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            {/* Playlist Name */}
            <View style={{ gap: 8 }}>
              <Text style={styles.formLabel}>Playlist Name *</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Reception Promo Loop"
                placeholderTextColor="#94a3b8"
                value={playlistName}
                onChangeText={setPlaylistName}
              />
            </View>

            {/* Description */}
            <View style={{ gap: 8 }}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Promotion loops for main lobby screens"
                placeholderTextColor="#94a3b8"
                value={playlistDescription}
                onChangeText={setPlaylistDescription}
              />
            </View>

            {/* Select Primary Assets */}
            <View style={{ gap: 8 }}>
              <Text style={styles.formLabel}>Tap Assets to Add to Sequence Timeline</Text>
              
              <View style={styles.assetsGrid}>
                {/* Row 1: Add Media, Asset 0, Asset 1 */}
                <View style={styles.assetsGridRow}>
                  <TouchableOpacity
                    onPress={handleDirectUploadMedia}
                    style={[styles.mediaBoxGrid, styles.uploadMediaCard]}
                  >
                    <Add size={20} color="#7c3aed" variant="Linear" />
                    <Text style={styles.uploadMediaText}>Add Media</Text>
                  </TouchableOpacity>

                  {mediaList[0] ? (
                    <TouchableOpacity
                      onPress={() => handleAddSlideToCreatedPlaylist(mediaList[0].id)}
                      style={styles.mediaBoxGrid}
                    >
                      <Image source={{ uri: mediaList[0].url }} style={{ width: '100%', height: '100%' }} />
                      <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(124, 58, 237,0.85)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold' }}>+ Add</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.mediaBoxGrid, { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }]} />
                  )}

                  {mediaList[1] ? (
                    <TouchableOpacity
                      onPress={() => handleAddSlideToCreatedPlaylist(mediaList[1].id)}
                      style={styles.mediaBoxGrid}
                    >
                      <Image source={{ uri: mediaList[1].url }} style={{ width: '100%', height: '100%' }} />
                      <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(124, 58, 237,0.85)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold' }}>+ Add</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.mediaBoxGrid, { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }]} />
                  )}
                </View>

                {/* Row 2: Asset 2, Asset 3, View All */}
                <View style={styles.assetsGridRow}>
                  {mediaList[2] ? (
                    <TouchableOpacity
                      onPress={() => handleAddSlideToCreatedPlaylist(mediaList[2].id)}
                      style={styles.mediaBoxGrid}
                    >
                      <Image source={{ uri: mediaList[2].url }} style={{ width: '100%', height: '100%' }} />
                      <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(124, 58, 237,0.85)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold' }}>+ Add</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.mediaBoxGrid, { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }]} />
                  )}

                  {mediaList[3] ? (
                    <TouchableOpacity
                      onPress={() => handleAddSlideToCreatedPlaylist(mediaList[3].id)}
                      style={styles.mediaBoxGrid}
                    >
                      <Image source={{ uri: mediaList[3].url }} style={{ width: '100%', height: '100%' }} />
                      <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(124, 58, 237,0.85)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold' }}>+ Add</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.mediaBoxGrid, { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }]} />
                  )}

                  <TouchableOpacity
                    onPress={() => setShowAllAssetsModal(true)}
                    style={[styles.mediaBoxGrid, styles.viewAllCard]}
                  >
                    <Eye size={20} color="#7c3aed" variant="Linear" />
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Sequence Timeline */}
            <View style={{ gap: 8 }}>
              <Text style={styles.formLabel}>Sequence Timeline ({createdSlides.length} slides)</Text>
              {createdSlides.length === 0 ? (
                <View style={{ padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700', fontStyle: 'italic' }}>Timeline is empty. Tap assets above to add slides.</Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {createdSlides.map((slide, idx) => {
                    const mediaItem = mediaList.find(m => m.id === slide.mediaId);
                    return (
                      <View key={slide.id} style={styles.timelineItemCard}>
                        {/* Header/Reorder row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f172a' }}>Slide #{idx + 1}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <TouchableOpacity
                              disabled={idx === 0}
                              onPress={() => handleMoveCreatedSlide(idx, 'up')}
                              style={[styles.smallActionBtn, idx === 0 && { opacity: 0.3 }]}
                            >
                              <Text style={styles.smallActionBtnText}>▲</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              disabled={idx === createdSlides.length - 1}
                              onPress={() => handleMoveCreatedSlide(idx, 'down')}
                              style={[styles.smallActionBtn, idx === createdSlides.length - 1 && { opacity: 0.3 }]}
                            >
                              <Text style={styles.smallActionBtnText}>▼</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveCreatedSlide(slide.id)}
                              style={[styles.smallActionBtn, { backgroundColor: '#fee2e2' }]}
                            >
                              <Text style={[styles.smallActionBtnText, { color: '#ef4444' }]}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Slide Details */}
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                          <View style={{ width: 64, height: 48, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Image source={{ uri: mediaItem?.url }} style={{ width: '100%', height: '100%' }} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#1e293b' }} numberOfLines={1}>
                              {mediaItem?.name || 'Asset'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>Play time:</Text>
                              <TextInput
                                keyboardType="numeric"
                                value={String(slide.duration)}
                                onChangeText={(val) => handleUpdateCreatedSlide(slide.id, { duration: Math.max(1, parseInt(val) || 5) })}
                                style={{ width: 44, height: 26, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, backgroundColor: '#ffffff', textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#7c3aed', padding: 0 }}
                              />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>sec</Text>
                            </View>
                          </View>
                        </View>

                        {/* Layout details */}
                        <View style={{ gap: 6, marginTop: 10 }}>
                          <Text style={styles.formLabel}>Layout style</Text>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {['Single', '50-50 Split', '70-30 Split'].map(lStyle => (
                              <TouchableOpacity
                                key={lStyle}
                                onPress={() => handleUpdateCreatedSlide(slide.id, { layoutType: lStyle })}
                                style={[styles.microSelectBtn, slide.layoutType === lStyle && styles.microSelectBtnActive]}
                              >
                                <Text style={[styles.microSelectBtnText, slide.layoutType === lStyle && styles.microSelectBtnTextActive]}>{lStyle}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Second asset selector for split layout */}
                        {slide.layoutType !== 'Single' && (
                          <View style={{ gap: 6, marginTop: 10 }}>
                            <Text style={styles.formLabel}>Zone 2 secondary asset</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                              {mediaList.map(m => {
                                const isSelected = slide.secondMediaId === m.id;
                                return (
                                  <TouchableOpacity
                                    key={m.id}
                                    onPress={() => handleUpdateCreatedSlide(slide.id, { secondMediaId: m.id })}
                                    style={[styles.smallMediaBox, isSelected && styles.smallMediaBoxActive]}
                                  >
                                    <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} />
                                    {isSelected && (
                                      <View style={[styles.selectedIndicator, { width: 14, height: 14, borderRadius: 7, top: 4, right: 4 }]}>
                                        <Text style={[styles.selectedIndicatorText, { fontSize: 8 }]}>✓</Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Widget Overlays */}
            <View style={{ gap: 8 }}>
              <Text style={styles.formLabel}>Add Widget Overlay</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['none', 'weather', 'clock', 'rss', 'qrcode'].map(wType => (
                  <TouchableOpacity
                    key={wType}
                    onPress={() => setPlaylistWidgetType(wType)}
                    style={[styles.formSelectBtn, playlistWidgetType === wType && styles.formSelectBtnActive]}
                  >
                    <Text style={[styles.formSelectBtnText, playlistWidgetType === wType && styles.formSelectBtnTextActive, { textTransform: 'capitalize' }]}>{wType}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Widget Placement & Link inputs */}
            {playlistWidgetType !== 'none' && (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={styles.formLabel}>Widget Link / Url / Text</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter URL or Clock format"
                    placeholderTextColor="#94a3b8"
                    value={playlistWidgetLink}
                    onChangeText={setPlaylistWidgetLink}
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={styles.formLabel}>Widget Placement</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {['Top-Right', 'Top-Left', 'Bottom-Right', 'Bottom-Left'].map(place => (
                      <TouchableOpacity
                        key={place}
                        onPress={() => setPlaylistWidgetPlacement(place)}
                        style={[styles.formSelectBtn, { flex: 0, minWidth: '47%' }, playlistWidgetPlacement === place && styles.formSelectBtnActive]}
                      >
                        <Text style={[styles.formSelectBtnText, playlistWidgetPlacement === place && styles.formSelectBtnTextActive]}>{place}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSavePlaylist}
            >
              <TickSquare size={20} color="#ffffff" variant="Linear" />
              <Text style={styles.submitBtnText}>{editingPlaylistId ? 'Update Playlist' : 'Create Playlist'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL 6: LIVE SIMULATOR PREVIEW ================= */}
      {previewPlaylist && activeModal === 'preview-playlist' && (
        <View style={[styles.modalOverlay, { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 110 }]}>
          <View style={{ width: '90%', maxWidth: 320, backgroundColor: '#05070F', borderRadius: 24, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <ThemedText style={{ color: '#ffffff', fontWeight: 'bold' }}>Simulator: {previewPlaylist.name}</ThemedText>
              <TouchableOpacity onPress={() => { setActiveModal(null); setPreviewPlaylist(null); }}>
                <ThemedText style={{ color: '#ffffff', fontSize: 18 }}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', height: 180, backgroundColor: '#181c23', borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={{ uri: getMediaUrl(previewPlaylist.slides[previewSlideIndex]?.mediaId) }}
                style={{ width: '100%', height: '100%' }}
              />
            </View>

            {previewPlaylist.slides.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setPreviewSlideIndex(idx => (idx === 0 ? previewPlaylist.slides.length - 1 : idx - 1))}
                  style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                >
                  <ThemedText style={{ color: '#ffffff', fontSize: 12 }}>Prev</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPreviewSlideIndex(idx => (idx === previewPlaylist.slides.length - 1 ? 0 : idx + 1))}
                  style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                >
                  <ThemedText style={{ color: '#ffffff', fontSize: 12 }}>Next</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}



      {/* Modal to show all assets for adding to playlist */}
      <Modal
        visible={showAllAssetsModal}
        animationType="fade"
        onRequestClose={() => setShowAllAssetsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#ffffff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>All Media Assets</Text>
            <TouchableOpacity onPress={() => setShowAllAssetsModal(false)}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#7c3aed' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              {mediaList.map(m => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    handleAddSlideToCreatedPlaylist(m.id);
                    Alert.alert('Added', `"${m.name}" added to sequence timeline.`);
                  }}
                  style={{ width: '47%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', marginBottom: 6 }}
                >
                  <Image source={{ uri: m.url }} style={{ width: '100%', height: '70%' }} />
                  <View style={{ height: '30%', paddingHorizontal: 8, justifyContent: 'center', backgroundColor: '#ffffff' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }} numberOfLines={1}>{m.name}</Text>
                  </View>
                  <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#7c3aed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: 'bold' }}>+ Add</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ================= VIEW MEDIA LIBRARY MODAL ================= */}
      <Modal
        visible={isMediaLibraryVisible}
        animationType="slide"
        onRequestClose={() => setIsMediaLibraryVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#ffffff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '900', color: '#181c23' }}>Media Library</ThemedText>
            <TouchableOpacity onPress={() => setIsMediaLibraryVisible(false)}>
              <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#7c3aed' }}>CLOSE</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Storage Card with Add Media button next to it */}
            <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b' }}>STORAGE USED</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                    {getStorageUsedMB().toFixed(1)} MB / 5.0 GB ({((getStorageUsedMB() / 5120) * 100).toFixed(1)}%)
                  </Text>
                </View>
                {/* Progress bar */}
                <View style={{ height: 8, borderRadius: 4, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.min(100, (getStorageUsedMB() / 5120) * 100)}%`, backgroundColor: '#7c3aed', borderRadius: 4 }} />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowAddMediaPopup(true);
                }}
                style={{ height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Add size={16} color="#ffffff" variant="Linear" />
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>Add Media</Text>
              </TouchableOpacity>
            </View>

            {/* Filter and Sort controls */}
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 }}>
              {/* Search */}
              <TextInput
                style={{ height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, backgroundColor: '#f8fafc', fontSize: 13, color: '#0f172a' }}
                placeholder="Search media by name..."
                placeholderTextColor="#94a3b8"
                value={mediaSearchQuery}
                onChangeText={setMediaSearchQuery}
              />
              
              {/* Filter Row */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Filter by Type</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['All', 'Image', 'Video', 'Layout'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setMediaFilterType(type)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: mediaFilterType === type ? '#7c3aed' : '#f1f5f9',
                      }}
                    >
                      <Text style={{ color: mediaFilterType === type ? '#ffffff' : '#475569', fontSize: 11, fontWeight: 'bold' }}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Row */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Sort By</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['Name', 'Size'] as const).map(sort => (
                    <TouchableOpacity
                      key={sort}
                      onPress={() => setMediaSortBy(sort)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: mediaSortBy === sort ? '#7c3aed' : '#f1f5f9',
                      }}
                    >
                      <Text style={{ color: mediaSortBy === sort ? '#ffffff' : '#475569', fontSize: 11, fontWeight: 'bold' }}>
                        {sort}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Media list */}
            <View style={{ backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 12 }}>
              {getFilteredAndSortedMedia().length === 0 ? (
                <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', paddingVertical: 20 }}>No media items found</Text>
              ) : (
                getFilteredAndSortedMedia().map(m => (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                      <Image source={{ uri: m.url }} style={{ width: 50, height: 38, borderRadius: 6 }} />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#181c23' }} numberOfLines={1}>{m.name}</ThemedText>
                        <ThemedText style={{ fontSize: 11, color: '#717786', marginTop: 2 }}>{m.size} • {m.type}</ThemedText>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {/* View Button */}
                      <TouchableOpacity
                        style={{ padding: 8, backgroundColor: 'rgba(124, 58, 237, 0.08)', borderRadius: 10 }}
                        onPress={() => setPreviewMediaUrl(m.url)}
                      >
                        <Eye size={16} color="#7c3aed" />
                      </TouchableOpacity>
                      {/* Delete Button */}
                      <TouchableOpacity
                        style={{ padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 10 }}
                        onPress={() => {
                          Alert.alert(
                            'Delete Media',
                            `Are you sure you want to delete "${m.name}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => setMediaList(prev => prev.filter(item => item.id !== m.id)) }
                            ]
                          );
                        }}
                      >
                        <Trash size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Inline Add Media Preset Popup Overlay */}
          {showAddMediaPopup && (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20, zIndex: 200 }}>
              <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 20, gap: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#181c23' }}>Add Media Preset</Text>
                  <TouchableOpacity onPress={() => setShowAddMediaPopup(false)}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#64748b', padding: 4 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#717786', textTransform: 'uppercase' }}>Select Preset to Import</Text>
                
                <View style={{ gap: 8 }}>
                  {MEDIA_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => {
                        const newMedia = {
                          id: 'm' + (mediaList.length + 1),
                          name: p.name,
                          size: p.size,
                          type: p.type,
                          url: p.url
                        };
                        setMediaList(prev => [...prev, newMedia]);
                        setShowAddMediaPopup(false);
                        Alert.alert('Success', `"${p.name}" has been added to your Media Library.`);
                      }}
                      style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e0e2ed', backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <Image source={{ uri: p.url }} style={{ width: 44, height: 34, borderRadius: 6 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#181c23' }}>{p.name}</Text>
                        <Text style={{ fontSize: 9, color: '#717786', marginTop: 1 }}>{p.size} • {p.type}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Fullscreen Media Preview Modal */}
          {previewMediaUrl && (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 250 }}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 12 }}
                onPress={() => setPreviewMediaUrl(null)}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>✕ Close</Text>
              </TouchableOpacity>
              <Image source={{ uri: previewMediaUrl }} style={{ width: '90%', height: '70%', borderRadius: 16 }} contentFit="contain" />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputField: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    fontSize: 14,
    color: '#0f172a',
  },
  formSelectBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSelectBtnActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  formSelectBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  formSelectBtnTextActive: {
    color: '#ffffff',
  },
  mediaBox: {
    width: 110,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  mediaBoxActive: {
    borderColor: '#7c3aed',
  },
  assetsGrid: {
    gap: 10,
    width: '100%',
  },
  assetsGridRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    width: '100%',
  },
  mediaBoxGrid: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#7c3aed',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7c3aed',
  },
  uploadMediaCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#7c3aed',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadMediaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7c3aed',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  selectedIndicatorText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  timelineItemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  smallActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  microSelectBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  microSelectBtnActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  microSelectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  microSelectBtnTextActive: {
    color: '#ffffff',
  },
  smallMediaBox: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  smallMediaBoxActive: {
    borderColor: '#7c3aed',
  },
});
