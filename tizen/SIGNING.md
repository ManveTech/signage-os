# Tizen Signage Player Signature & Build Guide

This directory contains the configurations and scripts to package and cryptographically sign the Tizen web widget for deployment on Samsung SSSP Displays (commercial TVs) via the SSSP URL Launcher.

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
