import { useEffect, useState } from 'react';
import AppHeader, { HeaderSearchItem } from '../../../components/AppHeader';
import { mediaStore } from '../../../lib/mediaStore';

const breadcrumbMap: Record<string, string[]> = {
  dashboard: ['Dashboard'],
  'my-screens-list': ['Screens'],
  'screens-all': ['Screens'],
  'screens-manage': ['Screens'],
  'screens-add': ['Screens', 'Add screen'],
  'screens-groups': ['Screens', 'Groups'],
  'screens-logs': ['Screens', 'Logs'],
  'media-library': ['Media'],
  'playlists-all': ['Playlists'],
  'playlists-create': ['Playlists', 'Create playlist'],
  'playlists-scheduler': ['Playlists', 'Scheduler'],
  'reports-overview': ['Reports'],
  'reports-screens': ['Reports', 'Screens'],
  'reports-media': ['Reports', 'Media'],
  'reports-logs': ['Reports', 'Activity'],
  'license-billing': ['License & Billing'],
  'licenses-pool': ['License & Billing'],
  'video-conferencing': ['Video calls'],
  'settings-general': ['Settings'],
  'settings-player': ['Settings'],
  'settings-notifications': ['Settings'],
  support: ['Help & Support'],
  'support-tickets': ['Help & Support', 'My tickets'],
  'support-help': ['Help & Support', 'Help Center'],
  profile: ['Profile'],
};

const PAGES: HeaderSearchItem[] = [
  { title: 'Dashboard', type: 'Page', view: 'dashboard' },
  { title: 'My screens', type: 'Page', view: 'my-screens-list' },
  { title: 'Add a screen', type: 'Page', view: 'screens-add' },
  { title: 'Screen groups', type: 'Page', view: 'screens-groups' },
  { title: 'Media library', type: 'Page', view: 'media-library' },
  { title: 'Playlists', type: 'Page', view: 'playlists-all' },
  { title: 'Create a playlist', type: 'Page', view: 'playlists-create' },
  { title: 'Reports', type: 'Page', view: 'reports-overview' },
  { title: 'License & Billing', subtitle: 'Plan, invoices, payments', type: 'Page', view: 'license-billing' },
  { title: 'My support tickets', type: 'Page', view: 'support-tickets' },
  { title: 'Help Center', subtitle: 'Guides and FAQs', type: 'Page', view: 'support-help' },
  { title: 'Profile & password', type: 'Page', view: 'profile' },
];

type Props = {
  activeView: string;
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
  userEmail?: string;
  onToggleSidebar?: () => void;
  onSwitchToAdmin?: () => void;
};

export default function Header({ activeView, onNavigate, onLogout, userEmail = '', onSwitchToAdmin }: Props) {
  const read = () => ({
    name: localStorage.getItem(`signageos_user_name_${userEmail}`) || userEmail.split('@')[0],
    email: userEmail,
    avatar: localStorage.getItem(`signageos_user_avatar_${userEmail}`) || '',
  });
  const [profile, setProfile] = useState(read);
  const readBrand = () => ({
    name: localStorage.getItem('signageos_client_name') || localStorage.getItem('signageos_custom_company') || '',
    logo: localStorage.getItem('signageos_client_logo') || localStorage.getItem('signageos_custom_logo') || '',
  });
  const [brand, setBrand] = useState(readBrand);

  useEffect(() => {
    setProfile(read());
    const onProfile = () => setProfile(read());
    const onBrand = () => setBrand(readBrand());
    window.addEventListener('signageos_user_profile_updated', onProfile);
    window.addEventListener('signageos_branding_updated', onBrand);
    return () => {
      window.removeEventListener('signageos_user_profile_updated', onProfile);
      window.removeEventListener('signageos_branding_updated', onBrand);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const buildSearch = (): HeaderSearchItem[] => {
    const items = [...PAGES];
    mediaStore.getScreens()
      .filter(s => s.assignedToUserEmail === userEmail && s.status !== 'pairing' && s.status !== 'unlinked')
      .forEach(s => items.push({ title: s.name, subtitle: s.location, type: 'Screen', view: 'my-screens-list' }));
    mediaStore.getPlaylists()
      .filter(p => p.createdBy === userEmail)
      .forEach(p => items.push({ title: p.name, type: 'Playlist', view: 'playlists-all' }));
    mediaStore.getMedia()
      .filter(m => m.uploadedBy === userEmail)
      .forEach(m => items.push({ title: m.title, subtitle: m.type, type: 'Media', view: 'media-library' }));
    return items;
  };

  return (
    <AppHeader
      crumbs={breadcrumbMap[activeView] ?? ['Dashboard']}
      brandName={brand.name && brand.name !== 'SignageOS' ? brand.name : 'BlueStar DigiTech'}
      brandLogo={brand.logo}
      profile={profile}
      roleLabel="Client account"
      buildSearch={buildSearch}
      onNavigate={onNavigate}
      onLogout={onLogout}
      switchLabel={onSwitchToAdmin ? 'Back to admin view' : undefined}
      onSwitch={onSwitchToAdmin}
    />
  );
}
