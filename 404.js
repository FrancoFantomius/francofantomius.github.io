(function () {
    const canvas = document.getElementById('tree-canvas');
    const ctx = canvas.getContext('2d');
    const markersLayer = document.getElementById('markers-layer');
    const errorHeader = document.getElementById('error-header');
    const infoCard = document.getElementById('info-card');
    const cardTitle = document.getElementById('card-title');
    const cardBody = document.getElementById('card-body');
    const cardLink = document.getElementById('card-link');
    const closeCard = document.querySelector('.close-card');

    // Configuration for asymmetric fractal tree (matching the reference image structure)
    const L_ANGLE = -32 * Math.PI / 180; // Left branch relative angle
    const R_ANGLE = 22 * Math.PI / 180;  // Right branch relative angle
    const L_SCALE = 0.74;                // Left length scaling
    const R_SCALE = 0.78;                // Right length scaling
    const MAX_DEPTH = 10;                // Maximum recursion depth

    // Point mappings loaded dynamically from sitemap.json
    let MARKERS_CONFIG = {};

    async function loadSitemap() {
        try {
            const response = await fetch('/sitemap.json');
            MARKERS_CONFIG = await response.json();
            initMarkers();
            resizeCanvas();
        } catch (err) {
            console.error("Failed to load sitemap.json:", err);
        }
    }

    let markerPositions = {};
    let markerElements = {};
    let scrollPercent = 0;
    let ticking = false;

    // Initialize HTML overlays for the markers
    function initMarkers() {
        markersLayer.innerHTML = '';
        Object.keys(MARKERS_CONFIG).forEach(key => {
            const config = MARKERS_CONFIG[key];

            const wrapper = document.createElement('div');
            wrapper.className = 'marker-wrapper';
            wrapper.id = `marker-${key}`;

            const btn = document.createElement('div');
            btn.className = 'marker-btn';
            btn.style.borderColor = '#ffffff';
            btn.style.color = '#ffffff';
            btn.style.backgroundColor = config.color;
            btn.style.boxShadow = `0 4px 10px rgba(0, 0, 0, 0.15), 0 0 10px ${config.color}44`;
            btn.innerText = config.label;

            // Hover styles inverted cleanly for light background
            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = '#ffffff';
                btn.style.color = config.color;
                btn.style.borderColor = config.color;
                btn.style.boxShadow = `0 6px 15px ${config.color}88`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = config.color;
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#ffffff';
                btn.style.boxShadow = `0 4px 10px rgba(0, 0, 0, 0.15), 0 0 10px ${config.color}44`;
            });

            // Click opens the Info Card
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showInfoCard(config);
            });

            // Tooltip creation
            const tooltip = document.createElement('div');
            tooltip.className = 'marker-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-title">${config.title}</div>
                <div class="tooltip-desc">${config.desc}</div>
            `;

            wrapper.appendChild(tooltip);
            wrapper.appendChild(btn);
            markersLayer.appendChild(wrapper);

            markerElements[key] = wrapper;
        });
    }

    // Modal Interaction
    function showInfoCard(config) {
        cardTitle.innerText = config.title;
        cardBody.innerText = config.desc;
        cardLink.href = config.link;

        if (config.link.startsWith('http') || config.link.startsWith('mailto')) {
            cardLink.target = '_blank';
        } else {
            cardLink.target = '_self';
        }

        infoCard.classList.add('active');
    }

    closeCard.addEventListener('click', () => {
        infoCard.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
        if (!infoCard.contains(e.target) && !e.target.classList.contains('marker-btn')) {
            infoCard.classList.remove('active');
        }
    });

    infoCard.addEventListener('click', (e) => {
        // Prevent click events inside the card from closing it
        e.stopPropagation();
    });

    // Helper: Determine branch color based on path & depth (transitioning through blues/cyans)
    function getBranchColor(depth, path) {
        if (depth === 0) return '#002266'; // Deep navy base trunk (stands out on light bg)

        // Find path-heavy side: check first splitting choice
        const isLeft = path[1] === 0;

        if (depth === 1) return isLeft ? '#0044aa' : '#0284c7'; // Blue vs Sky Blue
        if (depth === 2) return isLeft ? '#0066cc' : '#0ea5e9'; // Mid Blue vs Sky Blue
        if (depth === 3) return isLeft ? '#0284c7' : '#0d9488'; // Sky Blue vs Teal
        if (depth === 4) return isLeft ? '#0ea5e9' : '#14b8a6'; // Sky Blue vs Light Teal
        if (depth === 5) return isLeft ? '#06b6d4' : '#22d3ee'; // Cyan vs Bright Cyan
        if (depth === 6) return '#0891b2'; // Cyan/Teal
        if (depth === 7) return '#0ea5e9'; // Sky
        if (depth === 8) return '#38bdf8'; // Light Sky
        return '#67e8f9'; // Soft Cyan tip
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

        // Draw leaf clusters on outer tips (matching the reference image but in bright cyan/blue)
        if (depth >= 8) {
            ctx.beginPath();
            ctx.arc(endX, endY, Math.max(2, 6 - depth * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = '#22d3ee'; // Bright cyan leaf circles
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
