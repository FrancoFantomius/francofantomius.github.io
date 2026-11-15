import '@francofantomius/material-components/dialog';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import { SettingsManager } from './settings.js';

(function () {
    const canvas = document.getElementById('tree-canvas');
    const ctx = canvas.getContext('2d');
    const markersLayer = document.getElementById('markers-layer');
    const errorHeader = document.getElementById('error-header');
    
    // M3 Dialog elements
    const infoDialog = document.getElementById('info-dialog');
    const dialogBody = document.getElementById('dialog-body');
    const dialogCloseBtn = document.getElementById('dialog-close-btn');
    const dialogLinkBtn = document.getElementById('dialog-link-btn');

    // Configuration for asymmetric fractal tree (matching the reference image structure)
    const L_ANGLE = -32 * Math.PI / 180; // Left branch relative angle
    const R_ANGLE = 22 * Math.PI / 180;  // Right branch relative angle
    const L_SCALE = 0.74;                // Left length scaling
    const R_SCALE = 0.78;                // Right length scaling
    const MAX_DEPTH = 10;                // Maximum recursion depth

    // Point mappings loaded dynamically from data/sitemap.json
    let MARKERS_CONFIG = {};
    let markerPositions = {};
    let markerElements = {};
    let scrollPercent = 0;
    let ticking = false;

    // M3 Settings
    const params = {
        color: '#0044aa'
    };

    const settingsManager = new SettingsManager({
        params,
        onColorChange: (newColor) => {
            params.color = newColor;
            drawTree();
        },
        onThemeChange: () => {
            drawTree();
        }
    });

    if (dialogCloseBtn && infoDialog) {
        dialogCloseBtn.addEventListener('click', () => {
            if (typeof infoDialog.close === 'function') {
                infoDialog.close('close');
            } else {
                infoDialog.open = false;
            }
        });
    }

    async function loadSitemap() {
        try {
            const response = await fetch('/data/sitemap.json');
            MARKERS_CONFIG = await response.json();
            initMarkers();
            resizeCanvas();
        } catch (err) {
            console.error("Failed to load sitemap.json:", err);
        }
    }

    // Helper: Map node labels or icons to material symbols
    function getMarkerIcon(config) {
        if (config.icon) return config.icon;
        const titleLower = (config.title || '').toLowerCase();
        if (titleLower.includes('home')) return 'home';
        if (titleLower.includes('latex')) return 'functions';
        if (titleLower.includes('github') || titleLower.includes('code')) return 'code';
        if (titleLower.includes('email') || titleLower.includes('contact') || (config.link && config.link.startsWith('mailto:'))) return 'mail';
        if (titleLower.includes('archive') || titleLower.includes('history')) return 'history';
        if (titleLower.includes('map') || titleLower.includes('site')) return 'account_tree';
        if (titleLower.includes('boring')) return 'article';
        if (titleLower.includes('triangle') || titleLower.includes('fractal')) return 'history_edu';
        return 'explore';
    }

    // Initialize Material Design 3 HTML overlays for the markers
    function initMarkers() {
        markersLayer.innerHTML = '';
        Object.keys(MARKERS_CONFIG).forEach(key => {
            const config = MARKERS_CONFIG[key];

            const wrapper = document.createElement('div');
            wrapper.className = 'marker-wrapper';
            wrapper.id = `marker-${key}`;

            const btn = document.createElement('md-icon-button');
            btn.setAttribute('variant', 'tonal');
            const iconName = getMarkerIcon(config);
            btn.setAttribute('icon', iconName);
            btn.setAttribute('aria-label', config.title || config.label || 'Marker');

            // Click opens the M3 dialog
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showInfoDialog(config);
            });

            // Tooltip creation
            const tooltip = document.createElement('div');
            tooltip.className = 'marker-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-title">${config.title}</div>
                <div class="tooltip-desc">${config.desc || ''}</div>
            `;

            const label = document.createElement('div');
            label.className = 'marker-label';
            label.innerText = config.label || config.title;

            wrapper.appendChild(tooltip);
            wrapper.appendChild(btn);
            wrapper.appendChild(label);
            markersLayer.appendChild(wrapper);

            markerElements[key] = wrapper;
        });
    }

    // Show M3 Dialog
    function showInfoDialog(config) {
        if (!infoDialog) return;

        infoDialog.setAttribute('headline', config.title || 'Navigation');
        infoDialog.setAttribute('icon', getMarkerIcon(config));

        if (dialogBody) {
            dialogBody.textContent = config.desc || '';
            dialogBody.style.display = config.desc ? 'block' : 'none';
        }

        if (dialogLinkBtn) {
            dialogLinkBtn.href = config.link;
            const isExternal = config.link.startsWith('http') || config.link.startsWith('mailto');
            dialogLinkBtn.target = isExternal ? '_blank' : '_self';
            
            if (config.link.endsWith('.html') || !isExternal) {
                dialogLinkBtn.textContent = 'Explore Page';
            } else if (config.link.startsWith('mailto:')) {
                dialogLinkBtn.textContent = 'Send Email';
            } else {
                dialogLinkBtn.textContent = 'Open Link';
            }
        }

        if (typeof infoDialog.show === 'function') {
            infoDialog.show();
        } else {
            infoDialog.open = true;
        }
    }

    // Convert hex to rgb object
    function hexToRgb(hex) {
        const cleaned = hex.replace('#', '');
        const bigint = parseInt(cleaned.length === 3 
            ? cleaned.split('').map(c => c + c).join('') 
            : cleaned, 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    // Interpolate between two hex colors
    function lerpColor(hexA, hexB, t) {
        const a = hexToRgb(hexA);
        const b = hexToRgb(hexB);
        const r = Math.round(a.r + (b.r - a.r) * t);
        const g = Math.round(a.g + (b.g - a.g) * t);
        const bl = Math.round(a.b + (b.b - a.b) * t);
        return `rgb(${r}, ${g}, ${bl})`;
    }

    // Helper: Determine branch color dynamically based on theme and active color
    function getBranchColor(depth, path) {
        const base = params.color || '#0044aa';
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const tipColor = isDark ? '#67e8f9' : '#22d3ee';
        const trunkColor = isDark ? '#d8e2ff' : '#001a41';

        if (depth === 0) return trunkColor;

        const fraction = Math.min(1, depth / MAX_DEPTH);
        return lerpColor(base, tipColor, fraction);
    }

    // Recursive function to compute and draw fractal branches
    function drawBranch(startX, startY, len, angle, depth, path, maxGrowthLevel) {
        if (depth > MAX_DEPTH || depth > Math.floor(maxGrowthLevel)) return;

        let progress = 1.0;
        if (depth === Math.floor(maxGrowthLevel)) {
            progress = maxGrowthLevel - depth;
        }

        if (progress <= 0) return;

        // Compute end coordinates
        const endX = startX + Math.cos(angle) * len * progress;
        const endY = startY + Math.sin(angle) * len * progress;

        // Line width scales down with depth
        const lineWidth = Math.max(1.2, 16 - depth * 1.6);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = getBranchColor(depth, path);
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Check if there is a marker configured for the current branch's end coordinate
        const matchedMarkerKey = Object.keys(MARKERS_CONFIG).find(key => {
            const markerPath = MARKERS_CONFIG[key].path;
            if (markerPath.length !== path.length) return false;
            return markerPath.every((val, idx) => val === path[idx]);
        });

        if (matchedMarkerKey) {
            markerPositions[matchedMarkerKey] = { x: endX, y: endY };
        }

        // Draw leaf clusters on outer tips
        if (depth >= 8) {
            ctx.beginPath();
            ctx.arc(endX, endY, Math.max(2, 6 - depth * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = params.color || '#22d3ee';
            ctx.fill();
        }

        // If branch is fully grown and we have not reached depth limit, draw child branches
        if (progress === 1.0 && depth < MAX_DEPTH) {
            const nextLen = len;

            // Left child
            drawBranch(
                endX, endY,
                nextLen * L_SCALE,
                angle + L_ANGLE,
                depth + 1,
                [...path, 0],
                maxGrowthLevel
            );

            // Right child
            drawBranch(
                endX, endY,
                nextLen * R_SCALE,
                angle + R_ANGLE,
                depth + 1,
                [...path, 1],
                maxGrowthLevel
            );
        }
    }

    // Main Draw Function
    function drawTree() {
        if (Object.keys(MARKERS_CONFIG).length === 0) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        markerPositions = {};

        // Calculate progress level mapping scrollPercent to maximum visible depth
        const maxGrowthLevel = scrollPercent * (MAX_DEPTH + 1);

        const startX = canvas.width / 2;
        const startY = canvas.height * 0.92; // Base of the tree is near the bottom
        const baseLength = Math.min(canvas.height * 0.22, canvas.width * 0.2, 150);

        // Marker O is at the base of the trunk
        markerPositions['O'] = { x: startX, y: startY };

        // Draw tree starting with depth 0 path [0]
        drawBranch(startX, startY, baseLength, -Math.PI / 2, 0, [0], maxGrowthLevel);

        updateMarkerElements();
    }

    // Update positions and opacity of HTML markers
    function updateMarkerElements() {
        Object.keys(MARKERS_CONFIG).forEach(key => {
            const config = MARKERS_CONFIG[key];
            const elem = markerElements[key];
            if (!elem) return;

            const pos = markerPositions[key];
            const pathDepth = config.path.length;

            // Marker O is at the trunk start, and is always visible.
            // Other markers appear once their parent branch finishes growing.
            const isGrown = (key === 'O') || (scrollPercent * (MAX_DEPTH + 1) >= pathDepth);

            if (isGrown && pos) {
                elem.style.left = `${pos.x}px`;
                elem.style.top = `${pos.y}px`;
                elem.classList.add('visible');
            } else {
                elem.classList.remove('visible');
            }
        });
    }

    // Device Pixel Ratio scaling for sharp rendering
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;

        ctx.scale(dpr, dpr);

        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;

        drawTree();
    }

    // Scroll listener with requestAnimationFrame throttling
    function onScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                drawTree();

                // Smoothly fade out header on scroll
                errorHeader.style.opacity = Math.max(0, 1 - scrollPercent * 4.5);
                errorHeader.style.transform = `translate(-50%, ${-scrollPercent * 90}px)`;

                ticking = false;
            });
            ticking = true;
        }
    }

    // Init Page
    loadSitemap();

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', onScroll);
})();
