const fs = require('fs');
const path = require('path');
const { Signature } = require('tizen');
const forge = require('node-forge');
const JSZip = require('jszip');

const configPath = '/Users/preethamreddy/share/tizenbrewInstallerConfig.json';
const unsignedWgtPath = path.join(__dirname, 'Debug/tizen_unsigned.wgt');
const signedWgtPath = path.join(__dirname, 'Debug/tizen.wgt');
const ssspConfigPath = path.join(__dirname, 'sssp_config.xml');

function resignPackage(certificates, packageBuffer) {
    return new Promise(async (resolve, reject) => {
        try {
            const zip = await JSZip.loadAsync(packageBuffer);
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
            const distributorP12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certificates.password);
            const p12Asn1Author = forge.asn1.fromDer(certificates.authorCert);
            const authorP12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1Author, false, certificates.password);

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
        
        const certificates = {
            authorCert: Buffer.from(config.authorCert, 'base64').toString('binary'),
            distributorCert: Buffer.from(config.distributorCert, 'base64').toString('binary'),
            password: config.password
        };
        
        console.log('Reading unsigned widget...');
        if (!fs.existsSync(unsignedWgtPath)) {
            throw new Error(`Unsigned widget not found at: ${unsignedWgtPath}. Run pack script first!`);
        }
        const unsignedBuffer = fs.readFileSync(unsignedWgtPath);
        
        console.log('Cryptographically signing widget with Samsung Partner keys...');
        const signedBuffer = await resignPackage(certificates, unsignedBuffer);
        
        console.log('Writing signed widget to disk...');
        fs.writeFileSync(signedWgtPath, signedBuffer);
        console.log(`Signed widget size: ${signedBuffer.length} bytes`);
        
        // Automatically update sssp_config.xml with the correct size
        console.log('Updating sssp_config.xml size...');
        let ssspXml = fs.readFileSync(ssspConfigPath, 'utf8');
        ssspXml = ssspXml.replace(/<size>\d+<\/size>/, `<size>${signedBuffer.length}</size>`);
        
        // Auto-increment the version minor number (e.g. 1.0.3 -> 1.0.4) to clear TV installer cache
        const verMatch = ssspXml.match(/<ver>(\d+)\.(\d+)\.(\d+)<\/ver>/);
        if (verMatch) {
            const major = verMatch[1];
            const minor = verMatch[2];
            const patch = parseInt(verMatch[3]) + 1;
            const newVer = `${major}.${minor}.${patch}`;
            ssspXml = ssspXml.replace(/<ver>[^<]+<\/ver>/, `<ver>${newVer}</ver>`);
            console.log(`Incremented manifest version to: ${newVer}`);
        }
        
        fs.writeFileSync(ssspConfigPath, ssspXml);
        console.log('SUCCESS! Widget signed and SSSP manifest updated.');
    } catch (e) {
        console.error('Failed to sign package:', e.message);
        process.exit(1);
    }
}

run();
