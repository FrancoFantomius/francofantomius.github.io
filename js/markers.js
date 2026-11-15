export class MarkerManager {
    constructor({ markersLayerId = 'markers-layer', dialogId = 'info-dialog', controls = null, getAutoRotate = () => false } = {}) {
        this.markersLayer = document.getElementById(markersLayerId);
        this.dialog = document.getElementById(dialogId);
        this.dialogBody = document.getElementById('dialog-body');
        this.dialogCloseBtn = document.getElementById('dialog-close-btn');
        this.dialogLinkBtn = document.getElementById('dialog-link-btn');

        this.controls = controls;
        this.getAutoRotate = getAutoRotate;
        this.markers = [];

        if (this.dialogCloseBtn) {
            this.dialogCloseBtn.addEventListener('click', () => {
                if (this.dialog) {
                    if (typeof this.dialog.close === 'function') {
                        this.dialog.close('close');
                    } else {
                        this.dialog.open = false;
                    }
                }
            });
        }

        if (this.dialog) {
            this.dialog.addEventListener('close', () => {
                if (this.controls && this.getAutoRotate()) {
                    this.controls.autoRotate = true;
                }
            });
        }
    }

    setControls(controls) {
        this.controls = controls;
    }

    createMarkers(pointsData, positions) {
        if (!this.markersLayer) return;
        this.markersLayer.innerHTML = '';
        this.markers = [];

        if (!pointsData || pointsData.length === 0 || !positions || positions.length === 0) return;

        pointsData.forEach((data, index) => {
            if (index >= positions.length) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'marker-wrapper';

            const btn = document.createElement('md-icon-button');
            btn.setAttribute('variant', 'tonal');
            const iconName = (data.icon && data.icon.trim()) ? data.icon.trim() : 'add';
            btn.setAttribute('icon', iconName);
            btn.setAttribute('aria-label', data.short || data.title || 'Marker');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data.redirect && data.link) {
                    window.location.href = data.link;
                    return;
                }
                this.showDialog(data);
            });
            wrapper.appendChild(btn);

            if (data.short) {
                const label = document.createElement('div');
                label.className = 'marker-label';
                label.innerText = data.short;
                wrapper.appendChild(label);
            }

            this.markersLayer.appendChild(wrapper);

            this.markers.push({
                element: wrapper,
                baseVector: positions[index]
            });
        });
    }

    showDialog(data) {
        if (!this.dialog) return;

        if (data.title) {
            this.dialog.setAttribute('headline', data.title);
        } else {
            this.dialog.removeAttribute('headline');
        }

        const iconName = (data.icon && data.icon.trim()) ? data.icon.trim() : 'add';
        this.dialog.setAttribute('icon', iconName);

        if (this.dialogBody) {
            this.dialogBody.textContent = data.body || '';
            this.dialogBody.style.display = data.body ? 'block' : 'none';
        }

        if (this.dialogLinkBtn) {
            if (data.link) {
                this.dialogLinkBtn.href = data.link;
                this.dialogLinkBtn.target = data.redirect ? '_self' : '_blank';
                this.dialogLinkBtn.style.display = 'inline-flex';
            } else {
                this.dialogLinkBtn.style.display = 'none';
            }
        }

        if (typeof this.dialog.show === 'function') {
            this.dialog.show();
        } else {
            this.dialog.open = true;
        }

        if (this.controls && this.getAutoRotate()) {
            this.controls.autoRotate = false;
        }
    }

    update(camera, scale = 1) {
        if (!camera || this.markers.length === 0) return;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const widthHalf = width / 2;
        const heightHalf = height / 2;

        this.markers.forEach(marker => {
            const pos = marker.baseVector.clone();
            if (scale !== 1) {
                pos.multiplyScalar(scale);
            }
            pos.project(camera);

            if (pos.z > 1) {
                marker.element.style.display = 'none';
            } else {
                marker.element.style.display = 'flex';

                const x = (pos.x * widthHalf) + widthHalf;
                const y = -(pos.y * heightHalf) + heightHalf;

                marker.element.style.left = `${x}px`;
                marker.element.style.top = `${y}px`;
                // Closer elements (smaller pos.z / smaller camera distance) render on top
                marker.element.style.zIndex = Math.round((1 - pos.z) * 100000);
            }
        });
    }

    /**
     * Greedily selects candidates that maximize the minimum distance to already-selected points.
     * @param {Array<THREE.Vector3>} candidates Available points to pick from
     * @param {number} count Number of points to select
     * @param {Array<THREE.Vector3>} existingPoints Points already selected (e.g. from previous depths)
     * @returns {Array<THREE.Vector3>} Selected points
     */
    static selectMaxSeparatedPoints(candidates, count, existingPoints = []) {
        if (!candidates || candidates.length === 0 || count <= 0) return [];
        const pool = [...candidates];
        const selected = [];

        while (selected.length < count && pool.length > 0) {
            let bestIndex = -1;
            let maxMinDist = -Infinity;

            const referencePoints = [...existingPoints, ...selected];

            if (referencePoints.length === 0) {
                // If nothing has been chosen yet, pick the first one
                bestIndex = 0;
            } else {
                for (let i = 0; i < pool.length; i++) {
                    const candidate = pool[i];
                    let minDist = Infinity;
                    for (const ref of referencePoints) {
                        const d = candidate.distanceTo(ref);
                        if (d < minDist) {
                            minDist = d;
                        }
                    }
                    if (minDist > maxMinDist) {
                        maxMinDist = minDist;
                        bestIndex = i;
                    }
                }
            }

            if (bestIndex !== -1) {
                selected.push(pool[bestIndex]);
                pool.splice(bestIndex, 1);
            } else {
                break;
            }
        }

        return selected;
    }
}
