import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Alert,
  Text,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '../themed-text';
import {
  ProfileCircle,
  Wallet,
  CardReceive,
  Building,
  InfoCircle,
  Key,
  Add,
  Trash,
  Edit2,
  TickSquare,
  Call,
  Sms,
  Location,
  Eye,
  Clock,
  Link,
  TickCircle,
  ShieldCross,
  Notification,
  Global,
  Colorfilter,
  MessageQuestion,
  NoteAdd,
  ArrowRight,
  ShieldSecurity,
  DirectInbox,
  Filter
} from 'iconsax-react-native';

export type SettingsTabProps = {
  screen: 'splash' | 'login' | 'user' | 'admin';
  settingsUsers: any[];
  setSettingsUsers: React.Dispatch<React.SetStateAction<any[]>>;
  availableLicenses: any[];
  setAvailableLicenses: React.Dispatch<React.SetStateAction<any[]>>;
  mobTransactions: any[];
  setMobTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  mobInvoices: any[];
  setMobInvoices: React.Dispatch<React.SetStateAction<any[]>>;
  mobOrgs: any[];
  setMobOrgs: React.Dispatch<React.SetStateAction<any[]>>;
  mobTickets: any[];
  setMobTickets: React.Dispatch<React.SetStateAction<any[]>>;
  mobFaqs: any[];
  setMobFaqs: React.Dispatch<React.SetStateAction<any[]>>;
  mobDocs: any[];
  setMobDocs: React.Dispatch<React.SetStateAction<any[]>>;
  
  // Profile settings
  profileName: string;
  setProfileName: (val: string) => void;
  profileEmail: string;
  setProfileEmail: (val: string) => void;
  profilePhone: string;
  setProfilePhone: (val: string) => void;
  rzpKeyId: string;
  setRzpKeyId: (val: string) => void;
  rzpKeySecret: string;
  setRzpKeySecret: (val: string) => void;
  isAdmin?: boolean;
};

type SettingSubTab = 'menu' | 'profile' | 'billing' | 'support' | 'adminConfig' | 'licensing' | 'organizations';

