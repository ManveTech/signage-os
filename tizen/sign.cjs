const fs = require('fs');
const path = require('path');
const { Signature } = require('tizen');
const forge = require('node-forge');
const JSZip = require('jszip');

const configPath = '/Users/preethamreddy/share/tizenbrewInstallerConfig.json';
const unsignedWgtPath = path.join(__dirname, 'Debug/tizen_unsigned.wgt');
const signedWgtPath = path.join(__dirname, 'Debug/tizen.wgt');
const ssspConfigPath = path.join(__dirname, 'sssp_config.xml');

function resignPackage(certificates, packageBuffer, newVer) {
    return new Promise(async (resolve, reject) => {
        try {
            const zip = await JSZip.loadAsync(packageBuffer);

            // Update the version in config.xml directly inside the zip in memory before signing
            if (newVer && zip.file('config.xml')) {
                let configXmlText = await zip.file('config.xml').async('string');
                configXmlText = configXmlText.replace(/(<widget\s+[^>]*\bversion=")[^"]+(")/, `$1${newVer}$2`);
                zip.file('config.xml', configXmlText);
            }

            const files = await Promise.all(
                Object.keys(zip.files).map(async (filename) => {
                    const file = zip.files[filename];
                    if (file.dir) return null;
                    if (file.name.includes('signature') && file.name.endsWith('.xml')) return null;
                    const data = await file.async('nodebuffer');
                    return {
                        uri: encodeURIComponent(filename),
                        data
                    };
                })
            );

            const filteredFiles = files.filter(file => file !== null);

            const p12Asn1 = forge.asn1.fromDer(certificates.distributorCert);
            const distributorP12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certificates.distributorPassword);
            const p12Asn1Author = forge.asn1.fromDer(certificates.authorCert);
            const authorP12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1Author, false, certificates.authorPassword);

            const AuthorSignature = new Signature('AuthorSignature', filteredFiles);
            const filesAuthor = await AuthorSignature.sign(authorP12);
            const DistributorSignature = new Signature('DistributorSignature', filesAuthor);
            const signedFiles = await DistributorSignature.sign(distributorP12);

            // Create a new zip
            const newZip = new JSZip();
            for (const file of signedFiles) {
                newZip.file(decodeURIComponent(file.uri), file.data);
            }

            resolve(await newZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
        } catch (error) {
            reject(new Error(`Resigning Package Error: ${error.message}`));
        }
    });
}

async function run() {
    try {
        console.log('Loading configurations from tizenbrewInstallerConfig.json...');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Configuration file not found at: ${configPath}`);
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        const localAuthorCertPath = '/Users/preethamreddy/Projects/signage-os/tizen/certs/manve_author.p12';
        const certificates = {
            authorCert: fs.readFileSync(localAuthorCertPath, 'binary'),
            authorPassword: 'Alpha@2004',
            distributorCert: Buffer.from(config.distributorCert, 'base64').toString('binary'),
            distributorPassword: config.password
        };
        
        console.log('Reading unsigned widget...');
        if (!fs.existsSync(unsignedWgtPath)) {
            throw new Error(`Unsigned widget not found at: ${unsignedWgtPath}. Run pack script first!`);
        }
        const unsignedBuffer = fs.readFileSync(unsignedWgtPath);
        
        // Read current version from sssp_config.xml and determine new version to increment
        let ssspXml = fs.readFileSync(ssspConfigPath, 'utf8');
        let newVer = '1.0.0';
        const verMatch = ssspXml.match(/<ver>(\d+)\.(\d+)\.(\d+)<\/ver>/);
        if (verMatch) {
            const major = verMatch[1];
            const minor = verMatch[2];
            const patch = parseInt(verMatch[3]) + 1;
            newVer = `${major}.${minor}.${patch}`;
            ssspXml = ssspXml.replace(/<ver>[^<]+<\/ver>/, `<ver>${newVer}</ver>`);
            console.log(`Incrementing version to: ${newVer}`);
        }
        
        console.log('Cryptographically signing widget with Samsung Partner keys...');
        const signedBuffer = await resignPackage(certificates, unsignedBuffer, newVer);
        
        console.log('Writing signed widget to disk...');
        fs.writeFileSync(signedWgtPath, signedBuffer);
        console.log(`Signed widget size: ${signedBuffer.length} bytes`);
        
        // Automatically update sssp_config.xml with the correct size
        console.log('Updating sssp_config.xml size...');
        ssspXml = ssspXml.replace(/<size>\d+<\/size>/, `<size>${signedBuffer.length}</size>`);
        
        fs.writeFileSync(ssspConfigPath, ssspXml);
        console.log('SUCCESS! Widget signed and SSSP manifest updated.');
    } catch (e) {
        console.error('Failed to sign package:', e.message);
        process.exit(1);
    }
}

run();
