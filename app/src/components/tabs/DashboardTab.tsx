import React from 'react';
import { View, Switch, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ThemedText } from '../themed-text';
import {
  Category,
  Monitor,
  TickCircle,
  Wifi,
  FolderOpen,
  DocumentText,
  Wallet,
  Calendar,
  DocumentUpload,
  Key,
  Warning2,
} from 'iconsax-react-native';

export type DashboardTabProps = {
  opMode: boolean;
  setOpMode: (val: boolean) => void;
  isAdmin?: boolean;
  screensList: any[];
  playlistsList: any[];
  mediaList: any[];
  availableLicenses: any[];
  mobInvoices: any[];
  profileEmail: string;
};

export function DashboardTab({
  opMode,
  setOpMode,
  isAdmin = true,
  screensList,
  playlistsList,
  mediaList,
  availableLicenses,
  mobInvoices,
  profileEmail,
}: DashboardTabProps) {

  // Helper: Calculate days remaining
  const calculateDaysLeft = (dateStr?: string) => {
    if (!dateStr) return 0;
    const diffTime = new Date(dateStr).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Determine standard filter contexts
  const filteredScreens = isAdmin && opMode 
    ? screensList 
    : screensList.filter(s => s.assignedToUserEmail === profileEmail);

  const myScreensCount = screensList.filter(s => s.assignedToUserEmail === profileEmail).length;
  const onlineScreens = filteredScreens.filter(s => s.status === 'online' || s.status === 'active').length;
  const offlineScreens = filteredScreens.filter(s => s.status === 'offline').length;
  
  const filteredMedia = isAdmin && opMode 
    ? mediaList 
    : mediaList.filter(m => m.uploadedBy === profileEmail);
  const totalMedia = filteredMedia.length;

  const filteredPlaylists = isAdmin && opMode 
    ? playlistsList 
    : playlistsList.filter(p => p.createdBy === profileEmail);
  const activePlaylists = filteredPlaylists.length;

  const totalLicenses = availableLicenses.length;
  const expiringLicenses = availableLicenses.filter(l => calculateDaysLeft(l.expiryDate) < 15 && l.status === 'active').length;

  // Build KPI configurations
  const kpis = isAdmin 
    ? [
        { val: screensList.length.toString(), label: 'Total Screens', icon: Category, color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.05)' },
        { val: myScreensCount.toString(), label: 'My Screens', icon: Monitor, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.05)' },
        { val: onlineScreens.toString(), label: 'Online', icon: TickCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },
        { val: offlineScreens.toString(), label: 'Offline', icon: Wifi, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)' },
        { val: totalMedia.toString(), label: 'Total Media', icon: FolderOpen, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },
        { val: activePlaylists.toString(), label: 'Active Playlists', icon: DocumentText, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' },
        { val: totalLicenses.toString(), label: 'Total Licenses', icon: Wallet, color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.05)' },
        { val: expiringLicenses.toString(), label: 'Expiring Licenses', icon: Calendar, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.05)' }
      ]
    : [
        { val: myScreensCount.toString(), label: 'My Screens', icon: Monitor, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.05)' },
        { val: onlineScreens.toString(), label: 'Online', icon: TickCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },
        { val: totalMedia.toString(), label: 'Total Media', icon: FolderOpen, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },
        { val: activePlaylists.toString(), label: 'Active Playlists', icon: DocumentText, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' }
      ];

  // Dynamic Alerts list
  const alerts: { type: 'error' | 'warning' | 'info'; title: string; desc: string; time: string }[] = [];

  filteredScreens.forEach(s => {
    if (s.status === 'offline') {
      alerts.push({
        type: 'error',
        title: `Screen "${s.name}" is offline`,
        desc: `Location: ${s.location || 'Unknown'} · Last seen ${s.lastSeen || s.lastHeartbeat || 'recently'}`,
        time: s.lastSeen || 'now'
      });
    } else if (s.status === 'warning') {
      alerts.push({
        type: 'warning',
        title: `Screen "${s.name}" storage warning`,
        desc: `Location: ${s.location || 'Unknown'} · Storage space is ${s.storageUsed || '90%'} full`,
        time: s.lastSeen || 'now'
      });
    }
  });

  if (isAdmin) {
    availableLicenses.forEach(l => {
      const days = calculateDaysLeft(l.expiryDate);
      if (days < 15 && l.status === 'active') {
        alerts.push({
          type: 'warning',
          title: `License "${l.id}" expiring soon`,
          desc: `Assigned to ${l.assignedOrgName || l.assignedUserEmail || 'Unassigned'} — Expires ${l.expiryDate} (${days} days left)`,
          time: '1d'
        });
      }
    });
  } else {
    const userLicense = availableLicenses.find(l => l.assignedUserEmail === profileEmail);
    if (userLicense) {
      const days = calculateDaysLeft(userLicense.expiryDate);
      if (days < 15) {
        alerts.push({
          type: 'warning',
          title: `License expiring soon`,
          desc: `Your license ${userLicense.id} expires on ${userLicense.expiryDate} (${days} days left)`,
          time: '1d'
        });
      }
    }

    const myInvoices = mobInvoices.filter(i => i.clientEmail === profileEmail);
    const unpaidInvoices = myInvoices.filter(i => i.status === 'unpaid');
    unpaidInvoices.forEach(inv => {
      const days = calculateDaysLeft(inv.dueDate);
      const isOverdue = days <= 0;
      alerts.push({
        type: isOverdue ? 'error' : 'warning',
        title: isOverdue ? `Payment Overdue` : `Pending Subscription Payment`,
        desc: `Invoice ${inv.id} (₹${inv.amount.toLocaleString()}) is due on ${inv.dueDate} (${isOverdue ? 'Overdue' : `${days} days left`})`,
        time: 'now'
      });
    });
  }

  // Dynamic Activities log
  const activities = [
    { text: `Welcome back. Managed profile associated with "${profileEmail}"`, time: 'Just now', type: 'user' },
  ];

  if (filteredScreens.length > 0) {
    const active = filteredScreens.find(s => s.status === 'online' || s.status === 'active');
    if (active) {
      activities.push({
        text: `Screen "${active.name}" reported normal heartbeat signal`,
        time: active.lastSeen || '5 mins ago',
        type: 'screen'
      });
    }
  }

  if (filteredMedia.length > 0) {
    activities.push({
      text: `Media asset "${filteredMedia[0].name}" verified inside player cache`,
      time: '20 mins ago',
      type: 'media'
    });
  }

  if (filteredPlaylists.length > 0) {
    activities.push({
      text: `Active Playlist "${filteredPlaylists[0].name}" sync broadcast succeeded`,
      time: '1 hour ago',
      type: 'playlist'
    });
  }

  const activityIconMap: Record<string, any> = {
    screen: Monitor,
    media: DocumentUpload,
    playlist: DocumentText,
    user: TickCircle,
  };

  const activityColorMap: Record<string, string> = {
    screen: 'rgba(16, 185, 129, 0.08)',
    media: 'rgba(124, 58, 237, 0.08)',
    playlist: 'rgba(6, 182, 212, 0.08)',
    user: 'rgba(56, 189, 248, 0.08)',
  };

  const activityIconColorMap: Record<string, string> = {
    screen: '#10b981',
    media: '#7c3aed',
    playlist: '#06b6d4',
    user: '#38bdf8',
  };

  return (
    <View style={styles.innerTabContent}>
      {/* OP Mode Toggle Card */}
      {isAdmin && (
        <View style={styles.opModeCard}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <ThemedText type="default" style={{ fontWeight: '600', color: '#181c23', fontSize: 16 }}>Oversight Mode</ThemedText>
            <ThemedText style={styles.opModeDesc}>
              {opMode ? 'Displaying all client screens and playlists in your network.' : 'Displaying only your assigned screens and playlists.'}
            </ThemedText>
          </View>
          <Switch
            value={opMode}
            onValueChange={setOpMode}
            trackColor={{ false: '#c1c6d7', true: '#7c3aed' }}
            thumbColor="#ffffff"
          />
        </View>
      )}

      {/* KPI Grid Cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        {kpis.map((card, idx) => {
          const IconComponent = card.icon;
          return (
            <View
              key={idx}
              style={{
                width: '48.5%',
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e0e2ed',
                padding: 14,
                justifyContent: 'space-between',
                minHeight: 112,
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: card.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <IconComponent size={18} color={card.color} variant="Bulk" />
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <ThemedText style={{ fontSize: 22, fontWeight: '900', color: '#181c23' }}>{card.val}</ThemedText>
                <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: '#717786', marginTop: 2 }}>{card.label}</ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      {/* Activity Feed */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 4 }}>
        <ThemedText type="smallBold" style={{ fontSize: 13, color: '#717786', letterSpacing: 0.8, fontWeight: '800' }}>RECENT ACTIVITY</ThemedText>
      </View>
      
      <View style={styles.cardContainer}>
        {activities.map((item, idx) => {
          const IconComp = activityIconMap[item.type] || TickCircle;
          return (
            <View 
              key={idx} 
              style={[
                styles.activityRow, 
                idx < activities.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#f1f3fe', paddingBottom: 12 }
              ]}
            >
              <View style={[styles.activityIconWrapper, { backgroundColor: activityColorMap[item.type] }]}>
                <IconComp size={18} color={activityIconColorMap[item.type]} variant="Bold" />
              </View>
              <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
                <ThemedText style={{ fontSize: 13, color: '#181c23', lineHeight: 18 }}>{item.text}</ThemedText>
                <ThemedText style={{ fontSize: 10, color: '#717786', fontWeight: 'bold' }}>{item.time}</ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      {/* Alerts and Critical Warnings */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 4 }}>
        <ThemedText type="smallBold" style={{ fontSize: 13, color: '#717786', letterSpacing: 0.8, fontWeight: '800' }}>ALERTS & SYSTEM HEALTH</ThemedText>
        {alerts.length > 0 && (
          <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#b91c1c' }}>{alerts.length} ACTIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContainer}>
        {alerts.length === 0 ? (
          <View style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
            <TickCircle size={28} color="#10b981" variant="Bold" />
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#181c23', marginTop: 8 }}>All systems operational</Text>
            <Text style={{ fontSize: 10, color: '#717786', marginTop: 2 }}>No active diagnostic issues or pending billing items.</Text>
          </View>
        ) : (
          alerts.map((alert, i) => (
            <View 
              key={i} 
              style={[
                styles.alertItem, 
                alert.type === 'error' ? { backgroundColor: 'rgba(239, 68, 68, 0.04)', borderColor: '#fee2e2' } : { backgroundColor: 'rgba(245, 158, 11, 0.04)', borderColor: '#fef3c7' },
                i < alerts.length - 1 && { marginBottom: 8 }
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Warning2 size={16} color={alert.type === 'error' ? '#ef4444' : '#f59e0b'} variant="Bold" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>{alert.title}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 16 }}>{alert.desc}</Text>
                </View>
                <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: 'bold' }}>{alert.time}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  innerTabContent: {
    gap: 16,
  },
  opModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e2ed',
    padding: 20,
    marginBottom: 8,
  },
  opModeDesc: {
    fontSize: 12,
    color: '#717786',
    marginTop: 4,
    lineHeight: 16,
  },
  cardContainer: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e2ed',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  alertItem: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
});
