import type { TourStep } from './runner';
import { firstVisible } from './runner';
import { ADMIN_ROUTES } from '../routes';

/**
 * The admin orientation tour — walks through each area and the main things
 * you do there: add a screen, manage it, upload media, build a playlist, and
 * the client/billing/support sections.
 *
 * Steps that point at something conditional (a screen card when no screens
 * exist yet, for example) are skipped by the runner when it isn't there.
 * `firstVisible` falls back from the desktop sidebar to the phone dock, so
 * the same steps work on both layouts.
 */
export function getAdminTourSteps(): TourStep[] {
  return [
    // ── Dashboard ──────────────────────────────────────────────────────────
    {
      route: ADMIN_ROUTES['dashboard'],
      element: '[data-tour="kpi-cards"]',
      popover: {
        title: 'Your network at a glance',
        description: 'How many screens are online right now — split into your own screens and your clients\'. Tap it to open the full list.'
      }
    },
    {
      element: '[data-tour="quick-actions"]',
      popover: {
        title: 'Quick actions',
        description: 'The three things you do most: add a screen, upload media, and create a playlist.'
      }
    },
    {
      element: '[data-tour="attention"]',
      popover: {
        title: 'Needs attention',
        description: 'Screens that went offline and licences that are expiring or unpaid show up here. Tap one to deal with it.'
      }
    },

    // ── My Screens ─────────────────────────────────────────────────────────
    {
      element: firstVisible('[data-tour="sidebar-my-screens"]', '[data-tour="dock-screens"]'),
      popover: {
        title: 'Screens',
        description: 'Everything about your TVs lives here: My Screens (yours), Client Screens (everyone else\'s), groups and activity logs.'
      }
    },
    {
      route: ADMIN_ROUTES['my-screens-list'],
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
        description: 'Online, Offline and Warning — each shows how many screens are in that state. Tap one to filter, tap it again to clear.'
      }
    },
    {
      element: '[data-tour="screen-card"]',
      popover: {
        title: 'Manage a screen',
        description: 'Tap any screen to open its details: change what it plays, Check status (asks the TV to answer right now), Pause / Resume, Sync, Clear cache, move it into a group, or Unlink the TV.'
      }
    },

    // ── Add Screen ─────────────────────────────────────────────────────────
    {
      route: ADMIN_ROUTES['screens-add-my'],
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
        description: 'Give it a name people recognise (e.g. "Lobby TV"), pick Landscape or Portrait to match how the TV is mounted, and its size. On the last step, open the signage app on the TV and type the 6-character code it shows — the TV starts playing within a few seconds.'
      }
    },

    // ── Groups & logs ──────────────────────────────────────────────────────
    {
      route: ADMIN_ROUTES['screens-groups-my'],
      element: '[data-tour="groups-new"]',
      popover: {
        title: 'Screen groups',
        description: 'Group screens that should behave the same — a floor, a branch, a window row. Give the group a playlist and every screen in it plays it; Sync, Pause or change volume for all of them at once.'
      }
    },
    {
      element: '[data-tour="group-card"]',
      popover: {
        title: 'A group',
        description: 'Tap a group to see its screens, add or remove screens, and change its playlist.'
      }
    },
    {
      route: ADMIN_ROUTES['screens-logs'],
      element: '[data-tour="logs-filters"]',
      popover: {
        title: 'Activity logs',
        description: 'Every pairing, going offline, coming back, sync and error, day by day. Filter by type to find out what happened to a screen and when.'
      }
    },

    // ── Media & playlists ──────────────────────────────────────────────────
    {
      element: firstVisible('[data-tour="sidebar-my-channel"]', '[data-tour="dock-playlists"]'),
      popover: {
        title: 'Content',
        description: 'Your media library and playlists — what your screens actually play.'
      }
    },
    {
      route: ADMIN_ROUTES['my-media'],
      element: '[data-tour="media-upload"]',
      popover: {
        title: 'Upload media',
        description: 'Add images and videos — tap Upload or drop files on the page. Files are stored once and reused in as many playlists as you like.'
      }
    },
    {
      element: '[data-tour="media-card"]',
      popover: {
        title: 'Your files',
        description: 'Tap a file to preview it, see which playlists use it, rename it, or delete it to free up storage.'
      }
    },
    {
      route: ADMIN_ROUTES['my-playlists'],
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
        description: 'Tap a playlist to see its slides, where it\'s playing, pause it everywhere, choose which screens play it, or edit it.'
      }
    },
    {
      route: ADMIN_ROUTES['my-create-playlist'],
      element: '[data-tour="create-media"]',
      popover: {
        title: 'Building a playlist: pick media',
        description: 'Tap + on any file (or drag it) to add it to the playlist. You can upload new files right here too.'
      }
    },
    {
      element: '[data-tour="create-timeline"]',
      popover: {
        title: 'Order and timing',
        description: 'Slides play top to bottom. Set how many seconds each image shows (videos play to the end), reorder them, or split a slide to show two files side by side.'
      }
    },
    {
      element: '[data-tour="create-settings"]',
      popover: {
        title: 'Playlist settings',
        description: 'Name it, choose Landscape or Portrait, the transition between slides, shuffle and loop, and optional widgets like a clock, news ticker or QR code.'
      }
    },
    {
      element: '[data-tour="create-save"]',
      popover: {
        title: 'Preview, then save',
        description: 'Preview plays it exactly as the TV will. Save, then assign it to screens from the playlist or the screen\'s details.'
      }
    },

    // ── Clients ────────────────────────────────────────────────────────────
    {
      route: ADMIN_ROUTES['screens-all'],
      element: firstVisible('[data-tour="screens-filters"]', '[data-tour="screens-search"]'),
      popover: {
        title: 'Client screens',
        description: 'Every client\'s screens in one list, with the same filters and actions — plus a filter for organization and a view of TVs still waiting to be paired.'
      }
    },
    {
      route: ADMIN_ROUTES['client-playlists'],
      element: firstVisible('[data-tour="playlist-card"]', '[data-tour="playlists-new"]'),
      popover: {
        title: 'Client playlists & media',
        description: 'Playlists and files your clients own. You can edit them or build new ones on a client\'s behalf.'
      }
    },
    {
      route: ADMIN_ROUTES['users'],
      element: firstVisible('[data-tour="sidebar-users"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Clients',
        description: 'Add a client (they get a login by email), assign or change their licence, and see their screens and renewal date.'
      }
    },
    {
      route: ADMIN_ROUTES['licenses-management'],
      element: firstVisible('[data-tour="sidebar-licenses"]', '[data-tour="dock-licenses"]'),
      popover: {
        title: 'Licensing',
        description: 'Create licences (screens, storage, price), see what\'s expiring, send renewal reminders, and track invoices and payments.'
      }
    },
    {
      route: ADMIN_ROUTES['reports-overview'],
      element: firstVisible('[data-tour="sidebar-reports"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Reports',
        description: 'Uptime, screens offline for over a day, the screens that drop out most, unused media and storage per client.'
      }
    },
    {
      route: ADMIN_ROUTES['support-issues'],
      element: firstVisible('[data-tour="sidebar-support"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Helpdesk',
        description: 'Reply to client tickets (they get an email), and keep the FAQs and guides your clients see up to date.'
      }
    },
    {
      route: ADMIN_ROUTES['profile'],
      element: firstVisible('[data-tour="sidebar-profile"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Your profile',
        description: 'Your photo, name, password and Razorpay keys. That\'s the tour — you can run it again any time from the Helpdesk.'
      }
    }
  ];
}
