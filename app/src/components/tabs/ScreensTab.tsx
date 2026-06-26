import React, { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Text, StyleSheet, Modal, Alert, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../config';
import { ThemedText } from '../themed-text';
import { Image } from 'expo-image';
import {
  Add,
  Monitor,
  Category,
  TickCircle,
  Wifi,
  Trash,
  Calendar,
  Edit2,
  Refresh,
  VideoPlay,
  Eraser,
  StopCircle,
  FolderMinus,
  FolderAdd,
} from 'iconsax-react-native';

export type ScreensTabProps = {
  opMode: boolean;
  screensList: any[];
  setScreensList: React.Dispatch<React.SetStateAction<any[]>>;
  groupsList: any[];
  setGroupsList: React.Dispatch<React.SetStateAction<any[]>>;
  playlistsList: any[];
  isAdmin?: boolean;
  profileEmail: string;
  onRefresh?: () => Promise<void>;
};

// Format seconds into human-readable uptime string
function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Calculate live uptime = cumulative + current session (if online)
function getLiveUptime(screen: any): number {
  let total = screen.cumulativeUptime || 0;
  const isOnline = screen.status === 'online' || screen.status === 'active';
  if (isOnline && screen.onlineSince) {
    const sessionMs = Date.now() - new Date(screen.onlineSince).getTime();
    if (sessionMs > 0) total += Math.floor(sessionMs / 1000);
  }
  return total;
}

export function ScreensTab({
  opMode,
  screensList,
  setScreensList,
  groupsList,
  setGroupsList,
  playlistsList,
  isAdmin = true,
  profileEmail,
  onRefresh,
}: ScreensTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Local Screen Tab States
  const [screensSubTab, setScreensSubTab] = useState<'screens' | 'groups'>('screens');
  const [screenSearch, setScreenSearch] = useState('');
  const [screenFilter, setScreenFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [ungroupedExpanded, setUngroupedExpanded] = useState(false);

  // Modal States
  const [activeModal, setActiveModal] = useState<null | 'add-screen' | 'create-group' | 'pairing-code' | 'pairing-success' | 'edit-group' | 'reconnect-screen' | 'add-screens-to-group'>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [selectedScreen, setSelectedScreen] = useState<any | null>(null);
  const [reconnectScreen, setReconnectScreen] = useState<any | null>(null);
  const [reconnectPairingCode, setReconnectPairingCode] = useState('');
  const [addScreensToGroupId, setAddScreensToGroupId] = useState<string | null>(null);
  const [detailSelectedPlaylist, setDetailSelectedPlaylist] = useState('');
  const [detailScheduleEnabled, setDetailScheduleEnabled] = useState(false);
  const [detailSchedulePlaylist, setDetailSchedulePlaylist] = useState('');
  const [detailScheduleDate, setDetailScheduleDate] = useState('');
  const [detailScheduleTime, setDetailScheduleTime] = useState('');
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [playlistPage, setPlaylistPage] = useState(0);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupPlaylistSearch, setGroupPlaylistSearch] = useState('');
  const [groupPlaylistPage, setGroupPlaylistPage] = useState(0);
  const [groupActionTab, setGroupActionTab] = useState<null | 'assign' | 'schedule'>(null);
  const [groupSchedulePlaylist, setGroupSchedulePlaylist] = useState('');
  const [groupScheduleDate, setGroupScheduleDate] = useState('');
  const [groupScheduleTime, setGroupScheduleTime] = useState('');

  // Form Fields - Register/Edit Screen
  const [screenName, setScreenName] = useState('');
  const [screenOrientation, setScreenOrientation] = useState('landscape');
  const [screenSize, setScreenSize] = useState('');
  const [screenResolution, setScreenResolution] = useState('1920x1080');
  const [screenOs, setScreenOs] = useState('android');
  const [screenTimezone, setScreenTimezone] = useState('Asia/Kolkata');
  const [screenCountry, setScreenCountry] = useState('India');
  const [screenState, setScreenState] = useState('');
  const [screenCity, setScreenCity] = useState('');
  const [screenZip, setScreenZip] = useState('');
  const [screenAddress, setScreenAddress] = useState('');
  const [screenGroup, setScreenGroup] = useState('');
  const [screenPlaylist, setScreenPlaylist] = useState('');
  const [screenPairingCode, setScreenPairingCode] = useState('');

  // Editing Keys
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Form Fields - Create/Edit Group
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescriptionInput, setGroupDescriptionInput] = useState('');
  const [groupAccentColor, setGroupAccentColor] = useState('#7c3aed');
  const [groupPlaylistInput, setGroupPlaylistInput] = useState('');

  const toggleGroupExpand = (g: any) => {
    const nextVal = expandedGroupId === g.id ? null : g.id;
    setExpandedGroupId(nextVal);
    setGroupActionTab(null);
    setGroupPlaylistSearch('');
    setGroupPlaylistPage(0);
    setGroupSchedulePlaylist(g.schedulePlaylist || (playlistsList[0]?.name || ''));
    setGroupScheduleDate(g.scheduleDate || new Date().toISOString().split('T')[0]);
    setGroupScheduleTime(g.scheduleTime || '12:00');
  };

  // Handlers
  const handleEditScreen = (s: any) => {
    setEditingScreenId(s.id);
    setScreenName(s.name);
    setScreenOrientation(s.orientation || 'landscape');
    setScreenSize(s.screenSize || '');
    setScreenResolution(s.resolution || '1920x1080');
    setScreenOs(s.os || 'android');
    setScreenTimezone(s.timezone || 'Asia/Kolkata');
    
    // Parse location
    const parts = (s.location || '').split(',').map((x: string) => x.trim());
    setScreenCity(parts[0] || '');
    setScreenState(parts[1] || '');
    setScreenCountry(parts[2] || 'India');
    setScreenAddress(s.address || '');
    setScreenZip(s.zip || '');
    setScreenGroup(s.groupId || '');
    setScreenPlaylist(s.playlist || 'Normal');
    
    setActiveStep(1);
    setSelectedScreen(null); // Close the detail modal
    setActiveModal('add-screen');
  };

  const handleEditScreenSave = () => {
    const screenData = {
      name: screenName,
      location: [screenCity, screenState, screenCountry].filter(Boolean).join(', ') || 'Unknown Location',
      orientation: screenOrientation,
      screenSize: screenSize,
      resolution: screenResolution,
      os: screenOs,
      timezone: screenTimezone,
      address: screenAddress,
      zip: screenZip,
      groupId: screenGroup || undefined,
      playlist: screenGroup ? (groupsList.find(g => g.id === screenGroup)?.playlist || 'Normal') : (screenPlaylist || 'Normal'),
    };
    
    setScreensList(prev => prev.map(s => s.id === editingScreenId ? { ...s, ...screenData } : s));
    Alert.alert('Success', 'Screen updated successfully');
    
    setActiveModal(null);
    setEditingScreenId(null);
  };

  const handleCreateScreenSubmit = () => {
    if (!screenName.trim()) {
      Alert.alert('Error', 'Please enter a screen name');
      return;
    }
    if (editingScreenId) {
      handleEditScreenSave();
    } else {
      setActiveModal('pairing-code');
    }
  };

  const handleEditGroup = (g: any) => {
    setEditingGroupId(g.id);
    setGroupNameInput(g.name);
    setGroupDescriptionInput(g.description || '');
    setGroupAccentColor(g.accentColor || '#7c3aed');
    setGroupPlaylistInput(g.playlist || 'Normal');
    setActiveModal('create-group');
  };

  const handleCreateGroupSubmit = () => {
    if (!groupNameInput.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    const groupData = {
      name: groupNameInput,
      description: groupDescriptionInput || 'Custom Screen Group',
      accentColor: groupAccentColor,
      playlist: groupPlaylistInput || 'Normal',
    };

    if (editingGroupId) {
      setGroupsList(prev => prev.map(g => g.id === editingGroupId ? { ...g, ...groupData } : g));
      Alert.alert('Success', 'Group updated successfully');
    } else {
      const newGroup = {
        id: Date.now().toString(),
        screensCount: 0,
        tags: ['0 Screens'],
        progress: null,
        ...groupData
      };
      setGroupsList(prev => [...prev, newGroup]);
      Alert.alert('Success', 'Group created successfully');
    }
    setActiveModal(null);
    setEditingGroupId(null);
  };

  const [isPairing, setIsPairing] = useState(false);

  const handlePairDevice = async () => {
    const code = screenPairingCode.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Error', 'Please enter a valid pairing code');
      return;
    }
    if (!screenName.trim()) {
      Alert.alert('Error', 'Please enter a screen name first');
      return;
    }
    setIsPairing(true);
    try {
      const token = await AsyncStorage.getItem('signageos_token');
      const location = [screenCity, screenState, screenCountry].filter(Boolean).join(', ') || 'Unknown Location';
      const res = await fetch(`${API_BASE}/screens/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          pairingCode: code,
          name: screenName,
          location,
          groupId: screenGroup || undefined,
          playlist: screenPlaylist || undefined,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Add the newly paired screen to local state so it appears immediately
        const newScreen = {
          id: data.id || Date.now().toString(),
          name: data.name || screenName,
          location,
          assignedToUserEmail: data.assignedToUserEmail || profileEmail,
          status: data.status || 'online',
          orientation: screenOrientation || 'landscape',
          screenSize: screenSize,
          resolution: screenResolution,
          os: screenOs,
          timezone: screenTimezone,
          address: screenAddress,
          zip: screenZip,
          groupId: screenGroup || undefined,
          playlist: data.playlist || screenPlaylist || 'Normal',
          lastSeen: 'Just now',
          version: 'v2.4.1',
          thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'
        };
        setScreensList(prev => {
          // Replace if already exists (by id), otherwise append
          const exists = prev.some(s => s.id === newScreen.id);
          return exists ? prev.map(s => s.id === newScreen.id ? newScreen : s) : [...prev, newScreen];
        });
        setActiveModal('pairing-success');
      } else {
        Alert.alert('Pairing Failed', data.message || 'Invalid pairing code or license limit reached.');
      }
    } catch (e: any) {
      Alert.alert('Connection Error', 'Could not reach the server. Please check your network.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleReconnectDevice = async () => {
    const code = reconnectPairingCode.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Error', 'Please enter a valid pairing code');
      return;
    }
    if (!reconnectScreen) return;
    setIsPairing(true);
    try {
      const token = await AsyncStorage.getItem('signageos_token');
      const res = await fetch(`${API_BASE}/screens/reconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          screenId: reconnectScreen.id,
          pairingCode: code,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert('Success', `Successfully reconnected "${reconnectScreen.name}"!`);
        setScreensList(prev => prev.map(s => s.id === reconnectScreen.id ? {
          ...s,
          hardware_uuid: data.hardware_uuid || s.hardware_uuid,
          status: 'online',
          lastSeen: 'Just now'
        } : s));
        setActiveModal(null);
        setSelectedScreen(null);
        setReconnectScreen(null);
        setReconnectPairingCode('');
      } else {
        Alert.alert('Reconnect Failed', data.message || 'Invalid pairing code or connection failure.');
      }
    } catch (e: any) {
      Alert.alert('Connection Error', 'Could not reach the server. Please check your network.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleDisconnectDevice = async (screen: any) => {
    Alert.alert(
      'Disconnect Screen',
      `Are you sure you want to disconnect "${screen.name}"? The TV player will go back to the pairing setup screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('signageos_token');
              const res = await fetch(`${API_BASE}/screens/disconnect`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ screenId: screen.id })
              });
              if (res.ok) {
                Alert.alert('Success', `Successfully disconnected "${screen.name}".`);
                setScreensList(prev => prev.filter(item => item.id !== screen.id));
                setSelectedScreen(null);
              } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Error', err.message || 'Failed to disconnect screen');
              }
            } catch (e: any) {
              Alert.alert('Error', `Network error: ${e.message}`);
            }
          }
        }
      ]
    );
  };

  // Filtered Screens
  const filteredScreens = screensList.filter(s => {
    const name = (s.name || '').toLowerCase();
    const location = (s.location || '').toLowerCase();
    const matchesSearch = name.includes(screenSearch.toLowerCase()) ||
      location.includes(screenSearch.toLowerCase());
    const matchesFilter = screenFilter === 'all' || s.status === screenFilter;
    // Admins in non-opMode see their own screens; in opMode see client screens
    // Non-admins only see their own screens
    const isMyScreen = s.assignedToUserEmail === profileEmail;
    const matchesMode = isAdmin 
      ? (opMode ? !isMyScreen : true)  // admin: opMode = client screens, else all
      : isMyScreen;
    return matchesSearch && matchesFilter && matchesMode;
  });

  const ungroupedScreensList = screensList.filter(s => !s.groupId);

  return (
    <View style={styles.innerTabContent}>
      {/* Sub Tab toggle & Register/Create Button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#ecedf9', borderRadius: 12, padding: 4, flex: 1 }}>
          <TouchableOpacity
            onPress={() => setScreensSubTab('screens')}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: screensSubTab === 'screens' ? '#ffffff' : 'transparent' }}
          >
            <ThemedText style={{ fontSize: 12, fontWeight: screensSubTab === 'screens' ? 'bold' : 'normal', color: screensSubTab === 'screens' ? '#7c3aed' : '#717786' }}>Screens</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScreensSubTab('groups')}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: screensSubTab === 'groups' ? '#ffffff' : 'transparent' }}
          >
            <ThemedText style={{ fontSize: 12, fontWeight: screensSubTab === 'groups' ? 'bold' : 'normal', color: screensSubTab === 'groups' ? '#7c3aed' : '#717786' }}>Groups</ThemedText>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
          onPress={() => {
            if (screensSubTab === 'screens') {
              setActiveStep(1);
              setScreenName('');
              setScreenCity('');
              setActiveModal('add-screen');
            } else {
              setGroupNameInput('');
              setGroupDescriptionInput('');
              setGroupAccentColor('#7c3aed');
              setGroupPlaylistInput('');
              setActiveModal('create-group');
            }
          }}
        >
          <Add size={16} color="#ffffff" style={{ marginRight: 4 }} />
          <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
            {screensSubTab === 'screens' ? 'Register' : 'Create'}
          </ThemedText>
        </TouchableOpacity>
        {/* Refresh Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#f1f3fe',
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isRefreshing ? 0.6 : 1,
            borderWidth: 1,
            borderColor: '#dde0f7'
          }}
          onPress={async () => {
            if (isRefreshing || !onRefresh) return;
            setIsRefreshing(true);
            await onRefresh();
            setIsRefreshing(false);
          }}
          disabled={isRefreshing || !onRefresh}
        >
          <Refresh size={18} color={isRefreshing ? '#a0aec0' : '#7c3aed'} />
        </TouchableOpacity>
      </View>

      {screensSubTab === 'screens' ? (
        /* Screens View */
        <View style={{ gap: 16 }}>
          {/* Summary Stats Grid */}
          <View style={{ marginBottom: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(124, 58, 237, 0.05)', borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.12)', borderRadius: 20, padding: 16, position: 'relative', overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ color: '#7c3aed', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Screens</ThemedText>
                  <Monitor size={18} color="#7c3aed" style={{ opacity: 0.5 }} />
                </View>
                <ThemedText style={{ fontSize: 28, fontWeight: 'bold', color: '#181c23', marginTop: 8 }}>{screensList.length}</ThemedText>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#7c3aed' }} />
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 20, padding: 16, position: 'relative', overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ color: '#006e28', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Online</ThemedText>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                </View>
                <ThemedText style={{ fontSize: 28, fontWeight: 'bold', color: '#181c23', marginTop: 8 }}>{screensList.filter(s => s.status === 'online').length}</ThemedText>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#10B981' }} />
              </View>
            </View>
          </View>

          {/* Search & Filter Bar */}
          <TextInput
            style={{ backgroundColor: '#ecedf9', color: '#181c23', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, fontSize: 14, fontWeight: '500', borderWidth: 1, borderColor: '#e0e2ed' }}
            placeholder="Search by Name or Location..."
            placeholderTextColor="#717786"
            value={screenSearch}
            onChangeText={setScreenSearch}
          />

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(['all', 'online', 'offline', 'warning'] as const).map(filterOpt => (
              <TouchableOpacity
                key={filterOpt}
                onPress={() => setScreenFilter(filterOpt)}
                style={{
                  backgroundColor: screenFilter === filterOpt ? '#7c3aed' : '#ecedf9',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginRight: 8,
                }}
              >
                <ThemedText style={{ color: screenFilter === filterOpt ? '#ffffff' : '#414755', fontSize: 12, fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {filterOpt}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Screens Cards List */}
          <View style={{ gap: 12 }}>
            {filteredScreens.map(s => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setSelectedScreen(s);
                  setDetailSelectedPlaylist(s.playlist || 'Normal');
                  setDetailScheduleEnabled(!!s.schedulePlaylist);
                  setDetailSchedulePlaylist(s.schedulePlaylist || (playlistsList[0]?.name || 'Normal'));
                  setDetailScheduleDate(s.scheduleDate || new Date().toISOString().split('T')[0]);
                  setDetailScheduleTime(s.scheduleTime || '12:00');
                  setPlaylistSearch('');
                  setPlaylistPage(0);
                }}
                style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderStyle: 'solid', borderWidth: 1, borderColor: '#e0e2ed', gap: 12 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: 'bold', color: '#181c23' }}>{s.name}</ThemedText>
                    <ThemedText style={{ fontSize: 11, color: '#717786', marginTop: 2 }}>{s.location}</ThemedText>
                  </View>
                  <View style={{ backgroundColor: s.status === 'online' ? '#e6f4ea' : '#fce8e6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <ThemedText style={{ fontSize: 9, color: s.status === 'online' ? '#137333' : '#c5221f', fontWeight: 'bold', textTransform: 'uppercase' }}>{s.status}</ThemedText>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f3fe', paddingTop: 10 }}>
                  <ThemedText style={{ fontSize: 11, color: '#717786' }}>Playlist: <ThemedText style={{ fontWeight: 'bold', color: '#7c3aed' }}>{s.playlist}</ThemedText></ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        /* Groups View */
        <View style={{ gap: 16 }}>
          {groupsList.map(g => {
            const isExpanded = expandedGroupId === g.id;
            const groupScreens = screensList.filter(s => s.groupId === g.id);
            return (
              <View key={g.id} style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderStyle: 'solid', borderWidth: 1, borderColor: '#e0e2ed', gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => toggleGroupExpand(g)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.accentColor }} />
                    <ThemedText style={{ fontSize: 15, fontWeight: 'bold', color: '#181c23' }}>{g.name}</ThemedText>
                    <ThemedText style={{ fontSize: 10, color: '#717786' }}>{isExpanded ? '▲' : '▼'}</ThemedText>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleEditGroup(g)}
                      style={{ padding: 4 }}
                    >
                      <Edit2 size={14} color="#0EA5E9" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setGroupsList(prev => prev.filter(item => item.id !== g.id))}
                      style={{ padding: 4 }}
                    >
                      <Trash size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => toggleGroupExpand(g)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={{ fontSize: 11, color: '#717786' }}>{g.description}</ThemedText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f3fe', paddingTop: 10, marginTop: 8 }}>
                    <ThemedText style={{ fontSize: 11, color: '#717786' }}>Playlist: <ThemedText style={{ fontWeight: 'bold', color: '#7c3aed' }}>{g.playlist}</ThemedText></ThemedText>
                    {g.schedulePlaylist && (
                      <ThemedText style={{ fontSize: 10, color: '#d97706', fontWeight: 'bold' }}>🕒 Scheduled</ThemedText>
                    )}
                    <ThemedText style={{ fontSize: 11, color: '#717786' }}>{g.tags?.join(' • ') || '0 Screens'}</ThemedText>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#f1f3fe', paddingTop: 12, gap: 12 }}>
                    
                    {/* A. Group Quick Actions Row */}
                    <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Group Actions</ThemedText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setAddScreensToGroupId(g.id);
                          setActiveModal('add-screens-to-group');
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>+ Add Screens</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setGroupActionTab(groupActionTab === 'assign' ? null : 'assign')}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: groupActionTab === 'assign' ? '#7c3aed' : '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: groupActionTab === 'assign' ? '#ffffff' : '#475569' }}>Assign Playlist</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setGroupActionTab(groupActionTab === 'schedule' ? null : 'schedule')}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: groupActionTab === 'schedule' ? '#7c3aed' : '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: groupActionTab === 'schedule' ? '#ffffff' : '#475569' }}>Schedule Playlist</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setScreensList(prev => prev.map(s => s.groupId === g.id ? { ...s, force_sync: true } : s));
                          Alert.alert('Success', 'Sync command sent to all screens in group!');
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Force Sync Group</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setScreensList(prev => prev.map(s => s.groupId === g.id ? { ...s, clear_cache: true } : s));
                          Alert.alert('Success', 'Cache purge command sent to all screens in group!');
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Clear Group Cache</ThemedText>
                      </TouchableOpacity>
                    </View>

                    {/* B. Action Tab Content: Assign Playlist */}
                    {groupActionTab === 'assign' && (
                      <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', gap: 8 }}>
                        <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>Select Playlist to Assign to Group</ThemedText>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}>
                          <ThemedText style={{ marginRight: 6, color: '#64748b', fontSize: 12 }}>🔍</ThemedText>
                          <TextInput
                            style={{ flex: 1, fontSize: 12, color: '#334155', padding: 0 }}
                            placeholder="Search playlists..."
                            placeholderTextColor="#94a3b8"
                            value={groupPlaylistSearch}
                            onChangeText={(txt) => {
                              setGroupPlaylistSearch(txt);
                              setGroupPlaylistPage(0);
                            }}
                          />
                        </View>

                        {(() => {
                          const allOpts = ['Normal', ...playlistsList.map(p => p.name)].filter(pName =>
                            pName.toLowerCase().includes(groupPlaylistSearch.toLowerCase())
                          );
                          const itemsPerPage = 3;
                          const maxPage = Math.max(0, Math.ceil(allOpts.length / itemsPerPage) - 1);
                          const currentPage = Math.min(groupPlaylistPage, maxPage);
                          const pageItems = allOpts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

                          return (
                            <View style={{ gap: 6 }}>
                              {pageItems.map(pName => (
                                <TouchableOpacity
                                  key={pName}
                                  onPress={() => {
                                    setGroupsList(prev => prev.map(item => item.id === g.id ? { ...item, playlist: pName } : item));
                                    setScreensList(prev => prev.map(s => s.groupId === g.id ? { ...s, playlist: pName } : s));
                                    setGroupActionTab(null);
                                    Alert.alert('Success', `Playlist "${pName}" assigned to all screens in group!`);
                                  }}
                                  style={{
                                    backgroundColor: g.playlist === pName ? '#7c3aed' : '#ffffff',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 10,
                                    borderStyle: 'solid',
                                    borderWidth: 1,
                                    borderColor: g.playlist === pName ? '#7c3aed' : '#e2e8f0',
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                >
                                  <ThemedText style={{ color: g.playlist === pName ? '#ffffff' : '#334155', fontSize: 12, fontWeight: 'bold' }}>
                                    {pName}
                                  </ThemedText>
                                  {g.playlist === pName && (
                                    <ThemedText style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>Active</ThemedText>
                                  )}
                                </TouchableOpacity>
                              ))}

                              {maxPage > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                  <TouchableOpacity
                                    disabled={currentPage === 0}
                                    onPress={() => setGroupPlaylistPage(p => Math.max(0, p - 1))}
                                    style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#e2e8f0' }}
                                  >
                                    <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>‹ Prev</ThemedText>
                                  </TouchableOpacity>
                                  <ThemedText style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold' }}>
                                    {currentPage + 1} of {maxPage + 1}
                                  </ThemedText>
                                  <TouchableOpacity
                                    disabled={currentPage >= maxPage}
                                    onPress={() => setGroupPlaylistPage(p => Math.min(maxPage, p + 1))}
                                    style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#e2e8f0' }}
                                  >
                                    <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>Next ›</ThemedText>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {/* C. Action Tab Content: Schedule Playlist */}
                    {groupActionTab === 'schedule' && (
                      <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
                        <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>Schedule Group Playlist Switch</ThemedText>
                        
                        <View>
                          <ThemedText style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Target Playlist</ThemedText>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                            {playlistsList.map(p => (
                              <TouchableOpacity
                                key={p.id}
                                onPress={() => setGroupSchedulePlaylist(p.name)}
                                style={{
                                  backgroundColor: groupSchedulePlaylist === p.name ? '#7c3aed' : '#ffffff',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  borderStyle: 'solid',
                                  borderWidth: 1,
                                  borderColor: groupSchedulePlaylist === p.name ? '#7c3aed' : '#e2e8f0'
                                }}
                              >
                                <ThemedText style={{ color: groupSchedulePlaylist === p.name ? '#ffffff' : '#334155', fontSize: 11, fontWeight: 'bold' }}>
                                  {p.name}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Switch Date</ThemedText>
                            <TextInput
                              style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontSize: 12, fontWeight: '500' }}
                              placeholder="YYYY-MM-DD"
                              value={groupScheduleDate}
                              onChangeText={setGroupScheduleDate}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Switch Time</ThemedText>
                            <TextInput
                              style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontSize: 12, fontWeight: '500' }}
                              placeholder="HH:MM"
                              value={groupScheduleTime}
                              onChangeText={setGroupScheduleTime}
                            />
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            setGroupsList(prev => prev.map(item => item.id === g.id ? {
                              ...item,
                              schedulePlaylist: groupSchedulePlaylist || undefined,
                              scheduleDate: groupScheduleDate || undefined,
                              scheduleTime: groupScheduleTime || undefined
                            } : item));
                            setScreensList(prev => prev.map(s => s.groupId === g.id ? {
                              ...s,
                              schedulePlaylist: groupSchedulePlaylist || undefined,
                              scheduleDate: groupScheduleDate || undefined,
                              scheduleTime: groupScheduleTime || undefined
                            } : s));
                            setGroupActionTab(null);
                            Alert.alert('Success', 'Scheduled playlist switch saved for all screens in group!');
                          }}
                          style={{ backgroundColor: '#7c3aed', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
                        >
                          <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>Save Group Schedule Settings</ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* D. Screens in Group Accordion List */}
                    <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 }}>Screens in this group ({groupScreens.length})</ThemedText>
                    {groupScreens.length === 0 ? (
                      <ThemedText style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No screens assigned yet</ThemedText>
                    ) : (
                      groupScreens.map(screen => (
                        <View key={screen.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: screen.status === 'online' ? '#10B981' : '#ef4444' }} />
                            <View style={{ flex: 1 }}>
                              <ThemedText style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>{screen.name}</ThemedText>
                              <ThemedText style={{ fontSize: 11, color: '#64748b' }}>{screen.location || 'No location'}</ThemedText>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Remove from Group',
                                `Remove "${screen.name}" from this group?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () => {
                                      setScreensList(prev => prev.map(s => s.id === screen.id ? { ...s, groupId: undefined } : s));
                                      Alert.alert('Success', `"${screen.name}" removed from group`);
                                    }
                                  }
                                ]
                              );
                            }}
                            style={{ padding: 6 }}
                          >
                            <Trash size={15} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Ungrouped Screens Accordion */}
          <View style={{ backgroundColor: '#f1f3fe', borderRadius: 20, padding: 16, marginTop: 10 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
              onPress={() => setUngroupedExpanded(!ungroupedExpanded)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Monitor size={14} color="#414755" />
                <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#414755', letterSpacing: 0.8 }}>UNGROUPED SCREENS ({ungroupedScreensList.length})</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 14, color: '#717786', fontWeight: 'bold' }}>{ungroupedExpanded ? '▲' : '▼'}</ThemedText>
            </TouchableOpacity>

            {ungroupedExpanded && (
              <View style={{ gap: 12, marginTop: 16 }}>
                {ungroupedScreensList.length === 0 ? (
                  <ThemedText style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>No ungrouped screens</ThemedText>
                ) : (
                  ungroupedScreensList.map(us => (
                    <TouchableOpacity
                      key={us.id}
                      onPress={() => {
                        setSelectedScreen(us);
                        setDetailSelectedPlaylist(us.playlist || 'Normal');
                        setDetailScheduleEnabled(false);
                        setPlaylistSearch('');
                        setPlaylistPage(0);
                      }}
                      style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderStyle: 'solid', borderWidth: 1, borderColor: '#e0e2ed' }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(124, 58, 237, 0.08)', alignItems: 'center', justifyContent: 'center' }}>
                          <Monitor size={18} color="#7c3aed" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={{ fontSize: 14, fontWeight: 'bold', color: '#181c23' }}>{us.name}</ThemedText>
                          <ThemedText style={{ fontSize: 11, color: '#717786', marginTop: 2 }}>{us.location || 'No location set'}</ThemedText>
                        </View>
                      </View>
                      <View style={{ backgroundColor: us.status === 'online' ? '#e6f4ea' : '#f1f3fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <ThemedText style={{ color: us.status === 'online' ? '#137333' : '#414755', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{us.status || 'offline'}</ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Screen Details Modal */}
      {selectedScreen && (
        <Modal visible={!!selectedScreen} transparent={true} animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
                <View>
                  <ThemedText style={{ fontSize: 20, fontWeight: '900', color: '#0f172a' }}>Screen details</ThemedText>
                  <ThemedText style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Manage device and active playback</ThemedText>
                </View>
                <TouchableOpacity onPress={() => setSelectedScreen(null)} style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 12 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#64748b' }}>✕ Close</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedScreen.thumbnail }} style={{ width: '100%', height: 140, borderRadius: 20, marginBottom: 20 }} />
                
                {/* 1. General Info Card */}
                <View style={{ backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', gap: 12, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Screen Name</ThemedText>
                    <ThemedText style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13 }}>{selectedScreen.name}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Location</ThemedText>
                    <ThemedText style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13 }}>{selectedScreen.location}</ThemedText>
                  </View>
                  {/* Group Info Row */}
                  {(() => {
                    const grp = groupsList.find(g => g.id === selectedScreen.groupId);
                    return grp ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Group</ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: grp.accentColor || '#7c3aed' }} />
                          <ThemedText style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13 }}>{grp.name}</ThemedText>
                        </View>
                      </View>
                    ) : null;
                  })()}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Status</ThemedText>
                    <View style={{ backgroundColor: selectedScreen.status === 'online' ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8 }}>
                      <ThemedText style={{ fontWeight: '900', color: selectedScreen.status === 'online' ? '#15803d' : '#b91c1c', fontSize: 11, textTransform: 'uppercase' }}>{selectedScreen.status}</ThemedText>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Orientation</ThemedText>
                    <ThemedText style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13, textTransform: 'capitalize' }}>{selectedScreen.orientation}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Last Heartbeat</ThemedText>
                    <ThemedText style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 13 }}>{selectedScreen.lastSeen || selectedScreen.lastHeartbeat || 'Just now'}</ThemedText>
                  </View>
                  {/* Uptime & Loops Metrics */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, gap: 10, marginTop: 2 }}>
                    <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Performance Metrics</ThemedText>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, backgroundColor: 'rgba(124, 58, 237, 0.05)', borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.12)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
                        <ThemedText style={{ fontSize: 10, color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Total Uptime</ThemedText>
                        <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{formatUptime(getLiveUptime(selectedScreen))}</ThemedText>
                      </View>
                      <View style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
                        <ThemedText style={{ fontSize: 10, color: '#059669', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Loops Played</ThemedText>
                        <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{(selectedScreen.cumulativeLoops || 0).toLocaleString()}</ThemedText>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 2. Device Controls Section */}
                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Device Controls</ThemedText>
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? { ...s, force_sync: true } : s));
                        Alert.alert('Success', 'Sync signal sent to screen!');
                      }}
                      style={{ flex: 1, flexDirection: 'row', backgroundColor: '#faf5ff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e9d5ff', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Refresh size={16} color="#7c3aed" />
                      <ThemedText style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: 13 }}>Force Sync</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? { ...s, restart_playlist: true } : s));
                        Alert.alert('Success', 'Playback restart signal sent successfully!');
                      }}
                      style={{ flex: 1, flexDirection: 'row', backgroundColor: '#faf5ff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e9d5ff', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <VideoPlay size={16} color="#7c3aed" />
                      <ThemedText style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: 13 }}>Restart</ThemedText>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? { ...s, clear_cache: true } : s));
                        Alert.alert('Success', 'Cache purge command sent to screen!');
                      }}
                      style={{ flex: 1, flexDirection: 'row', backgroundColor: '#faf5ff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e9d5ff', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Eraser size={16} color="#7c3aed" />
                      <ThemedText style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: 13 }}>Clear Cache</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedScreen.groupId) {
                          Alert.alert('Info', 'Stop playback is not available for screens in a group. Manage group playlist instead.');
                          return;
                        }
                        setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? { ...s, playlist: 'None', playlistId: '' } : s));
                        setSelectedScreen(prev => prev ? { ...prev, playlist: 'None', playlistId: '' } : null);
                        setDetailSelectedPlaylist('None');
                        Alert.alert('Success', 'Playback stopped for screen!');
                      }}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        backgroundColor: selectedScreen.groupId ? '#f1f5f9' : '#fff5f5',
                        borderStyle: 'solid',
                        borderWidth: 1,
                        borderColor: selectedScreen.groupId ? '#e2e8f0' : '#fee2e2',
                        paddingVertical: 12,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: selectedScreen.groupId ? 0.5 : 1
                      }}
                    >
                      <StopCircle size={16} color={selectedScreen.groupId ? '#94a3b8' : '#ef4444'} />
                      <ThemedText style={{ color: selectedScreen.groupId ? '#94a3b8' : '#ef4444', fontWeight: 'bold', fontSize: 13 }}>Stop Playback</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {selectedScreen.groupId && (
                    <TouchableOpacity
                      onPress={() => {
                        setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? { ...s, groupId: undefined } : s));
                        setSelectedScreen(prev => prev ? { ...prev, groupId: undefined } : null);
                        Alert.alert('Success', 'Screen removed from group successfully!');
                      }}
                      style={{ width: '100%', flexDirection: 'row', backgroundColor: '#fffbeb', borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <FolderMinus size={16} color="#d97706" />
                      <ThemedText style={{ color: '#d97706', fontWeight: 'bold', fontSize: 13 }}>Remove from Group</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 3. Assign Playlist Section */}
                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Assign Playlist</ThemedText>
                <View style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 14, gap: 10, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 }}>
                    <ThemedText style={{ fontSize: 13, color: '#64748b' }}>Active Loop</ThemedText>
                    <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#7c3aed' }}>{detailSelectedPlaylist}</ThemedText>
                  </View>
                  
                  {/* Playlist Search Input with Search Icon */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
                    <ThemedText style={{ marginRight: 6, color: '#64748b', fontSize: 12 }}>🔍</ThemedText>
                    <TextInput
                      style={{ flex: 1, fontSize: 13, color: '#334155', padding: 0 }}
                      placeholder="Search playlists..."
                      placeholderTextColor="#94a3b8"
                      value={playlistSearch}
                      onChangeText={(txt) => {
                        setPlaylistSearch(txt);
                        setPlaylistPage(0);
                      }}
                    />
                  </View>

                  {/* Playlists listing */}
                  {(() => {
                    const allOpts = ['Normal', ...playlistsList.map(p => p.name)].filter(pName =>
                      pName.toLowerCase().includes(playlistSearch.toLowerCase())
                    );
                    const itemsPerPage = 3;
                    const maxPage = Math.max(0, Math.ceil(allOpts.length / itemsPerPage) - 1);
                    const currentPage = Math.min(playlistPage, maxPage);
                    const pageItems = allOpts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

                    return (
                      <View style={{ gap: 8 }}>
                        {pageItems.length === 0 ? (
                          <ThemedText style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 }}>No playlists found</ThemedText>
                        ) : (
                          pageItems.map(pName => (
                            <TouchableOpacity
                              key={pName}
                              onPress={() => {
                                setDetailSelectedPlaylist(pName);
                                setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? { ...s, playlist: pName } : s));
                                setSelectedScreen(prev => prev ? { ...prev, playlist: pName } : null);
                              }}
                              style={{
                                backgroundColor: detailSelectedPlaylist === pName ? '#7c3aed' : '#f8fafc',
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderStyle: 'solid',
                                borderWidth: 1,
                                borderColor: detailSelectedPlaylist === pName ? '#7c3aed' : '#e2e8f0',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <ThemedText style={{ color: detailSelectedPlaylist === pName ? '#ffffff' : '#334155', fontSize: 13, fontWeight: 'bold' }}>
                                {pName}
                              </ThemedText>
                              {detailSelectedPlaylist === pName && (
                                <ThemedText style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>Active</ThemedText>
                              )}
                            </TouchableOpacity>
                          ))
                        )}

                        {/* Pagination Controls */}
                        {maxPage > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 }}>
                            <TouchableOpacity
                              disabled={currentPage === 0}
                              onPress={() => setPlaylistPage(p => Math.max(0, p - 1))}
                              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: currentPage === 0 ? '#f1f5f9' : '#e2e8f0' }}
                            >
                              <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: currentPage === 0 ? '#94a3b8' : '#475569' }}>‹ Prev</ThemedText>
                            </TouchableOpacity>
                            <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>
                              {currentPage + 1} of {maxPage + 1}
                            </ThemedText>
                            <TouchableOpacity
                              disabled={currentPage >= maxPage}
                              onPress={() => setPlaylistPage(p => Math.min(maxPage, p + 1))}
                              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: currentPage >= maxPage ? '#f1f5f9' : '#e2e8f0' }}
                            >
                              <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: currentPage >= maxPage ? '#94a3b8' : '#475569' }}>Next ›</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* 4. Schedule Switch Section */}
                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Schedule Playlist Switch</ThemedText>
                <View style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 16, gap: 14, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>Enable Switch Schedule</ThemedText>
                    <TouchableOpacity
                      onPress={() => setDetailScheduleEnabled(!detailScheduleEnabled)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: detailScheduleEnabled ? '#7c3aed' : '#cbd5e1',
                        padding: 2,
                        justifyContent: 'center',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', transform: [{ translateX: detailScheduleEnabled ? 20 : 0 }] }} />
                    </TouchableOpacity>
                  </View>

                  {detailScheduleEnabled && (
                    <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 }}>
                      <View>
                        <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Target Playlist</ThemedText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                          {playlistsList.map(p => (
                            <TouchableOpacity
                              key={p.id}
                              onPress={() => setDetailSchedulePlaylist(p.name)}
                              style={{
                                backgroundColor: detailSchedulePlaylist === p.name ? '#7c3aed' : '#f1f5f9',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 10,
                              }}
                            >
                              <ThemedText style={{ color: detailSchedulePlaylist === p.name ? '#ffffff' : '#334155', fontSize: 11, fontWeight: 'bold' }}>
                                {p.name}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Switch Date</ThemedText>
                          <TextInput
                            style={{ backgroundColor: '#f8fafc', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, fontSize: 12, fontWeight: '500' }}
                            placeholder="YYYY-MM-DD"
                            value={detailScheduleDate}
                            onChangeText={setDetailScheduleDate}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Switch Time</ThemedText>
                          <TextInput
                            style={{ backgroundColor: '#f8fafc', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, fontSize: 12, fontWeight: '500' }}
                            placeholder="HH:MM"
                            value={detailScheduleTime}
                            onChangeText={setDetailScheduleTime}
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setScreensList(prev => prev.map(s => s.id === selectedScreen.id ? {
                            ...s,
                            schedulePlaylist: detailSchedulePlaylist || undefined,
                            scheduleDate: detailScheduleDate || undefined,
                            scheduleTime: detailScheduleTime || undefined
                          } : s));
                          setSelectedScreen(prev => prev ? {
                            ...prev,
                            schedulePlaylist: detailSchedulePlaylist || undefined,
                            scheduleDate: detailScheduleDate || undefined,
                            scheduleTime: detailScheduleTime || undefined
                          } : null);
                          Alert.alert('Success', 'Schedule playlist switch saved!');
                        }}
                        style={{ backgroundColor: '#7c3aed', paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
                      >
                        <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>Save Schedule Settings</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={() => handleEditScreen(selectedScreen)}
                  style={{ flex: 1, minWidth: 90, borderStyle: 'solid', borderWidth: 1.5, borderColor: '#7c3aed', height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ThemedText style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: 12 }}>Edit Details</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setReconnectScreen(selectedScreen);
                    setReconnectPairingCode('');
                    setActiveModal('reconnect-screen');
                  }}
                  style={{ flex: 1, minWidth: 90, backgroundColor: '#10B981', height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>Reconnect</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDisconnectDevice(selectedScreen)}
                  style={{ flex: 1, minWidth: 90, backgroundColor: '#f97316', height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>Disconnect</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setScreensList(prev => prev.filter(item => item.id !== selectedScreen.id));
                    setSelectedScreen(null);
                    Alert.alert('Success', 'Signage display unlinked successfully!');
                  }}
                  style={{ flex: 1, minWidth: 90, backgroundColor: '#ef4444', height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>Unregister</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= MODAL 1: REGISTER/EDIT SCREEN WIZARD ================= */}
      <Modal
        visible={activeModal === 'add-screen'}
        animationType="slide"
        onRequestClose={() => { setActiveModal(null); setEditingScreenId(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#ffffff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
            <TouchableOpacity onPress={() => { setActiveModal(null); setEditingScreenId(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText style={{ fontSize: 18, color: '#7c3aed', fontWeight: 'bold' }}>←</ThemedText>
              <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{editingScreenId ? 'Edit Screen' : 'Register Screen'}</ThemedText>
            </TouchableOpacity>
            <ThemedText style={{ fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 }}>SIGNAGE OS</ThemedText>
          </View>

          {/* Wizard Steps indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
            {[1, 2, 3].map(s => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: activeStep === s ? '#7c3aed' : activeStep > s ? '#10B981' : '#ecedf9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ThemedText style={{ color: activeStep === s || activeStep > s ? '#ffffff' : '#717786', fontSize: 12, fontWeight: 'bold' }}>
                    {activeStep > s ? '✓' : s}
                  </ThemedText>
                </View>
                {s < 3 && <View style={{ width: 40, height: 2, backgroundColor: activeStep > s ? '#10B981' : '#ecedf9', marginHorizontal: 8 }} />}
              </View>
            ))}
          </View>

          {/* Form Content */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
            {activeStep === 1 && (
              <View style={{ gap: 16 }}>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Screen Name *</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. North Lobby 02"
                    placeholderTextColor="#717786"
                    value={screenName}
                    onChangeText={setScreenName}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Orientation</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="landscape / portrait"
                    placeholderTextColor="#717786"
                    value={screenOrientation}
                    onChangeText={setScreenOrientation}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Screen Size</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder='e.g. 55"'
                    placeholderTextColor="#717786"
                    value={screenSize}
                    onChangeText={setScreenSize}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Resolution</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. 1920x1080"
                    placeholderTextColor="#717786"
                    value={screenResolution}
                    onChangeText={setScreenResolution}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>OS Type</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="android / windows / linux"
                    placeholderTextColor="#717786"
                    value={screenOs}
                    onChangeText={setScreenOs}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Timezone</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. Asia/Kolkata"
                    placeholderTextColor="#717786"
                    value={screenTimezone}
                    onChangeText={setScreenTimezone}
                  />
                </View>
              </View>
            )}

            {activeStep === 2 && (
              <View style={{ gap: 16 }}>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Country</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. India"
                    placeholderTextColor="#717786"
                    value={screenCountry}
                    onChangeText={setScreenCountry}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>State</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. Maharashtra"
                    placeholderTextColor="#717786"
                    value={screenState}
                    onChangeText={setScreenState}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>City</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. Mumbai"
                    placeholderTextColor="#717786"
                    value={screenCity}
                    onChangeText={setScreenCity}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>ZIP Code</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. 400001"
                    placeholderTextColor="#717786"
                    value={screenZip}
                    onChangeText={setScreenZip}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Full Address</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="Building, Street, Area"
                    placeholderTextColor="#717786"
                    value={screenAddress}
                    onChangeText={setScreenAddress}
                  />
                </View>
              </View>
            )}

            {activeStep === 3 && (
              <View style={{ gap: 16 }}>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Assign Group</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. Lobby Displays"
                    placeholderTextColor="#717786"
                    value={screenGroup}
                    onChangeText={setScreenGroup}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Assign Playlist</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="Standard Corporate Loop"
                    placeholderTextColor="#717786"
                    value={screenPlaylist}
                    onChangeText={setScreenPlaylist}
                  />
                </View>
              </View>
            )}

            <View style={{ gap: 10, marginTop: 12 }}>
              {activeStep < 3 ? (
                <TouchableOpacity
                  style={{ backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setActiveStep(s => s + 1)}
                >
                  <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15 }}>Next</ThemedText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{ backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  onPress={handleCreateScreenSubmit}
                >
                  <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15 }}>
                    {editingScreenId ? 'Update Screen' : 'Register Device'}
                  </ThemedText>
                </TouchableOpacity>
              )}

              {activeStep > 1 && (
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#e0e2ed', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setActiveStep(s => s - 1)}
                >
                  <ThemedText style={{ color: '#414755', fontWeight: '600', fontSize: 13 }}>Back</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL 1.5: CREATE GROUP MODAL ================= */}
      <Modal visible={activeModal === 'create-group'} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={{ width: '90%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: '#7c3aed' }}>{editingGroupId ? 'Edit Group' : 'Create Group'}</ThemedText>
              <TouchableOpacity onPress={() => { setActiveModal(null); setEditingGroupId(null); }}>
                <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: '#717786' }}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginBottom: 20 }}>
              <View style={{ gap: 16 }}>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Group Name *</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ecedf9', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. Retail Zone"
                    placeholderTextColor="#717786"
                    value={groupNameInput}
                    onChangeText={setGroupNameInput}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Description</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ecedf9', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. North Zone Stores"
                    placeholderTextColor="#717786"
                    value={groupDescriptionInput}
                    onChangeText={setGroupDescriptionInput}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Accent Color</ThemedText>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    {['#7c3aed', '#bc000a', '#0d9488', '#10B981', '#F59E0B'].map(colorOpt => (
                      <TouchableOpacity
                        key={colorOpt}
                        onPress={() => setGroupAccentColor(colorOpt)}
                        style={{
                           width: 32,
                           height: 32,
                           borderRadius: 16,
                           backgroundColor: colorOpt,
                           borderWidth: groupAccentColor === colorOpt ? 3 : 0,
                           borderColor: '#181c23',
                        }}
                      />
                    ))}
                  </View>
                </View>
                <View>
                  <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#414755', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Assign Playlist</ThemedText>
                  <TextInput
                    style={{ backgroundColor: '#ecedf9', color: '#181c23', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 13, fontWeight: '500' }}
                    placeholder="e.g. Summer Playlist"
                    placeholderTextColor="#717786"
                    value={groupPlaylistInput}
                    onChangeText={setGroupPlaylistInput}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={{ backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              onPress={handleCreateGroupSubmit}
            >
              <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15 }}>
                {editingGroupId ? 'Update Group' : 'Create Group'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 2: PAIRING DEVICE CODE POPUP ================= */}
      <Modal visible={activeModal === 'pairing-code'} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.pairingCard}>
            <ThemedText type="smallBold" style={{ fontSize: 20, textAlign: 'center', marginBottom: 8, color: '#181c23' }}>Pair Display Device</ThemedText>
            <ThemedText style={{ textAlign: 'center', color: '#8F9BB3', fontSize: 13, marginBottom: 20 }}>
              Enter the pairing code shown on your display hardware screen (e.g. SO-4920)
            </ThemedText>
            <TextInput
              style={[styles.pairingCodeInput, { color: '#181c23', borderColor: '#7c3aed' }]}
              placeholder="SO-XXXX"
              placeholderTextColor="#8F9BB3"
              maxLength={7}
              autoCapitalize="characters"
              value={screenPairingCode}
              onChangeText={setScreenPairingCode}
            />
            <TouchableOpacity style={[styles.pairButton, isPairing && { opacity: 0.7 }]} onPress={handlePairDevice} disabled={isPairing}>
              <ThemedText style={styles.pairButtonText}>{isPairing ? 'Pairing...' : 'Link Display'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={() => setActiveModal(null)} disabled={isPairing}>
              <ThemedText style={styles.skipButtonText}>Pair Later</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 3: PAIRING SUCCESS OVERLAY ================= */}
      <Modal visible={activeModal === 'pairing-success'} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pairingCard, { alignItems: 'center' }]}>
            <TickCircle size={48} color="#10B981" variant="Bulk" style={{ marginBottom: 12 }} />
            <ThemedText type="smallBold" style={{ fontSize: 20, textAlign: 'center', marginBottom: 8, color: '#181c23' }}>Device Paired Successfully!</ThemedText>
            <ThemedText style={{ textAlign: 'center', color: '#8F9BB3', fontSize: 13, marginBottom: 24 }}>
              Your signage screen is now connected and broadcasting content.
            </ThemedText>
            <TouchableOpacity
              style={[styles.pairButton, { backgroundColor: '#10B981', width: '100%' }]}
              onPress={() => {
                setActiveModal(null);
                setScreenName('');
                setScreenCity('');
                setScreenCountry('');
                setScreenOrientation('');
                setScreenPlaylist('');
                setScreenPairingCode('');
              }}
            >
              <ThemedText style={styles.pairButtonText}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 4: RECONNECT DEVICE CODE POPUP ================= */}
      <Modal visible={activeModal === 'reconnect-screen'} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.pairingCard}>
            <ThemedText type="smallBold" style={{ fontSize: 20, textAlign: 'center', marginBottom: 8, color: '#181c23' }}>Reconnect Screen</ThemedText>
            <ThemedText style={{ textAlign: 'center', color: '#8F9BB3', fontSize: 13, marginBottom: 20 }}>
              Enter the pairing code shown on your display hardware screen to reconnect it to "{reconnectScreen?.name}"
            </ThemedText>
            <TextInput
              style={[styles.pairingCodeInput, { color: '#181c23', borderColor: '#7c3aed' }]}
              placeholder="SO-XXXX"
              placeholderTextColor="#8F9BB3"
              maxLength={7}
              autoCapitalize="characters"
              value={reconnectPairingCode}
              onChangeText={setReconnectPairingCode}
            />
            <TouchableOpacity style={[styles.pairButton, isPairing && { opacity: 0.7 }]} onPress={handleReconnectDevice} disabled={isPairing}>
              <ThemedText style={styles.pairButtonText}>{isPairing ? 'Reconnecting...' : 'Reconnect Display'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={() => { setActiveModal(null); setReconnectScreen(null); }} disabled={isPairing}>
              <ThemedText style={styles.skipButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 5: ADD SCREENS TO GROUP ================= */}
      <Modal visible={activeModal === 'add-screens-to-group'} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={{ width: '90%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 28, padding: 24, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
              <View>
                <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: '#7c3aed' }}>Add Screens to Group</ThemedText>
                <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Only showing ungrouped screens</ThemedText>
              </View>
              <TouchableOpacity onPress={() => { setActiveModal(null); setAddScreensToGroupId(null); }}>
                <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: '#717786' }}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginBottom: 20 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const ungrouped = screensList.filter(s => !s.groupId);
                if (ungrouped.length === 0) {
                  return (
                    <ThemedText style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginVertical: 30 }}>
                      No ungrouped screens available
                    </ThemedText>
                  );
                }
                return (
                  <View style={{ gap: 12 }}>
                    {ungrouped.map(us => (
                      <View key={us.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 14, borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#1f2937' }}>{us.name}</ThemedText>
                          <ThemedText style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{us.location || 'No location'}</ThemedText>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            const gp = groupsList.find(g => g.id === addScreensToGroupId);
                            const updatedScreen = {
                              ...us,
                              groupId: addScreensToGroupId,
                              playlist: gp?.playlist || us.playlist,
                            };
                            setScreensList(prev => prev.map(s => s.id === us.id ? updatedScreen : s));
                            Alert.alert('Success', `"${us.name}" added to group!`);
                          }}
                          style={{ backgroundColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                        >
                          <ThemedText style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>+ Add</ThemedText>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>

            <TouchableOpacity
              style={{ backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => { setActiveModal(null); setAddScreensToGroupId(null); }}
            >
              <ThemedText style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  innerTabContent: {
    gap: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairingCard: {
    width: '90%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  pairingCodeInput: {
    backgroundColor: '#ecedf9',
    borderRadius: 14,
    height: 52,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 1.5,
    marginBottom: 20,
  },
  pairButton: {
    backgroundColor: '#7c3aed',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pairButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  skipButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#717786',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
