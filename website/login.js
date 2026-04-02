/* =============================================
   AgroBot — Login Page JavaScript
   Handles device connection + location permission
   ============================================= */

(() => {
    'use strict';

    // ─── Theme ───
    function initTheme() {
        const saved = localStorage.getItem('agrobot-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
    }
    initTheme();

    // ─── Particle Background (same as dashboard) ───
    function initParticles() {
        const canvas = document.getElementById('particles-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 3 + 1;
                this.speedY = -(Math.random() * 0.3 + 0.1);
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.3 + 0.05;
                this.type = Math.random() > 0.5 ? 'leaf' : 'drop';
            }
            update() {
                this.y += this.speedY;
                this.x += this.speedX;
                if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) {
                    this.reset();
                    this.y = canvas.height + 10;
                }
            }
            draw() {
                ctx.save();
                ctx.globalAlpha = this.opacity;
                if (this.type === 'leaf') {
                    ctx.fillStyle = '#4caf50';
                    ctx.beginPath();
                    ctx.ellipse(this.x, this.y, this.size * 2, this.size, Math.PI / 4, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillStyle = '#42a5f5';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        for (let i = 0; i < 30; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animate);
        }
        animate();
    }
    initParticles();

    // ─── DOM ───
    const form = document.getElementById('login-form');
    const deviceName = document.getElementById('device-name');
    const deviceId = document.getElementById('device-id');
    const deviceUrl = document.getElementById('device-url');
    const wifiModule = document.getElementById('wifi-module');
    const accessKey = document.getElementById('access-key');
    const rememberDevice = document.getElementById('remember-device');
    const btnConnect = document.getElementById('btn-connect');
    const btnLoader = document.getElementById('btn-loader');
    const btnText = btnConnect.querySelector('.btn-text');
    const btnArrow = btnConnect.querySelector('.btn-arrow');
    const formError = document.getElementById('form-error');
    const errorText = document.getElementById('error-text');
    const btnLocation = document.getElementById('btn-location');
    const locationPrompt = document.getElementById('location-prompt');
    const locationStatus = document.getElementById('location-status');
    const locationTextEl = document.getElementById('location-text');
    const togglePassword = document.getElementById('toggle-password');
    const savedDevicesContainer = document.getElementById('saved-devices');
    const savedList = document.getElementById('saved-list');

    let userLocation = null;

    // ─── Check if already logged in ───
    const session = JSON.parse(localStorage.getItem('agrobot-session') || 'null');
    if (session && session.deviceId) {
        window.location.href = 'index.html';
        return;
    }

    // ─── Load saved location from previous session ───
    const savedLocation = JSON.parse(localStorage.getItem('agrobot-location') || 'null');
    if (savedLocation) {
        userLocation = savedLocation;
        locationPrompt.classList.add('hidden');
        locationStatus.classList.remove('hidden');
        locationTextEl.textContent = `Location set (${savedLocation.lat.toFixed(2)}, ${savedLocation.lon.toFixed(2)})`;
    }

    // ─── Password Toggle ───
    togglePassword.addEventListener('click', () => {
        const isPassword = accessKey.type === 'password';
        accessKey.type = isPassword ? 'text' : 'password';
        togglePassword.innerHTML = isPassword
            ? '<i class="fas fa-eye-slash"></i>'
            : '<i class="fas fa-eye"></i>';
    });

    // ─── Location Permission ───
    btnLocation.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showLocationError('Geolocation is not supported by your browser.');
            return;
        }

        btnLocation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting...';
        btnLocation.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLocation = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                };
                localStorage.setItem('agrobot-location', JSON.stringify(userLocation));

                locationPrompt.classList.add('hidden');
                locationStatus.classList.remove('hidden');
                locationTextEl.textContent = `Location enabled (${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)})`;
            },
            (err) => {
                btnLocation.innerHTML = '<i class="fas fa-location-crosshairs"></i> Allow Location';
                btnLocation.disabled = false;
                showLocationError('Location access denied. Weather data won\'t be available.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    function showLocationError(msg) {
        locationStatus.classList.remove('hidden');
        locationStatus.style.background = 'rgba(244, 67, 54, 0.1)';
        locationStatus.style.color = '#f44336';
        locationStatus.innerHTML = `<i class="fas fa-times-circle"></i> <span>${msg}</span>`;
    }

    // ─── Load Saved Devices ───
    function loadSavedDevices() {
        const devices = JSON.parse(localStorage.getItem('agrobot-devices') || '[]');
        if (devices.length === 0) {
            savedDevicesContainer.classList.add('hidden');
            return;
        }

        savedDevicesContainer.classList.remove('hidden');
        savedList.innerHTML = devices.map((d, i) => `
            <button type="button" class="saved-device-btn" data-index="${i}">
                <i class="fas fa-microchip"></i>
                <span>${d.deviceName}</span>
                <span class="saved-id">${d.deviceId}</span>
                <span class="saved-remove" data-remove="${i}" title="Remove device">
                    <i class="fas fa-times"></i>
                </span>
            </button>
        `).join('');

        // Click to fill form
        savedList.querySelectorAll('.saved-device-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Don't trigger if clicking remove
                if (e.target.closest('.saved-remove')) return;

                const idx = parseInt(btn.dataset.index);
                const d = devices[idx];
                deviceName.value = d.deviceName;
                deviceId.value = d.deviceId;
                deviceUrl.value = d.serverUrl;
                wifiModule.value = d.wifiModule || 'esp8266';
                accessKey.value = d.accessKey || '';

                // Scroll to form
                form.scrollIntoView({ behavior: 'smooth' });
            });
        });

        // Remove device
        savedList.querySelectorAll('.saved-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.remove);
                devices.splice(idx, 1);
                localStorage.setItem('agrobot-devices', JSON.stringify(devices));
                loadSavedDevices();
            });
        });
    }
    loadSavedDevices();

    // ─── Form Submit ───
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const name = deviceName.value.trim();
        const id = deviceId.value.trim();
        let url = deviceUrl.value.trim();
        const module = wifiModule.value;
        const key = accessKey.value.trim();

        // Validation
        if (!name) return showError('Please enter a device name.');
        if (!id) return showError('Please enter a device ID.');
        if (!url) return showError('Please enter the server IP or URL.');

        // Normalize URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }

        // Show loading
        btnText.classList.add('hidden');
        btnArrow.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        btnConnect.disabled = true;

        try {
            // Test connection to the server
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            let connected = false;
            try {
                const res = await fetch(url + '/api/latest', {
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (res.ok) connected = true;
            } catch (fetchErr) {
                // If the provided URL fails, try relative (same server)
                try {
                    const res2 = await fetch('/api/latest');
                    if (res2.ok) {
                        url = window.location.origin;
                        connected = true;
                    }
                } catch (e2) {
                    // Still allow connection (device may be added later)
                    connected = true;
                }
            }

            // Build session
            const sessionData = {
                deviceName: name,
                deviceId: id,
                serverUrl: url,
                wifiModule: module,
                accessKey: key,
                location: userLocation,
                connectedAt: new Date().toISOString(),
            };

            // Save session
            localStorage.setItem('agrobot-session', JSON.stringify(sessionData));

            // Save to devices list if "remember" is checked
            if (rememberDevice.checked) {
                const devices = JSON.parse(localStorage.getItem('agrobot-devices') || '[]');
                // Check if already saved (by ID)
                const existing = devices.findIndex(d => d.deviceId === id);
                if (existing >= 0) {
                    devices[existing] = sessionData;
                } else {
                    devices.push(sessionData);
                }
                localStorage.setItem('agrobot-devices', JSON.stringify(devices));
            }

            // Save location
            if (userLocation) {
                localStorage.setItem('agrobot-location', JSON.stringify(userLocation));
            }

            // Redirect to dashboard
            btnLoader.innerHTML = '<i class="fas fa-check"></i> Connected!';
            btnLoader.style.color = '#fff';

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 600);

        } catch (err) {
            showError('Could not connect. Check the IP address and try again.');
            resetButton();
        }
    });

    function showError(msg) {
        formError.classList.remove('hidden');
        errorText.textContent = msg;
    }

    function hideError() {
        formError.classList.add('hidden');
    }

    function resetButton() {
        btnText.classList.remove('hidden');
        btnArrow.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        btnLoader.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Connecting...';
        btnConnect.disabled = false;
    }

})();
