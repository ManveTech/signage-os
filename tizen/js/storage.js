/**
 * SignageOS Player - Storage & Device Hardware Module
 */

window.SignageStorage = (function () {
    const { KEYS } = window.SignageConfig;

    function getOrGenerateUUID() {
        let uuid = localStorage.getItem(KEYS.UUID);
        if (!uuid) {
            uuid = 'tizen-uuid-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(KEYS.UUID, uuid);
        }
        return uuid;
    }

    function getFileURI(file) {
        if (file) {
            if (typeof file.toURI === 'function') {
                return file.toURI();
            } else if (typeof file.toURI === 'string') {
                return file.toURI;
            }
        }
        return '';
    }

    function checkScreenSize() {
        return new Promise((resolve) => {
            const urlParams = new URLSearchParams(window.location.search);
            const testInches = urlParams.get('test_inches');
            if (testInches) {
                const inches = parseInt(testInches, 10);
                console.log(`Query parameter test override detected: ${inches} inches`);
                resolve({ allowed: inches <= 43, size: inches });
                return;
            }

            if (!window.tizen || !window.tizen.systeminfo) {
                console.log("Not in Tizen environment, allowing all sizes.");
                resolve({ allowed: true, size: 0 });
                return;
            }

            let detectedInches = null;
            let displayDone = false;
            let buildDone = false;

            function checkDone() {
                if (displayDone && buildDone) {
                    if (detectedInches !== null && detectedInches > 43) {
                        resolve({ allowed: false, size: detectedInches });
                    } else {
                        resolve({ allowed: true, size: detectedInches || 0 });
                    }
                }
            }

            try {
                window.tizen.systeminfo.getPropertyValue("DISPLAY", (disp) => {
                    if (disp.physicalWidth && disp.physicalHeight) {
                        const widthMm = disp.physicalWidth;
                        const heightMm = disp.physicalHeight;
                        const diagonalMm = Math.sqrt(Math.pow(widthMm, 2) + Math.pow(heightMm, 2));
                        const inches = diagonalMm / 25.4;
                        console.log(`DISPLAY physical diagonal: ${inches.toFixed(2)} inches`);
                        if (inches > 0) {
                            detectedInches = Math.round(inches);
                        }
                    }
                    displayDone = true;
                    checkDone();
                }, (err) => {
                    console.warn("DISPLAY systeminfo fetch error:", err);
                    displayDone = true;
                    checkDone();
                });
            } catch (e) {
                console.error("DISPLAY property access exception:", e);
                displayDone = true;
                checkDone();
            }

            try {
                window.tizen.systeminfo.getPropertyValue("BUILD", (build) => {
                    if (build.model) {
                        console.log(`BUILD model detected: ${build.model}`);
                        const matches = build.model.match(/\d{2,}/);
                        if (matches && matches[0]) {
                            const sizeFromModel = parseInt(matches[0], 10);
                            console.log(`Parsed size from model code: ${sizeFromModel} inches`);
                            if (sizeFromModel > 0 && (!detectedInches || sizeFromModel > detectedInches)) {
                                detectedInches = sizeFromModel;
                            }
                        }
                    }
                    buildDone = true;
                    checkDone();
                }, (err) => {
                    console.warn("BUILD systeminfo fetch error:", err);
                    buildDone = true;
                    checkDone();
                });
            } catch (e) {
                console.error("BUILD property access exception:", e);
                buildDone = true;
                checkDone();
            }
        });
    }

    return {
        getOrGenerateUUID,
        getFileURI,
        checkScreenSize
    };
})();
