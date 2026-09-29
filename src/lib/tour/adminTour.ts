import type { TourStep } from './runner';
import { firstVisible } from './runner';
import { ADMIN_ROUTES } from '../routes';

/**
 * The admin orientation tour.
 *
 * Sidebar items that expand into children (My Screens, Client Screens, My
 * Channel, Licensing, Support, Settings) are only ever *toggled* by their own
 * click handler, not navigated to — there's no standalone route for "the My
 * Channel section" itself. Rather than fight that, those steps carry no
 * `route` at all: the sidebar renders on every dashboard page, so the step
 * just spotlights the nav entry from wherever the tour already is and
 * explains what's behind it. Only genuinely standalone pages (Dashboard,
 * Users, Organizations, Profile) get an actual route.
 *
 * `firstVisible` falls back from the desktop sidebar entry to the mobile
 * dock tab, so the same step works on both layouts without a second copy.
 *
 * A few sections (Client Screens, Users, Support, Profile) have no dock tab
 * of their own on mobile — they live inside the dock's "More" sheet instead.
 * Those steps fall back to `dock-more`: without it, `firstVisible` found
 * nothing on the app's mobile-width WebView and the runner silently skipped
 * the step, so the app's tour was quietly missing a third of the website's.
 */
export function getAdminTourSteps(): TourStep[] {
  return [
    {
      route: ADMIN_ROUTES['dashboard'],
      element: '[data-tour="kpi-cards"]',
      popover: {
        title: 'Your Command Center',
        description: 'A live snapshot of your whole network — total screens, who\'s online, and what needs attention, at a glance.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-my-screens"]', '[data-tour="dock-screens"]'),
      popover: {
        title: 'My Screens',
        description: 'Screens you manage directly — pair a new display, group them together, and check their pairing/heartbeat logs.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-screens"]', '[data-tour="dock-screens"]'),
      popover: {
        title: 'Client Screens',
        description: 'Every screen across every client organization — oversight, troubleshooting, and bulk actions in one place.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-my-channel"]', '[data-tour="dock-playlists"]'),
      popover: {
        title: 'My Channel',
        description: 'Your own media library and playlists — build a layout, drop in images or video, and schedule when it plays.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-licenses"]', '[data-tour="dock-licenses"]'),
      popover: {
        title: 'Licensing',
        description: 'The license pool, payment history, upcoming renewals, and invoices — everything billing-related lives here.'
      }
    },
    {
      route: ADMIN_ROUTES['users'],
      element: firstVisible('[data-tour="sidebar-users"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Clients & Users',
        description: 'Onboard a new client, assign them a license, and manage their account from here.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-support"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Support',
        description: 'Track ongoing issues, maintain your FAQ, and manage support documentation your clients see.'
      }
    },
    {
      route: ADMIN_ROUTES['profile'],
      element: firstVisible('[data-tour="sidebar-profile"]', '[data-tour="dock-more"]'),
      popover: {
        title: 'Your Profile',
        description: 'Account details, security, and (if you\'re a super admin) platform-wide integrations like payments and email — all here. That\'s the tour — you\'re all set.'
      }
    }
  ];
}
