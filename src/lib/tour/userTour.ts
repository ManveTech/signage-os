import type { TourStep } from './runner';
import { firstVisible } from './runner';
import { USER_ROUTES } from '../routes';

/**
 * The client-user orientation tour. See adminTour.ts for why sections that
 * only expand (My Screens, My Channel, Support) carry no `route` — there's
 * no standalone page for the section itself, just its children.
 */
export function getUserTourSteps(): TourStep[] {
  return [
    {
      route: USER_ROUTES['dashboard'],
      element: '[data-tour="kpi-cards"]',
      popover: {
        title: 'Welcome to Your Dashboard',
        description: 'Your screens, license status, and recent activity — everything you need at a glance.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-my-screens"]', '[data-tour="dock-screens"]'),
      popover: {
        title: 'My Screens',
        description: 'Pair a new display, organize them into groups, and check their status and logs here.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-my-channel"]', '[data-tour="dock-playlists"]'),
      popover: {
        title: 'My Channel',
        description: 'Upload media and build playlists — this is what actually plays on your screens.'
      }
    },
    {
      route: USER_ROUTES['license-billing'],
      element: firstVisible('[data-tour="sidebar-license-billing"]', '[data-tour="dock-licenses"]'),
      popover: {
        title: 'License & Billing',
        description: 'Your active plan, screen allowance, and billing history, all in one place.'
      }
    },
    {
      element: firstVisible('[data-tour="sidebar-support"]'),
      popover: {
        title: 'Support',
        description: 'Raise a ticket or browse the help center if you ever get stuck.'
      }
    },
    {
      route: USER_ROUTES['profile'],
      element: firstVisible('[data-tour="sidebar-profile"]'),
      popover: {
        title: 'Your Profile',
        description: 'Account details and security settings live here. That\'s the tour — you\'re all set.'
      }
    }
  ];
}
