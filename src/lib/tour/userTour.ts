import type { TourStep } from './runner';
import { firstVisible } from './runner';
import { USER_ROUTES } from '../routes';

/**
 * The client orientation tour — the same depth as the admin one, without
 * the client/billing administration: add and manage screens, upload media,
 * build a playlist, billing and support.
 *
 * Conditional steps (no screens / playlists yet) are skipped by the runner;
 * `firstVisible` falls back from the desktop sidebar to the phone dock.
 */
export function getUserTourSteps(): TourStep[] {
  return [
    // ── Dashboard ──────────────────────────────────────────────────────────
    {
      route: USER_ROUTES['dashboard'],
      element: '[data-tour="kpi-cards"]',
      popover: {
        title: 'Welcome to your dashboard',
        description: 'How many of your screens are online right now. Tap it to see them all.'
      }
    },
    {
      element: '[data-tour="quick-actions"]',
      popover: {
        title: 'Quick actions',
        description: 'Add a screen, upload media, or create a playlist in one tap.'
      }
    },
    {
      element: '[data-tour="attention"]',
      popover: {
        title: 'Needs attention',
        description: 'Screens that went offline and anything about your plan (renewal due, payment needed) show up here.'
      }
    },

    // ── Screens ────────────────────────────────────────────────────────────
    {
      element: firstVisible('[data-tour="sidebar-my-screens"]', '[data-tour="dock-screens"]'),
      popover: {
        title: 'Screens',
        description: 'Your TVs, the groups you put them in, and their activity logs.'
      }
    },
    {
      route: USER_ROUTES['my-screens-list'],
      element: '[data-tour="screens-add"]',
      popover: {
        title: 'Add a screen',
        description: 'Start here to connect a new TV. You\'ll name it, choose portrait or landscape, then type in the code the TV shows.'
      }
    },
    {
      element: '[data-tour="screens-search"]',
      popover: {
        title: 'Find a screen',
        description: 'Search by name or location, and switch between the card and list views.'
      }
    },
    {
      element: '[data-tour="screens-filters"]',
      popover: {
        title: 'Filter by status',
        description: 'Online, Offline and Warning, with a count for each. Tap one to filter, tap it again to clear.'
      }
    },
    {
      element: '[data-tour="screen-card"]',
      popover: {
        title: 'Manage a screen',
        description: 'Tap a screen to change what it plays, Check status (asks the TV to answer right now), Pause / Resume, Sync, Clear cache, put it in a group, or Unlink the TV.'
      }
    },
    {
      route: USER_ROUTES['screens-add'],
      element: '[data-tour="add-steps"]',
      popover: {
        title: 'Adding a screen: 4 short steps',
        description: 'Screen → Location → Content → Connect. Only the name is required; everything else can be changed later.'
      }
    },
    {
      element: '[data-tour="add-form"]',
      popover: {
        title: 'Name, orientation & size',
        description: 'Name it (e.g. "Lobby TV"), pick Landscape or Portrait to match how it\'s mounted, and its size. On the last step, open the signage app on the TV and type the 6-character code it shows — it starts playing within seconds.'
      }
    },
    {
      route: USER_ROUTES['screens-groups'],
      element: '[data-tour="groups-new"]',
      popover: {
        title: 'Screen groups',
        description: 'Group screens that should show the same thing. Give the group a playlist and every screen in it plays it — and Sync or Pause them all at once.'
      }
    },
    {
      route: USER_ROUTES['screens-logs'],
      element: '[data-tour="logs-filters"]',
      popover: {
        title: 'Activity logs',
        description: 'When each screen paired, went offline, came back or synced — handy when something looks wrong.'
      }
    },

    // ── Media & playlists ──────────────────────────────────────────────────
    {
      element: firstVisible('[data-tour="sidebar-my-channel"]', '[data-tour="dock-playlists"]'),
      popover: {
        title: 'Playlists & media',
        description: 'What your screens actually play: your uploaded files and the playlists built from them.'
      }
    },
    {
      route: USER_ROUTES['media-library'],
      element: '[data-tour="media-upload"]',
      popover: {
        title: 'Upload media',
        description: 'Add images and videos (or a YouTube link). Upload once, use in as many playlists as you like.'
      }
    },
    {
      route: USER_ROUTES['playlists-all'],
      element: '[data-tour="playlists-new"]',
      popover: {
        title: 'Playlists',
        description: 'A playlist is the sequence a screen plays on loop. Create one here.'
      }
    },
    {
      element: '[data-tour="playlist-card"]',
      popover: {
        title: 'Open a playlist',
        description: 'Tap one to see its slides and where it plays, pause it everywhere, choose its screens, or edit it.'
      }
    },
    {
      route: USER_ROUTES['playlists-create'],
      element: '[data-tour="create-media"]',
      popover: {
        title: 'Building a playlist: pick media',
        description: 'Tap + on a file (or drag it) to add it. You can upload new files right here too.'
      }
    },
    {
      element: '[data-tour="create-timeline"]',
      popover: {
        title: 'Order and timing',
        description: 'Slides play top to bottom. Set seconds per image (videos play to the end), reorder, or split a slide to show two files side by side.'
      }
    },
    {
      element: '[data-tour="create-settings"]',
      popover: {
        title: 'Playlist settings',
        description: 'Name it, choose Landscape or Portrait, the transition, shuffle and loop, plus optional widgets like a clock, ticker or QR code.'
      }
    },
    {
      element: '[data-tour="create-save"]',
      popover: {
        title: 'Preview, then save',
        description: 'Preview plays it exactly as your TV will. Save, then assign it to screens.'
      }
    },

    // ── Billing, support, profile ──────────────────────────────────────────
    {
      route: USER_ROUTES['license-billing'],
      element: firstVisible('[data-tour="sidebar-license-billing"]', '[data-tour="dock-licenses"]'),
      popover: {
        title: 'License & Billing',
        description: 'Your plan, how many screens and how much storage you\'re using, renewals, invoices and payments.'
      }
    },
    {
      route: USER_ROUTES['support-tickets'],
      element: firstVisible('[data-tour="sidebar-support"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Help & Support',
        description: 'Search the Help Center, or open a ticket — our team replies here and by email.'
      }
    },
    {
      route: USER_ROUTES['profile'],
      element: firstVisible('[data-tour="sidebar-profile"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Your profile',
        description: 'Your photo, name and password (and branding, if your plan includes it). That\'s the tour — run it again any time from Help & Support.'
      }
    }
  ];
}
