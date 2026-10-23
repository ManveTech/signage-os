# Google Play listing — BlueStar DigiTech

Everything to paste into Play Console for the phone app
(`com.bluestardigitech.app`). Graphics are in this folder; see
"Rebuilding the graphics" at the end.

---

## Read first: "just a website in an app"

Google Play's **Minimum Functionality** policy rejects apps that are mainly a
webview of a website. This app is the dashboard in a Capacitor wrapper, so a
reviewer may raise it. What it does beyond the website, worth listing in the
description and in any appeal:

- **Native Google sign-in** with the phone's own Google account picker.
- **Print or save invoices as PDF** through Android's print service.
- **Scan a TV's pairing QR code** with the camera.
- Android back-button navigation and a phone-first layout with bottom tabs.

Start on **Internal testing** (light review, live within hours). Move to
production once clients use it.

---

## Store listing

**App name** (max 30): `BlueStar DigiTech`

**Short description** (max 80):

```
Manage your digital signage screens, playlists and media from your phone.
```

**Full description** (max 4000):

```
BlueStar DigiTech is the companion app for businesses running digital signage with BlueStar — standees, kiosks, video walls and TV screens. See every screen, change what it plays and keep your content fresh, wherever you are.

YOUR SCREENS, AT A GLANCE
• See which screens are online, offline or not yet linked
• Find out the moment a screen stops responding, with optional email alerts
• Check what each screen is playing, its group and player version

CHANGE WHAT PLAYS, FROM YOUR PHONE
• Switch a screen or a whole group to another playlist
• Schedule a playlist to start at a set time
• Sync, pause or check a screen remotely
• Connect a new TV by scanning the QR code it shows

CONTENT
• Upload images and videos straight from your phone
• Build playlists: arrange slides and set how long each one plays
• Send a playlist to one screen or to every screen in a group

LICENCE AND BILLING
• See your plan, what you're using and when it renews
• Renew securely with Razorpay (UPI, cards, net banking)
• Print or save GST invoices as PDF

SIGN-IN
Sign in with the account your BlueStar team set up for you — with your email and password, or with Google. New to BlueStar digital signage? Contact us at bluestardigitech.com.

The app is for BlueStar business customers; an account is needed to use it.
```

**App category:** Business  **Tags:** Business, Productivity

**Contact details:**
- Email: info@bluestarmetacraft.com (the website's contact — change if support should go elsewhere)
- Website: https://bluestardigitech.com
- Privacy policy: https://bluestardigitech.com/privacy

**Graphics** (this folder):

| Play Console field | File |
|---|---|
| App icon (512×512) | `BlueStar-icon-512.png` |
| Feature graphic (1024×500) | `BlueStar-feature-1024x500.png` |
| Phone screenshots (2–8) | `BlueStar-screenshot-1.png` … `-6.png`, in that order |

Tablet screenshots are optional; skip them for now.

**Release notes for 1.0.0:**

```
First release: screen status, remote playlist changes, media uploads, playlists, and licence & billing — in your pocket.
```

---

## App content (the mandatory declarations)

| Section | Answer |
|---|---|
| Privacy policy | `https://bluestardigitech.com/privacy` |
| App access | **All or some functionality is restricted.** Give reviewers a working login (see below) |
| Ads | **No**, the app contains no ads |
| Content rating | Fill the questionnaire as a **Utility / Productivity / Business** app: no violence, sexual content, gambling, drugs or user-to-user public content. Expect "Everyone" / "3+" |
| Target audience | **18 and over** only (a business tool) |
| News app | No |
| Government app | No |
| Financial features | None of the listed ones (it takes payments for its own service; it isn't a banking, loan or crypto app) |
| Health | No |
| Data safety | See below |

### App access: the reviewer's login

The whole app is behind a sign-in, so a reviewer who can't sign in rejects it.
Before submitting, create a **demo client on the live platform**: its own
licence, a couple of screens (they can be "not linked"), a few images and a
playlist. Give Play the email and password under **App access → Add
instructions**, e.g. "Sign in with the email and password below. Google
sign-in is not needed." Keep that account; every review uses it.

---

## Data safety form

Answers match the privacy policy. If a feature starts collecting something
new, update both.

**Overview questions**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only) |
| Which ways can users request that their data is deleted? | **Users can request that data is deleted** — by email, as described in the privacy policy. Accounts are created by BlueStar, not in the app, so no in-app sign-up/deletion flow is required |

**Data types — collected** (none are *shared*: the providers that handle data
for us, i.e. hosting, Razorpay and Google, are service providers, which Play
does not count as sharing). None are processed only on-device unless noted.

| Category → type | Collected | Required or optional | Purposes |
|---|---|---|---|
| Personal info → **Name** | Yes | Required | App functionality, Account management |
| Personal info → **Email address** | Yes | Required | App functionality, Account management, Developer communications |
| Personal info → **Phone number** | Yes | Optional | Account management |
| Personal info → **Address** | Yes | Optional (billing address on invoices) | App functionality |
| Personal info → **User IDs** | Yes | Required | App functionality, Account management, Fraud prevention/security |
| Financial info → **Payment info** | Yes (entered on Razorpay's checkout inside the app) | Optional (only when paying in-app) | App functionality |
| Financial info → **Purchase history** | Yes (licence payments, invoices) | Required | App functionality, Account management |
| Photos and videos → **Photos** | Yes (images uploaded for screens) | Optional | App functionality |
| Photos and videos → **Videos** | Yes (videos uploaded for screens) | Optional | App functionality |
| Messages → **Other in-app messages** | Yes (support tickets) | Optional | App functionality (customer support) |

**Not collected** — answer "No" for: location, contacts, calendar, health &
fitness, web browsing history, files & docs, audio, device or other IDs (the
phone app doesn't read any; screen IDs belong to the TVs), app activity and
diagnostics (no analytics or crash-reporting SDKs).

Notes for the form:
- **Camera:** used only to scan a pairing QR code; the image never leaves the
  phone, so it isn't "collected".
- **Video calls**, if turned on for an account, go directly between devices and
  aren't stored, so they aren't "collected" either.
- Each collected type is **not ephemeral** (it's stored), and none is used for
  advertising or personalisation.

---

## Releasing

1. `android/keystore.properties` and `android/bluestar-upload.jks` must be
   present (back them up — see `android/app/build.gradle`).
2. Raise `versionCode` in `android/app/build.gradle` for every upload.
3. Build, from the repo root:
   ```bash
   npm run build && npx cap sync android
   cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
   ```
4. Check it points at the live API before uploading (the root `.env` once held
   an old demo server):
   ```bash
   grep -l "api.bluestardigitech.com" android/app/src/main/assets/public/assets/*.js
   ```
5. Upload `android/app/build/outputs/bundle/release/app-release.aab`.

Most changes don't need a store release: the app talks to the same API, and
dashboard changes ship with the website. A new upload is only needed when the
bundled app itself must change.

## Rebuilding the graphics

```bash
# 1. the local demo stack from scripts/help-guides/README.md (seed.py), dashboard on :5175
node store-assets/capture.mjs     # raw/*.png + raw/lift.json — demo data only, never production
node store-assets/build.mjs       # slides, feature graphic and icon
```

Headlines and captions live in `SLIDES` in `build.mjs`.
