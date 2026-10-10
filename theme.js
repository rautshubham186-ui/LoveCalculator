/**
 * theme.js
 * --------
 * Theme module: Light / Dark only (no "System" option).
 * Both the mode and the color palette persist independently.
 *
 *   data-theme="light|dark"               — controlled by mode
 *   data-palette="rose|sunset" — color palette
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  var MODE_KEY = 'lc-theme';
  var PALETTE_KEY = 'lc-palette';
  var VALID_MODES = ['light', 'dark'];
  var VALID_PALETTES = ['rose', 'sunset'];
  var currentMode = 'light';
  var currentPalette = 'rose';

  function isValidMode(m) { return VALID_MODES.indexOf(m) !== -1; }
  function isValidPalette(p) { return VALID_PALETTES.indexOf(p) !== -1; }

  function detectSystemTheme() {
    // Fallback only — no longer exposed as a user option
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function resolveActiveMode() {
    return currentMode; // No more 'system' — direct value
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    var active = resolveActiveMode();
    document.documentElement.setAttribute('data-theme', active);
    document.documentElement.setAttribute('data-palette', currentPalette);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var colors = {
        'rose-light':     '#fff5f8',
        'rose-dark':      '#1a0d18',
        'midnight-light': '#f6f1ff',
        'midnight-dark':  '#0d0820',
        'ocean-light':    '#eef9fb',
        'ocean-dark':     '#06141c',
        'aurora-light':   '#f0fdf6',
        'aurora-dark':    '#04140e',
        'sunset-light':   '#fff4ec',
        'sunset-dark':    '#1d0e08'
      };
      var key = currentPalette + '-' + active;
      meta.setAttribute('content', colors[key] || '#fff5f8');
    }
    if (typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('lc-theme-changed', {
        detail: { mode: currentMode, palette: currentPalette, active: active }
      }));
    }
  }

  function setMode(mode) {
    if (!isValidMode(mode)) mode = 'light';
    currentMode = mode;
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
    applyTheme();
  }

  function setPalette(palette) {
    if (!isValidPalette(palette)) palette = 'rose';
    currentPalette = palette;
    try { localStorage.setItem(PALETTE_KEY, palette); } catch (e) {}
    applyTheme();
  }

  function loadTheme() {
    var storedMode = null, storedPalette = null;
    try { storedMode = localStorage.getItem(MODE_KEY); } catch (e) {}
    try { storedPalette = localStorage.getItem(PALETTE_KEY); } catch (e) {}
    currentMode = (storedMode && isValidMode(storedMode)) ? storedMode : 'light';
    currentPalette = (storedPalette && isValidPalette(storedPalette)) ? storedPalette : 'rose';
    applyTheme();
    return { mode: currentMode, palette: currentPalette };
  }

  function getMode() { return currentMode; }
  function getPalette() { return currentPalette; }
  function getActiveMode() { return resolveActiveMode(); }

  // No system watcher needed — only light/dark

  function cycleMode() {
    // Only light <-> dark (no system)
    var next = currentMode === 'light' ? 'dark' : 'light';
    setMode(next);
    return next;
  }

  function cyclePalette() {
    var idx = VALID_PALETTES.indexOf(currentPalette);
    var next = VALID_PALETTES[(idx + 1) % VALID_PALETTES.length];
    setPalette(next);
    return next;
  }

  function init() {
    loadTheme();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  LoveCalc.theme = {
    setMode: setMode,
    setPalette: setPalette,
    loadTheme: loadTheme,
    saveTheme: function () {
      try {
        localStorage.setItem(MODE_KEY, currentMode);
        localStorage.setItem(PALETTE_KEY, currentPalette);
      } catch (e) {}
    },
    detectSystemTheme: detectSystemTheme,
    getMode: getMode,
    getPalette: getPalette,
    getActiveMode: getActiveMode,
    cycleMode: cycleMode,
    cyclePalette: cyclePalette,
    applyTheme: applyTheme,
    VALID_MODES: VALID_MODES,
    VALID_PALETTES: VALID_PALETTES
  };

})(typeof window !== 'undefined' ? window : this);
