# Samsung Tizen SSSP Digital Signage Application - Signing & Deployment Guide

---

# SECTION 1: Active Working Build Guide (Current)

This section contains the active, working build process verified for Samsung Tizen commercial displays (SSSP).

## 1. Overview & Architecture

Samsung Tizen displays enforce strict security verification on web applications (`.wgt` packages). To successfully install and run an SSSP application via the **SSSP URL Launcher**, the package must be cryptographically signed using a valid dual-signature layout:

1. **Author Signature (`author-signature.xml`)**: Proves developer identity. Generated using the local author certificate (`manve_author.p12`).
2. **Distributor Signature (`signature1.xml`)**: Authorizes application privileges across Samsung hardware. Generated using the Samsung Partner distributor certificate loaded from `tizenbrewInstallerConfig.json`.

---

## 2. Cryptographic Prerequisites

### Key files used in the automated pipeline:

* **Author Key**: Located at `tizen/certs/manve_author.p12`
  * **Password**: `Alpha@2004`
  * **Generated via CLI**: `tz cert -n ManveTech -p Alpha@2004 -e manve.business@gmail.com -f tizen/certs/manve_author.p12`
* **Distributor Key**: Loaded from `/Users/preethamreddy/share/tizenbrewInstallerConfig.json`
  * **Issuer**: `VD DEVELOPER Partner CA Class` (Samsung Partner Level)
  * **Password**: Loaded from configuration JSON.

---

## 3. Automated Signing Pipeline (`tizen/sign.cjs`)

The project uses a custom Node.js script ([tizen/sign.cjs](file:///Users/preethamreddy/Projects/signage-os/tizen/sign.cjs)) that bypasses native CLI bugs (such as Go RDNSequence string parsing errors on Partner certificates) while strictly producing W3C-compliant XML Digital Signatures.

### Critical Signature Specification Rules:

1. **Explicit XML Namespaces**:
   * Both `<SignedInfo>` and `<Object Id="prop">` tags **must** explicitly declare `xmlns="http://www.w3.org/2000/09/xmldsig#"`.
   * Absence of this attribute causes the TV's security framework to evaluate the element under a blank namespace, resulting in signature mismatch error `<-4>`.
2. **Digest & Signature Algorithms**:
   * Hashes are computed using **SHA-512**.
   * Signatures are computed using **RSA-SHA512**.
3. **Automatic Versioning & Cache Management**:
   * On every execution, `sign.cjs` increments the patch version string (e.g. `1.0.95` -> `1.0.96`) in both `config.xml` and `sssp_config.xml`.
   * Version incrementing forces Samsung TVs to bypass internal installer caches and fetch fresh signature data over the network.
4. **Manifest Synchronization**:
   * `sign.cjs` measures the exact byte length of the generated `tizen.wgt` file and writes it into `<size>` in `sssp_config.xml`.

---

## 4. TV Setup Instructions (One-time Setup per TV)

To enable network installation via the SSSP URL Launcher during development:

1. **Turn on Developer Mode**:
   * Open the **Apps** menu on the TV.
   * Press `1` -> `2` -> `3` -> `4` -> `5` on the remote control.
   * Toggle **Developer Mode** to **ON**.
   * Enter your Mac's Host PC IP (e.g. `192.168.29.4`).
   * Click **OK**.
2. **Log into Samsung Account**:
   * Go to **Settings** -> **System** / **General** -> **Samsung Account**.
   * Sign in with your Samsung Developer credentials (`manve.business@gmail.com`).
3. **Restart Display**:
   * Hold down the **Power** button on the TV remote for 3 seconds until the display shuts down and cold-boots back up.

---

## 5. Daily Development & Build Workflow

Whenever you make code updates inside the `tizen/` folder (such as editing `app.js` or `index.html`), execute the following steps:

### Step 1: Package & Sign (Single Command)
Run the following compound command in your terminal:

```bash
zip -j tizen/Debug/tizen_unsigned.wgt tizen/README.md tizen/app.js tizen/config.xml tizen/index.css tizen/index.html && node tizen/sign.cjs && rm tizen/Debug/tizen_unsigned.wgt
```

### Step 2: Commit & Deploy
1. Open **GitHub Desktop**.
2. Commit the updated files (`tizen/Debug/tizen.wgt`, `tizen/config.xml`, `tizen/sssp_config.xml`).
3. Click **Push origin** to upload the commit to GitHub.
4. Wait 30–60 seconds for Coolify / server deployment to update `http://tizen.manve.co`.

### Step 3: Run on TV
1. On the TV, open the **SSSP URL Launcher**.
2. Enter **`http://tizen.manve.co`**.
3. The TV will pull `sssp_config.xml`, download `tizen.wgt`, verify the signatures, and launch the player!

---

## 6. Commercial Production Rollout (External Clients)

When deploying to client locations where Developer Mode cannot be enabled:

1. Take the compiled `tizen.wgt` package.
2. Log into the [Samsung TV Seller Office](https://seller.samsungapps.com/tv).
3. Submit the application as a **Private Enterprise Application**.
4. Once approved, Samsung will re-sign the application with their global production key.
5. The application will then run out-of-the-box on **any Samsung TV worldwide** without requiring Developer Mode or manual setup!

---
---

# SECTION 2: Legacy / Historical Build Guide (Original Reference)

This section contains the original build guide preserved for historical reference.

## How It Works

Commercial Samsung displays require a valid digital signature chain issued by a **Samsung Partner Root Certificate Authority**. If a package is unsigned or signed using a public Tizen CA, the TV's security framework blocks installation, returning an "Unable to start app" error.

This setup uses a standalone Node.js-based cryptosigner (`tizen/sign.js`) which:
1. **Reads Keys**: Loads your Samsung Author and Partner Distributor PKCS12 (`.p12`) keys from `/Users/preethamreddy/share/tizenbrewInstallerConfig.json`.
2. **Generates Digests**: Calculates cryptographically secure SHA-512 hashes for all files in the widget package.
3. **Applies Signatures**: Sign those digests using RSA-SHA512 with the private keys to produce the standard XML Digital Signatures (`author-signature.xml` and `signature1.xml`).
4. **Builds Manifest**: Modifies `tizen/sssp_config.xml` to match the exact byte size of the signed package and increments the version string (forcing the TV to discard its installer cache and pull the updated package).

This decouples your build pipeline completely from Tizen Studio IDE GUI profile manager, Java GUI popups, and Go compiler RDNSequence parsing bugs!

## Build & Sign Workflow

Whenever you modify any code inside the `tizen/` directory (e.g. `app.js` or `index.html`):

### 1. Package Unsigned Files
Zip the 5 core code files into a temporary archive:
```bash
zip -j tizen/Debug/tizen_unsigned.wgt tizen/README.md tizen/app.js tizen/config.xml tizen/index.css tizen/index.html
```

### 2. Sign and Update SSSP Manifest
Run the signing script:
```bash
node tizen/sign.cjs
```
This script will:
* Load the certificates from `tizenbrewInstallerConfig.json`.
* Sign the package and output `tizen/Debug/tizen.wgt`.
* Read the byte size and write it to `tizen/sssp_config.xml`.
* Auto-increment the version number (e.g. `1.0.3` -> `1.0.4`) so the TV pulls a fresh copy.
* Delete any temporary/unsigned files.

### 3. Deploy
Add the changes to Git and push them:
```bash
git add .
git commit -m "feat: updated player widget and signed package"
git push origin main
```

Once Coolify completes building, go to your TV network settings and run the URL Launcher installation using `http://tizen.manve.co`. The TV will pull the new package and install it successfully!
