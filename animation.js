/**
 * animation.js
 * ------------
 * Performance-conscious, GPU-friendly celebration engine (spec sections
 * 11, 12, 35, 38, 47, 48, 88).
 *
 * Principles:
 *   - All effects use CSS transforms + opacity (GPU-friendly).
 *   - Maximum particle count is bounded per intensity level.
 *   - Honors `prefers-reduced-motion`: disables particles, keeps a
 *     static, attractive result.
 *   - Auto-stops intensive animations after a fixed duration so the
 *     page never has runaway CPU usage.
 *   - Provides a single overlay container; effects are added/removed
 *     without affecting layout or covering controls/ads.
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  var overlay = null;
  var activeParticles = [];
  var stopTimers = [];
  var reducedMotion = false;
  var particleCap = 60; // global hard cap, never exceeded

  function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function detectPerformanceMode() {
    // A very light heuristic: if deviceMemory is exposed and small, or
    // if hardware concurrency is low, reduce particle counts. We never
    // probe in privacy-invasive ways — only these two standardized,
    // permission-free hints (spec section 35).
    if (typeof navigator === 'undefined') return 'normal';
    var mem = navigator.deviceMemory;
    var cores = navigator.hardwareConcurrency;
    if ((mem && mem <= 2) || (cores && cores <= 2)) return 'eco';
    return 'normal';
  }

  function performanceScale() {
    var mode = detectPerformanceMode();
    if (mode === 'eco') return 0.5;
    return 1.0;
  }

  function applyReducedMotion() {
    reducedMotion = prefersReducedMotion();
    if (reducedMotion && overlay) {
      // Remove all current particles immediately
      clearAll();
    }
  }

  // Watch for system reduced-motion changes (e.g. user toggles it while
  // viewing the page).
  function watchReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var handler = function () { applyReducedMotion(); };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  // ---------------------------------------------------------------------
  // Overlay setup
  // ---------------------------------------------------------------------
  function ensureOverlay() {
    if (overlay) return overlay;
    if (typeof document === 'undefined') return null;
    overlay = document.createElement('div');
    overlay.className = 'lc-anim-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    return overlay;
  }

  function clearAll() {
    activeParticles.forEach(function (p) {
      if (p && p.parentNode) p.parentNode.removeChild(p);
    });
    activeParticles = [];
    stopTimers.forEach(function (t) { clearTimeout(t); });
    stopTimers = [];
  }

  function stopAnimations() {
    clearAll();
  }

  // ---------------------------------------------------------------------
  // Particle factory
  //   Each particle is a single DOM element with a CSS class that
  //   triggers a keyframe animation. Lifetime is controlled by JS so
  //   we can clean up reliably.
  // ---------------------------------------------------------------------
  function spawnParticle(className, opts) {
    if (reducedMotion) return null;
    if (activeParticles.length >= particleCap) return null;
    var ov = ensureOverlay();
    if (!ov) return null;

    var el = document.createElement('span');
    el.className = 'lc-anim ' + className;
    el.setAttribute('aria-hidden', 'true');

    if (opts) {
      if (opts.left != null) el.style.left = opts.left + '%';
      if (opts.top != null)  el.style.top  = opts.top  + '%';
      if (opts.delay != null) el.style.animationDelay = opts.delay + 'ms';
      if (opts.duration != null) el.style.animationDuration = opts.duration + 'ms';
      if (opts.size != null) {
        el.style.fontSize = opts.size + 'px';
        el.style.width = opts.size + 'px';
        el.style.height = opts.size + 'px';
      }
      if (opts.color) el.style.color = opts.color;
      if (opts.scale != null) el.style.setProperty('--scale', opts.scale);
      if (opts.rotate != null) el.style.setProperty('--rotate', opts.rotate + 'deg');
    }

    ov.appendChild(el);
    activeParticles.push(el);

    var life = (opts && opts.life) || 4000;
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      var i = activeParticles.indexOf(el);
      if (i !== -1) activeParticles.splice(i, 1);
    }, life);

    return el;
  }

  // ---------------------------------------------------------------------
  // Effects (spec section 12)
  // ---------------------------------------------------------------------
  function createFloatingHearts(count, opts) {
    opts = opts || {};
    var scale = performanceScale();
    var n = Math.round((count || 12) * scale);
    for (var i = 0; i < n; i++) {
      spawnParticle('lc-heart', {
        left: Math.random() * 100,
        top: 100 + Math.random() * 10,
        delay: Math.random() * 600,
        duration: 4500 + Math.random() * 2500,
        size: 14 + Math.random() * 18,
        life: 7000 + Math.random() * 1500,
        scale: 0.6 + Math.random() * 0.8,
        color: opts.color || null
      });
    }
  }

  function createFlowerPetals(count) {
    var scale = performanceScale();
    var n = Math.round((count || 8) * scale);
    var colors = ['#FFB6C1', '#FFC0CB', '#FFD1DC', '#FFD9E4', '#FFE4EC'];
    for (var i = 0; i < n; i++) {
      spawnParticle('lc-petal', {
        left: Math.random() * 100,
        top: -10 + Math.random() * -10,
        delay: Math.random() * 800,
        duration: 5500 + Math.random() * 3000,
        size: 12 + Math.random() * 14,
        life: 8500 + Math.random() * 1500,
        rotate: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function createSparkles(count) {
    var scale = performanceScale();
    var n = Math.round((count || 10) * scale);
    for (var i = 0; i < n; i++) {
      spawnParticle('lc-sparkle', {
        left: 10 + Math.random() * 80,
        top: 10 + Math.random() * 80,
        delay: Math.random() * 1000,
        duration: 1500 + Math.random() * 1500,
        size: 6 + Math.random() * 10,
        life: 3000 + Math.random() * 1500,
        scale: 0.5 + Math.random() * 1.0
      });
    }
  }

  function createConfetti(count) {
    var scale = performanceScale();
    var n = Math.round((count || 24) * scale);
    var colors = ['#FF4D8D', '#FFB6C1', '#FFD700', '#7CE7FF', '#B6FFB6', '#FF8FAB', '#C58AF9'];
    for (var i = 0; i < n; i++) {
      var el = spawnParticle('lc-confetti', {
        left: Math.random() * 100,
        top: -10,
        delay: Math.random() * 800,
        duration: 3500 + Math.random() * 2500,
        life: 6500 + Math.random() * 1500,
        rotate: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
      if (el) {
        el.style.width = (4 + Math.random() * 6) + 'px';
        el.style.height = (8 + Math.random() * 8) + 'px';
      }
    }
  }

  function createStars(count) {
    var scale = performanceScale();
    var n = Math.round((count || 6) * scale);
    for (var i = 0; i < n; i++) {
      spawnParticle('lc-star', {
        left: 5 + Math.random() * 90,
        top: 5 + Math.random() * 50,
        delay: Math.random() * 1000,
        duration: 2000 + Math.random() * 1500,
        size: 10 + Math.random() * 14,
        life: 3500 + Math.random() * 1500,
        scale: 0.6 + Math.random() * 0.9
      });
    }
  }

  function createGlowWaves(count) {
    if (reducedMotion) return;
    var scale = performanceScale();
    var n = Math.round((count || 3) * scale);
    var ov = ensureOverlay();
    if (!ov) return;
    for (var i = 0; i < n; i++) {
      var el = document.createElement('span');
      el.className = 'lc-anim lc-glow-wave';
      el.setAttribute('aria-hidden', 'true');
      el.style.left = (20 + Math.random() * 60) + '%';
      el.style.top  = (20 + Math.random() * 60) + '%';
      el.style.animationDelay = (i * 600) + 'ms';
      ov.appendChild(el);
      activeParticles.push(el);
      (function (node) {
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
          var j = activeParticles.indexOf(node);
          if (j !== -1) activeParticles.splice(j, 1);
        }, 4000);
      })(el);
    }
  }

  // ---------------------------------------------------------------------
  // Master celebration (spec section 11 — animation levels)
  // ---------------------------------------------------------------------
  function createCelebration(intensity, palette) {
    if (reducedMotion) return;
    var lvl = (intensity && intensity.level) || 3;
    var pal = palette || { primary: '#E8849B', accent: '#F8B7C8' };

    switch (lvl) {
      case 1: // 0-19 very gentle
        createFloatingHearts(4, { color: pal.accent });
        break;
      case 2: // 20-39
        createFloatingHearts(8, { color: pal.accent });
        createSparkles(6);
        break;
      case 3: // 40-59
        createFloatingHearts(12, { color: pal.accent });
        createSparkles(10);
        createFlowerPetals(6);
        createGlowWaves(2);
        break;
      case 4: // 60-79
        createFloatingHearts(18, { color: pal.accent });
        createSparkles(16);
        createFlowerPetals(10);
        createStars(4);
        createConfetti(18);
        createGlowWaves(3);
        break;
      case 5: // 80-94
        createFloatingHearts(24, { color: pal.accent });
        createSparkles(20);
        createFlowerPetals(14);
        createStars(8);
        createConfetti(28);
        createGlowWaves(4);
        break;
      case 6: // 95-100 grand
        createFloatingHearts(30, { color: pal.accent });
        createSparkles(24);
        createFlowerPetals(18);
        createStars(12);
        createConfetti(40);
        createGlowWaves(5);
        // One extra confetti burst 800ms later for cinematic effect
        stopTimers.push(setTimeout(function () { createConfetti(24); }, 800));
        stopTimers.push(setTimeout(function () { createFloatingHearts(12, { color: pal.accent }); }, 1200));
        break;
    }

    // Auto-stop intensive effects after the celebration window so the
    // page returns to a calm state (spec section 12).
    var total = 9000;
    if (lvl >= 5) total = 11000;
    if (lvl >= 6) total = 13000;
    stopTimers.push(setTimeout(function () {
      // Keep at most a few gentle hearts for ambient warmth
      var remaining = activeParticles.slice(0, Math.min(6, activeParticles.length));
      activeParticles.slice(remaining.length).forEach(function (p) {
        if (p && p.parentNode) p.parentNode.removeChild(p);
      });
      activeParticles = remaining;
    }, total));
  }

  // ---------------------------------------------------------------------
  // Hero / empty-state ambient hearts (very low intensity, looped subtly)
  // ---------------------------------------------------------------------
  var ambientTimer = null;
  function startAmbient() {
    if (reducedMotion) return;
    stopAmbient();
    function tick() {
      if (reducedMotion) return;
      spawnParticle('lc-heart lc-ambient', {
        left: Math.random() * 100,
        top: 100,
        duration: 9000 + Math.random() * 3000,
        size: 10 + Math.random() * 12,
        life: 12000,
        scale: 0.4 + Math.random() * 0.4
      });
      ambientTimer = setTimeout(tick, 1800 + Math.random() * 1800);
    }
    tick();
  }
  function stopAmbient() {
    if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null; }
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  LoveCalc.animation = {
    prefersReducedMotion: prefersReducedMotion,
    detectPerformanceMode: detectPerformanceMode,
    applyReducedMotion: applyReducedMotion,
    watchReducedMotion: watchReducedMotion,
    createFloatingHearts: createFloatingHearts,
    createFlowerPetals: createFlowerPetals,
    createSparkles: createSparkles,
    createConfetti: createConfetti,
    createStars: createStars,
    createGlowWaves: createGlowWaves,
    createCelebration: createCelebration,
    stopAnimations: stopAnimations,
    startAmbient: startAmbient,
    stopAmbient: stopAmbient
  };

  // Auto-init reduced motion watcher
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watchReducedMotion);
    } else {
      watchReducedMotion();
    }
  }

})(typeof window !== 'undefined' ? window : this);
