// js/settings.js
// Settings UI Controller using @francofantomius/material-components Web Components
import '@francofantomius/material-components/fab';
import '@francofantomius/material-components/card';
import '@francofantomius/material-components/switch';
import '@francofantomius/material-components/segmented-button';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import { applyTheme, lightColorScheme, darkColorScheme, generateColorScheme } from '@francofantomius/material-components/theme';

export class SettingsManager {
    /**
     * @param {Object} options
     * @param {Object} options.params - State object containing color, autoRotate, etc.
     * @param {Function} options.onColorChange - Callback when fractal color changes: (hexColor) => void
     * @param {Function} options.onAutoRotateChange - Callback when auto-rotation toggles: (boolean) => void
     * @param {Function} [options.onThemeChange] - Callback when theme changes: (theme, isDark) => void
     */
    constructor(options = {}) {
        this.params = options.params || {};
        this.onColorChange = options.onColorChange || (() => {});
        this.onAutoRotateChange = options.onAutoRotateChange || (() => {});
        this.onThemeChange = options.onThemeChange || (() => {});

        this.isOpen = false;
        this.theme = localStorage.getItem('site-theme') || 'system';
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Restore global settings from localStorage across all pages
        const savedColor = localStorage.getItem('site-color');
        if (savedColor) {
            this.params.color = savedColor;
        }

        const savedAutoRotate = localStorage.getItem('site-auto-rotate');
        if (savedAutoRotate !== null) {
            this.params.autoRotate = savedAutoRotate === 'true';
        }

        this.menuBtn = document.getElementById('menu-btn');
        this.uiContainer = document.getElementById('ui-container');
        this.closeBtn = document.getElementById('m3-settings-close');
        this.themeSelector = document.getElementById('theme-selector');
        this.colorPicker = document.getElementById('color-picker');
        this.colorIndicator = document.getElementById('color-indicator');
        this.browserAccentBtn = document.getElementById('m3-use-accent-btn');
        this.rotateCheck = document.getElementById('rotate-check');

        this.init();
    }

    init() {
        this.setupTheme();
        this.setupControls();
        this.bindEvents();
    }

