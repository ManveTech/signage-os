import { useEffect, useState } from 'react';
import AppHeader, { HeaderSearchItem } from '../../../components/AppHeader';
import { mediaStore } from '../../../lib/mediaStore';

const breadcrumbMap: Record<string, string[]> = {
  dashboard: ['Dashboard'],
  'my-screens-list': ['My Screens', 'Screens'],
  'screens-groups-my': ['My Screens', 'Groups'],
  'screens-logs': ['My Screens', 'Logs'],
  'screens-add-my': ['My Screens', 'Add screen'],
  'screens-all': ['Client Screens', 'All screens'],
  'screens-manage': ['Client Screens', 'All screens'],
  'screens-add-client': ['Client Screens', 'Add screen'],
  'screens-add': ['Client Screens', 'Add screen'],
  'screens-groups-all': ['Client Screens', 'Groups'],
  'screens-groups': ['Client Screens', 'Groups'],
  'screens-logs-all': ['Client Screens', 'Logs'],
  'my-media': ['My Channel', 'Media'],
  'media-library': ['My Channel', 'Media'],
  'my-playlists': ['My Channel', 'Playlists'],
  'playlists-all': ['My Channel', 'Playlists'],
  'my-create-playlist': ['My Channel', 'Create playlist'],
  'playlists-create': ['Client Assets', 'Create playlist'],
  'playlists-scheduler': ['My Channel', 'Scheduler'],
  'client-media': ['Client Assets', 'Media'],
  'client-playlists': ['Client Assets', 'Playlists'],
  users: ['Clients'],
  organizations: ['Organizations'],
  'licenses-management': ['Licensing', 'Licenses'],
  'licenses-expirations': ['Licensing', 'Expiring'],
  'licenses-invoices': ['Licensing', 'Invoices'],
  'licenses-payments': ['Licensing', 'Payments'],
  'licenses-code': ['Licensing', 'License decoder'],
  'reports-overview': ['Reports'],
  'reports-screens': ['Reports', 'Screens'],
  'reports-media': ['Reports', 'Media'],
  'reports-logs': ['Reports', 'Activity'],
  support: ['Helpdesk'],
  'support-issues': ['Helpdesk', 'Tickets'],
  'support-faq': ['Helpdesk', 'FAQs'],
  'support-docs': ['Helpdesk', 'Guides'],
  integrations: ['Integrations'],
  'settings-general': ['Settings'],
  'video-conferencing': ['Video calls'],
  profile: ['Profile'],
};

const PAGES: HeaderSearchItem[] = [
  { title: 'Dashboard', type: 'Page', view: 'dashboard' },
  { title: 'My screens', type: 'Page', view: 'my-screens-list' },
  { title: 'Client screens', type: 'Page', view: 'screens-all' },
  { title: 'Add a screen', type: 'Page', view: 'screens-add-my' },
  { title: 'Screen groups', type: 'Page', view: 'screens-groups-all' },
  { title: 'Screen logs', type: 'Page', view: 'screens-logs-all' },
  { title: 'My playlists', type: 'Page', view: 'my-playlists' },
  { title: 'Create a playlist', type: 'Page', view: 'my-create-playlist' },
  { title: 'My media library', type: 'Page', view: 'my-media' },
  { title: 'Client playlists', type: 'Page', view: 'client-playlists' },
  { title: 'Client media', type: 'Page', view: 'client-media' },
  { title: 'Clients', type: 'Page', view: 'users' },
  { title: 'Organizations', type: 'Page', view: 'organizations' },
  { title: 'Licenses', subtitle: 'Licensing', type: 'Page', view: 'licenses-management' },
  { title: 'Invoices', subtitle: 'Licensing', type: 'Page', view: 'licenses-invoices' },
  { title: 'Payments', subtitle: 'Licensing', type: 'Page', view: 'licenses-payments' },
  { title: 'Reports', type: 'Page', view: 'reports-overview' },
  { title: 'Helpdesk', subtitle: 'Tickets, FAQs and guides', type: 'Page', view: 'support-issues' },
  { title: 'Integrations', subtitle: 'Storage, email, Google sign-in', type: 'Page', view: 'integrations' },
  { title: 'Profile & password', type: 'Page', view: 'profile' },
];

type Props = {
  activeView: string;
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
  onSwitchToClient?: () => void;
};

export default function Header({ activeView, onNavigate, onLogout, onSwitchToClient }: Props) {
  const read = () => ({
    name: localStorage.getItem('signageos_admin_name') || 'Administrator',
    email: localStorage.getItem('signageos_admin_email') || localStorage.getItem('signageos_user_email') || '',
    avatar: localStorage.getItem('signageos_admin_avatar') || '',
  });
  const [profile, setProfile] = useState(read);
  const readBrand = () => ({
    name: localStorage.getItem('signageos_custom_company') || localStorage.getItem('signageos_client_name') || '',
    logo: localStorage.getItem('signageos_custom_logo') || localStorage.getItem('signageos_client_logo') || '',
  });
  const [brand, setBrand] = useState(readBrand);

  // The old header listened for this event but kept rendering its first
  // snapshot, so a new photo or name only showed after a reload.
  useEffect(() => {
    const onProfile = () => setProfile(read());
    const onBrand = () => setBrand(readBrand());
    window.addEventListener('signageos_admin_profile_updated', onProfile);
    window.addEventListener('signageos_branding_updated', onBrand);
    return () => {
      window.removeEventListener('signageos_admin_profile_updated', onProfile);
      window.removeEventListener('signageos_branding_updated', onBrand);
    };
  }, []);

  const buildSearch = (): HeaderSearchItem[] => {
    const items = [...PAGES];
    mediaStore.getScreens().filter(s => s.status !== 'pairing' && s.status !== 'unlinked').forEach(s => {
      items.push({ title: s.name, subtitle: s.assignedToUserEmail || s.location, type: 'Screen', view: 'screens-all' });
    });
    mediaStore.getPlaylists().forEach(p => {
      items.push({ title: p.name, subtitle: p.createdBy, type: 'Playlist', view: 'my-playlists' });
    });
    mediaStore.getMedia().forEach(m => {
      items.push({ title: m.title, subtitle: m.uploadedBy, type: 'Media', view: 'my-media' });
    });
    try {
      JSON.parse(localStorage.getItem('signageos_users') || '[]')
        .filter((u: any) => u?.name && u.role !== 'admin' && u.role !== 'super_admin')
        .forEach((u: any) => items.push({ title: u.company || u.name, subtitle: `${u.name} · ${u.email}`, type: 'Client', view: 'users' }));
    } catch { /* ignore malformed cache */ }
    return items;
  };

  return (
    <AppHeader
      crumbs={breadcrumbMap[activeView] ?? ['Dashboard']}
      brandName={brand.name && brand.name !== 'SignageOS' ? brand.name : 'BlueStar DigiTech'}
      brandLogo={brand.logo}
      profile={profile}
      roleLabel="Administrator"
      buildSearch={buildSearch}
      onNavigate={onNavigate}
      onLogout={onLogout}
      switchLabel={onSwitchToClient ? 'Switch to client view' : undefined}
      onSwitch={onSwitchToClient}
    />
  );
}
