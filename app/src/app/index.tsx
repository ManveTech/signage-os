import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Switch,
  Modal,
  Alert,
  Text,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';

import {
  Category,
  Monitor,
  DocumentText,
  Setting2,
  NotificationBing,
  Trash,
} from 'iconsax-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAllFromDatabase, pushToDatabase, API_BASE } from '../lib/syncHelper';

// Import modular tab components
import { DashboardTab } from '../components/tabs/DashboardTab';
import { ScreensTab } from '../components/tabs/ScreensTab';
import { PlaylistsTab } from '../components/tabs/PlaylistsTab';
import { SettingsTab } from '../components/tabs/SettingsTab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ScreenState = 'splash' | 'login' | 'user' | 'admin';
type AdminTab = 'dashboard' | 'screens' | 'playlists' | 'settings';

function AppContent() {
  const insets = useSafeAreaInsets();
  // Navigation & Authentication states
  const [screen, setScreen] = useState<ScreenState>('splash');
  const logoScale = React.useRef(new Animated.Value(0.95)).current;
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const progressWidth = React.useRef(new Animated.Value(0)).current;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Admin Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [dockWidth, setDockWidth] = useState(0);
  const tabX = React.useRef(new Animated.Value(0)).current;
  const indicatorScale = React.useRef(new Animated.Value(1)).current;

  const tabIndices = {
    dashboard: 0,
    screens: 1,
    playlists: 2,
    settings: 3,
  };

  const startTabIdx = React.useRef(0);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startTabIdx.current = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
        Animated.spring(indicatorScale, {
          toValue: 0.92,
          useNativeDriver: true,
          friction: 6,
          tension: 80,
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        if (dockWidth <= 0) return;
        const tabWidth = dockWidth / 4;
        const targetVal = startTabIdx.current + (gestureState.dx / tabWidth);
        const clampedVal = Math.max(0, Math.min(3, targetVal));
        tabX.setValue(clampedVal);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (dockWidth <= 0) return;
        const tabWidth = dockWidth / 4;
        const targetVal = startTabIdx.current + (gestureState.dx / tabWidth);
        const finalIdx = Math.max(0, Math.min(3, Math.round(targetVal)));
        
        const tabs: AdminTab[] = ['dashboard', 'screens', 'playlists', 'settings'];
        setActiveTab(tabs[finalIdx]);

        Animated.parallel([
          Animated.spring(indicatorScale, {
            toValue: 1.0,
            useNativeDriver: true,
            friction: 6,
            tension: 80,
          }),
          Animated.spring(tabX, {
            toValue: finalIdx,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
          })
        ]).start();
      },
      onPanResponderTerminate: () => {
        const idx = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
        Animated.parallel([
          Animated.spring(indicatorScale, {
            toValue: 1.0,
            useNativeDriver: true,
          }),
          Animated.spring(tabX, {
            toValue: idx,
            useNativeDriver: true,
          })
        ]).start();
      }
    })
  ).current;

  useEffect(() => {
    const idx = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : 0;
    Animated.spring(tabX, {
      toValue: idx,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [activeTab]);

  const [opMode, setOpMode] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // Profile & Credentials states
  const [profileName, setProfileName] = useState('Super Admin');
  const [profileEmail, setProfileEmail] = useState('admin@signageos.io');
  const [profilePhone, setProfilePhone] = useState('+91 98765 43210');
  const [rzpKeyId, setRzpKeyId] = useState('rzp_live_59c82b184a8219');
  const [rzpKeySecret, setRzpKeySecret] = useState('sec_live_92a01b19ff82a17b0193');

  // Shared Data States
  const [screensList, setScreensList] = useState([
    { 
      id: '1', 
      name: 'North Lobby Screen 01', 
      location: 'New Delhi, India', 
      type: 'my', 
      status: 'online', 
      orientation: 'landscape', 
      playlist: 'Corporate Branding',
      storageUsed: '1.2 GB',
      storageTotal: '5 GB',
      lastSeen: '2 mins ago',
      version: 'v2.4.1',
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPudAKFAY4ns4u3PJ1XnNZ5IzmwJUmjon6J2x91Cm9eCNjwkT4vWSclyoa81L7VIw4u3cfH95f1pIz_5OqeD8eHEaIKDDMIdz0zsgHSyNBAbVGDezjBVto7bJ02-af4M6oPL0qxi767HZu5NrzI8mELXBsh2sR3kr1kFqWRg-QviPYAPUlG5HXeISDTFoBZpk3S52jIQo9Bjc8Q_FMgZnbbGmPh-5MRaKzZlZrq7NyU78Syv6aRNdcemvf83BCDdc22627fTZpnq0'
    },
    { 
      id: '2', 
      name: 'Cafeteria Menu Display', 
      location: 'Mumbai, India', 
      type: 'my', 
      status: 'offline', 
      orientation: 'portrait', 
      playlist: 'Lunch Specials',
      storageUsed: '4.8 GB',
      storageTotal: '5 GB',
      lastSeen: '4 hours ago',
      version: 'v2.3.8',
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCCUNnyrSUs_LdfsY_hF2vDexj4K53_SNFVL4hI2MlqfQWTj7FX9oH6W7UEzuJz6LBy9YJF7-izQZxKrDfevB1tjDS2rcaQd1snnkjkBDxVlJTKQ56o-rsvZJS6RuwnV1idxAI7ECMDZCnzcn-aAmIGvluc7BMpaRgn1jaAQCwtKDfgbAtAb7uYe1tHM1MH1H4XrIVcRKtrHnzNqJNMJUaeF1vdcekoBQgXn6g16P1MfZjJVMZaus-AEq4fTuCwfudahda1cTrFN5g'
    },
    { 
      id: '3', 
      name: 'CEO Office Portrait', 
      location: 'New York, USA', 
      type: 'client', 
      status: 'warning', 
      orientation: 'portrait', 
      playlist: 'Corporate Branding',
      warning: 'Firmware update required',
      storageUsed: '2.1 GB',
      storageTotal: '5 GB',
      lastSeen: '1 min ago',
      version: 'v2.1.0',
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYEiWQICT3LO2ZD8ENUEo1n8XiK1tXjtWgzPny0gIGSXEHArIke-EFjmI5ywmdI9HbJAXdoKGGDe5Y5jjDheN4IbTczIvEfO-tnQtY0vxggRwqKb9F4gBxdim6-Wgu-51M8XlPFKCGu-wF-7bDtl5mQ57WAk6l1ieR09Yasmd4rG-vOIth6AjzymLQuIqRZCn09Axd6uHfeKYRFMFps8d9ygK3qkL1cqRMqYdBdGt8-XO9KYN-meIQdal_MYtdm06jnPSt0pgwAG0'
    },
    { 
      id: '4', 
      name: 'Outdoor Entrance Display', 
      location: 'Chennai, India', 
      type: 'client', 
      status: 'offline', 
      orientation: 'landscape', 
      playlist: 'Standard Corporate Loop',
      storageUsed: '3.5 GB',
      storageTotal: '5 GB',
      lastSeen: '1 day ago',
      version: 'v2.3.8',
      thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'
    },
  ]);

  const [groupsList, setGroupsList] = useState([
    { 
      id: '1', 
      name: 'Retail Zone', 
      description: 'North Zone Stores - Terminal 1',
      accentColor: '#7c3aed',
      screensCount: 12,
      playlist: 'Summer Playlist',
      tags: ['Retail Assets'],
      progress: null
    },
  ]);

  const [playlistsList, setPlaylistsList] = useState([
    {
      id: 'p1',
      name: 'Corporate Branding',
      type: 'my' as const,
      slides: [
        { id: 'slide1', mediaId: 'pres1', duration: 15 },
        { id: 'slide2', mediaId: 'pres2', duration: 10 }
      ],
      widget: 'Clock (Top-Right)',
      syncStatus: 'synced' as const,
      orientation: 'horizontal'
    },
    {
      id: 'p2',
      name: 'Lunch Specials',
      type: 'my' as const,
      slides: [
        { id: 'slide3', mediaId: 'pres3', duration: 20 }
      ],
      widget: 'None',
      syncStatus: 'pending' as const,
      orientation: 'horizontal'
    }
  ]);

  const [mediaList, setMediaList] = useState([
    { id: 'pres1', name: 'corporate_welcome_4k.mp4', type: 'Video' as const, size: '42.5MB', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80' },
    { id: 'pres2', name: 'seasonal_promo_spring.jpg', type: 'Image' as const, size: '2.8MB', url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80' },
    { id: 'pres3', name: 'cafeteria_lunch_board.layout', type: 'Layout' as const, size: '24KB', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80' }
  ]);

  const [settingsUsers, setSettingsUsers] = useState([
    { name: 'Priya Reddy', email: 'priya@demo.com', role: 'org_admin', mobile: '+91 99999 99999', address: '123 Tech Park, Bangalore', company: 'ManveTech', license: 'SOS-NORTH-9982', screens: 3, status: 'Active' },
    { name: 'Kevin Durant', email: 'kevin@demo.com', role: 'org_admin', mobile: '+1 555-0199', address: '789 Broad St, NY', company: 'KD Enterprises', license: 'SOS-EAST-1142', screens: 5, status: 'Active' },
    { name: 'System Admin', email: 'admin@demo.com', role: 'Administrator', mobile: '+91 88888 88888', address: 'Office 402, Mumbai', company: 'SignageOS HQ', license: 'SOS-HQ-0001', screens: 12, status: 'Active' }
  ]);

  const [availableLicenses, setAvailableLicenses] = useState([
    { id: 'SOS-NORTH-9982', name: 'North Lobby Premium', deviceLimit: 10, tenure: 'Annual', expiryDate: '2027-06-30', price: 12000, assignedUserEmail: 'priya@demo.com', assignedOrgName: 'ManveTech', storageLimit: 20, status: 'active' },
    { id: 'SOS-CAF-4482', name: 'Cafeteria Standard', deviceLimit: 5, tenure: 'Monthly', expiryDate: '2026-07-15', price: 1000, assignedUserEmail: '', assignedOrgName: '', storageLimit: 5, status: 'active' },
    { id: 'SOS-EAST-1142', name: 'East Wing Standard', deviceLimit: 5, tenure: 'Annual', expiryDate: '2027-02-28', price: 8000, assignedUserEmail: 'kevin@demo.com', assignedOrgName: 'KD Enterprises', storageLimit: 10, status: 'active' },
    { id: 'SOS-WEST-7761', name: 'West Gate Promo', deviceLimit: 2, tenure: 'Trial', expiryDate: '2026-08-01', price: 0, assignedUserEmail: '', assignedOrgName: '', storageLimit: 2, status: 'active' },
  ]);

  const [mobTransactions, setMobTransactions] = useState([
    { id: 'TXN-9840192', licenseId: 'SOS-NORTH-9982', licenseName: 'North Lobby Premium', clientName: 'ManveTech', clientEmail: 'priya@demo.com', amount: 14160, paymentDate: '2026-06-01', status: 'success', razorpayPaymentId: 'pay_Pz9201a093', razorpayOrderId: 'order_Oz92019482' },
    { id: 'TXN-7391038', licenseId: 'SOS-EAST-1142', licenseName: 'East Wing Standard', clientName: 'KD Enterprises', clientEmail: 'kevin@demo.com', amount: 9440, paymentDate: '2026-05-15', status: 'success', razorpayPaymentId: 'pay_Kz8201a829', razorpayOrderId: 'order_Kz82019381' }
  ]);

  const [mobInvoices, setMobInvoices] = useState([
    { id: 'INV-4019', licenseId: 'SOS-NORTH-9982', licenseName: 'North Lobby Premium', clientName: 'ManveTech', clientEmail: 'priya@demo.com', amount: 14160, dueDate: '2026-07-30', status: 'paid', issuedDate: '2026-06-01' },
    { id: 'INV-1930', licenseId: 'SOS-EAST-1142', licenseName: 'East Wing Standard', clientName: 'KD Enterprises', clientEmail: 'kevin@demo.com', amount: 9440, dueDate: '2026-06-15', status: 'paid', issuedDate: '2026-05-15' },
    { id: 'INV-7731', licenseId: 'SOS-WEST-7761', licenseName: 'West Gate Promo', clientName: 'Indiv Client', clientEmail: 'billing@client.com', amount: 0, dueDate: '2026-08-01', status: 'unpaid', issuedDate: '2026-06-20' }
  ]);

  const [mobOrgs, setMobOrgs] = useState([
    { id: 'ORG-1', name: 'ManveTech', adminName: 'Priya Reddy', email: 'priya@demo.com', planType: 'Enterprise', screensAllowed: 20, storageLimit: 50, subscriptionStatus: 'active' as const, renewalDate: '2027-06-30' },
    { id: 'ORG-2', name: 'KD Enterprises', adminName: 'Kevin Durant', email: 'kevin@demo.com', planType: 'Business', screensAllowed: 10, storageLimit: 25, subscriptionStatus: 'active' as const, renewalDate: '2027-02-28' }
  ]);

  const [mobTickets, setMobTickets] = useState([
    { id: 'TCK-4819', subject: 'Display HDMI flickering on Samsung Tizen', description: 'After playing video content, screen flashes black every few minutes.', severity: 'Medium', status: 'In Progress', createdDate: '2026-06-20' },
    { id: 'TCK-2291', subject: 'Billing subscription invoice double charge', description: 'My card was charged twice for SOS-NORTH-9982 license key renewal.', severity: 'High', status: 'Resolved', createdDate: '2026-06-15' }
  ]);

  const [mobFaqs, setMobFaqs] = useState([
    { id: 'FAQ-1', question: 'How do I pair a new screen?', answer: "Go to the Screens tab, click '+' or 'Register', and enter the 6-digit pairing code shown on your TV screen." },
    { id: 'FAQ-2', question: 'Why is my screen status Offline?', answer: "Make sure the player device is powered on, connected to the internet, and the SignageOS player app is active." },
    { id: 'FAQ-3', question: 'How do I update screen content?', answer: "Assign a playlist to the screen or group from the Playlists tab, then click Publish/Sync to push updates." },
    { id: 'FAQ-4', question: 'What media formats are supported?', answer: "We support standard images (JPG, PNG), video formats (MP4, WebM), and custom layout templates." }
  ]);

  const [mobDocs, setMobDocs] = useState([
    { id: 'DOC-1', title: 'Setting Up Dual HDMI Displays', category: 'Screens', content: 'Draft the helper documentation article detailing setup procedures...', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', createdDate: '2026-06-18' },
    { id: 'DOC-2', title: 'LG webOS Signage Configuration', category: 'Screens', content: 'Step-by-step display setup checklist and webOS package install instructions...', youtubeUrl: '', createdDate: '2026-06-19' }
  ]);

  function createLiveSetter<T>(
    oldList: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    collectionPath: string
  ) {
    return async (newVal: React.SetStateAction<T[]>) => {
      const resolvedList = typeof newVal === 'function' ? (newVal as Function)(oldList) : newVal;
      setter(resolvedList);

      try {
        // 1. Detect deletes
        for (const oldItem of oldList) {
          const oldId = (oldItem as any).id || (oldItem as any).email;
          if (!resolvedList.some((item: any) => (item.id || item.email) === oldId)) {
            await pushToDatabase(collectionPath, oldId, null, 'DELETE');
          }
        }
        // 2. Detect adds and updates
        for (const item of resolvedList) {
          const itemId = (item as any).id || (item as any).email;
          const oldItem = oldList.find((o: any) => (o.id || o.email) === itemId);
          if (!oldItem) {
            await pushToDatabase(collectionPath, itemId, item, 'POST');
          } else if (JSON.stringify(oldItem) !== JSON.stringify(item)) {
            await pushToDatabase(collectionPath, itemId, item, 'PUT');
          }
        }
      } catch (err) {
        console.error(`Sync error on collection ${collectionPath}:`, err);
      }
    };
  }

  const liveScreensSetter = createLiveSetter(screensList, setScreensList, 'screens');
  const liveGroupsSetter = createLiveSetter(groupsList, setGroupsList, 'screen_groups');
  const livePlaylistsSetter = createLiveSetter(playlistsList, setPlaylistsList, 'playlists');
  const liveMediaSetter = createLiveSetter(mediaList, setMediaList, 'media_items');
  const liveUsersSetter = createLiveSetter(settingsUsers, setSettingsUsers, 'users');
  const liveLicensesSetter = createLiveSetter(availableLicenses, setAvailableLicenses, 'licenses');
  const liveTransactionsSetter = createLiveSetter(mobTransactions, setMobTransactions, 'payments');
  const liveInvoicesSetter = createLiveSetter(mobInvoices, setMobInvoices, 'invoices');
  const liveOrgsSetter = createLiveSetter(mobOrgs, setMobOrgs, 'organizations');
  const liveTicketsSetter = createLiveSetter(mobTickets, setMobTickets, 'tickets');
  const liveFaqsSetter = createLiveSetter(mobFaqs, setMobFaqs, 'faqs');
  const liveDocsSetter = createLiveSetter(mobDocs, setMobDocs, 'support_docs');

  // Splash Screen timer simulation
  useEffect(() => {
    if (screen === 'splash') {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 30,
          useNativeDriver: true,
        }),
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
      ]).start();

      const timer = setTimeout(async () => {
        try {
          const token = await AsyncStorage.getItem('signageos_token');
          const storedEmail = await AsyncStorage.getItem('signageos_user_email');
          const storedRole = await AsyncStorage.getItem('signageos_user_role');
          const storedName = await AsyncStorage.getItem('signageos_user_name');
          
          if (token && storedEmail && storedRole) {
            setProfileName(storedName || (storedRole === 'admin' ? 'Super Admin' : 'Client User'));
            setProfileEmail(storedEmail);
            setScreen(storedRole === 'admin' ? 'admin' : 'user');
            setActiveTab('dashboard');
            
            // Sync database cache to AsyncStorage and state
            const dbData = await syncAllFromDatabase();
            loadSyncedData(dbData);
          } else {
            setScreen('login');
          }
        } catch (err) {
          console.error('Error auto-logging in:', err);
          setScreen('login');
        }
      }, 2300);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  const loadSyncedData = (dbData: Record<string, any[]>) => {
    if (dbData.signageos_screens) setScreensList(dbData.signageos_screens);
    if (dbData.signageos_groups) setGroupsList(dbData.signageos_groups);
    if (dbData.signageos_playlists) setPlaylistsList(dbData.signageos_playlists);
    if (dbData.signageos_media) setMediaList(dbData.signageos_media);
    if (dbData.signageos_users) setSettingsUsers(dbData.signageos_users);
    if (dbData.signageos_licenses) setAvailableLicenses(dbData.signageos_licenses);
    if (dbData.signageos_payments) setMobTransactions(dbData.signageos_payments);
    if (dbData.signageos_invoices) setMobInvoices(dbData.signageos_invoices);
    if (dbData.signageos_tickets) setMobTickets(dbData.signageos_tickets);
    if (dbData.signageos_faqs) setMobFaqs(dbData.signageos_faqs);
    if (dbData.signageos_docs) setMobDocs(dbData.signageos_docs);
    if (dbData.signageos_organizations) setMobOrgs(dbData.signageos_organizations);
  };

  // Login handler
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    const lowerUser = username.toLowerCase().trim();

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lowerUser, password })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          await AsyncStorage.setItem('signageos_token', data.token);
          await AsyncStorage.setItem('signageos_user_id', data.user.id);
          await AsyncStorage.setItem('signageos_user_email', data.user.email);
          const role = data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'user';
          await AsyncStorage.setItem('signageos_user_role', role);
          const name = data.user.name || (role === 'admin' ? 'Super Admin' : 'Client User');
          await AsyncStorage.setItem('signageos_user_name', name);

          setProfileName(name);
          setProfileEmail(data.user.email);
          setScreen(role);
          setActiveTab('dashboard');

          // Sync database cache to AsyncStorage and state
          const dbData = await syncAllFromDatabase();
          loadSyncedData(dbData);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Invalid credentials.');
      }
    } catch (err) {
      console.warn('Network error logging in, attempting offline simulation...', err);
      // Offline simulation fallback
      const lowerPass = password.toLowerCase();
      if (lowerUser === 'admin' && lowerPass === 'admin') {
        const mockToken = 'offline_admin_token';
        await AsyncStorage.setItem('signageos_token', mockToken);
        await AsyncStorage.setItem('signageos_user_id', 'admin_sys_usr');
        await AsyncStorage.setItem('signageos_user_email', 'admin@demo.com');
        await AsyncStorage.setItem('signageos_user_role', 'admin');
        await AsyncStorage.setItem('signageos_user_name', 'Super Admin');
        
        setProfileName('Super Admin');
        setProfileEmail('admin@demo.com');
        setScreen('admin');
        setActiveTab('dashboard');
      } else if ((lowerUser === 'user' || lowerUser === 'priya@demo.com') && lowerPass === 'user') {
        const mockToken = 'offline_user_token';
        await AsyncStorage.setItem('signageos_token', mockToken);
        await AsyncStorage.setItem('signageos_user_id', 'user_usr');
        await AsyncStorage.setItem('signageos_user_email', 'priya@demo.com');
        await AsyncStorage.setItem('signageos_user_role', 'user');
        await AsyncStorage.setItem('signageos_user_name', 'Priya Reddy');
        
        setProfileName('Priya Reddy');
        setProfileEmail('priya@demo.com');
        setScreen('user');
        setActiveTab('dashboard');
      } else {
        setError('Network offline. Use admin/admin or user/user simulated logins.');
      }
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('signageos_token');
    await AsyncStorage.removeItem('signageos_user_id');
    await AsyncStorage.removeItem('signageos_user_email');
    await AsyncStorage.removeItem('signageos_user_role');
    await AsyncStorage.removeItem('signageos_user_name');
    setScreen('login');
    setUsername('');
    setPassword('');
  };

  // Splash Screen Render
  if (screen === 'splash') {
    return (
      <View style={styles.splashContainer}>
        <Animated.View style={[styles.splashContent, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoWrapper}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400' }} 
              style={styles.splashLogo} 
              contentFit="cover"
            />
          </View>
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <ThemedText style={styles.splashTitle}>SignageOS</ThemedText>
            <ThemedText style={styles.splashSubtitle}>Enterprise CMS Console</ThemedText>
          </View>
        </Animated.View>
        <View style={styles.splashFooter}>
          <View style={styles.loaderLine}>
            <Animated.View 
              style={[
                styles.loaderProgress, 
                { 
                  width: progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  })
                }
              ]} 
            />
          </View>
        </View>
      </View>
    );
  }

  // Login View Render
  if (screen === 'login') {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9f9ff' }}>
        <ScrollView 
          contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.loginHeader}>
              <View style={styles.loginLogoWrapper}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400' }} 
                  style={styles.loginLogo} 
                  contentFit="cover"
                />
              </View>
              <ThemedText style={styles.loginTitle}>Welcome Back</ThemedText>
              <ThemedText style={styles.loginSubtitle}>Sign in to your signage terminal</ThemedText>
            </View>

            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Console Username</ThemedText>
              <TextInput
                placeholder="Enter username"
                placeholderTextColor="#8F9BB3"
                autoCapitalize="none"
                style={[styles.input, { color: '#181c23', borderColor: '#E2E8F0' }]}
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Console Password</ThemedText>
              <TextInput
                placeholder="Enter password"
                placeholderTextColor="#8F9BB3"
                secureTextEntry={true}
                autoCapitalize="none"
                style={[styles.input, { color: '#181c23', borderColor: '#E2E8F0' }]}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.forgotPasswordContainer} 
                onPress={() => Alert.alert('Reset Password', 'A password reset link has been sent to your registered email.')}
              >
                <ThemedText style={styles.forgotPasswordText}>Forgot Password?</ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <ThemedText style={styles.loginButtonText}>Sign In</ThemedText>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <ThemedText style={styles.dividerText}>or sign in with</ThemedText>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.googleButton} 
              onPress={() => {
                setProfileName('Priya Reddy');
                setProfileEmail('priya@demo.com');
                setProfilePhone('+91 99999 99999');
                setScreen('user');
                setActiveTab('dashboard');
                Alert.alert('Google Sign-In', 'Logged in successfully as Priya Reddy (priya@demo.com).');
              }}
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }} 
                style={styles.googleIcon} 
              />
              <ThemedText style={styles.googleButtonText}>Sign in with Google</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Admin & User View Render
  if (screen === 'admin' || screen === 'user') {
    const isAdmin = screen === 'admin';
    return (
      <View style={{ flex: 1, backgroundColor: '#f9f9ff' }}>
        {/* Floating Header */}
        <View style={[styles.headerContainer, { top: insets.top + 6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image 
              source={{ uri: isAdmin ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }} 
              style={styles.adminAvatar} 
            />
            <View>
              <ThemedText style={{ color: '#181c23', fontSize: 18, fontWeight: '900' }}>
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'screens' && 'Screens'}
                {activeTab === 'playlists' && 'Playlists'}
                {activeTab === 'settings' && 'Settings'}
              </ThemedText>
            </View>
          </View>

          {/* Right-aligned Actions Pill Container */}
          <View style={styles.headerActionsPill}>
            <TouchableOpacity onPress={() => alert('Notifications: 0 New Alerts')}>
              <NotificationBing size={18} color="#717786" variant="Linear" />
            </TouchableOpacity>
            <View style={{ width: 1, height: 16, backgroundColor: '#e2e8f0' }} />
            <TouchableOpacity onPress={() => setIsHeaderMenuOpen(true)}>
              <Category size={18} color="#717786" variant="Linear" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdown Menu Modal */}
        <Modal
          visible={isHeaderMenuOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsHeaderMenuOpen(false)}
        >
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.02)' }} 
            activeOpacity={1} 
            onPress={() => setIsHeaderMenuOpen(false)}
          >
            <View style={[styles.dropdownOverlayMenu, { top: insets.top + 68 + 10 }]}>
              <TouchableOpacity 
                style={styles.dropdownMenuItem}
                onPress={() => {
                  setIsHeaderMenuOpen(false);
                  handleLogout();
                }}
              >
                <Trash size={16} color="#ba1a1a" />
                <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: '#ba1a1a' }}>Log Out</ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Tab Subviews Content */}
        <ScrollView 
          style={styles.scrollViewContainer} 
          contentContainerStyle={{ 
            paddingTop: insets.top + 68 + 12, 
            paddingBottom: insets.bottom + 68 + 16, 
            paddingHorizontal: 20 
          }}
        >
          {activeTab === 'dashboard' && (
            <DashboardTab opMode={opMode} setOpMode={setOpMode} isAdmin={isAdmin} />
          )}

          {activeTab === 'screens' && (
            <ScreensTab
              opMode={opMode}
              screensList={screensList}
              setScreensList={liveScreensSetter}
              groupsList={groupsList}
              setGroupsList={liveGroupsSetter}
              playlistsList={playlistsList}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'playlists' && (
            <PlaylistsTab
              playlistsList={playlistsList}
              setPlaylistsList={livePlaylistsSetter}
              mediaList={mediaList}
              setMediaList={liveMediaSetter}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              screen={screen}
              settingsUsers={settingsUsers}
              setSettingsUsers={liveUsersSetter}
              availableLicenses={availableLicenses}
              setAvailableLicenses={liveLicensesSetter}
              mobTransactions={mobTransactions}
              setMobTransactions={liveTransactionsSetter}
              mobInvoices={mobInvoices}
              setMobInvoices={liveInvoicesSetter}
              mobOrgs={mobOrgs}
              setMobOrgs={liveOrgsSetter}
              mobTickets={mobTickets}
              setMobTickets={liveTicketsSetter}
              mobFaqs={mobFaqs}
              setMobFaqs={liveFaqsSetter}
              mobDocs={mobDocs}
              setMobDocs={liveDocsSetter}
              profileName={profileName}
              setProfileName={setProfileName}
              profileEmail={profileEmail}
              setProfileEmail={setProfileEmail}
              profilePhone={profilePhone}
              setProfilePhone={setProfilePhone}
              rzpKeyId={rzpKeyId}
              setRzpKeyId={setRzpKeyId}
              rzpKeySecret={rzpKeySecret}
              setRzpKeySecret={setRzpKeySecret}
              isAdmin={isAdmin}
            />
          )}
        </ScrollView>

        {/* BOTTOM NAVIGATION DOCK (Glassmorphic Floating Dock) */}
        <View 
          style={[styles.bottomNavigationDock, { bottom: insets.bottom + 8 }]} 
          onLayout={(e) => setDockWidth(e.nativeEvent.layout.width)}
        >
          <TouchableOpacity
            style={styles.dockItem}
            onPress={() => setActiveTab('dashboard')}
          >
            <Category size={20} color={activeTab === 'dashboard' ? '#7c3aed' : '#8F9BB3'} variant={activeTab === 'dashboard' ? 'Bold' : 'Linear'} />
            <ThemedText style={[styles.dockLabel, activeTab === 'dashboard' && { color: '#7c3aed' }]}>Dashboard</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockItem}
            onPress={() => setActiveTab('screens')}
          >
            <Monitor size={20} color={activeTab === 'screens' ? '#7c3aed' : '#8F9BB3'} variant={activeTab === 'screens' ? 'Bold' : 'Linear'} />
            <ThemedText style={[styles.dockLabel, activeTab === 'screens' && { color: '#7c3aed' }]}>Screens</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockItem}
            onPress={() => setActiveTab('playlists')}
          >
            <DocumentText size={20} color={activeTab === 'playlists' ? '#7c3aed' : '#8F9BB3'} variant={activeTab === 'playlists' ? 'Bold' : 'Linear'} />
            <ThemedText style={[styles.dockLabel, activeTab === 'playlists' && { color: '#7c3aed' }]}>Playlists</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockItem}
            onPress={() => setActiveTab('settings')}
          >
            <Setting2 size={20} color={activeTab === 'settings' ? '#7c3aed' : '#8F9BB3'} variant={activeTab === 'settings' ? 'Bold' : 'Linear'} />
            <ThemedText style={[styles.dockLabel, activeTab === 'settings' && { color: '#7c3aed' }]}>Settings</ThemedText>
          </TouchableOpacity>

          {dockWidth > 0 && (
            <Animated.View
              style={[
                styles.dockIndicator,
                {
                  width: (dockWidth / 4) - 16,
                  height: 52,
                  borderRadius: 26,
                  transform: [
                    {
                      translateX: tabX.interpolate({
                        inputRange: [0, 1, 2, 3],
                        outputRange: [
                          8,
                          8 + (dockWidth / 4),
                          8 + (dockWidth / 4) * 2,
                          8 + (dockWidth / 4) * 3,
                        ],
                      }),
                    },
                    { scale: indicatorScale },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            />
          )}
        </View>
      </View>
    );
  }

  return null;
}

export default function MainApp() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#f9f9ff' }}>
      <StatusBar style="dark" translucent={true} backgroundColor="transparent" />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9ff',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    backgroundColor: '#ffffff',
    marginBottom: 24,
  },
  splashLogo: {
    width: '100%',
    height: '100%',
  },
  splashTitle: {
    color: '#181c23',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  splashSubtitle: {
    color: '#8F9BB3',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  splashFooter: {
    position: 'absolute',
    bottom: 80,
    width: '60%',
  },
  loaderLine: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loaderProgress: {
    height: '100%',
    width: '100%',
    backgroundColor: '#7c3aed',
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  loginLogoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#7c3aed',
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  loginLogo: {
    width: '100%',
    height: '100%',
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#8F9BB3',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    color: '#8F9BB3',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#7c3aed',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    color: '#8F9BB3',
    paddingHorizontal: 12,
    textTransform: 'lowercase',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    color: '#181c23',
    fontSize: 15,
    fontWeight: '600',
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  headerContainer: {
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    height: 68,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(113, 119, 134, 0.3)',
  },
  headerActionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  dropdownOverlayMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 92 : 64,
    right: 32,
    width: 180,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    backgroundColor: '#fff5f5'
  },
  scrollViewContainer: {
    flex: 1,
    marginTop: 0,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f9f9ff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
  welcomeBanner: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  welcomeTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 8,
  },
  welcomeText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#ffffff',
  },
  playerInfo: {
    flex: 1,
  },
  playerStatusText: {
    fontSize: 12,
    color: '#8F9BB3',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F4F6F9',
  },
  statusBadgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusBadgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeTextGreen: {
    color: '#10B981',
  },
  badgeTextRed: {
    color: '#EF4444',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 16,
    color: '#8F9BB3',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bottomNavigationDock: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    height: 68,
    flexDirection: 'row',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  dockIndicator: {
    position: 'absolute',
    top: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  dockLabel: {
    fontSize: 10,
    color: '#8F9BB3',
    marginTop: 3,
    fontWeight: 'bold',
  },
});
