/**
 * Route mapping table connecting URL endpoints to view keys across Admin & Client portals.
 */

export const ADMIN_ROUTES: Record<string, string> = {
  'dashboard': '/admin/dashboard',
  'client-screens': '/admin/client-screens',
  'my-media': '/admin/my-channel/media',
  'my-playlists': '/admin/my-channel/playlists',
  'my-create-playlist': '/admin/my-channel/playlists/create',
  'client-media': '/admin/client-assets/media',
  'client-playlists': '/admin/client-assets/playlists',
  'my-screens-list': '/admin/my-screens',
  'screens-all': '/admin/screens',
  'screens-add': '/admin/screens/add',
  'screens-add-client': '/admin/screens/add-client',
  'screens-add-my': '/admin/screens/add-my',
  'screens-assign': '/admin/screens/assign',
  'screens-manage': '/admin/screens/manage',
  'screens-groups-my': '/admin/my-screens/groups',
  'screens-groups-all': '/admin/screens/groups',
  'screens-logs': '/admin/my-screens/logs',
  'screens-logs-all': '/admin/screens/logs',
  'media-library': '/admin/media',
  'media-upload': '/admin/media/upload',
  'media-layout': '/admin/media/layout',
  'playlists-all': '/admin/playlists',
  'playlists-create': '/admin/playlists/create',
  'playlists-scheduler': '/admin/playlists/scheduler',
  'reports-overview': '/admin/reports/overview',
  'reports-screens': '/admin/reports/screens',
  'reports-media': '/admin/reports/media',
  'reports-logs': '/admin/reports/logs',
  'users': '/admin/users',
  'licenses-management': '/admin/licenses/management',
  'licenses-payments': '/admin/licenses/payments',
  'licenses-expirations': '/admin/licenses/expirations',
  'licenses-invoices': '/admin/licenses/invoices',
  'licenses-code': '/admin/license-decoder',
  'organizations': '/admin/organizations',
  'settings-general': '/admin/settings/general',
  'settings-storage': '/admin/settings/storage',
  'settings-player': '/admin/settings/player',
  'settings-notifications': '/admin/settings/notifications',
  'support': '/admin/support',
  'support-issues': '/admin/support/issues',
  'support-faq': '/admin/support/faq',
  'support-docs': '/admin/support/docs',
  'profile': '/admin/profile',
};

export const USER_ROUTES: Record<string, string> = {
  'dashboard': '/dashboard',
  'my-screens-list': '/screens',
  'screens-all': '/screens/all',
  'screens-add': '/screens/add',
  'screens-assign': '/screens/assign',
  'screens-manage': '/screens/manage',
  'screens-groups': '/screens/groups',
  'screens-logs': '/screens/logs',
  'media-library': '/media',
  'media-upload': '/media/upload',
  'media-layout': '/media/layout',
  'playlists-all': '/playlists',
  'playlists-create': '/playlists/create',
  'playlists-scheduler': '/playlists/scheduler',
  'reports-overview': '/reports/overview',
  'reports-screens': '/reports/screens',
  'reports-media': '/reports/media',
  'reports-logs': '/reports/logs',
  'users': '/users',
  'licenses-pool': '/licenses/pool',
  'licenses-assign': '/licenses/assign',
  'licenses-history': '/licenses/history',
  'organizations': '/organizations',
  'settings-general': '/settings/general',
  'settings-storage': '/settings/storage',
  'settings-player': '/settings/player',
  'settings-notifications': '/settings/notifications',
  'support': '/support',
  'support-tickets': '/support/tickets',
  'support-help': '/support/help',
  'profile': '/profile',
};

// Inverse mappings (Path -> View ID)
export const REVERSE_ADMIN_ROUTES: Record<string, string> = Object.entries(ADMIN_ROUTES).reduce(
  (acc, [viewId, path]) => {
    acc[path] = viewId;
    return acc;
  },
  {} as Record<string, string>
);

export const REVERSE_USER_ROUTES: Record<string, string> = Object.entries(USER_ROUTES).reduce(
  (acc, [viewId, path]) => {
    acc[path] = viewId;
    return acc;
  },
  {} as Record<string, string>
);

export function getAdminViewFromPath(pathname: string): string {
  const cleanPath = pathname.replace(/\/$/, '') || '/admin/dashboard';
  if (REVERSE_ADMIN_ROUTES[cleanPath]) return REVERSE_ADMIN_ROUTES[cleanPath];
  if (cleanPath === '/admin' || cleanPath === '/admin/') return 'dashboard';
  
  // Prefix match fallback
  for (const [viewId, path] of Object.entries(ADMIN_ROUTES)) {
    if (cleanPath.startsWith(path)) return viewId;
  }
  return 'dashboard';
}

export function getUserViewFromPath(pathname: string): string {
  const cleanPath = pathname.replace(/\/$/, '') || '/dashboard';
  if (REVERSE_USER_ROUTES[cleanPath]) return REVERSE_USER_ROUTES[cleanPath];
  if (cleanPath === '/' || cleanPath === '') return 'dashboard';
  
  // Prefix match fallback
  for (const [viewId, path] of Object.entries(USER_ROUTES)) {
    if (cleanPath.startsWith(path)) return viewId;
  }
  return 'dashboard';
}
