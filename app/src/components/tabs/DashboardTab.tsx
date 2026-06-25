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
} from 'iconsax-react-native';

export type DashboardTabProps = {
  opMode: boolean;
  setOpMode: (val: boolean) => void;
  isAdmin?: boolean;
};

export function DashboardTab({ opMode, setOpMode, isAdmin = true }: DashboardTabProps) {
  const kpis = isAdmin 
    ? [
        { val: '248', label: 'Total Screens', trend: '+2', trendType: 'up', icon: Category, color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.05)' },
        { val: '6', label: 'My Screens', trend: '+5', trendType: 'up', icon: Monitor, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.05)' },
        { val: '201', label: 'Online', trend: '-3', trendType: 'down', icon: TickCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },
        { val: '31', label: 'Offline', trend: '+64', trendType: 'up', icon: Wifi, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)' },
        { val: '1,842', label: 'Total Media', trend: '+8', trendType: 'up', icon: FolderOpen, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },
        { val: '74', label: 'Active Playlists', trend: '+20', trendType: 'up', icon: DocumentText, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' },
        { val: '312', label: 'Total Licenses', trend: '+3', trendType: 'up', icon: Wallet, color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.05)' },
        { val: '7', label: 'Expiring Licenses', trend: null, trendType: null, icon: Calendar, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.05)' }
      ]
    : [
        { val: '6', label: 'My Screens', trend: null, trendType: null, icon: Monitor, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.05)' },
        { val: '5', label: 'Online', trend: null, trendType: null, icon: TickCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },
        { val: '24', label: 'Total Media', trend: '+2', trendType: 'up', icon: FolderOpen, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },
        { val: '3', label: 'Active Playlists', trend: null, trendType: null, icon: DocumentText, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' }
      ];

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

      {/* 8 KPI Grid Cards */}
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
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.01,
                shadowRadius: 6,
                elevation: 1,
                justifyContent: 'space-between',
                minHeight: 112,
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: card.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <IconComponent size={18} color={card.color} variant="Bulk" />
                </View>
                {card.trend && (
                  <View style={{
                    backgroundColor: card.trendType === 'down' ? '#fce8e6' : '#e6f4ea',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 12,
                  }}>
                    <ThemedText style={{
                      fontSize: 9,
                      fontWeight: 'bold',
                      color: card.trendType === 'down' ? '#c5221f' : '#137333',
                    }}>
                      {card.trend}
                    </ThemedText>
                  </View>
                )}
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
        <ThemedText type="smallBold" style={{ fontSize: 13, color: '#717786', letterSpacing: 0.8, fontWeight: '800' }}>RECENT ACTIVITY</ThemedText>
        <TouchableOpacity><ThemedText style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: 12 }}>View All</ThemedText></TouchableOpacity>
      </View>
      
      <View style={styles.activityFeedContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3fe' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <TickCircle size={18} color="#10b981" variant="Bold" />
          </View>
          <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
            <ThemedText style={{ fontSize: 13, color: '#181c23', lineHeight: 18 }}>Screen <Text style={{ fontWeight: 'bold', color: '#181c23' }}>Lobby 01</Text> reported active</ThemedText>
            <ThemedText style={{ fontSize: 10, color: '#717786', fontWeight: 'bold' }}>2 mins ago</ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3fe' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(124, 58, 237, 0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <DocumentUpload size={18} color="#7c3aed" variant="Bold" />
          </View>
          <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
            <ThemedText style={{ fontSize: 13, color: '#181c23', lineHeight: 18 }}>Uploaded media <Text style={{ fontWeight: 'bold', color: '#181c23' }}>cafeteria_lunch.png</Text></ThemedText>
            <ThemedText style={{ fontSize: 10, color: '#717786', fontWeight: 'bold' }}>1 hour ago</ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <Key size={18} color="#ef4444" variant="Bold" />
          </View>
          <View style={{ flex: 1, marginLeft: 12, gap: 2 }}>
            <ThemedText style={{ fontSize: 13, color: '#181c23', lineHeight: 18 }}><Text style={{ fontWeight: 'bold', color: '#181c23' }}>SOS-CAF</Text> license key synced</ThemedText>
            <ThemedText style={{ fontSize: 10, color: '#717786', fontWeight: 'bold' }}>12 hours ago</ThemedText>
          </View>
        </View>
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
    marginBottom: 12,
  },
  opModeDesc: {
    fontSize: 12,
    color: '#717786',
    marginTop: 4,
    lineHeight: 16,
  },
  activityFeedContainer: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e2ed',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
});
