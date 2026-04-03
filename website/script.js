/* =============================================
   AgroBot — Dashboard JavaScript
   Vanilla JS, no dependencies except Chart.js
   ============================================= */

(() => {
    'use strict';

    // ─── Login Session Check ───
    const session = JSON.parse(localStorage.getItem('agrobot-session') || 'null');
    if (!session || !session.deviceId) {
        window.location.href = 'login.html';
        return;
    }

    // ─── Config ───
    const CONFIG = {
        REFRESH_INTERVAL: 10000,       // 10 seconds
        OFFLINE_THRESHOLD: 60000,      // 60 seconds
        ALERTS_PER_PAGE: 5,
        DRY_THRESHOLD: 20,
        WET_THRESHOLD: 75,
        OPTIMAL_LOW: 40,
        OPTIMAL_HIGH: 70,
        GAUGE_CIRCUMFERENCE: 2 * Math.PI * 85, // ~534.07
        WEATHER_REFRESH: 600000,       // 10 minutes
    };

    // ─── State ───
    const state = {
        currentMoisture: null,
        lastTimestamp: null,
        chartInstance: null,
        chartView: 'daily',
        alertsData: [],
        alertsPage: 1,
        bannerDismissed: false,
        animatingValue: 0,
        weatherData: null,
    };

    // ─── DOM References ───
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const DOM = {
        // Navbar
        themeToggle: $('#theme-toggle'),
        themeIcon: $('#theme-icon'),
        statusPill: $('#status-pill'),
        statusDot: $('#status-dot'),
        statusText: $('#status-text'),
        connectedDeviceName: $('#connected-device-name'),
        btnLogout: $('#btn-logout'),
        // Gauge
        skeletonGauge: $('#skeleton-gauge'),
        gaugeContainer: $('#gauge-container'),
        gaugeFill: $('#gauge-fill'),
        gaugeValue: $('#gauge-value'),
        gaugeGradStart: $('#gauge-grad-start'),
        gaugeGradEnd: $('#gauge-grad-end'),
        moistureStatus: $('#moisture-status'),
        lastUpdated: $('#last-updated'),
        // Stats
        skeletonAvg: $('#skeleton-avg'),
        skeletonMin: $('#skeleton-min'),
        skeletonMax: $('#skeleton-max'),
        contentAvg: $('#content-avg'),
        contentMin: $('#content-min'),
        contentMax: $('#content-max'),
        avgValue: $('#avg-value'),
        minValue: $('#min-value'),
        minTime: $('#min-time'),
        maxValue: $('#max-value'),
        maxTime: $('#max-time'),
        // Weather
        weatherLocation: $('#weather-location'),
        weatherNoLocation: $('#weather-no-location'),
        weatherGrid: null, // set after check
        skeletonTemp: $('#skeleton-temp'),
        skeletonHumidity: $('#skeleton-humidity'),
        skeletonWind: $('#skeleton-wind'),
        skeletonCondition: $('#skeleton-condition'),
        contentTemp: $('#content-temp'),
        contentHumidity: $('#content-humidity'),
        contentWind: $('#content-wind'),
        contentCondition: $('#content-condition'),
        weatherTempVal: $('#weather-temp-val'),
        weatherHumidityVal: $('#weather-humidity-val'),
        weatherWindVal: $('#weather-wind-val'),
        weatherConditionVal: $('#weather-condition-val'),
        conditionIcon: $('#condition-icon'),
        btnLocationRetry: $('#btn-location-retry'),
        // Chart
        skeletonChart: $('#skeleton-chart'),
        moistureChart: $('#moisture-chart'),
        btnDaily: $('#btn-daily'),
        btnHourly: $('#btn-hourly'),
        // Alerts
        skeletonAlerts: $('#skeleton-alerts'),
        alertsTable: $('#alerts-table'),
        alertsTbody: $('#alerts-tbody'),
        noAlerts: $('#no-alerts'),
        alertsPagination: $('#alerts-pagination'),
        prevPage: $('#prev-page'),
        nextPage: $('#next-page'),
        pageInfo: $('#page-info'),
        // Alert Banner
        alertBanner: $('#alert-banner'),
        alertBannerMessage: $('#alert-banner-message'),
        alertBannerDismiss: $('#alert-banner-dismiss'),
        // Device
        totalReadings: $('#total-readings'),
        infoDeviceName: $('#info-device-name'),
        infoDeviceId: $('#info-device-id'),
        infoWifiModule: $('#info-wifi-module'),
        infoServerUrl: $('#info-server-url'),
        btnRawData: $('#btn-raw-data'),
        // Modal
        modalOverlay: $('#raw-modal-overlay'),
        modalClose: $('#modal-close'),
        rawTbody: $('#raw-tbody'),
        // Canvas
        particlesCanvas: $('#particles-canvas'),
    };

    // ─── Populate Session Info ───
    function populateSessionInfo() {
        if (session.deviceName) {
            DOM.connectedDeviceName.textContent = session.deviceName;
            if (DOM.infoDeviceName) DOM.infoDeviceName.textContent = session.deviceName;
        }
        if (session.deviceId && DOM.infoDeviceId) {
            DOM.infoDeviceId.textContent = session.deviceId;
        }
        if (session.wifiModule && DOM.infoWifiModule) {
            const moduleNames = {
                'esp8266': 'ESP8266 (NodeMCU)',
                'esp32': 'ESP32',
                'esp8266-01': 'ESP8266-01',
                'other': 'Other',
            };
            DOM.infoWifiModule.textContent = moduleNames[session.wifiModule] || session.wifiModule;
        }
        if (session.serverUrl && DOM.infoServerUrl) {
            DOM.infoServerUrl.textContent = session.serverUrl;
        }
    }

    // ─── Theme Management ───
    function initTheme() {
        const saved = localStorage.getItem('agrobot-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('agrobot-theme', next);
        updateThemeIcon(next);
        if (state.chartInstance) {
            updateChartColors();
        }
    }

    function updateThemeIcon(theme) {
        DOM.themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // ─── Logout ───
    function logout() {
        localStorage.removeItem('agrobot-session');
        window.location.href = 'login.html';
    }

    // ─── Particle Background ───
    function initParticles() {
        const canvas = DOM.particlesCanvas;
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

        for (let i = 0; i < 40; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ─── Utility Functions ───
    function timeAgo(dateStr) {
        if (!dateStr) return 'No data';
        const now = new Date();
        const then = new Date(dateStr);
        const diffMs = now - then;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);

        if (diffSec < 10) return 'Just now';
        if (diffSec < 60) return `${diffSec} seconds ago`;
        if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
        return then.toLocaleDateString();
    }

    function formatTime(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function getMoistureInfo(val) {
        if (val < 20) return { label: 'Too Dry', colors: ['#f44336', '#e53935'], status: 'danger' };
        if (val < 40) return { label: 'Low', colors: ['#ff9800', '#fb8c00'], status: 'warning' };
        if (val <= 70) return { label: 'Optimal', colors: ['#4caf50', '#81c784'], status: 'success' };
        if (val <= 85) return { label: 'Wet', colors: ['#42a5f5', '#1e88e5'], status: 'info' };
        return { label: 'Waterlogged', colors: ['#1565c0', '#0d47a1'], status: 'info' };
    }

    // ─── Count-up Animation ───
    function animateValue(element, start, end, duration = 800) {
        const startTime = performance.now();
        const diff = end - start;

        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * eased);
            element.textContent = current;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ─── Gauge Update ───
    function updateGauge(moisture) {
        const info = getMoistureInfo(moisture);
        const fraction = moisture / 100;
        const offset = CONFIG.GAUGE_CIRCUMFERENCE * (1 - fraction);

        DOM.gaugeGradStart.setAttribute('stop-color', info.colors[0]);
        DOM.gaugeGradEnd.setAttribute('stop-color', info.colors[1]);
        DOM.gaugeFill.style.strokeDashoffset = offset;

        const prevVal = state.animatingValue || 0;
        state.animatingValue = moisture;
        animateValue(DOM.gaugeValue, prevVal, moisture);

        DOM.moistureStatus.textContent = info.label;
        DOM.moistureStatus.style.color = info.colors[0];
    }

    // ─── Device Status ───
    function updateDeviceStatus() {
        if (!state.lastTimestamp) {
            DOM.statusPill.className = 'status-pill';
            DOM.statusText.textContent = 'No data';
            return;
        }
        const diff = Date.now() - new Date(state.lastTimestamp).getTime();
        if (diff < CONFIG.OFFLINE_THRESHOLD) {
            DOM.statusPill.className = 'status-pill online';
            DOM.statusText.textContent = 'Device Online';
        } else {
            DOM.statusPill.className = 'status-pill offline';
            DOM.statusText.textContent = 'Device Offline';
        }
    }

    // ─── Alert Banner ───
    function checkAlertBanner(moisture) {
        if (state.bannerDismissed) return;
        if (moisture < CONFIG.DRY_THRESHOLD) {
            DOM.alertBanner.classList.remove('type-wet');
            DOM.alertBanner.classList.add('type-dry');
            DOM.alertBannerMessage.textContent =
                `Soil is too dry! Moisture at ${moisture}% \u2014 please water the plants.`;
            showBanner();
            sendNotification('Soil Too Dry!', `Moisture at ${moisture}%. Please water the plants.`);
        } else if (moisture > CONFIG.WET_THRESHOLD) {
            DOM.alertBanner.classList.remove('type-dry');
            DOM.alertBanner.classList.add('type-wet');
            DOM.alertBannerMessage.textContent =
                `Soil is waterlogged! Moisture at ${moisture}% \u2014 check drainage.`;
            showBanner();
            sendNotification('Soil Waterlogged!', `Moisture at ${moisture}%. Check drainage.`);
        } else {
            hideBanner();
        }
    }

    function showBanner() {
        DOM.alertBanner.classList.remove('hidden');
        requestAnimationFrame(() => DOM.alertBanner.classList.add('visible'));
    }

    function hideBanner() {
        DOM.alertBanner.classList.remove('visible');
    }

    // ─── Browser Notifications ───
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function sendNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    // ─── Show / Hide Skeletons ───
    function showContent(skeletonEl, contentEl) {
        if (skeletonEl) skeletonEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');
    }

    function showError(containerEl, msg) {
        if (!containerEl) return;
        containerEl.innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-circle"></i>
                <p>${msg}</p>
            </div>`;
    }

    // ─── API Fetch Wrapper ───
    async function apiFetch(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // ─── Fetch Latest Moisture ───
    async function fetchLatest() {
        try {
            const data = await apiFetch('/api/latest');
            state.currentMoisture = data.moisture;
            state.lastTimestamp = data.timestamp;

            showContent(DOM.skeletonGauge, DOM.gaugeContainer);
            updateGauge(data.moisture);
            DOM.lastUpdated.innerHTML = `<i class="far fa-clock"></i> Last updated: ${timeAgo(data.timestamp)}`;
            updateDeviceStatus();
            checkAlertBanner(data.moisture);
        } catch (err) {
            console.warn('fetchLatest error:', err);
            showContent(DOM.skeletonGauge, DOM.gaugeContainer);
            DOM.gaugeValue.textContent = '\u2014';
            DOM.moistureStatus.textContent = 'No data';
            DOM.lastUpdated.innerHTML = '<i class="fas fa-exclamation-circle"></i> No data \u2014 device may be offline';
            DOM.statusPill.className = 'status-pill offline';
            DOM.statusText.textContent = 'Offline';
        }
    }

    // ─── Fetch Stats ───
    async function fetchStats() {
        try {
            const data = await apiFetch('/api/stats');

            showContent(DOM.skeletonAvg, DOM.contentAvg);
            showContent(DOM.skeletonMin, DOM.contentMin);
            showContent(DOM.skeletonMax, DOM.contentMax);

            DOM.avgValue.textContent = `${data.avg_today}%`;
            DOM.minValue.textContent = `${data.min_today}%`;
            DOM.minTime.textContent = `at ${formatTime(data.min_time)}`;
            DOM.maxValue.textContent = `${data.max_today}%`;
            DOM.maxTime.textContent = `at ${formatTime(data.max_time)}`;
            DOM.totalReadings.textContent = data.total_readings;
        } catch (err) {
            console.warn('fetchStats error:', err);
            showContent(DOM.skeletonAvg, DOM.contentAvg);
            showContent(DOM.skeletonMin, DOM.contentMin);
            showContent(DOM.skeletonMax, DOM.contentMax);
            DOM.avgValue.textContent = '\u2014';
            DOM.minValue.textContent = '\u2014';
            DOM.maxValue.textContent = '\u2014';
        }
    }

    // ─── Weather (Open-Meteo — Free, No API Key) ───
    const WEATHER_CODES = {
        0: { label: 'Clear Sky', icon: 'fa-sun' },
        1: { label: 'Mainly Clear', icon: 'fa-sun' },
        2: { label: 'Partly Cloudy', icon: 'fa-cloud-sun' },
        3: { label: 'Overcast', icon: 'fa-cloud' },
        45: { label: 'Fog', icon: 'fa-smog' },
        48: { label: 'Rime Fog', icon: 'fa-smog' },
        51: { label: 'Light Drizzle', icon: 'fa-cloud-rain' },
        53: { label: 'Drizzle', icon: 'fa-cloud-rain' },
        55: { label: 'Dense Drizzle', icon: 'fa-cloud-showers-heavy' },
        61: { label: 'Light Rain', icon: 'fa-cloud-rain' },
        63: { label: 'Rain', icon: 'fa-cloud-showers-heavy' },
        65: { label: 'Heavy Rain', icon: 'fa-cloud-showers-heavy' },
        71: { label: 'Light Snow', icon: 'fa-snowflake' },
        73: { label: 'Snow', icon: 'fa-snowflake' },
        75: { label: 'Heavy Snow', icon: 'fa-snowflake' },
        80: { label: 'Rain Showers', icon: 'fa-cloud-showers-heavy' },
        81: { label: 'Moderate Showers', icon: 'fa-cloud-showers-heavy' },
        82: { label: 'Violent Showers', icon: 'fa-cloud-showers-heavy' },
        95: { label: 'Thunderstorm', icon: 'fa-bolt' },
        96: { label: 'Thunderstorm + Hail', icon: 'fa-bolt' },
        99: { label: 'Severe Thunderstorm', icon: 'fa-bolt' },
    };

    async function fetchWeather() {
        const location = session.location || JSON.parse(localStorage.getItem('agrobot-location') || 'null');

        if (!location) {
            // No location — show prompt
            const weatherGrid = document.querySelector('.weather-grid');
            if (weatherGrid) weatherGrid.classList.add('hidden');
            if (DOM.weatherNoLocation) DOM.weatherNoLocation.classList.remove('hidden');
            if (DOM.weatherLocation) DOM.weatherLocation.innerHTML = '<i class="fas fa-map-marker-alt"></i> Location not available';
            // Hide skeletons
            showContent(DOM.skeletonTemp, null);
            showContent(DOM.skeletonHumidity, null);
            showContent(DOM.skeletonWind, null);
            showContent(DOM.skeletonCondition, null);
            return;
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
            const res = await fetch(url);
            const data = await res.json();
            const current = data.current;

            state.weatherData = current;

            // Temperature
            showContent(DOM.skeletonTemp, DOM.contentTemp);
            DOM.weatherTempVal.textContent = `${current.temperature_2m}\u00B0C`;

            // Humidity
            showContent(DOM.skeletonHumidity, DOM.contentHumidity);
            DOM.weatherHumidityVal.textContent = `${current.relative_humidity_2m}%`;

            // Wind
            showContent(DOM.skeletonWind, DOM.contentWind);
            DOM.weatherWindVal.textContent = `${current.wind_speed_10m} km/h`;

            // Condition
            showContent(DOM.skeletonCondition, DOM.contentCondition);
            const wc = WEATHER_CODES[current.weather_code] || { label: 'Unknown', icon: 'fa-cloud' };
            DOM.weatherConditionVal.textContent = wc.label;
            DOM.conditionIcon.className = `fas ${wc.icon}`;

            // Location label — reverse geocode from Open-Meteo timezone
            if (data.timezone) {
                const parts = data.timezone.split('/');
                const city = parts[parts.length - 1].replace(/_/g, ' ');
                DOM.weatherLocation.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${city}`;
            }

        } catch (err) {
            console.warn('fetchWeather error:', err);
            showContent(DOM.skeletonTemp, DOM.contentTemp);
            showContent(DOM.skeletonHumidity, DOM.contentHumidity);
            showContent(DOM.skeletonWind, DOM.contentWind);
            showContent(DOM.skeletonCondition, DOM.contentCondition);
            DOM.weatherTempVal.textContent = '\u2014';
            DOM.weatherHumidityVal.textContent = '\u2014';
            DOM.weatherWindVal.textContent = '\u2014';
            DOM.weatherConditionVal.textContent = 'Unavailable';
            DOM.weatherLocation.innerHTML = '<i class="fas fa-exclamation-circle"></i> Weather data unavailable';
        }
    }

    function requestLocationForWeather() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                localStorage.setItem('agrobot-location', JSON.stringify(loc));

                // Update session
                session.location = loc;
                localStorage.setItem('agrobot-session', JSON.stringify(session));

                // Show weather grid, hide prompt
                const weatherGrid = document.querySelector('.weather-grid');
                if (weatherGrid) weatherGrid.classList.remove('hidden');
                if (DOM.weatherNoLocation) DOM.weatherNoLocation.classList.add('hidden');

                fetchWeather();
            },
            () => {
                alert('Location access was denied. Please enable it in your browser settings.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // ─── Chart ───
    function getChartColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            text: isDark ? '#b0c4b0' : '#4a6a4a',
            grid: isDark ? 'rgba(76,175,80,0.08)' : 'rgba(56,142,60,0.08)',
            tooltip: isDark ? '#1a2e1a' : '#ffffff',
            tooltipText: isDark ? '#f0f0f0' : '#1a2e1a',
        };
    }

    function createChart(labels, data, label) {
        const ctx = DOM.moistureChart.getContext('2d');
        const colors = getChartColors();

        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        gradient.addColorStop(0, 'rgba(76, 175, 80, 0.35)');
        gradient.addColorStop(1, 'rgba(76, 175, 80, 0.02)');

        if (state.chartInstance) state.chartInstance.destroy();

        state.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    borderColor: '#4caf50',
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#4caf50',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.tooltip,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: 'rgba(76,175,80,0.3)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `Moisture: ${ctx.parsed.y}%`,
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: colors.text, font: { family: 'Poppins', size: 11 } },
                        grid: { color: colors.grid },
                    },
                    y: {
                        min: 0, max: 100,
                        ticks: {
                            color: colors.text,
                            font: { family: 'Poppins', size: 11 },
                            stepSize: 20,
                            callback: (v) => v + '%',
                        },
                        grid: { color: colors.grid },
                    },
                },
            },
            plugins: [{
                id: 'thresholdLines',
                beforeDraw(chart) {
                    const { ctx, chartArea: { left, right }, scales: { y } } = chart;

                    // Dry threshold at 20%
                    const dryY = y.getPixelForValue(20);
                    ctx.save();
                    ctx.setLineDash([6, 4]);
                    ctx.strokeStyle = 'rgba(244, 67, 54, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(left, dryY);
                    ctx.lineTo(right, dryY);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(244, 67, 54, 0.7)';
                    ctx.font = '10px Poppins';
                    ctx.fillText('Dry threshold', left + 4, dryY - 6);
                    ctx.restore();

                    // Wet threshold at 70%
                    const wetY = y.getPixelForValue(70);
                    ctx.save();
                    ctx.setLineDash([6, 4]);
                    ctx.strokeStyle = 'rgba(66, 165, 245, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(left, wetY);
                    ctx.lineTo(right, wetY);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(66, 165, 245, 0.7)';
                    ctx.font = '10px Poppins';
                    ctx.fillText('Wet threshold', left + 4, wetY - 6);
                    ctx.restore();
                },
            }],
        });
    }

    function updateChartColors() {
        if (!state.chartInstance) return;
        const colors = getChartColors();
        const chart = state.chartInstance;
        chart.options.scales.x.ticks.color = colors.text;
        chart.options.scales.y.ticks.color = colors.text;
        chart.options.scales.x.grid.color = colors.grid;
        chart.options.scales.y.grid.color = colors.grid;
        chart.options.plugins.tooltip.backgroundColor = colors.tooltip;
        chart.options.plugins.tooltip.titleColor = colors.tooltipText;
        chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
        chart.update('none');
    }

    async function fetchWeekly() {
        try {
            const data = await apiFetch('/api/weekly');
            showContent(DOM.skeletonChart, DOM.moistureChart);

            const labels = data.map(d => {
                const dt = new Date(d.date);
                return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            });
            const values = data.map(d => d.avg_moisture);
            createChart(labels, values, 'Daily Average Moisture');
        } catch (err) {
            console.warn('fetchWeekly error:', err);
            showContent(DOM.skeletonChart, null);
            if (DOM.skeletonChart) {
                DOM.skeletonChart.classList.remove('skeleton-shimmer');
                showError(DOM.skeletonChart, 'No chart data \u2014 device may be offline');
            }
        }
    }

    async function fetchHourly() {
        try {
            const data = await apiFetch('/api/hourly');
            showContent(DOM.skeletonChart, DOM.moistureChart);

            const labels = data.map(d => d.hour);
            const values = data.map(d => d.avg_moisture);
            createChart(labels, values, 'Hourly Moisture (Today)');
        } catch (err) {
            console.warn('fetchHourly error:', err);
            showContent(DOM.skeletonChart, null);
            if (DOM.skeletonChart) {
                DOM.skeletonChart.classList.remove('skeleton-shimmer');
                showError(DOM.skeletonChart, 'No hourly data available');
            }
        }
    }

    // ─── Alerts Table ───
    async function fetchAlerts() {
        try {
            const data = await apiFetch('/api/alerts');
            state.alertsData = data;

            showContent(DOM.skeletonAlerts, null);

            if (data.length === 0) {
                DOM.noAlerts.classList.remove('hidden');
                DOM.alertsTable.classList.add('hidden');
                DOM.alertsPagination.classList.add('hidden');
            } else {
                DOM.noAlerts.classList.add('hidden');
                DOM.alertsTable.classList.remove('hidden');
                DOM.alertsPagination.classList.remove('hidden');
                renderAlertsPage();
            }
        } catch (err) {
            console.warn('fetchAlerts error:', err);
            showContent(DOM.skeletonAlerts, null);
            DOM.noAlerts.classList.remove('hidden');
            DOM.noAlerts.querySelector('p').textContent = 'Could not load alerts';
        }
    }

    function renderAlertsPage() {
        const start = (state.alertsPage - 1) * CONFIG.ALERTS_PER_PAGE;
        const end = start + CONFIG.ALERTS_PER_PAGE;
        const pageData = state.alertsData.slice(start, end);
        const totalPages = Math.ceil(state.alertsData.length / CONFIG.ALERTS_PER_PAGE);

        DOM.alertsTbody.innerHTML = pageData.map(a => `
            <tr class="alert-${a.type}">
                <td>${formatTime(a.time)}</td>
                <td>${a.moisture}%</td>
                <td><span class="alert-badge ${a.type}">${a.type === 'dry' ? 'Dry' : 'Wet'}</span></td>
                <td><span class="alert-badge ${a.status}">${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span></td>
            </tr>
        `).join('');

        DOM.pageInfo.textContent = `Page ${state.alertsPage} of ${totalPages}`;
        DOM.prevPage.disabled = state.alertsPage <= 1;
        DOM.nextPage.disabled = state.alertsPage >= totalPages;
    }

    // ─── Raw Data Modal ───
    async function openRawModal() {
        DOM.modalOverlay.classList.remove('hidden');
        requestAnimationFrame(() => DOM.modalOverlay.classList.add('visible'));

        try {
            const data = await apiFetch('/api/raw');
            DOM.rawTbody.innerHTML = data.map((r, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(r.timestamp).toLocaleString()}</td>
                    <td>${r.raw_adc}</td>
                    <td>${r.moisture}%</td>
                </tr>
            `).join('');
        } catch (err) {
            DOM.rawTbody.innerHTML = `
                <tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">
                    Could not load raw data
                </td></tr>`;
        }
    }

    function closeRawModal() {
        DOM.modalOverlay.classList.remove('visible');
        setTimeout(() => DOM.modalOverlay.classList.add('hidden'), 300);
    }

    // ─── Event Listeners ───
    function bindEvents() {
        DOM.themeToggle.addEventListener('click', toggleTheme);
        DOM.btnLogout.addEventListener('click', logout);

        // Chart toggle
        DOM.btnDaily.addEventListener('click', () => {
            if (state.chartView === 'daily') return;
            state.chartView = 'daily';
            DOM.btnDaily.classList.add('active');
            DOM.btnHourly.classList.remove('active');
            fetchWeekly();
        });

        DOM.btnHourly.addEventListener('click', () => {
            if (state.chartView === 'hourly') return;
            state.chartView = 'hourly';
            DOM.btnHourly.classList.add('active');
            DOM.btnDaily.classList.remove('active');
            fetchHourly();
        });

        // Alert banner dismiss
        DOM.alertBannerDismiss.addEventListener('click', () => {
            state.bannerDismissed = true;
            hideBanner();
        });

        // Pagination
        DOM.prevPage.addEventListener('click', () => {
            if (state.alertsPage > 1) {
                state.alertsPage--;
                renderAlertsPage();
            }
        });
        DOM.nextPage.addEventListener('click', () => {
            const totalPages = Math.ceil(state.alertsData.length / CONFIG.ALERTS_PER_PAGE);
            if (state.alertsPage < totalPages) {
                state.alertsPage++;
                renderAlertsPage();
            }
        });

        // Raw data modal
        DOM.btnRawData.addEventListener('click', openRawModal);
        DOM.modalClose.addEventListener('click', closeRawModal);
        DOM.modalOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.modalOverlay) closeRawModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeRawModal();
        });

        // Weather location retry
        if (DOM.btnLocationRetry) {
            DOM.btnLocationRetry.addEventListener('click', requestLocationForWeather);
        }
    }

    // ─── Auto-Refresh Loop ───
    function startAutoRefresh() {
        fetchLatest();
        fetchStats();
        fetchWeekly();
        fetchAlerts();
        fetchWeather();

        setInterval(fetchLatest, CONFIG.REFRESH_INTERVAL);
        setInterval(() => { fetchStats(); fetchAlerts(); }, 30000);
        setInterval(fetchWeather, CONFIG.WEATHER_REFRESH);

        setInterval(() => {
            if (state.lastTimestamp) {
                DOM.lastUpdated.innerHTML = `<i class="far fa-clock"></i> Last updated: ${timeAgo(state.lastTimestamp)}`;
            }
            updateDeviceStatus();
        }, 30000);
    }

    // ─── Init ───
    function init() {
        initTheme();
        initParticles();
        populateSessionInfo();
        bindEvents();
        requestNotificationPermission();
        startAutoRefresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