    /**
     * Resolves the browser/system accent color as hex.
     * Uses CSS AccentColor system keyword computed style.
     */
    static getBrowserAccentColor(fallback = '#0044aa') {
        try {
            const probe = document.createElement('div');
            probe.style.cssText = 'position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; background-color: AccentColor; color: AccentColor;';
            document.body.appendChild(probe);
            const computed = window.getComputedStyle(probe).backgroundColor;
            document.body.removeChild(probe);

            if (computed && computed.startsWith('rgb')) {
                const rgb = computed.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const r = parseInt(rgb[0], 10);
                    const g = parseInt(rgb[1], 10);
                    const b = parseInt(rgb[2], 10);
                    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                }
            }
        } catch (e) {
            console.warn('Could not read system AccentColor:', e);
        }
        return fallback;
    }

    setupTheme() {
        this.applyActiveTheme(this.theme);

        this.mediaQuery.addEventListener('change', () => {
            if (this.theme === 'system') {
                this.applyActiveTheme('system');
            }
        });
    }

    applyActiveTheme(mode) {
        this.theme = mode;
        localStorage.setItem('site-theme', mode);

        const isDark = mode === 'dark' || (mode === 'system' && this.mediaQuery.matches);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

        // Apply M3 tokens generated dynamically from current base color or default scheme
        this.updateThemeTokens();

        this.onThemeChange(mode, isDark);
    }

    /**
     * Re-generates and applies the M3 color scheme tokens based on the current
     * base color (or fallback) and current dark/light state.
     */
    updateThemeTokens() {
        const isDark = this.theme === 'dark' || (this.theme === 'system' && this.mediaQuery.matches);
        const color = this.params.color || '#0044aa';
        try {
            const dynamicScheme = generateColorScheme(color, isDark);
            applyTheme(dynamicScheme, document.documentElement);
        } catch (e) {
            console.warn('Could not generate dynamic color scheme:', e);
            const fallbackScheme = isDark ? darkColorScheme : lightColorScheme;
            applyTheme(fallbackScheme, document.documentElement);
        }
    }

    setupControls() {
        // Synchronize initial segmented button selection
        if (this.themeSelector) {
            const buttons = this.themeSelector.querySelectorAll('md-segmented-button');
            buttons.forEach(btn => {
                btn.selected = (btn.value === this.theme);
            });
        }

        // Synchronize color picker and indicator
        if (this.colorPicker && this.params.color) {
            this.colorPicker.value = this.params.color;
            if (this.colorIndicator) {
                this.colorIndicator.style.backgroundColor = this.params.color;
            }
        }

        // Synchronize switch
        if (this.rotateCheck) {
            this.rotateCheck.selected = !!this.params.autoRotate;
        }
    }

    bindEvents() {
        // Expand on FAB click
        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.isOpen) {
                    this.collapse();
                } else {
                    this.expand();
                }
            });
        }

        // Close button click
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.collapse();
            });
        }

        // Prevent clicks inside settings card from bubbling
        if (this.uiContainer) {
            this.uiContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Click-away listener: collapse settings box when clicking anywhere outside
        document.addEventListener('pointerdown', (e) => {
            if (!this.isOpen) return;
            const clickedBox = this.uiContainer && this.uiContainer.contains(e.target);
            const clickedBtn = this.menuBtn && this.menuBtn.contains(e.target);
            if (!clickedBox && !clickedBtn) {
                this.collapse();
            }
        });

        // Escape key to collapse
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.collapse();
            }
        });

        // Theme selection via md-segmented-button-set
        if (this.themeSelector) {
            this.themeSelector.addEventListener('change', (e) => {
                const val = e.detail?.value || (e.detail?.target && e.detail.target.value);
                if (val) {
                    this.applyActiveTheme(val);
                }
            });

            // Also support direct click on buttons in set
            const buttons = this.themeSelector.querySelectorAll('md-segmented-button');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => { b.selected = (b === btn); });
                    if (btn.value) {
                        this.applyActiveTheme(btn.value);
                    }
                });
            });
        }

        // Browser Accent button (md-chip)
        if (this.browserAccentBtn) {
            this.browserAccentBtn.addEventListener('click', () => {
                const accentHex = SettingsManager.getBrowserAccentColor(this.params.color || '#0044aa');
                if (this.colorPicker) this.colorPicker.value = accentHex;
                if (this.colorIndicator) this.colorIndicator.style.backgroundColor = accentHex;
                this.params.color = accentHex;
                localStorage.setItem('site-color', accentHex);
                this.updateThemeTokens();
                this.onColorChange(accentHex);
            });
        }

        // Color input
        if (this.colorPicker) {
            this.colorPicker.addEventListener('input', (e) => {
                const hex = e.target.value;
                if (this.colorIndicator) this.colorIndicator.style.backgroundColor = hex;
                this.params.color = hex;
                localStorage.setItem('site-color', hex);
                this.updateThemeTokens();
                this.onColorChange(hex);
            });
        }

        // Auto-rotation md-switch
        if (this.rotateCheck) {
            this.rotateCheck.addEventListener('change', (e) => {
                const isSelected = e.target.selected ?? e.target.checked ?? false;
                this.params.autoRotate = isSelected;
                localStorage.setItem('site-auto-rotate', String(isSelected));
                this.onAutoRotateChange(isSelected);
            });

            this.rotateCheck.addEventListener('click', () => {
                setTimeout(() => {
                    const isSelected = !!this.rotateCheck.selected;
                    this.params.autoRotate = isSelected;
                    localStorage.setItem('site-auto-rotate', String(isSelected));
                    this.onAutoRotateChange(isSelected);
                }, 0);
            });
        }

        // Cross-tab synchronization via storage event
        window.addEventListener('storage', (e) => {
            if (e.key === 'site-theme' && e.newValue) {
                this.theme = e.newValue;
                if (this.themeSelector) {
                    const buttons = this.themeSelector.querySelectorAll('md-segmented-button');
                    buttons.forEach(btn => {
                        btn.selected = (btn.value === this.theme);
                    });
                }
                this.applyActiveTheme(this.theme);
            } else if (e.key === 'site-color' && e.newValue) {
                this.params.color = e.newValue;
                if (this.colorPicker) this.colorPicker.value = e.newValue;
                if (this.colorIndicator) this.colorIndicator.style.backgroundColor = e.newValue;
                this.updateThemeTokens();
                this.onColorChange(e.newValue);
            } else if (e.key === 'site-auto-rotate' && e.newValue !== null) {
                const isSelected = e.newValue === 'true';
                this.params.autoRotate = isSelected;
                if (this.rotateCheck) this.rotateCheck.selected = isSelected;
                this.onAutoRotateChange(isSelected);
            }
        });
    }

    expand() {
        this.isOpen = true;
        if (this.menuBtn) {
            this.menuBtn.classList.add('m3-fab-hidden');
        }
        if (this.uiContainer) {
            this.uiContainer.classList.add('expanded');
        }
    }

    collapse() {
        this.isOpen = false;
        if (this.uiContainer) {
            this.uiContainer.classList.remove('expanded');
        }
        if (this.menuBtn) {
            this.menuBtn.classList.remove('m3-fab-hidden');
        }
    }
}
