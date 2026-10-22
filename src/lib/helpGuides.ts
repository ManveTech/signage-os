/**
 * The built-in Help Center: step-by-step guides and FAQs for clients.
 *
 * These ship with the dashboard rather than living in the database, so every
 * account has them from the first sign-in and they change in the same commit
 * as the screens they describe. Guides and FAQs added from the admin
 * Helpdesk still appear alongside, under the team's own heading.
 *
 * Screenshots and the positions of their highlights come from
 * scripts/help-guides/capture.mjs (see helpShots.json). When a page changes,
 * re-run it rather than editing the numbers by hand.
 */

export type GuideCategory = 'Getting started' | 'Screens' | 'Content' | 'Plan & billing';

export interface GuideStep {
  /** Plain text. Numbers like (1) refer to the numbered marks on the screenshot. */
  text: string;
  /** Key into helpShots.json. */
  shot?: string;
}

export interface HelpGuide {
  id: string;
  title: string;
  category: GuideCategory;
  summary: string;
  /** Rough reading time, shown on the card. */
  minutes: number;
  steps: GuideStep[];
  tips?: string[];
}

export const GUIDE_CATEGORIES: GuideCategory[] = ['Getting started', 'Screens', 'Content', 'Plan & billing'];

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: 'first-sign-in',
    title: 'Sign in for the first time',
    category: 'Getting started',
    summary: 'Use the details from your welcome email, then choose your own password.',
    minutes: 2,
    steps: [
      { shot: 'sign-in', text: 'Open the sign-in link in your welcome email (or go to cms.bluestardigitech.com). Enter your email (1) and the temporary password from the email (2), then press Sign in (3).' },
      { shot: 'first-password', text: 'The first time, you are asked to choose your own password. Type it in (1), type it again (2) and press Save & Enter Portal (3). It needs at least 8 characters. From now on, the temporary password no longer works.' },
      { shot: 'dashboard', text: 'You are in. Everything lives in the menu on the left: My Screens (1) is your TVs, My Channel (2) is your photos, videos and playlists, and License & Billing (3) is your plan, limits and invoices.' },
    ],
    tips: [
      'Forgot your password? Press "Forgot password?" on the sign-in page. The reset link in the email works once, for 15 minutes.',
      'Only tick "Keep me signed in" on your own computer or phone.',
    ],
  },

  {
    id: 'add-screen',
    title: 'Add a screen and connect the TV',
    category: 'Screens',
    summary: 'Install the app on the TV, add the screen in your dashboard, and enter the code the TV shows.',
    minutes: 4,
    steps: [
      { text: 'Install the app on the TV. Open bluestardigitech.com/app in the TV\'s browser — on Android TV, in the free Downloader app. The download starts by itself; open the file and press Install. (On some TVs you first have to allow installs from that app.)' },
      { text: 'Open the Bluestar Signage app on the TV. It shows a 6-character pairing code and a QR code. Leave it on screen.' },
      { shot: 'screens-add-button', text: 'In your dashboard, go to My Screens and press Add Screen (1).' },
      { shot: 'add-screen-name', text: 'Give the screen a name people will recognise, usually where it is mounted (1). Choose Portrait or Landscape to match how the TV hangs (2), then press Continue (3). The next step asks where the screen is — you can skip it.' },
      { shot: 'add-screen-content', text: 'Choose what it should play: put it in a group (1) — it then plays the group\'s playlist — or pick a single playlist (2). You can change this at any time.' },
      { shot: 'add-screen-connect', text: 'Type the code from the TV (1) and press Connect TV (2). Within a few seconds the TV starts downloading and playing. On a phone you can press "Scan the QR code instead" and point the camera at the TV. Not at the TV yet? Press Connect later (3): the screen is saved as "Not linked" and you can pair it whenever you are ready.' },
    ],
    tips: [
      'Your plan includes a set number of screens — see License & Billing. When you reach it, a new TV can\'t be paired until the plan is upgraded.',
      'If the code is refused, check you typed the one the TV shows right now. Codes are only valid for a short time.',
    ],
  },

  {
    id: 'screen-status',
    title: 'Online, offline and heartbeats',
    category: 'Screens',
    summary: 'How the dashboard knows a TV is working, and what to do when one goes offline.',
    minutes: 3,
    steps: [
      { shot: 'screens-status', text: 'Every connected TV sends a small "heartbeat" to the server about once a minute. If none arrives for about 3 minutes, the screen is shown as Offline. The filters at the top (1) count your screens by status, and an offline screen is marked red (2).' },
      { shot: 'screen-offline', text: 'Open an offline screen to see when it was last heard from (1). Check status (2) asks the TV directly whether it is there. Sync now (3) makes it download its content again without stopping what is playing.' },
      { shot: 'settings-alerts', text: 'Want to know straight away? In Settings, turn on "Email me when a screen goes offline" (1). You get at most one email per screen every 30 minutes, and none while a screen is asleep on its schedule.' },
    ],
    tips: [
      'An offline TV keeps playing what it has already downloaded — it just can\'t receive changes until it is back.',
      'The usual causes: the TV was switched off at the wall, the Wi-Fi or network dropped, or someone closed the app. Turning the TV back on normally brings it back within a minute or two.',
    ],
  },

  {
    id: 'unlink-repair',
    title: 'Unlink, re-pair or replace a TV',
    category: 'Screens',
    summary: 'Move a screen to another TV, or reconnect one, without setting it up again.',
    minutes: 2,
    steps: [
      { shot: 'screen-unlink', text: 'In My Screens, open the screen and choose Unlink TV (1). The TV disconnects and goes back to showing a pairing code, but the screen keeps its name, playlist and group. Remove screen (2) is different: it deletes the screen and all its settings.' },
      { shot: 'screen-pair', text: 'To connect a TV again — the same one or a replacement — open the screen (it shows "Not linked") and choose Pair a TV (1). Enter the code the TV is showing. Everything you set up for that screen carries over.' },
    ],
    tips: [
      'Replacing a broken TV: install the app on the new one, then use Pair a TV on the existing screen. No need to add a new screen.',
      'Moving a TV to another spot: unlink it, then pair it to the screen for its new place.',
    ],
  },

  {
    id: 'groups',
    title: 'Group your screens',
    category: 'Screens',
    summary: 'Give several screens the same playlist and control them together.',
    minutes: 3,
    steps: [
      { shot: 'groups', text: 'Go to My Screens → Groups and press New Group (1). Name it — for example, after a branch — and choose its playlist. Screens that aren\'t in a group are listed below; use Add to group (2) to move one in.' },
      { shot: 'group-detail', text: 'Tap a group to manage it. Change playlist (1) switches every screen in the group at once. Add screens (2) brings more in. From here you can also schedule a playlist switch, restart the playlist, and sync or clear the cache on all its screens together.' },
      { text: 'A screen in a group always plays the group\'s playlist. To give one screen something different, open it and choose Remove from group first.' },
    ],
    tips: ['Sleep schedules can be set for a whole group (in Edit group) instead of screen by screen.'],
  },

  {
    id: 'upload-media',
    title: 'Upload photos and videos',
    category: 'Content',
    summary: 'Add files to your library, and the size limits that apply.',
    minutes: 3,
    steps: [
      { shot: 'media-library', text: 'Go to My Channel → All Media and press Upload (1). Choose one or more files, or drag them anywhere onto the page. Upload to playlist (2) does the same and also puts them straight into playlists — see "Add media to playlists".' },
      { text: 'Limits: images up to 20 MB each (very large photos are resized automatically), videos up to 300 MB each. Everything you upload counts towards your plan\'s storage, and the bar at the top of the page shows how much you have left.' },
    ],
    tips: [
      'For video, MP4 (H.264) plays on every TV.',
      'Match the shape of the screen: tall images (for example 1080 × 1920) for portrait screens, wide ones for landscape.',
      'Deleting a file also removes it from every playlist that used it.',
    ],
  },

  {
    id: 'create-playlist',
    title: 'Create a playlist',
    category: 'Content',
    summary: 'Put files in order, set how long each one shows, and choose how it plays.',
    minutes: 4,
    steps: [
      { shot: 'playlists', text: 'Go to My Channel → All Playlists and press New playlist (1).' },
      { shot: 'playlist-editor', text: 'Your files are under Media Assets (1). Click one, or drag it into the timeline, to add it as a slide — you can upload new files here too. In the timeline, Play time (2) is how many seconds each slide stays on screen; reorder slides with the arrows or by dragging. Layout splits the screen between two files. To change a playlist you made earlier, pick it from the menu at the top (3).' },
      { text: 'Below the timeline, name the playlist and choose its orientation (Portrait for tall screens), transition, shuffle, loop and volume. Widgets can add a clock, a QR code or scrolling text. Press Save Playlist.' },
    ],
    tips: [
      'A new playlist plays nowhere until you choose screens for it — see "Choose what a screen plays".',
      'Changes to a playlist reach every screen playing it on their own, usually within seconds.',
    ],
  },

  {
    id: 'add-to-playlists',
    title: 'Add media to playlists',
    category: 'Content',
    summary: 'Upload once and add the files to one or several playlists in the same step.',
    minutes: 2,
    steps: [
      { shot: 'media-upload-to-playlist', text: 'In All Media, press Upload to playlist and choose your files (1). Tick every playlist they should join (2) and set how many seconds each image stays on screen (3) — videos always play for their full length. Press Upload & add (4). The files are added to the end of each playlist you ticked.' },
      { text: 'To add files you have already uploaded, open the playlist in the editor (All Playlists → tap it → Edit playlist) and click them in Media Assets.' },
    ],
  },

  {
    id: 'assign-playlist',
    title: 'Choose what a screen plays',
    category: 'Content',
    summary: 'Put a playlist on screens, on a group, or switch it automatically at a set time.',
    minutes: 2,
    steps: [
      { shot: 'playlist-assign', text: 'From the playlist: in All Playlists, tap the playlist, then Choose screens (1) and tick the screens that should play it — or Assign to a group (2).' },
      { shot: 'screen-actions', text: 'From the screen: in My Screens, tap the screen and choose Change playlist (1).' },
      { text: 'To switch automatically — say, evening offers from 6 PM — open the screen or group and choose Schedule a playlist, then pick the playlist, date and time.' },
    ],
    tips: ['A screen in a group plays the group\'s playlist. Change it on the group, or take the screen out of the group first.'],
  },

  {
    id: 'plan-billing',
    title: 'Your plan, limits and payments',
    category: 'Plan & billing',
    summary: 'What your plan includes, how to pay or renew, and what happens if a payment is late.',
    minutes: 3,
    steps: [
      { shot: 'billing', text: 'Open License & Billing. Your plan shows what it includes (1) — how many screens and how much storage — and what you are using now (2). To pay or renew, press the button under your plan (3). Payment is handled securely by Razorpay.' },
      { text: 'Renewing early is safe: the new period is added after your current one ends, so you don\'t lose any days.' },
      { text: 'If a payment is late, your screens keep playing. Your dashboard stays open for 7 more days, then pauses until you pay — paying unlocks it straight away. Reminders are emailed a week before the renewal date and again when it is due.' },
      { text: 'Your invoices and payments are listed at the bottom of the page; open an invoice to print it or save it as a PDF. To show your business name, address and GSTIN on invoices, fill in Invoice details.' },
    ],
    tips: ['Need more screens or storage? Press "Need more screens or storage?" on the same page and we\'ll upgrade your plan.'],
  },
];