export function SettingsTab({
  screen,
  settingsUsers,
  setSettingsUsers,
  availableLicenses,
  setAvailableLicenses,
  mobTransactions,
  setMobTransactions,
  mobInvoices,
  setMobInvoices,
  mobOrgs,
  setMobOrgs,
  mobTickets,
  setMobTickets,
  mobFaqs,
  setMobFaqs,
  mobDocs,
  setMobDocs,
  profileName,
  setProfileName,
  profileEmail,
  setProfileEmail,
  profilePhone,
  setProfilePhone,
  rzpKeyId,
  setRzpKeyId,
  rzpKeySecret,
  setRzpKeySecret,
  isAdmin = false,
}: SettingsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SettingSubTab>('menu');
  
  // Support states
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketSeverity, setTicketSeverity] = useState('Medium');
  const [showRaiseTicketModal, setShowRaiseTicketModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [docPage, setDocPage] = useState(0);

  // Billing Pagination & Filter states
  const [txSearch, setTxSearch] = useState('');
  const [txFromDate, setTxFromDate] = useState('');
  const [txToDate, setTxToDate] = useState('');
  const [showTxFilterModal, setShowTxFilterModal] = useState(false);
  const [txPage, setTxPage] = useState(0);

  const [invSearch, setInvSearch] = useState('');
  const [invFromDate, setInvFromDate] = useState('');
  const [invToDate, setInvToDate] = useState('');
  const [showInvFilterModal, setShowInvFilterModal] = useState(false);
  const [invPage, setInvPage] = useState(0);

  // Active view modals
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Invite User states
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('org_admin');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // General app settings
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [accentColor, setAccentColor] = useState('#7c3aed');

  // White-label custom branding states
  const [companyName, setCompanyName] = useState('SignageOS');
  const [companyLogo, setCompanyLogo] = useState('');

  // Edit User states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editUserLicense, setEditUserLicense] = useState('');

  // Create License states
  const [showCreateLicModal, setShowCreateLicModal] = useState(false);
  const [newLicId, setNewLicId] = useState('');
  const [newLicName, setNewLicName] = useState('');
  const [newLicPrice, setNewLicPrice] = useState('1000');
  const [newLicTenure, setNewLicTenure] = useState<'monthly' | 'yearly'>('monthly');
  const [newLicUserEmail, setNewLicUserEmail] = useState('');
  const [newLicStorage, setNewLicStorage] = useState('5');
  const [newLicDevice, setNewLicDevice] = useState('5');
  const [newLicWhiteLabel, setNewLicWhiteLabel] = useState(false);

  // Edit License states
  const [editingLicense, setEditingLicense] = useState<any | null>(null);
  const [editLicName, setEditLicName] = useState('');
  const [editLicPrice, setEditLicPrice] = useState('1000');
  const [editLicTenure, setEditLicTenure] = useState<'monthly' | 'yearly'>('monthly');
  const [editLicUserEmail, setEditLicUserEmail] = useState('');
  const [editLicStorage, setEditLicStorage] = useState('5');
  const [editLicDevice, setEditLicDevice] = useState('5');
  const [editLicWhiteLabel, setEditLicWhiteLabel] = useState(false);

  // Create/Edit Org states
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgAdminName, setNewOrgAdminName] = useState('');
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState('');
  const [newOrgPlanType, setNewOrgPlanType] = useState('Starter');
  const [newOrgScreens, setNewOrgScreens] = useState('5');
  const [newOrgStorage, setNewOrgStorage] = useState('10');
  const [newOrgRenewal, setNewOrgRenewal] = useState('');

  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgAdminName, setEditOrgAdminName] = useState('');
  const [editOrgAdminEmail, setEditOrgAdminEmail] = useState('');
  const [editOrgPlanType, setEditOrgPlanType] = useState('Starter');
  const [editOrgScreens, setEditOrgScreens] = useState('5');
  const [editOrgStorage, setEditOrgStorage] = useState('10');
  const [editOrgRenewal, setEditOrgRenewal] = useState('');

  const userLicense = availableLicenses.find(l => l.assignedUserEmail === profileEmail);
  const isWhiteLabelEnabled = userLicense ? !!userLicense.whiteLabel || userLicense.name.toLowerCase().includes('premium') : false;

  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditPhone(user.mobile || '');
    setEditCompany(user.company);
    setEditAddress(user.address || '');
    setEditUserLicense(user.license || 'N/A');
  };

  const handleSaveEditUser = () => {
    if (!editName.trim() || !editCompany.trim()) {
      Alert.alert('Error', 'Name and Company are required.');
      return;
    }
    
    // Save license changes
    setSettingsUsers(prev => prev.map(u => (u.email === editingUser.email) ? {
      ...u,
      name: editName,
      mobile: editPhone,
      company: editCompany,
      address: editAddress,
      license: editUserLicense
    } : u));

    // Also update assigned licenses
    setAvailableLicenses(prev => prev.map(l => {
      // If license ID matches the newly assigned license, assign it to this user
      if (l.id === editUserLicense) {
        return {
          ...l,
          assignedUserEmail: editingUser.email,
          assignedOrgName: editCompany,
          status: 'active'
        };
      }
      // If it was assigned to this user but is no longer selected, unassign it
      if (l.assignedUserEmail === editingUser.email && l.id !== editUserLicense) {
        return {
          ...l,
          assignedUserEmail: '',
          assignedOrgName: '',
          status: 'active'
        };
      }
      return l;
    }));

    setEditingUser(null);
    Alert.alert('Success', 'User profile updated successfully.');
  };

  const handleCreateLicense = () => {
    if (!newLicId.trim() || !newLicName.trim()) {
      Alert.alert('Error', 'License ID and Name are required.');
      return;
    }
    const newLic = {
      id: newLicId.toUpperCase(),
      name: newLicName,
      price: Number(newLicPrice),
      tenure: newLicTenure,
      assignedUserEmail: newLicUserEmail || '',
      assignedOrgName: settingsUsers.find(u => u.email === newLicUserEmail)?.company || '',
      expiryDate: newLicTenure === 'monthly' ? '2026-07-25' : '2027-06-25',
      storageLimit: Number(newLicStorage),
      deviceLimit: Number(newLicDevice),
      whiteLabel: newLicWhiteLabel,
      status: newLicUserEmail ? 'pending_payment' : 'active'
    };
    setAvailableLicenses([...availableLicenses, newLic]);
    setShowCreateLicModal(false);
    setNewLicId('');
    setNewLicName('');
    Alert.alert('Success', `License ${newLic.id} created successfully.`);
  };

  const handleOpenEditLicense = (lic: any) => {
    setEditingLicense(lic);
    setEditLicName(lic.name);
    setEditLicPrice(String(lic.price));
    setEditLicTenure(lic.tenure);
    setEditLicUserEmail(lic.assignedUserEmail || '');
    setEditLicStorage(String(lic.storageLimit || 5));
    setEditLicDevice(String(lic.deviceLimit || 5));
    setEditLicWhiteLabel(!!lic.whiteLabel);
  };

  const handleSaveEditLicense = () => {
    if (!editLicName.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    setAvailableLicenses(prev => prev.map(l => (l.id === editingLicense.id) ? {
      ...l,
      name: editLicName,
      price: Number(editLicPrice),
      tenure: editLicTenure,
      assignedUserEmail: editLicUserEmail,
      assignedOrgName: settingsUsers.find(u => u.email === editLicUserEmail)?.company || '',
      storageLimit: Number(editLicStorage),
      deviceLimit: Number(editLicDevice),
      whiteLabel: editLicWhiteLabel
    } : l));
    setEditingLicense(null);
    Alert.alert('Success', 'License details updated successfully.');
  };

  const handleDeleteLicense = (lic: any) => {
    Alert.alert(
      'Delete License',
      `Are you sure you want to delete/revoke License ${lic.id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setAvailableLicenses(prev => prev.filter(l => l.id !== lic.id));
          Alert.alert('Success', `License ${lic.id} has been revoked.`);
        }}
      ]
    );
  };

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete client "${user.name}"? This will unassign any active license from their account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setSettingsUsers(prev => prev.filter(u => u.email !== user.email));
          Alert.alert('Success', `Client "${user.name}" has been removed.`);
        }}
      ]
    );
  };

  // Org handlers
  const handleCreateOrg = () => {
    if (!newOrgName.trim() || !newOrgAdminEmail.trim()) {
      Alert.alert('Error', 'Organization Name and Admin Email are required.');
      return;
    }
    const newOrg = {
      id: `ORG-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newOrgName,
      adminName: newOrgAdminName,
      email: newOrgAdminEmail,
      planType: newOrgPlanType,
      screensAllowed: Number(newOrgScreens),
      storageLimit: Number(newOrgStorage),
      subscriptionStatus: 'active',
      renewalDate: newOrgRenewal || '2027-06-25'
    };
    setMobOrgs([...mobOrgs, newOrg]);
    setShowCreateOrgModal(false);
    setNewOrgName('');
    setNewOrgAdminEmail('');
    setNewOrgAdminName('');
    Alert.alert('Success', `Organization "${newOrg.name}" created successfully.`);
  };

  const handleOpenEditOrg = (org: any) => {
    setEditingOrg(org);
    setEditOrgName(org.name);
    setEditOrgAdminName(org.adminName || '');
    setEditOrgAdminEmail(org.email || '');
    setEditOrgPlanType(org.planType || 'Starter');
    setEditOrgScreens(String(org.screensAllowed || 5));
    setEditOrgStorage(String(org.storageLimit || 10));
    setEditOrgRenewal(org.renewalDate || '');
  };

  const handleSaveEditOrg = () => {
    if (!editOrgName.trim()) {
      Alert.alert('Error', 'Organization Name is required.');
      return;
    }
    setMobOrgs(prev => prev.map(o => (o.id === editingOrg.id) ? {
      ...o,
      name: editOrgName,
      adminName: editOrgAdminName,
      email: editOrgAdminEmail,
      planType: editOrgPlanType,
      screensAllowed: Number(editOrgScreens),
      storageLimit: Number(editOrgStorage),
      renewalDate: editOrgRenewal
    } : o));
    setEditingOrg(null);
    Alert.alert('Success', 'Organization updated successfully.');
  };

  const handleDeleteOrg = (org: any) => {
    Alert.alert(
      'Delete Organization',
      `Are you sure you want to delete organization "${org.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setMobOrgs(prev => prev.filter(o => o.id !== org.id));
          Alert.alert('Success', `Organization "${org.name}" has been deleted.`);
        }}
      ]
    );
  };

  // Filter lists to current user
  const userFilteredInvoices = mobInvoices.filter(
    (inv) => isAdmin || inv.clientEmail === profileEmail
  );
  const userFilteredTransactions = mobTransactions.filter(
    (txn) => isAdmin || txn.clientEmail === profileEmail
  );
  const userFilteredOrgs = mobOrgs.filter(
    (org) => isAdmin || org.email === profileEmail
  );

  const handleSaveProfile = () => {
    Alert.alert('Profile Saved', 'Your configuration settings have been successfully updated.');
  };

  const handleRaiseTicket = () => {
    if (!ticketSubject || !ticketDescription) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    const newTicket = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: ticketSubject,
      description: ticketDescription,
      severity: ticketSeverity,
      status: 'Open',
      createdDate: new Date().toISOString().split('T')[0],
      clientEmail: profileEmail,
    };
    setMobTickets([newTicket, ...mobTickets]);
    setTicketSubject('');
    setTicketDescription('');
    setShowRaiseTicketModal(false);
    Alert.alert('Ticket Raised', `Support Ticket ${newTicket.id} has been raised successfully.`);
  };

  const handleInviteUser = () => {
    if (!newUserName || !newUserEmail) {
      Alert.alert('Error', 'Name and Email are required.');
      return;
    }
    const newUser = {
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      mobile: newUserPhone,
      company: newUserCompany || 'Client Org',
      status: 'Active',
      screens: 0,
      license: 'N/A',
    };
    setSettingsUsers([...settingsUsers, newUser]);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserCompany('');
    setShowInviteModal(false);
    Alert.alert('User Invited', `Successfully invited ${newUserName} as ${newUserRole}.`);
  };

  return (
    <View style={styles.container}>
      {/* Back button for detail views */}
      {activeSubTab !== 'menu' && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setActiveSubTab('menu')}
        >
          <Text style={styles.backButtonText}>← Back to Settings Menu</Text>
        </TouchableOpacity>
      )}

      {/* Menu layout */}
      {activeSubTab === 'menu' && (
        <View style={styles.menuContainer}>
          {/* Active subscription card for non-admin users */}
          {!isAdmin && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardWelcome}>ACTIVE SUBSCRIPTION</Text>
                  <Text style={styles.infoCardName}>{profileName}</Text>
                  <Text style={styles.infoCardOrg}>{userFilteredOrgs[0]?.name || 'ManveTech'}</Text>
                </View>
                <View style={styles.screensBadge}>
                  <Text style={styles.screensBadgeText}>0/5 Screens</Text>
                </View>
              </View>

              <View style={styles.infoCardDivider} />

              <View style={styles.infoCardFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoMetaLabel}>License Plan</Text>
                  <Text style={styles.infoMetaValue}>
                    {availableLicenses.filter(l => l.assignedUserEmail === profileEmail)[0]?.name || 'Standard Plan'}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingLeft: 8 }}>
                  <Text style={styles.infoMetaLabel}>Expiry Date</Text>
                  <Text style={styles.infoMetaValue}>
                    {availableLicenses.filter(l => l.assignedUserEmail === profileEmail)[0]?.expiryDate || '2026-12-31'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.renewButton}
                  onPress={() => setActiveSubTab('billing')}
                >
                  <Text style={styles.renewButtonText}>Renew</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setActiveSubTab('profile')}
          >
            <View style={styles.menuItemIconWrapper}>
              <ProfileCircle size={22} color="#7c3aed" variant="Bulk" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Personal Profile</Text>
              <Text style={styles.menuItemDesc}>Manage your profile details and app preferences</Text>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setActiveSubTab('billing')}
          >
            <View style={styles.menuItemIconWrapper}>
              <Wallet size={22} color="#7c3aed" variant="Bulk" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Billing & Plans</Text>
              <Text style={styles.menuItemDesc}>View subscriptions, active licenses, and invoices</Text>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setActiveSubTab('support')}
          >
            <View style={styles.menuItemIconWrapper}>
              <MessageQuestion size={22} color="#7c3aed" variant="Bulk" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Help & Support</Text>
              <Text style={styles.menuItemDesc}>Explore FAQs, documentation, and support tickets</Text>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          {isAdmin && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSubTab('licensing')}
              >
                <View style={styles.menuItemIconWrapper}>
                  <Key size={22} color="#7c3aed" variant="Bulk" />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>Licensing Control</Text>
                  <Text style={styles.menuItemDesc}>Create, update, and assign platform licenses</Text>
                </View>
                <ArrowRight size={18} color="#94a3b8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSubTab('organizations')}
              >
                <View style={styles.menuItemIconWrapper}>
                  <Building size={22} color="#7c3aed" variant="Bulk" />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>Organizations</Text>
                  <Text style={styles.menuItemDesc}>Manage client directories, quotas, and tenants</Text>
                </View>
                <ArrowRight size={18} color="#94a3b8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSubTab('adminConfig')}
              >
                <View style={styles.menuItemIconWrapper}>
                  <ShieldSecurity size={22} color="#7c3aed" variant="Bulk" />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>Admin Console</Text>
                  <Text style={styles.menuItemDesc}>Manage clients, user directory, and payment keys</Text>
                </View>
                <ArrowRight size={18} color="#94a3b8" />
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* 1. Profile Setting Sub-tab */}
      {activeSubTab === 'profile' && (
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Personal Profile Details</ThemedText>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              style={styles.textInput}
              placeholder="Enter name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              value={profileEmail}
              onChangeText={setProfileEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.textInput, { backgroundColor: '#f1f5f9', color: '#64748b' }]}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mobile Phone</Text>
            <TextInput
              value={profilePhone}
              onChangeText={setProfilePhone}
              keyboardType="phone-pad"
              style={styles.textInput}
              placeholder="Enter mobile number"
            />
          </View>

          {/* White label / Custom branding settings */}
          {isWhiteLabelEnabled ? (
            <View style={[styles.sectionCard, { marginTop: 16 }]}>
              <ThemedText style={[styles.sectionHeader, { marginBottom: 12 }]}>Branding Settings (White-Label Active)</ThemedText>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company Name Override</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  style={styles.textInput}
                  placeholder="e.g. My Awesome Signage"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company Logo URL</Text>
                <TextInput
                  value={companyLogo}
                  onChangeText={setCompanyLogo}
                  style={styles.textInput}
                  placeholder="e.g. https://domain.com/logo.png"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Theme Accent Color</Text>
                <TextInput
                  value={accentColor}
                  onChangeText={setAccentColor}
                  style={styles.textInput}
                  placeholder="#7c3aed"
                />
              </View>
            </View>
          ) : (
            !isAdmin && (
              <View style={styles.whiteLabelAlert}>
                <ShieldCross size={20} color="#b45309" variant="Bold" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.alertTitle}>White Labeling Status</Text>
                  <Text style={styles.alertDescription}>
                    Your assigned license does not include white-label permissions. Custom logo uploads and themes are managed by your administrator.
                  </Text>
                </View>
              </View>
            )
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile}>
            <Text style={styles.primaryButtonText}>Save Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Billing & Plans Sub-tab */}
      {activeSubTab === 'billing' && (() => {
        // Filter transactions
        const filteredTxns = userFilteredTransactions.filter(t => {
          const matchesSearch = t.id.toLowerCase().includes(txSearch.toLowerCase()) || 
            (t.licenseName || '').toLowerCase().includes(txSearch.toLowerCase());
          
          let matchesFromDate = true;
          let matchesToDate = true;
          if (txFromDate) {
            matchesFromDate = new Date(t.paymentDate) >= new Date(txFromDate);
          }
          if (txToDate) {
            matchesToDate = new Date(t.paymentDate) <= new Date(txToDate);
          }
          return matchesSearch && matchesFromDate && matchesToDate;
        });

        // Filter invoices
        const filteredInvoices = userFilteredInvoices.filter(i => {
          const matchesSearch = i.id.toLowerCase().includes(invSearch.toLowerCase());
          
          let matchesFromDate = true;
          let matchesToDate = true;
          if (invFromDate) {
            matchesFromDate = new Date(i.issuedDate) >= new Date(invFromDate);
          }
          if (invToDate) {
            matchesToDate = new Date(i.issuedDate) <= new Date(invToDate);
          }
          return matchesSearch && matchesFromDate && matchesToDate;
        });

        // Paginate
        const paginatedTxns = filteredTxns.slice(txPage * 5, (txPage + 1) * 5);
        const paginatedInvoices = filteredInvoices.slice(invPage * 5, (invPage + 1) * 5);

        return (
          <View style={{ gap: 16 }}>
            {/* Transactions Section */}
            <View style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <ThemedText style={[styles.sectionHeader, { marginBottom: 0 }]}>Transaction History</ThemedText>
                <TouchableOpacity style={{ padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' }} onPress={() => setShowTxFilterModal(true)}>
                  <Filter size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Search Control */}
              <View style={{ marginBottom: 12 }}>
                <TextInput
                  value={txSearch}
                  onChangeText={(val) => { setTxSearch(val); setTxPage(0); }}
                  placeholder="Search Txn ID / Plan"
                  style={[styles.textInput, { height: 38 }]}
                />
              </View>

              {paginatedTxns.length === 0 ? (
                <Text style={styles.emptyText}>No transaction records found.</Text>
              ) : (
                paginatedTxns.map((txn) => (
                  <TouchableOpacity key={txn.id} style={styles.txnItem} onPress={() => setSelectedTxn(txn)}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={styles.txnId}>{txn.id}</Text>
                        <Text style={styles.txnDate}>{txn.paymentDate}</Text>
                      </View>
                      <Text style={styles.txnAmount}>₹{(txn.amount || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={styles.txnMeta}>{txn.licenseName} (Click to View)</Text>
                      <Text style={styles.txnStatus}>{txn.status.toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* Pagination Controls */}
              {filteredTxns.length > 5 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    disabled={txPage === 0}
                    onPress={() => setTxPage(p => Math.max(0, p - 1))}
                    style={[styles.pageButton, txPage === 0 && styles.pageButtonDisabled]}
                  >
                    <Text style={[styles.pageButtonText, txPage === 0 && styles.pageButtonTextDisabled]}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageIndicatorText}>
                    Page {txPage + 1} of {Math.ceil(filteredTxns.length / 5)}
                  </Text>
                  <TouchableOpacity
                    disabled={txPage >= Math.ceil(filteredTxns.length / 5) - 1}
                    onPress={() => setTxPage(p => Math.min(Math.ceil(filteredTxns.length / 5) - 1, p + 1))}
                    style={[styles.pageButton, txPage >= Math.ceil(filteredTxns.length / 5) - 1 && styles.pageButtonDisabled]}
                  >
                    <Text style={[styles.pageButtonText, txPage >= Math.ceil(filteredTxns.length / 5) - 1 && styles.pageButtonTextDisabled]}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Invoices Section */}
            <View style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <ThemedText style={[styles.sectionHeader, { marginBottom: 0 }]}>Billing Invoices</ThemedText>
                <TouchableOpacity style={{ padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' }} onPress={() => setShowInvFilterModal(true)}>
                  <Filter size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Search Control */}
              <View style={{ marginBottom: 12 }}>
                <TextInput
                  value={invSearch}
                  onChangeText={(val) => { setInvSearch(val); setInvPage(0); }}
                  placeholder="Search Invoice ID"
                  style={[styles.textInput, { height: 38 }]}
                />
              </View>

              {paginatedInvoices.length === 0 ? (
                <Text style={styles.emptyText}>No invoices found.</Text>
              ) : (
                paginatedInvoices.map((inv) => (
                  <TouchableOpacity key={inv.id} style={styles.invoiceItem} onPress={() => setSelectedInvoice(inv)}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={styles.invoiceId}>{inv.id}</Text>
                        <Text style={styles.invoiceDate}>Issued: {inv.issuedDate}</Text>
                      </View>
                      <Text style={styles.invoiceAmount}>₹{(inv.amount || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
                      <Text style={styles.invoiceMeta}>Due: {inv.dueDate} (Click to View)</Text>
                      <Text style={[styles.invoiceStatus, inv.status === 'paid' ? { color: '#059669' } : { color: '#dc2626' }]}>
                        {inv.status.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* Pagination Controls */}
              {filteredInvoices.length > 5 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    disabled={invPage === 0}
                    onPress={() => setInvPage(p => Math.max(0, p - 1))}
                    style={[styles.pageButton, invPage === 0 && styles.pageButtonDisabled]}
                  >
                    <Text style={[styles.pageButtonText, invPage === 0 && styles.pageButtonTextDisabled]}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageIndicatorText}>
                    Page {invPage + 1} of {Math.ceil(filteredInvoices.length / 5)}
                  </Text>
                  <TouchableOpacity
                    disabled={invPage >= Math.ceil(filteredInvoices.length / 5) - 1}
                    onPress={() => setInvPage(p => Math.min(Math.ceil(filteredInvoices.length / 5) - 1, p + 1))}
                    style={[styles.pageButton, invPage >= Math.ceil(filteredInvoices.length / 5) - 1 && styles.pageButtonDisabled]}
                  >
                    <Text style={[styles.pageButtonText, invPage >= Math.ceil(filteredInvoices.length / 5) - 1 && styles.pageButtonTextDisabled]}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      })()}

      {/* 3. Help & Support Sub-tab */}
      {activeSubTab === 'support' && (
        <View style={{ gap: 16 }}>
          {/* Help guides & articles */}
          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionHeader}>Resources</ThemedText>
            
            <View style={{ gap: 8, marginVertical: 10 }}>
              {mobDocs.slice(docPage * 5, (docPage + 1) * 5).map((doc) => (
                <TouchableOpacity key={doc.id} style={styles.resourceListItem} onPress={() => setSelectedDoc(doc)}>
                  <DirectInbox size={16} color="#7c3aed" variant="Linear" />
                  <Text style={styles.resourceListText} numberOfLines={1}>{doc.title}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {mobDocs.length > 5 && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  disabled={docPage === 0}
                  onPress={() => setDocPage(p => Math.max(0, p - 1))}
                  style={[styles.pageButton, docPage === 0 && styles.pageButtonDisabled]}
                >
                  <Text style={[styles.pageButtonText, docPage === 0 && styles.pageButtonTextDisabled]}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicatorText}>
                  Page {docPage + 1} of {Math.ceil(mobDocs.length / 5)}
                </Text>
                <TouchableOpacity
                  disabled={docPage >= Math.ceil(mobDocs.length / 5) - 1}
                  onPress={() => setDocPage(p => Math.min(Math.ceil(mobDocs.length / 5) - 1, p + 1))}
                  style={[styles.pageButton, docPage >= Math.ceil(mobDocs.length / 5) - 1 && styles.pageButtonDisabled]}
                >
                  <Text style={[styles.pageButtonText, docPage >= Math.ceil(mobDocs.length / 5) - 1 && styles.pageButtonTextDisabled]}>Next</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedDoc && (
              <View style={styles.docCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.docCategory}>{selectedDoc.category.toUpperCase()}</Text>
                  <TouchableOpacity onPress={() => setSelectedDoc(null)}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.docTitle}>{selectedDoc.title}</Text>
                <Text style={styles.docContent}>{selectedDoc.content}</Text>
                {selectedDoc.youtubeUrl ? (
                  <View style={styles.videoLinkContainer}>
                    <Text style={styles.videoLinkTitle}>Video Walkthrough Link:</Text>
                    <Text style={styles.videoLinkUrl}>{selectedDoc.youtubeUrl}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* FAQs List */}
          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionHeader}>Frequently Asked Questions</ThemedText>
            {mobFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <View key={faq.id} style={styles.faqItem}>
                  <TouchableOpacity onPress={() => setOpenFaqId(isOpen ? null : faq.id)} style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Text style={styles.faqArrow}>{isOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {isOpen && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Tickets list */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <ThemedText style={[styles.sectionHeader, { marginBottom: 0 }]}>Support Desk Tickets</ThemedText>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowRaiseTicketModal(true)}>
                <Add size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Raise Ticket</Text>
              </TouchableOpacity>
            </View>

            {mobTickets.filter(t => isAdmin || t.clientEmail === profileEmail).length === 0 ? (
              <Text style={styles.emptyText}>No active support desk tickets raised.</Text>
            ) : (
              mobTickets.filter(t => isAdmin || t.clientEmail === profileEmail).map((ticket) => (
                <View key={ticket.id} style={styles.ticketItem}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.ticketId}>{ticket.id}</Text>
                    <View style={[styles.ticketStatusBadge, ticket.status === 'Resolved' ? { backgroundColor: '#d1fae5' } : { backgroundColor: '#fee2e2' }]}>
                      <Text style={[styles.ticketStatusText, ticket.status === 'Resolved' ? { color: '#065f46' } : { color: '#991b1b' }]}>
                        {ticket.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                  <Text style={styles.ticketDesc}>{ticket.description}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={styles.ticketDate}>Raised: {ticket.createdDate}</Text>
                    <Text style={styles.ticketSeverity}>Severity: {ticket.severity}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* 4. Admin Config Console (Only Admin) */}
      {isAdmin && activeSubTab === 'adminConfig' && (
        <View style={{ gap: 16 }}>
          {/* User directory */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <ThemedText style={[styles.sectionHeader, { marginBottom: 0 }]}>Client Access & User Directory</ThemedText>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowInviteModal(true)}>
                <Add size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Invite Client</Text>
              </TouchableOpacity>
            </View>

            {settingsUsers.map((user, idx) => (
              <View key={idx} style={styles.userCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userRole}>{user.role.toUpperCase()}</Text>
                </View>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userCompany}>{user.company} • License: {user.license}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.08)' }}
                    onPress={() => handleOpenEditUser(user)}
                  >
                    <Edit2 size={14} color="#7c3aed" />
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#7c3aed' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
                    onPress={() => handleDeleteUser(user)}
                  >
                    <Trash size={14} color="#EF4444" />
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#EF4444' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Global Payment Config (Razorpay Keys) */}
          <View style={styles.sectionCard}>
            <ThemedText style={styles.sectionHeader}>Global Payment API Keys (Razorpay)</ThemedText>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Razorpay Key ID</Text>
              <TextInput
                value={rzpKeyId}
                onChangeText={setRzpKeyId}
                style={styles.textInput}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Razorpay Secret Key</Text>
              <TextInput
                value={rzpKeySecret}
                onChangeText={setRzpKeySecret}
                style={styles.textInput}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => Alert.alert('Keys Saved', 'API Credentials successfully verified and configured.')}>
              <Text style={styles.primaryButtonText}>Verify & Save Keys</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. Licensing Control Panel */}
      {isAdmin && activeSubTab === 'licensing' && (
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <ThemedText style={[styles.sectionHeader, { marginBottom: 0 }]}>Licensing Command Center</ThemedText>
            <TouchableOpacity style={styles.addButton} onPress={() => {
              setNewLicId('');
              setNewLicName('');
              setNewLicPrice('1000');
              setNewLicTenure('monthly');
              setNewLicUserEmail('');
              setNewLicStorage('5');
              setNewLicDevice('5');
              setNewLicWhiteLabel(false);
              setShowCreateLicModal(true);
            }}>
              <Add size={16} color="#ffffff" />
              <Text style={styles.addButtonText}>Create License</Text>
            </TouchableOpacity>
          </View>

          {availableLicenses.map((lic, index) => (
            <View key={lic.id || index} style={[styles.userCard, { borderLeftColor: lic.whiteLabel ? '#7c3aed' : '#E2E8F0', borderLeftWidth: 4 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.userName}>{lic.id}</Text>
                <Text style={[styles.userRole, { backgroundColor: lic.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', color: lic.status === 'active' ? '#10B981' : '#F59E0B' }]}>
                  {lic.status.toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 4 }}>{lic.name}</Text>
              <Text style={styles.userEmail}>₹{lic.price} • {lic.tenure} • Storage: {lic.storageLimit || 5} GB • Screens: {lic.deviceLimit || 5} Max</Text>
              <Text style={styles.userCompany}>{lic.assignedUserEmail ? `Assigned: ${lic.assignedUserEmail}` : 'Unassigned (Available)'}</Text>
              {lic.whiteLabel && (
                <Text style={{ fontSize: 10, color: '#7c3aed', fontWeight: 'bold', marginTop: 4 }}>✨ White Label Enabled</Text>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.08)' }}
                  onPress={() => handleOpenEditLicense(lic)}
                >
                  <Edit2 size={14} color="#7c3aed" />
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#7c3aed' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
                  onPress={() => handleDeleteLicense(lic)}
                >
                  <Trash size={14} color="#EF4444" />
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#EF4444' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 6. Organizations Panel */}
      {isAdmin && activeSubTab === 'organizations' && (
        <View style={styles.sectionCard}>
          <View style={{ marginBottom: 12 }}>
            <ThemedText style={[styles.sectionHeader, { marginBottom: 4 }]}>Client Organizations</ThemedText>
            <Text style={{ fontSize: 12, color: '#64748b' }}>Multi-tenant client organization directory and quotas (Read-Only)</Text>
          </View>

          {mobOrgs.map((org, index) => (
            <View key={org.id || index} style={styles.userCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.userName}>{org.name}</Text>
                <Text style={[styles.userRole, { backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }]}>
                  {org.planType}
                </Text>
              </View>
              <Text style={styles.userEmail}>Admin: {org.adminName} ({org.email})</Text>
              <Text style={styles.userCompany}>Screens Allowed: {org.screensAllowed} • Storage: {org.storageLimit} GB</Text>
              <Text style={styles.userCompany}>Renewal: {org.renewalDate} • Status: {org.subscriptionStatus.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Support Ticket Modal */}
      <Modal visible={showRaiseTicketModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Raise Support Ticket</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                value={ticketSubject}
                onChangeText={setTicketSubject}
                style={styles.textInput}
                placeholder="Brief description of the issue"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Severity Level</Text>
              <TextInput
                value={ticketSeverity}
                onChangeText={setTicketSeverity}
                style={styles.textInput}
                placeholder="e.g. Low, Medium, High"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Detailed Description</Text>
              <TextInput
                value={ticketDescription}
                onChangeText={setTicketDescription}
                style={[styles.textInput, { height: 100 }]}
                placeholder="Enter details..."
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRaiseTicketModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleRaiseTicket}>
                <Text style={styles.submitButtonText}>Submit Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Invite New Client</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                value={newUserName}
                onChangeText={setNewUserName}
                style={styles.textInput}
                placeholder="Client Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                value={newUserEmail}
                onChangeText={setNewUserEmail}
                style={styles.textInput}
                placeholder="client@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Company / Org</Text>
              <TextInput
                value={newUserCompany}
                onChangeText={setNewUserCompany}
                style={styles.textInput}
                placeholder="e.g. ManveTech"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Role Designation</Text>
              <TextInput
                value={newUserRole}
                onChangeText={setNewUserRole}
                style={styles.textInput}
                placeholder="e.g. org_admin, user"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleInviteUser}>
                <Text style={styles.submitButtonText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT USER DETAILS MODAL */}
      <Modal visible={editingUser !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Edit Client Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Client Full Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={styles.textInput}
                placeholder="Enter client name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                style={styles.textInput}
                placeholder="Enter phone number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Organization / Company</Text>
              <TextInput
                value={editCompany}
                onChangeText={setEditCompany}
                style={styles.textInput}
                placeholder="Enter company name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Billing / Office Address</Text>
              <TextInput
                value={editAddress}
                onChangeText={setEditAddress}
                style={[styles.textInput, { height: 60 }]}
                placeholder="Enter office address"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assigned License (Dropdown)</Text>
              <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 4, backgroundColor: '#f8fafc' }}>
                <ScrollView style={{ maxHeight: 120 }}>
                  <TouchableOpacity
                    style={{ padding: 8, backgroundColor: editUserLicense === 'N/A' ? 'rgba(124, 58, 237, 0.08)' : 'transparent', borderRadius: 8 }}
                    onPress={() => setEditUserLicense('N/A')}
                  >
                    <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: editUserLicense === 'N/A' ? 'bold' : 'normal' }}>N/A (No License)</Text>
                  </TouchableOpacity>
                  {availableLicenses.map((lic) => (
                    <TouchableOpacity
                      key={lic.id}
                      style={{ padding: 8, backgroundColor: editUserLicense === lic.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent', borderRadius: 8 }}
                      onPress={() => setEditUserLicense(lic.id)}
                    >
                      <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: editUserLicense === lic.id ? 'bold' : 'normal' }}>
                        {lic.id} - {lic.name} (₹{lic.price})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingUser(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSaveEditUser}>
                <Text style={styles.submitButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VIEW TRANSACTION DETAILS MODAL */}
      <Modal visible={selectedTxn !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Transaction Details</Text>
            {selectedTxn && (
              <View style={{ gap: 12 }}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Transaction ID</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{selectedTxn.id}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Date</Text>
                  <Text style={{ fontSize: 14, color: '#334155' }}>{selectedTxn.paymentDate}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Plan Purchased</Text>
                  <Text style={{ fontSize: 14, color: '#334155' }}>{selectedTxn.licenseName}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount Paid</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>₹{selectedTxn.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#059669' }}>{selectedTxn.status.toUpperCase()}</Text>
                </View>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.submitButton} onPress={() => setSelectedTxn(null)}>
                <Text style={styles.submitButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VIEW INVOICE DETAILS MODAL */}
      <Modal visible={selectedInvoice !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Invoice Details</Text>
            {selectedInvoice && (
              <View style={{ gap: 12 }}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Invoice ID</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{selectedInvoice.id}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Issued Date</Text>
                  <Text style={{ fontSize: 14, color: '#334155' }}>{selectedInvoice.issuedDate}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Due Date</Text>
                  <Text style={{ fontSize: 14, color: '#334155' }}>{selectedInvoice.dueDate}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Total Due</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>₹{selectedInvoice.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: selectedInvoice.status === 'paid' ? '#059669' : '#dc2626' }}>
                    {selectedInvoice.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.submitButton} onPress={() => setSelectedInvoice(null)}>
                <Text style={styles.submitButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TRANSACTIONS DATE FILTER MODAL */}
      <Modal visible={showTxFilterModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Filter Transactions by Date</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>From Date (YYYY-MM-DD)</Text>
              <TextInput
                value={txFromDate}
                onChangeText={setTxFromDate}
                style={styles.textInput}
                placeholder="e.g. 2026-06-01"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>To Date (YYYY-MM-DD)</Text>
              <TextInput
                value={txToDate}
                onChangeText={setTxToDate}
                style={styles.textInput}
                placeholder="e.g. 2026-06-30"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setTxFromDate(''); setTxToDate(''); setTxPage(0); setShowTxFilterModal(false); }}>
                <Text style={styles.cancelButtonText}>Clear Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={() => { setTxPage(0); setShowTxFilterModal(false); }}>
                <Text style={styles.submitButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* INVOICES DATE FILTER MODAL */}
      <Modal visible={showInvFilterModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Filter Invoices by Date</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>From Date (YYYY-MM-DD)</Text>
              <TextInput
                value={invFromDate}
                onChangeText={setInvFromDate}
                style={styles.textInput}
                placeholder="e.g. 2026-06-01"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>To Date (YYYY-MM-DD)</Text>
              <TextInput
                value={invToDate}
                onChangeText={setInvToDate}
                style={styles.textInput}
                placeholder="e.g. 2026-06-30"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setInvFromDate(''); setInvToDate(''); setInvPage(0); setShowInvFilterModal(false); }}>
                <Text style={styles.cancelButtonText}>Clear Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={() => { setInvPage(0); setShowInvFilterModal(false); }}>
                <Text style={styles.submitButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE LICENSE MODAL */}
      <Modal visible={showCreateLicModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Create New License</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>License ID (Unique)</Text>
                <TextInput
                  value={newLicId}
                  onChangeText={setNewLicId}
                  style={styles.textInput}
                  placeholder="e.g. LIC-PREMIUM-X1"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Plan Name</Text>
                <TextInput
                  value={newLicName}
                  onChangeText={setNewLicName}
                  style={styles.textInput}
                  placeholder="e.g. Enterprise Plan"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price (INR)</Text>
                <TextInput
                  value={newLicPrice}
                  onChangeText={setNewLicPrice}
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="e.g. 5000"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tenure</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.cancelButton, newLicTenure === 'monthly' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                    onPress={() => setNewLicTenure('monthly')}
                  >
                    <Text style={[styles.cancelButtonText, newLicTenure === 'monthly' && { color: '#ffffff' }]}>Monthly</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelButton, newLicTenure === 'yearly' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                    onPress={() => setNewLicTenure('yearly')}
                  >
                    <Text style={[styles.cancelButtonText, newLicTenure === 'yearly' && { color: '#ffffff' }]}>Yearly</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assign User Email (Optional)</Text>
                <TextInput
                  value={newLicUserEmail}
                  onChangeText={setNewLicUserEmail}
                  style={styles.textInput}
                  placeholder="client@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Storage Limit (GB)</Text>
                <TextInput
                  value={newLicStorage}
                  onChangeText={setNewLicStorage}
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="5"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Screens Limit</Text>
                <TextInput
                  value={newLicDevice}
                  onChangeText={setNewLicDevice}
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="5"
                />
              </View>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Enable White Labeling</Text>
                  <Text style={styles.switchDesc}>Allow custom logo and theme accent branding</Text>
                </View>
                <Switch value={newLicWhiteLabel} onValueChange={setNewLicWhiteLabel} trackColor={{ true: '#7c3aed' }} />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateLicModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleCreateLicense}>
                <Text style={styles.submitButtonText}>Create License</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT LICENSE DETAILS MODAL */}
      <Modal visible={editingLicense !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Edit License Details</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Plan Name</Text>
                <TextInput
                  value={editLicName}
                  onChangeText={setEditLicName}
                  style={styles.textInput}
                  placeholder="License/Plan Name"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price (INR)</Text>
                <TextInput
                  value={editLicPrice}
                  onChangeText={setEditLicPrice}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tenure</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.cancelButton, editLicTenure === 'monthly' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                    onPress={() => setEditLicTenure('monthly')}
                  >
                    <Text style={[styles.cancelButtonText, editLicTenure === 'monthly' && { color: '#ffffff' }]}>Monthly</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelButton, editLicTenure === 'yearly' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                    onPress={() => setEditLicTenure('yearly')}
                  >
                    <Text style={[styles.cancelButtonText, editLicTenure === 'yearly' && { color: '#ffffff' }]}>Yearly</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assigned User Email</Text>
                <TextInput
                  value={editLicUserEmail}
                  onChangeText={setEditLicUserEmail}
                  style={styles.textInput}
                  placeholder="client@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Storage Limit (GB)</Text>
                <TextInput
                  value={editLicStorage}
                  onChangeText={setEditLicStorage}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Screens Limit</Text>
                <TextInput
                  value={editLicDevice}
                  onChangeText={setEditLicDevice}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Enable White Labeling</Text>
                  <Text style={styles.switchDesc}>Allow custom logo and theme accent branding</Text>
                </View>
                <Switch value={editLicWhiteLabel} onValueChange={setEditLicWhiteLabel} trackColor={{ true: '#7c3aed' }} />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingLicense(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSaveEditLicense}>
                <Text style={styles.submitButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE ORGANIZATION MODAL */}
      <Modal visible={showCreateOrgModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add Organization</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Organization / Company Name</Text>
                <TextInput
                  value={newOrgName}
                  onChangeText={setNewOrgName}
                  style={styles.textInput}
                  placeholder="e.g. Barista Coffee Chain"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Full Name</Text>
                <TextInput
                  value={newOrgAdminName}
                  onChangeText={setNewOrgAdminName}
                  style={styles.textInput}
                  placeholder="e.g. Sunita Roy"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Contact Email</Text>
                <TextInput
                  value={newOrgAdminEmail}
                  onChangeText={setNewOrgAdminEmail}
                  style={styles.textInput}
                  placeholder="e.g. sunita@demo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Plan Tier</Text>
                <TextInput
                  value={newOrgPlanType}
                  onChangeText={setNewOrgPlanType}
                  style={styles.textInput}
                  placeholder="e.g. Starter, Business, Enterprise"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Screens Allowed</Text>
                <TextInput
                  value={newOrgScreens}
                  onChangeText={setNewOrgScreens}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Storage Limit (GB)</Text>
                <TextInput
                  value={newOrgStorage}
                  onChangeText={setNewOrgStorage}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Renewal Date</Text>
                <TextInput
                  value={newOrgRenewal}
                  onChangeText={setNewOrgRenewal}
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateOrgModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleCreateOrg}>
                <Text style={styles.submitButtonText}>Create Org</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT ORGANIZATION MODAL */}
      <Modal visible={editingOrg !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Edit Organization</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Organization Name</Text>
                <TextInput
                  value={editOrgName}
                  onChangeText={setEditOrgName}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Full Name</Text>
                <TextInput
                  value={editOrgAdminName}
                  onChangeText={setEditOrgAdminName}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Contact Email</Text>
                <TextInput
                  value={editOrgAdminEmail}
                  onChangeText={setEditOrgAdminEmail}
                  style={styles.textInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Plan Tier</Text>
                <TextInput
                  value={editOrgPlanType}
                  onChangeText={setEditOrgPlanType}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Screens Allowed</Text>
                <TextInput
                  value={editOrgScreens}
                  onChangeText={setEditOrgScreens}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Storage Limit (GB)</Text>
                <TextInput
                  value={editOrgStorage}
                  onChangeText={setEditOrgStorage}
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Renewal Date</Text>
                <TextInput
                  value={editOrgRenewal}
                  onChangeText={setEditOrgRenewal}
                  style={styles.textInput}
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingOrg(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSaveEditOrg}>
                <Text style={styles.submitButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
    borderStyle: 'solid',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.16)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoCardWelcome: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(124, 58, 237, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCardName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#7c3aed',
    marginTop: 4,
  },
  infoCardOrg: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  screensBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  screensBadgeText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '800',
  },
  infoCardDivider: {
    height: 1,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    marginVertical: 16,
  },
  infoCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(124, 58, 237, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoMetaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  renewButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7c3aed',
  },
  menuContainer: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  menuItemIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    gap: 2,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  menuItemDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 16,
  },
  resourceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  resourceListText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
  },
  pageButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  pageButtonTextDisabled: {
    color: '#94a3b8',
  },
  pageIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabsWrapper: {
    height: 48,
    marginVertical: 4,
  },
  tabsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 38,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#334155',
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  whiteLabelAlert: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350f',
  },
  alertDescription: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  switchDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  orgItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
  },
  orgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
  },
  orgDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  orgDetailsLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  orgRenewal: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  licenseCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  licenseId: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  licensePrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  licenseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  licenseInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  txnItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
  },
  txnId: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  txnDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  txnMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  txnStatus: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
  },
  invoiceItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
  },
  invoiceId: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  invoiceDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  invoiceMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  invoiceStatus: {
    fontSize: 10,
    fontWeight: '900',
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 6,
  },
  docChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    maxWidth: 150,
  },
  docCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    marginTop: 8,
  },
  docCategory: {
    fontSize: 9,
    fontWeight: '900',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  closeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 6,
  },
  docContent: {
    fontSize: 12,
    color: '#334155',
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '500',
  },
  videoLinkContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  videoLinkTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  videoLinkUrl: {
    fontSize: 11,
    color: '#2563eb',
    marginTop: 2,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    paddingRight: 10,
  },
  faqArrow: {
    fontSize: 10,
    color: '#94a3b8',
  },
  faqAnswer: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 10,
    gap: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  ticketId: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  ticketStatusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ticketStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  ticketSubject: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  ticketDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '500',
  },
  ticketDate: {
    fontSize: 10,
    color: '#94a3b8',
  },
  ticketSeverity: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  userCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  userRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  userCompany: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  cancelButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});