export const HELP_FAQS: { id: string; question: string; answer: string }[] = [
  { id: 'faq-screens-limit', question: 'How many screens can I connect?',
    answer: 'As many as your plan includes — License & Billing shows the number and how many you are using. To add more, press "Need more screens or storage?" on that page.' },
  { id: 'faq-files', question: 'Which files can I upload, and how big?',
    answer: 'Photos and videos. Images up to 20 MB each (large ones are resized automatically) and videos up to 300 MB each. MP4 (H.264) is the safest video format. Everything counts towards your plan\'s storage.' },
  { id: 'faq-internet', question: 'Does the TV need internet all the time?',
    answer: 'Only to receive changes. The TV keeps everything it needs on the device, so if the connection drops it carries on playing what it has. New content arrives as soon as it is back online.' },
  { id: 'faq-update', question: 'I changed a playlist. When does the TV update?',
    answer: 'Usually within seconds. If a screen still shows the old content, check it is Online in My Screens, then open it and press Sync now.' },
  { id: 'faq-black', question: 'The TV is black or nothing is playing.',
    answer: 'Open the screen in My Screens and check: it has a playlist (not "No playlist"), the playlist has slides, and the screen isn\'t paused or asleep. Then press Sync now. If that doesn\'t help, Clear cache makes it download everything again — the TV stays blank until that finishes.' },
  { id: 'faq-pairing-again', question: 'The TV is showing a pairing code again.',
    answer: 'It was unlinked from its screen. Open the screen in My Screens, choose Pair a TV and enter the code. Its playlist, group and settings are kept.' },
  { id: 'faq-new-tv', question: 'How do I get the app on a new TV?',
    answer: 'Open bluestardigitech.com/app on the TV — in its browser, or in the Downloader app on Android TV. The latest version downloads by itself. Then follow "Add a screen and connect the TV".' },
  { id: 'faq-night', question: 'How do I turn screens off at night?',
    answer: 'Set a sleep schedule: open the screen and choose Edit details (for a group, Edit group), then set the times under Sleep schedule. For a one-off, use Sleep now on the screen; "Back to sleep schedule" undoes it.' },
  { id: 'faq-portrait', question: 'My portrait screen shows content sideways.',
    answer: 'Set the playlist\'s orientation to Portrait in the playlist editor, and use tall images. If it is still sideways, the TV may also be rotated in its own settings — open a ticket and we\'ll sort it out with you.' },
  { id: 'faq-late', question: 'What happens if my payment is late?',
    answer: 'Your screens keep playing. Your dashboard stays open for 7 days after the renewal date, then pauses until you pay. Paying from License & Billing unlocks it straight away.' },
  { id: 'faq-renew-early', question: 'Can I pay before my renewal date?',
    answer: 'Yes. The new period starts when the current one ends, so you don\'t lose any days.' },
  { id: 'faq-invoices', question: 'Where are my invoices?',
    answer: 'At the bottom of License & Billing. Open one to print it or save it as a PDF. Add your GSTIN and address under Invoice details to show them on invoices.' },
  { id: 'faq-password', question: 'I forgot my password.',
    answer: 'Press "Forgot password?" on the sign-in page and enter your email. The link we send works once, for 15 minutes.' },
];
