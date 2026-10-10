/**
 * app.js
 * ------
 * Main orchestrator for the Love Calculator.
 *
 * Responsibilities:
 *   - Wire up DOM events on DOMContentLoaded.
 *   - Manage empty / loading / error / result states.
 *   - Render result (percentage ring, personalized paragraph, breakdown).
 *   - Drive the calculation mode selector (names / thumbprint / both).
 *   - Capture thumbprint signatures from press-and-hold on pads.
 *   - Drive share / copy / share-card / reset buttons.
 *   - Render FAQ accordion dynamically from translations.
 *   - Drive the color-palette picker (5 themes) and light/dark/system toggle.
 *   - Toast notifications for accessibility-friendly feedback.
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  // ---------------------------------------------------------------------
  // Tiny DOM helpers
  // ---------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
  function setText(el, txt) { if (el) el.textContent = txt; }
  function setHTML(el, html) { if (el) el.innerHTML = html; }
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function t(path, vars) { return LoveCalc.i18n.t(path, vars); }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  var state = {
    lastResult: null,
    thumb1: null,
    thumb2: null
  };

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------
  var toastTimer = null;
  function toast(message, opts) {
    opts = opts || {};
    var el = $('#lc-toast');
    if (!el) return;
    setText(el, message);
    el.setAttribute('role', opts.role || 'status');
    el.setAttribute('aria-live', opts.polite === false ? 'assertive' : 'polite');
    el.classList.add('lc-toast--show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('lc-toast--show');
    }, opts.duration || 2400);
  }

  // ---------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------
  function showFieldError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    input.classList.add('lc-input--error');
    var err = input.parentNode.parentNode.querySelector('.lc-field-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'lc-field-error';
      err.setAttribute('role', 'alert');
      input.parentNode.parentNode.appendChild(err);
    }
    setText(err, message);
  }
  function clearFieldError(input) {
    input.removeAttribute('aria-invalid');
    input.classList.remove('lc-input--error');
    var err = input.parentNode.parentNode.querySelector('.lc-field-error');
    if (err) err.remove();
  }

  function validateInputs(name1, name2) {
    var v1 = LoveCalc.calculator.validateName(name1);
    var v2 = LoveCalc.calculator.validateName(name2);
    var i1 = $('#lc-name1');
    var i2 = $('#lc-name2');
    clearFieldError(i1); clearFieldError(i2);

    if (!v1.ok && !v2.ok) {
      showFieldError(i1, t('calculator.errorBothNames'));
      showFieldError(i2, t('calculator.errorBothNames'));
      return null;
    }
    if (!v1.ok) {
      showFieldError(i1, v1.reason === 'tooLong' ? t('calculator.errorTooLong') : t('calculator.errorInvalid'));
      return null;
    }
    if (!v2.ok) {
      showFieldError(i2, v2.reason === 'tooLong' ? t('calculator.errorTooLong') : t('calculator.errorInvalid'));
      return null;
    }
    return { name1: v1.value, name2: v2.value };
  }

  // ---------------------------------------------------------------------
  // Mode selector — removed. Both names and thumbprint pads are always
  // visible. The calculator uses whatever inputs are available.
  // ---------------------------------------------------------------------
  function initModeSelector() { /* no-op: mode selector removed */ }

  // ---------------------------------------------------------------------
  // Thumbprint capture
  //   On press-and-hold, we record:
  //     - duration (ms)
  //     - average X / Y position relative to the pad center
  //     - variance of X / Y
  //     - sample count
  //     - bounding box (min/max)
  //   These are combined into a deterministic signature by the calculator.
  //   We also render a stylized "fingerprint" of curved ridges using the
  //   signature as a seed, so the user sees a visual confirmation.
  // ---------------------------------------------------------------------
  function initThumbpads() {
    setupPad($('#lc-thumb1'), 1);
    setupPad($('#lc-thumb2'), 2);
    on($('#lc-thumb1-reset'), 'click', function () { resetPad(1); });
    on($('#lc-thumb2-reset'), 'click', function () { resetPad(2); });
  }

  // Scan duration: 1000ms (1 second) — a circular progress ring fills
  // around the thumb during this time, and the scan completes when the
  // ring is full.
  var SCAN_DURATION_MS = 1000;

  function setupPad(padEl, idx) {
    if (!padEl) return;
    var pressing = false;
    var startTime = 0;
    var samples = [];
    var scanEl = padEl.querySelector('.lc-thumb-scan');
    var statusEl = $('#lc-thumb' + idx + '-status');
    var resetBtn = $('#lc-thumb' + idx + '-reset');
    var autoScanTimer = null;

    function start(e) {
      if (pressing) return;
      // If already captured, ignore (must press Re-scan first)
      if ((idx === 1 && state.thumb1) || (idx === 2 && state.thumb2)) return;
      pressing = true;
      startTime = Date.now();
      samples = [];
      // Force a reflow so the CSS animation re-triggers on re-press
      padEl.classList.remove('lc-thumbpad--pressing');
      void padEl.offsetWidth;
      padEl.classList.add('lc-thumbpad--pressing');
      if (scanEl) scanEl.classList.add('lc-thumb-scan--active');
      setText(statusEl, t('thumbprint.scanning'));
      if (e) e.preventDefault();

      // Auto-complete the scan after SCAN_DURATION_MS (1 second).
      // The circular progress ring fills during this time; when it
      // completes, the scan is done.
      autoScanTimer = setTimeout(function () {
        if (!pressing) return;
        finishScan();
      }, SCAN_DURATION_MS);
    }
    function move(e) {
      if (!pressing) return;
      var rect = padEl.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var pt = (e.touches && e.touches[0]) || e;
      samples.push({
        x: pt.clientX - cx,
        y: pt.clientY - cy,
        t: Date.now() - startTime
      });
    }
    function finishScan() {
      pressing = false;
      padEl.classList.remove('lc-thumbpad--pressing');
      if (scanEl) scanEl.classList.remove('lc-thumb-scan--active');
      var duration = SCAN_DURATION_MS;
      // If we got real samples, use them; otherwise synthesize.
      var sig;
      if (samples.length > 0) {
        sig = computeSignature(samples, duration);
      } else {
        var synth = [];
        for (var i = 0; i < 6; i++) {
          synth.push({
            x: Math.sin(i * 0.7) * 6 + (idx * 3),
            y: Math.cos(i * 0.9) * 5 - (idx * 2),
            t: (i / 6) * duration
          });
        }
        sig = computeSignature(synth, duration);
      }
      capturePad(idx, sig);
    }
    function end() {
      // If user releases before the 300ms auto-scan completes, we still
      // complete the scan (a quick tap should work).
      if (!pressing) return;
      if (autoScanTimer) { clearTimeout(autoScanTimer); autoScanTimer = null; }
      finishScan();
    }

    // Mouse
    on(padEl, 'mousedown', start);
    on(document, 'mousemove', move);
    on(document, 'mouseup', end);
    // Touch
    on(padEl, 'touchstart', start, { passive: false });
    on(padEl, 'touchmove', move, { passive: false });
    on(padEl, 'touchend', end);
    on(padEl, 'touchcancel', end);
    // Keyboard: Space / Enter triggers an instant 300ms scan
    on(padEl, 'keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if ((idx === 1 && state.thumb1) || (idx === 2 && state.thumb2)) return;
        start(e);
      }
    });

    // Prevent native context menu / drag
    on(padEl, 'contextmenu', function (e) { e.preventDefault(); });
    on(padEl, 'dragstart', function (e) { e.preventDefault(); });
  }

  function computeSignature(samples, duration) {
    if (!samples.length) {
      return { duration: duration, samples: 0, avgX: 0, avgY: 0, varX: 0, varY: 0,
               minX: 0, maxX: 0, minY: 0, maxY: 0, area: 0 };
    }
    var sumX = 0, sumY = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      sumX += s.x; sumY += s.y;
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    var avgX = sumX / samples.length;
    var avgY = sumY / samples.length;
    var varX = 0, varY = 0;
    for (var j = 0; j < samples.length; j++) {
      varX += (samples[j].x - avgX) * (samples[j].x - avgX);
      varY += (samples[j].y - avgY) * (samples[j].y - avgY);
    }
    varX /= samples.length;
    varY /= samples.length;
    var area = (maxX - minX) * (maxY - minY);
    return {
      duration: Math.round(duration),
      samples: samples.length,
      avgX: Math.round(avgX * 100) / 100,
      avgY: Math.round(avgY * 100) / 100,
      varX: Math.round(varX * 100) / 100,
      varY: Math.round(varY * 100) / 100,
      minX: Math.round(minX * 100) / 100,
      maxX: Math.round(maxX * 100) / 100,
      minY: Math.round(minY * 100) / 100,
      maxY: Math.round(maxY * 100) / 100,
      area: Math.round(area * 100) / 100
    };
  }

  function capturePad(idx, sig) {
    if (idx === 1) state.thumb1 = sig;
    else state.thumb2 = sig;

    var padEl = $('#lc-thumb' + idx);
    var statusEl = $('#lc-thumb' + idx + '-status');
    var resetBtn = $('#lc-thumb' + idx + '-reset');
    var textEl = padEl.querySelector('.lc-thumb-text');
    if (textEl) textEl.textContent = '';
    padEl.classList.add('lc-thumbpad--captured');
    setText(statusEl, t('thumbprint.captured'));
    if (resetBtn) resetBtn.hidden = false;
    renderThumbRidges(idx, sig);

    // After Person 1 is scanned, prompt Person 2 to scan.
    // After Person 2 is scanned, confirm both are ready.
    var hintEl = $('#lc-thumb-hint');
    var pad1 = $('#lc-thumb1');
    var pad2 = $('#lc-thumb2');
    if (idx === 1 && !state.thumb2) {
      setText(hintEl, 'Person 1 scanned! Now Person 2 — press your thumb pad.');
      // Visually highlight the second pad
      if (pad2) pad2.classList.add('lc-thumbpad--next');
      if (pad1) pad1.classList.remove('lc-thumbpad--next');
      // Focus the second pad for accessibility
      if (pad2) { try { pad2.focus({ preventScroll: true }); } catch (e) {} }
    } else if (idx === 2 && !state.thumb1) {
      setText(hintEl, 'Person 2 scanned! Now Person 1 — press your thumb pad.');
      if (pad1) pad1.classList.add('lc-thumbpad--next');
      if (pad2) pad2.classList.remove('lc-thumbpad--next');
      if (pad1) { try { pad1.focus({ preventScroll: true }); } catch (e) {} }
    } else if (state.thumb1 && state.thumb2) {
      setText(hintEl, 'Both thumbprints scanned! Press Calculate Love to see your result.');
      if (pad1) pad1.classList.remove('lc-thumbpad--next');
      if (pad2) pad2.classList.remove('lc-thumbpad--next');
    }
  }

  function resetPad(idx) {
    if (idx === 1) state.thumb1 = null;
    else state.thumb2 = null;
    var padEl = $('#lc-thumb' + idx);
    var statusEl = $('#lc-thumb' + idx + '-status');
    var resetBtn = $('#lc-thumb' + idx + '-reset');
    var textEl = padEl.querySelector('.lc-thumb-text');
    if (textEl) textEl.textContent = 'TAP';
    padEl.classList.remove('lc-thumbpad--captured');
    padEl.classList.remove('lc-thumbpad--next');
    setText(statusEl, '');
    if (resetBtn) resetBtn.hidden = true;
    // Clear the scanned ridges and show the default ridges again
    var scannedRidges = padEl.querySelector('.lc-thumb-ridges--scanned');
    if (scannedRidges) scannedRidges.innerHTML = '';
    var defaultRidges = padEl.querySelector('.lc-thumb-ridges--default');
    if (defaultRidges) defaultRidges.style.display = '';
    // Reset the hint text
    var hintEl = $('#lc-thumb-hint');
    setText(hintEl, 'You can use names, thumbprints, or both — whichever you like. Press each thumb pad briefly to scan.');
  }

  // Render realistic fingerprint ridges inside the thumb shape.
  // The ridges are vertical curved lines (like a real thumbprint) with
  // a central whorl, generated deterministically from the scan signature.
  function renderThumbRidges(idx, sig) {
    var padEl = $('#lc-thumb' + idx);
    var scannedRidges = padEl.querySelector('.lc-thumb-ridges--scanned');
    var defaultRidges = padEl.querySelector('.lc-thumb-ridges--default');
    if (!scannedRidges) return;
    var seed = LoveCalc.calculator.hashThumbSignature(sig);
    // Mulberry32 PRNG
    var a = seed >>> 0;
    function rng() {
      a = (a + 0x6D2B79F5) >>> 0;
      var v = a;
      v = Math.imul(v ^ (v >>> 15), v | 1);
      v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    }

    // Hide the default ridges — we'll draw fresh, denser ones
    if (defaultRidges) defaultRidges.style.display = 'none';

    var html = '';
    // Center of the thumbprint (slightly above middle of the thumb)
    var cx = 100, cy = 120;

    // Draw concentric curved ridge lines that follow the thumb shape.
    // Each ridge is a vertical curved path from top to bottom of the thumb,
    // slightly offset to the left or right of center.
    var ridgeCount = 12;
    for (var i = 0; i < ridgeCount; i++) {
      // Offset from center: -5 to +5 range, spread across the thumb width
      var offset = (i - (ridgeCount - 1) / 2) * 7;
      // Wobble for natural variation
      var wobble = 2 + rng() * 3;
      var phase = rng() * Math.PI * 2;
      // Build a vertical curved path
      var points = [];
      for (var t = 0; t <= 1; t += 0.1) {
        var y = 50 + t * 170; // from y=50 (top) to y=220 (bottom)
        // Curve the ridge inward toward the center as we go down
        var curveIn = Math.sin(t * Math.PI) * 8;
        var x = cx + offset - curveIn + Math.sin(t * Math.PI * 3 + phase) * wobble;
        // Clamp x to stay within the thumb shape
        var maxOffset = 45 - t * 10;
        if (x < cx - maxOffset) x = cx - maxOffset;
        if (x > cx + maxOffset) x = cx + maxOffset;
        points.push(x.toFixed(1) + ',' + y.toFixed(1));
      }
      var opacity = (0.5 - Math.abs(offset) / 50).toFixed(2);
      html += '<polyline points="' + points.join(' ') + '" fill="none" stroke="var(--lc-primary)" stroke-width="1.4" opacity="' + opacity + '"/>';
    }

    // Central whorl — concentric ellipses at the center
    var whorlCx = cx + (rng() - 0.5) * 4;
    var whorlCy = cy + (rng() - 0.5) * 6;
    html += '<ellipse cx="' + whorlCx + '" cy="' + whorlCy + '" rx="16" ry="22" fill="none" stroke="var(--lc-primary)" stroke-width="1.5" opacity="0.5"/>';
    html += '<ellipse cx="' + whorlCx + '" cy="' + whorlCy + '" rx="11" ry="16" fill="none" stroke="var(--lc-primary)" stroke-width="1.5" opacity="0.55"/>';
    html += '<ellipse cx="' + whorlCx + '" cy="' + whorlCy + '" rx="6" ry="10" fill="none" stroke="var(--lc-primary)" stroke-width="1.5" opacity="0.6"/>';
    html += '<ellipse cx="' + whorlCx + '" cy="' + whorlCy + '" rx="2" ry="4" fill="none" stroke="var(--lc-primary)" stroke-width="1.5" opacity="0.65"/>';

    scannedRidges.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Result rendering
  // ---------------------------------------------------------------------
  function showEmpty() {
    var empty = $('#lc-empty');
    var loading = $('#lc-loading');
    var result = $('#lc-result');
    var timeline = $('#lc-timeline');
    if (empty) empty.hidden = false;
    if (loading) loading.hidden = true;
    if (result) result.hidden = true;
    if (timeline) timeline.hidden = true;
  }

  function showLoading() {
    var empty = $('#lc-empty');
    var loading = $('#lc-loading');
    var result = $('#lc-result');
    if (empty) empty.hidden = true;
    if (loading) loading.hidden = false;
    if (result) result.hidden = true;
  }

  function renderResult(res) {
    var empty = $('#lc-empty');
    var loading = $('#lc-loading');
    var result = $('#lc-result');
    if (empty) empty.hidden = true;
    if (loading) loading.hidden = true;
    if (result) result.hidden = false;

    // Names line (or generic labels for thumb-only mode)
    var namesEl = $('#lc-result-names');
    var label1 = res.display1 || 'Thumb 1';
    var label2 = res.display2 || 'Thumb 2';
    if (namesEl) {
      setHTML(namesEl, '<span class="lc-name">' + escapeHTML(label1) + '</span>' +
                       '<span class="lc-name-sep" aria-hidden="true">\u2764\uFE0F</span>' +
                       '<span class="lc-name">' + escapeHTML(label2) + '</span>');
    }

    // Palette
    var pal = res.palette || { primary: '#E8849B', accent: '#F8B7C8', glow: 'rgba(232,132,155,0.45)' };
    if (result) {
      result.style.setProperty('--lc-result-primary', pal.primary);
      result.style.setProperty('--lc-result-accent', pal.accent);
      result.style.setProperty('--lc-result-glow', pal.glow);
      result.dataset.intensity = res.intensity.level;
    }

    // Score number with count-up animation
    animateCountUp($('#lc-score'), 0, res.score, 1400);

    // Progress ring
    var ring = $('#lc-progress-ring-fg');
    if (ring) {
      var r = ring.getAttribute('r') || 90;
      var circumference = 2 * Math.PI * parseFloat(r);
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = circumference;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var offset = circumference * (1 - res.score / 100);
          ring.style.strokeDashoffset = offset;
        });
      });
      ring.style.stroke = pal.primary;
    }

    // Score label
    setText($('#lc-score-label'), t('result.label'));

    // Title (short category title)
    var msg = res.message || { title: '' };
    setText($('#lc-result-title'), msg.title || '');

    // Paragraph (flowing prose using both names)
    var paraEl = $('#lc-result-paragraph');
    if (paraEl) {
      setText(paraEl, res.paragraph || '');
      // Fade-in animation
      paraEl.classList.remove('lc-result__paragraph--visible');
      void paraEl.offsetWidth; // force reflow
      paraEl.classList.add('lc-result__paragraph--visible');
    }

    // Breakdown
    renderBreakdown(res);

    // Timeline (Past / Present / Future)
    renderTimeline(res);

    // SR announcement
    var sr = $('#lc-sr-result');
    if (sr) {
      setText(sr, label1 + ' and ' + label2 + ': ' + res.score +
                  ' percent. ' + (msg.title || '') + '. ' + t('hero.disclaimer'));
    }

    // Smooth scroll to the TOP of the result so the score is the first
    // thing the user sees. We use 'start' with a small manual offset
    // (via scrollTo) so the result heading isn't flush against the
    // sticky header.
    try {
      var resultRect = result.getBoundingClientRect();
      var win = result.ownerDocument.defaultView;
      var currentScroll = win.scrollY;
      var targetTop = currentScroll + resultRect.top - 80; // 80px offset for sticky header
      win.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } catch (e) {
      try { result.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {}
    }

    // Animation celebration
    LoveCalc.animation.stopAnimations();
    setTimeout(function () {
      LoveCalc.animation.createCelebration(res.intensity, pal);
    }, 200);

    // Notify SEO module
    if (LoveCalc.seo && LoveCalc.seo.onResult) LoveCalc.seo.onResult(res);
  }

  function animateCountUp(el, from, to, duration) {
    if (!el) return;
    if (LoveCalc.animation.prefersReducedMotion()) {
      el.innerHTML = String(to) + '<span class="lc-score-percent">%</span>';
      return;
    }
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(from + (to - from) * eased);
      el.innerHTML = String(val) + '<span class="lc-score-percent">%</span>';
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderBreakdown(res) {
    var container = $('#lc-breakdown');
    if (!container) return;
    // Reset collapsed state on each new calculation
    container.hidden = true;
    var toggle = $('#lc-breakdown-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      var icon = toggle.querySelector('.lc-breakdown-toggle-icon');
      if (icon) setText(icon, '+');
    }
    var keys = LoveCalc.calculator.SECONDARY_KEYS;
    var secondary = res.secondary || {};
    var labels = {
      loveVibe: t('breakdown.loveVibe'),
      friendshipVibe: t('breakdown.friendshipVibe'),
      chemistryVibe: t('breakdown.chemistryVibe'),
      communicationVibe: t('breakdown.communicationVibe'),
      funFactor: t('breakdown.funFactor'),
      adventureVibe: t('breakdown.adventureVibe'),
      caringVibe: t('breakdown.caringVibe')
    };
    var icons = {
      loveVibe: '\u2764\uFE0F',
      friendshipVibe: '\uD83E\uDD1D',
      chemistryVibe: '\u2696\uFE0F',
      communicationVibe: '\uD83D\uDCAC',
      funFactor: '\uD83C\uDF89',
      adventureVibe: '\uD83C\uDFD5\uFE0F',
      caringVibe: '\uD83E\uDD70'
    };
    var descriptions = {
      loveVibe: 'A warmhearted pull toward each other.',
      friendshipVibe: 'How easily these names make friends.',
      chemistryVibe: 'A spark between the two.',
      communicationVibe: 'The ease of conversation in the air.',
      funFactor: 'Laughter, jokes, and good vibes.',
      adventureVibe: 'Willingness to explore new things.',
      caringVibe: 'Tenderness and small kindnesses.'
    };

    setHTML(container, keys.map(function (k) {
      var val = secondary[k] != null ? secondary[k] : 0;
      var label = labels[k] || k;
      var icon = icons[k] || '';
      var desc = descriptions[k] || '';
      return '' +
        '<div class="lc-breakdown-item" data-key="' + k + '">' +
          '<div class="lc-breakdown-head">' +
            '<span class="lc-breakdown-icon" aria-hidden="true">' + icon + '</span>' +
            '<span class="lc-breakdown-label">' + escapeHTML(label) + '</span>' +
            '<span class="lc-breakdown-val">' + val + '%</span>' +
          '</div>' +
          '<div class="lc-breakdown-bar" role="progressbar" aria-valuenow="' + val +
            '" aria-valuemin="0" aria-valuemax="100" aria-label="' + escapeHTML(label) + '">' +
            '<span class="lc-breakdown-fill" style="width:0%"></span>' +
          '</div>' +
          '<p class="lc-breakdown-desc">' + escapeHTML(desc) + '</p>' +
        '</div>';
    }).join(''));

    setTimeout(function () {
      $all('.lc-breakdown-item', container).forEach(function (item) {
        var key = item.getAttribute('data-key');
        var val = secondary[key] != null ? secondary[key] : 0;
        var fill = item.querySelector('.lc-breakdown-fill');
        if (fill) {
          requestAnimationFrame(function () {
            fill.style.width = val + '%';
          });
        }
      });
    }, 300);
  }

  // ---------------------------------------------------------------------
  // Past / Present / Future timeline rendering
  // ---------------------------------------------------------------------
  function renderTimeline(res) {
    var timeline = res.timeline;
    var wrap = $('#lc-timeline');
    if (!wrap || !timeline) {
      if (wrap) wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    setText($('#lc-timeline-title'), t('timeline.title'));
    setText($('#lc-timeline-sub'), t('timeline.subtitle'));

    function fillPhase(phase, data) {
      var prefix = '#lc-timeline-' + phase;
      setText($(prefix + '-phase'), t('timeline.' + phase));
      setText($(prefix + '-score'), data.score + '%');
      setText($(prefix + '-title'), data.title);
      setText($(prefix + '-hint'), t('timeline.' + phase + 'Hint'));
      setText($(prefix + '-para'), data.paragraph);

      // Apply palette color to the score
      var scoreEl = $(prefix + '-score');
      if (scoreEl && data.palette) {
        scoreEl.style.color = data.palette.primary;
      }

      // Animate the score count-up
      var scoreNumEl = $(prefix + '-score');
      if (scoreNumEl && !LoveCalc.animation.prefersReducedMotion()) {
        animateCountUpPlain(scoreNumEl, 0, data.score, 1200);
      }
    }

    fillPhase('past', timeline.past);
    fillPhase('present', timeline.present);
    fillPhase('future', timeline.future);
  }

  function animateCountUpPlain(el, from, to, duration) {
    if (!el) return;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(from + (to - from) * eased);
      el.textContent = val + '%';
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------
  // Calculate flow
  // ---------------------------------------------------------------------
  function handleCalculate() {
    var i1 = $('#lc-name1');
    var i2 = $('#lc-name2');
    var name1 = i1 ? i1.value.trim() : '';
    var name2 = i2 ? i2.value.trim() : '';
    var hasNames = name1.length > 0 && name2.length > 0;
    var hasThumbs = !!(state.thumb1 && state.thumb2);
    var hasOneName = name1.length > 0 || name2.length > 0;
    var hasOneThumb = !!(state.thumb1 || state.thumb2);

    // Need at least BOTH names OR BOTH thumbprints to calculate.
    // If user enters only one name, or only one thumbprint, prompt them.
    if (!hasNames && !hasThumbs) {
      // Nothing entered at all
      if (hasOneName || hasOneThumb) {
        toast('Please enter both names or scan both thumbprints.', { role: 'alert', polite: false });
      } else {
        toast(t('calculator.errorBothNames'), { role: 'alert', polite: false });
      }
      return;
    }
    if (hasNames && !hasThumbs) {
      // Names only — validate
      var v = validateInputs(name1, name2);
      if (!v) {
        toast(t('calculator.errorBothNames'), { role: 'alert', polite: false });
        return;
      }
      name1 = v.name1; name2 = v.name2;
    }
    // If hasThumbs but only one name, that's fine — we use thumbs for score
    // and the name(s) for display. If no names, use generic labels.
    if (!hasNames) {
      name1 = name1 || 'Thumb 1';
      name2 = name2 || 'Thumb 2';
    }

    // Determine mode for the calculator
    var mode = hasNames && hasThumbs ? 'both' : (hasThumbs ? 'thumb' : 'names');

    showLoading();

    // Check if this is the visitor's first calculation. First-time
    // visitors get a boosted score (98-100) to make their first
    // experience joyful and share-worthy. The flag is stored in
    // localStorage so subsequent calculations use the normal algorithm.
    var firstVisit = false;
    try {
      if (!localStorage.getItem('lc-has-calculated')) {
        firstVisit = true;
      }
    } catch (e) {}

    var start = Date.now();

    // PRIVACY: Visitor names are NEVER sent to or saved on the server.
    // We only CHECK if this pair matches a pre-seeded celebrity couple.
    // If it does, we return the celebrity's stored result. If not, we
    // compute the result dynamically in the browser (with first-visit
    // boost) and never save it anywhere.
    fetch('/api/love-calc?name1=' + encodeURIComponent(name1) + '&name2=' + encodeURIComponent(name2), {
      method: 'GET'
    }).then(function (response) {
      return response.json();
    }).then(function (data) {
      var res;
      if (data && data.ok && data.found && data.result) {
        // Celebrity couple found in database — use the pre-saved result
        var r = data.result;
        res = {
          score: r.percentage,
          display1: r.name1,
          display2: r.name2,
          sameName: false,
          message: { title: r.messageTitle, lines: [] },
          paragraph: r.paragraph,
          secondary: r.secondary,
          category: LoveCalc.calculator.getScoreCategory(r.percentage),
          intensity: LoveCalc.calculator.getAnimationIntensity(r.percentage),
          palette: LoveCalc.calculator.getResultPalette(r.percentage),
          seed: 0,
          source: 'celebrity',
          firstVisit: false
        };
        // Generate timeline for the celebrity result
        var celebCore = {
          score: res.score,
          display1: res.display1,
          display2: res.display2,
          sameName: false,
          seed: LoveCalc.calculator.hashName(r.name1.toLowerCase()) ^ LoveCalc.calculator.hashName(r.name2.toLowerCase()),
          altSeed: 0,
          paragraph: res.paragraph
        };
        if (LoveCalc.calculator.generateTimeline) {
          res.timeline = LoveCalc.calculator.generateTimeline(celebCore, 'names');
        }
      } else {
        // Not a celebrity couple — compute dynamically in browser
        // (with first-visit boost). Result is NOT saved anywhere.
        res = LoveCalc.calculator.compute(name1, name2, state.thumb1, state.thumb2, mode, firstVisit);
        if (firstVisit) {
          try { localStorage.setItem('lc-has-calculated', '1'); } catch (e) {}
        }
      }
      state.lastResult = res;

      var elapsed = Date.now() - start;
      var wait = Math.max(0, 900 - elapsed);
      setTimeout(function () { renderResult(res); }, wait);
    }).catch(function (err) {
      // API failed — compute locally as fallback
      console.warn('Love calc API error (non-fatal):', err);
      var res = LoveCalc.calculator.compute(name1, name2, state.thumb1, state.thumb2, mode, firstVisit);
      if (firstVisit) {
        try { localStorage.setItem('lc-has-calculated', '1'); } catch (e) {}
      }
      state.lastResult = res;
      var elapsed = Date.now() - start;
      var wait = Math.max(0, 900 - elapsed);
      setTimeout(function () { renderResult(res); }, wait);
    });
  }

  function handleReset(clearInputs) {
    LoveCalc.animation.stopAnimations();
    var i1 = $('#lc-name1');
    var i2 = $('#lc-name2');
    if (clearInputs) {
      if (i1) { i1.value = ''; clearFieldError(i1); }
      if (i2) { i2.value = ''; clearFieldError(i2); }
      resetPad(1);
      resetPad(2);
    }
    state.lastResult = null;
    showEmpty();
    toast(t('toast.resetDone'));
    var calc = $('#lc-calculator');
    try { calc.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Share / copy / card
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // Result share handlers — share the result with names, score, paragraph,
  // and a share card image when possible.
  // ---------------------------------------------------------------------

  // Generate a share card image blob from the result.
  // SYNCHRONOUS: uses canvas.toDataURL() + atob() instead of async
  // toBlob(), so navigator.share() can be called in the same user
  // gesture (required on mobile browsers).
  function generateShareCardBlobSync(result) {
    try {
      var W = 720, H = 900;
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;

      var pal = result.palette || { primary: '#E8849B', accent: '#F8B7C8' };
      var siteUrl = window.location.origin + '/love-calculator/';

      // Background gradient
      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#fff5f8');
      bg.addColorStop(0.5, '#ffe4ec');
      bg.addColorStop(1, '#ffd1dc');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Decorative background hearts
      for (var i = 0; i < 12; i++) {
        var x = Math.random() * W;
        var y = Math.random() * H;
        var s = 20 + Math.random() * 50;
        ctx.globalAlpha = 0.06 + Math.random() * 0.05;
        drawHeartOnCanvas(ctx, x, y, s, pal.primary);
      }
      ctx.globalAlpha = 1;

      // Central main heart
      var cx = W / 2, cy = H * 0.36;
      ctx.globalAlpha = 0.25;
      drawHeartOnCanvas(ctx, cx, cy, 240, pal.primary);
      ctx.globalAlpha = 1;
      drawHeartOutlineOnCanvas(ctx, cx, cy, 240, pal.primary, 4);

      // Score text inside heart
      ctx.fillStyle = pal.primary;
      ctx.font = 'bold 120px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(result.score) + '%', cx, cy + 13);

      // Score label
      ctx.fillStyle = '#7a2a3f';
      ctx.font = '600 32px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Love Match', cx, cy + 87);

      // Names
      ctx.fillStyle = '#2a0d18';
      ctx.font = '600 38px -apple-system, "Segoe UI", Roboto, sans-serif';
      var names = result.display1 + '  \u2764\uFE0F  ' + result.display2;
      var maxW = W - 100;
      while (ctx.measureText(names).width > maxW && names.length > 4) {
        names = names.slice(0, -2);
      }
      if (names.length < (result.display1 + '  \u2764\uFE0F  ' + result.display2).length) {
        names = names + '\u2026';
      }
      ctx.fillText(names, cx, H * 0.66);

      // Title
      if (result.message && result.message.title) {
        ctx.fillStyle = pal.primary;
        ctx.font = 'italic 30px Georgia, serif';
        ctx.fillText(result.message.title, cx, H * 0.72);
      }

      // Website URL — printed on the card so anyone who sees it can
      // type it or click it (when shared as a link, the URL is
      // also embedded in the share text)
      ctx.fillStyle = '#5a2a3a';
      ctx.font = '500 22px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Love Calculator', cx, H - 70);
      ctx.fillStyle = '#8a5a6a';
      ctx.font = '400 18px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(siteUrl, cx, H - 40);

      // Generate as JPEG (smaller file size, more compatible)
      var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      var byteStr = atob(dataUrl.split(',')[1]);
      var u8arr = new Uint8Array(byteStr.length);
      for (var j = 0; j < byteStr.length; j++) {
        u8arr[j] = byteStr.charCodeAt(j);
      }
      return new Blob([u8arr], { type: 'image/jpeg' });
    } catch (e) {
      console.warn('Share card generation failed:', e);
      return null;
    }
  }

  function drawHeartOnCanvas(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 30, size / 30);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-14, -6, -22, 6, 0, 22);
    ctx.bezierCurveTo(22, 6, 14, -6, 0, 8);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.restore();
  }

  function drawHeartOutlineOnCanvas(ctx, cx, cy, size, color, lineWidth) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 30, size / 30);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-14, -6, -22, 6, 0, 22);
    ctx.bezierCurveTo(22, 6, 14, -6, 0, 8);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = (lineWidth || 2) * (30 / size);
    ctx.stroke();
    ctx.restore();
  }

  // Check if the browser can share files
  function canShareFiles() {
    return typeof navigator !== 'undefined' && navigator.canShare && typeof navigator.canShare === 'function';
  }

  // Try to share the result with image via Web Share API.
  // On mobile, navigator.share MUST be called within the user gesture
  // (synchronously), so we try native share first with text only, then
  // if the browser supports file sharing, we generate the image and
  // share again with the file.
  function shareResultWithImage(platform) {
    if (!state.lastResult) return;
    var result = state.lastResult;
    var siteUrl = window.location.origin + '/love-calculator/';
    var shareText = 'We got ' + result.score + '% on the Love Calculator \u2764\uFE0F ' +
                    result.display1 + ' \u2764\uFE0F ' + result.display2 +
                    '\n\nTry yours! ' + siteUrl;

    // STEP 1: Try to generate the JPG card synchronously.
    // This is fast (canvas drawing + toDataURL + atob are all sync).
    var file = null;
    try {
      var blob = generateShareCardBlobSync(result);
      if (blob) {
        file = new File([blob], 'love-calculator-' + result.score + '.jpg', { type: 'image/jpeg' });
      }
    } catch (e) {
      console.warn('Share card generation error:', e);
    }

    // STEP 2: Call navigator.share with file + text.
    // This opens the native share sheet showing ALL installed apps.
    // The user picks any app (WhatsApp, Instagram, Facebook, etc.)
    // and the JPG card + text go directly into that app.
    if (navigator.share) {
      var shareData = {
        title: 'Love Calculator \u2014 ' + result.score + '%',
        text: shareText
      };
      if (file) shareData.files = [file];

      navigator.share(shareData).then(function () {
        toast('Shared successfully!', { duration: 2000 });
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;

        // If file share failed, try again WITHOUT the file (text only)
        if (file) {
          navigator.share({
            title: 'Love Calculator \u2014 ' + result.score + '%',
            text: shareText
          }).then(function () {
            toast('Shared!', { duration: 2000 });
          }).catch(function (err2) {
            if (err2 && err2.name === 'AbortError') return;
            // Last resort: copy to clipboard
            LoveCalc.sharing.copyText(shareText).then(function () {
              toast('Result copied! Paste it anywhere.', { duration: 2500 });
            });
          });
        } else {
          // No file was generated — copy text
          LoveCalc.sharing.copyText(shareText).then(function () {
            toast('Result copied! Paste it anywhere.', { duration: 2500 });
          });
        }
      });
    } else {
      // Desktop: no navigator.share — copy text with URL
      LoveCalc.sharing.copyText(shareText).then(function () {
        toast('Result copied! Paste it anywhere.', { duration: 2500 });
      });
    }
  }

  function platformShareFallback(platform, shareText, isMobile) {
    var url = window.location.href;

    // This fallback only runs on desktop (no navigator.share) or when
    // navigator.share failed. On mobile, navigator.share with files is
    // the primary path and handles everything — no download needed.
    switch (platform) {
      case 'whatsapp':
        if (isMobile) {
          window.location.href = 'whatsapp://send?text=' + encodeURIComponent(shareText);
        } else {
          window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener,noreferrer');
        }
        toast('Opening WhatsApp...', { duration: 2000 });
        break;

      case 'instagram':
        LoveCalc.sharing.copyText(shareText).then(function () {});
        if (isMobile) {
          window.location.href = 'instagram://app';
        } else {
          window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
        }
        toast('Text copied! Paste in Instagram.', { duration: 3000 });
        break;

      case 'facebook':
        var fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '&quote=' + encodeURIComponent(shareText);
        if (isMobile) {
          window.location.href = 'fb://share?link=' + encodeURIComponent(url) + '&quote=' + encodeURIComponent(shareText);
          setTimeout(function () { window.open(fbUrl, '_blank', 'noopener,noreferrer'); }, 1500);
        } else {
          window.open(fbUrl, '_blank', 'noopener,noreferrer');
        }
        toast('Opening Facebook...', { duration: 2000 });
        break;

      default:
        if (navigator.share) {
          navigator.share({ title: 'Love Calculator', text: shareText }).catch(function () {});
        } else {
          LoveCalc.sharing.copyText(shareText).then(function () {
            toast('Result copied!', { duration: 2000 });
          });
        }
    }
  }

  function downloadBlob(blob, filename) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {}
  }

  function handleShare() {
    if (!state.lastResult) return;
    var result = state.lastResult;
    var siteUrl = window.location.origin + '/love-calculator/';
    var shareText = 'We got ' + result.score + '% on the Love Calculator \u2764\uFE0F ' +
                    result.display1 + ' \u2764\uFE0F ' + result.display2 +
                    '\n\nTry yours! ' + siteUrl;

    // STEP 1: Try to generate JPG card
    var file = null;
    try {
      var blob = generateShareCardBlobSync(result);
      if (blob) {
        file = new File([blob], 'love-calculator-' + result.score + '.jpg', { type: 'image/jpeg' });
      }
    } catch (e) {
      console.warn('Card generation error:', e);
    }

    // STEP 2: Try navigator.share with file + text
    if (navigator.share) {
      var shareData = { title: 'Love Calculator', text: shareText };
      if (file) shareData.files = [file];
      navigator.share(shareData).then(function () {
        toast('Shared!', { duration: 2000 });
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        // File share failed — try text only
        navigator.share({ title: 'Love Calculator', text: shareText }).catch(function () {
          // Both failed — fallback to WhatsApp web
          window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener,noreferrer');
          toast('Opening WhatsApp web...', { duration: 2000 });
        });
      });
      return;
    }

    // STEP 3: No navigator.share — open WhatsApp web directly
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener,noreferrer');
    toast('Opening WhatsApp web...', { duration: 2000 });
  }

  function handleCopy() {
    if (!state.lastResult) return;
    LoveCalc.sharing.copyResult(state.lastResult).then(function (r) {
      if (r && r.ok) toast(t('result.copied'));
      else toast(t('result.shareFailed'), { role: 'alert', polite: false });
    });
  }

  function handleWhatsApp() {
    if (!state.lastResult) return;
    shareResultWithImage('whatsapp');
  }

  function handleInstagram() {
    if (!state.lastResult) return;
    shareResultWithImage('instagram');
  }

  function handleFacebook() {
    if (!state.lastResult) return;
    shareResultWithImage('facebook');
  }

  function handleShareCard() {
    if (!state.lastResult) return;
    toast('Creating your share card\u2026', { duration: 1500 });
    LoveCalc.sharing.createShareCard(state.lastResult).then(function () {
      toast(t('result.cardSaved'));
    }).catch(function () {
      toast('Could not create share card.', { role: 'alert', polite: false });
    });
  }

  // ---------------------------------------------------------------------
  // FAQ accordion
  // ---------------------------------------------------------------------
  function renderFAQ() {
    var container = $('#lc-faq-list');
    if (!container) return;
    var items = (LoveCalc.i18n.en && LoveCalc.i18n.en.faq && LoveCalc.i18n.en.faq.items) || [];
    // Insert an ad slot in the middle of the FAQ list
    var midIndex = Math.floor(items.length / 2);
    var html = '';
    items.forEach(function (item, i) {
      var qid = 'lc-faq-q-' + i;
      var aid = 'lc-faq-a-' + i;
      html += '' +
        '<div class="lc-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">' +
          '<h3 class="lc-faq-q">' +
            '<button type="button" id="' + qid + '" aria-expanded="false" aria-controls="' + aid + '" class="lc-faq-btn">' +
              '<span itemprop="name">' + escapeHTML(item.q) + '</span>' +
              '<span class="lc-faq-icon" aria-hidden="true">+</span>' +
            '</button>' +
          '</h3>' +
          '<div class="lc-faq-a" id="' + aid + '" role="region" aria-labelledby="' + qid + '" hidden ' +
               'itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">' +
            '<p itemprop="text">' + escapeHTML(item.a) + '</p>' +
          '</div>' +
        '</div>';
      // Insert ad slot after the middle item
      if (i === midIndex - 1) {
        html += '<aside class="lc-ad lc-ad--inline lc-ad--faq" aria-label="Advertisement">' +
                '<span class="lc-ad-label">Advertisement</span>' +
                '<div class="lc-ad__slot"><!-- AdSense slot — between FAQ — replace at deploy --></div>' +
                '</aside>';
      }
    });
    setHTML(container, html);

    $all('.lc-faq-btn', container).forEach(function (btn) {
      on(btn, 'click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        var ans = document.getElementById(btn.getAttribute('aria-controls'));
        if (ans) ans.hidden = expanded;
        var icon = btn.querySelector('.lc-faq-icon');
        if (icon) setText(icon, expanded ? '+' : '\u2212');
      });
    });
  }

  // ---------------------------------------------------------------------
  // Static text binding
  // ---------------------------------------------------------------------
  function applyStaticText() {
    // Hero
    setText($('#lc-hero-title'), t('hero.title'));
    setText($('#lc-hero-subtitle'), t('hero.subtitle'));
    setText($('#lc-hero-desc'), t('hero.description'));
    setText($('#lc-hero-cta-text'), t('hero.cta'));
    setText($('#lc-hero-disclaimer'), t('hero.disclaimer'));

    // Nav
    setText($('#lc-nav-calculator'), t('nav.calculator'));
    setText($('#lc-nav-how'), t('nav.howItWorks'));
    setText($('#lc-nav-faq'), t('nav.faq'));
    setText($('#lc-nav-privacy'), t('nav.privacy'));

    // Mode selector
    setText($('#lc-mode-label'), t('calculator.modeLabel'));
    setText($('#lc-mode-names'), t('calculator.modeNames'));
    setText($('#lc-mode-names-hint'), t('calculator.modeNamesHint'));
    setText($('#lc-mode-thumb'), t('calculator.modeThumb'));
    setText($('#lc-mode-thumb-hint'), t('calculator.modeThumbHint'));
    setText($('#lc-mode-both'), t('calculator.modeBoth'));
    setText($('#lc-mode-both-hint'), t('calculator.modeBothHint'));

    // Calculator
    var n1 = $('#lc-name1'); if (n1) n1.setAttribute('placeholder', t('calculator.yourNamePlaceholder'));
    var n2 = $('#lc-name2'); if (n2) n2.setAttribute('placeholder', t('calculator.partnerNamePlaceholder'));
    setText($('label[for="lc-name1"]'), t('calculator.yourName'));
    setText($('label[for="lc-name2"]'), t('calculator.partnerName'));
    setText($('#lc-calc-btn-text'), t('calculator.calculate'));
    setText($('#lc-try-again-text'), t('calculator.tryAgain'));
    setText($('#lc-new-names-text'), t('calculator.newNames'));
    setText($('#lc-reset-text'), t('calculator.reset'));

    // Thumbprint
    setText($('#lc-thumb-hint'), t('thumbprint.hint'));
    setText($('#lc-thumb1-label'), t('thumbprint.pad1Label'));
    setText($('#lc-thumb2-label'), t('thumbprint.pad2Label'));

    // Empty / loading
    setText($('#lc-empty-title'), t('empty.title'));
    setText($('#lc-empty-hint'), t('empty.hint'));
    setText($('#lc-loading-title'), t('loading.title'));
    setText($('#lc-loading-hint'), t('loading.hint'));

    // Result actions
    setText($('#lc-share-text'), t('result.shareResult'));
    setText($('#lc-copy-text'), t('result.copyResult'));
    setText($('#lc-card-text'), t('result.createCard'));
    setText($('#lc-challenge'), t('result.challenge'));

    // Button hints
    setText($('#lc-share-hint'), t('howTo.legendShare'));
    setText($('#lc-copy-hint'), t('howTo.legendCopy'));
    setText($('#lc-whatsapp-hint'), t('howTo.legendWhatsApp'));
    setText($('#lc-card-hint'), t('howTo.legendCard'));
    setText($('#lc-try-again-hint'), 'Re-runs the same names');
    setText($('#lc-new-names-hint'), 'Clears names so you can try a new pair');
    setText($('#lc-reset-hint'), t('howTo.legendReset'));
    // Example demo removed

    // Breakdown
    setText($('#lc-breakdown-title'), t('breakdown.title'));
    setText($('#lc-breakdown-sub'), t('breakdown.subtitle'));

    // Sections
    setText($('#lc-how-title'), t('howItWorks.title'));
    setText($('#lc-how-lead'), t('howItWorks.lead'));
    var howSteps = [
      { t: t('howItWorks.step1Title'), b: t('howItWorks.step1Body') },
      { t: t('howItWorks.step2Title'), b: t('howItWorks.step2Body') },
      { t: t('howItWorks.step3Title'), b: t('howItWorks.step3Body') },
      { t: t('howItWorks.step4Title'), b: t('howItWorks.step4Body') }
    ];
    var howList = $('#lc-how-steps');
    if (howList) {
      setHTML(howList, howSteps.map(function (s) {
        return '<div class="lc-how-step"><h3>' + escapeHTML(s.t) + '</h3><p>' + escapeHTML(s.b) + '</p></div>';
      }).join(''));
    }

    setText($('#lc-faq-title'), t('faq.title'));

    setText($('#lc-disclaimer-title'), t('disclaimer.title'));
    setText($('#lc-disclaimer-body'), t('disclaimer.body'));

    setText($('#lc-privacy-title'), t('privacy.title'));
    setText($('#lc-privacy-body'), t('privacy.body'));

    setText($('#lc-edu-title'), t('educational.title'));
    setText($('#lc-edu-lead'), t('educational.lead'));
    setText($('#lc-edu-h2-what'), t('educational.h2What'));
    setText($('#lc-edu-p-what'), t('educational.pWhat'));
    setText($('#lc-edu-h2-why'), t('educational.h2Why'));
    setText($('#lc-edu-p-why'), t('educational.pWhy'));
    setText($('#lc-edu-h2-limit'), t('educational.h2Limit'));
    setText($('#lc-edu-p-limit'), t('educational.pLimit'));
    setText($('#lc-edu-h2-real'), t('educational.h2Real'));
    setText($('#lc-edu-p-real'), t('educational.pReal'));

    // Footer
    setText($('#lc-footer-tagline'), t('footer.tagline'));
    setText($('#lc-footer-about'), t('footer.about'));
    setText($('#lc-footer-privacy'), t('footer.privacy'));
    setText($('#lc-footer-terms'), t('footer.terms'));
    setText($('#lc-footer-contact'), t('footer.contact'));
    setText($('#lc-footer-disclaimer'), t('footer.disclaimer'));

  
// Brand
setText($('#lc-brand'), 'Love Calculator');
setText($('#lc-brand-footer'), 'Love Calculator');

    // Ad labels
    $all('.lc-ad-label').forEach(function (el) { setText(el, t('adLabel')); });
  }

  // ---------------------------------------------------------------------
  // Char counters
  // ---------------------------------------------------------------------
  function initCharCounters() {
    var max = LoveCalc.calculator.MAX_NAME_LEN;
    [['#lc-name1', '#lc-count1'], ['#lc-name2', '#lc-count2']].forEach(function (pair) {
      var input = $(pair[0]);
      var counter = $(pair[1]);
      if (!input || !counter) return;
      function update() {
        var len = input.value.length;
        setText(counter, len + ' / ' + max + ' ' + t('calculator.chars'));
        counter.classList.toggle('lc-count--warn', len > max);
      }
      on(input, 'input', update);
      update();
    });
  }

  // ---------------------------------------------------------------------
  // Clear buttons inside inputs
  // ---------------------------------------------------------------------
  function initClearButtons() {
    [['#lc-name1', '#lc-name1-clear'], ['#lc-name2', '#lc-name2-clear']].forEach(function (pair) {
      var input = $(pair[0]);
      var btn = $(pair[1]);
      if (!input || !btn) return;
      function sync() {
        btn.style.visibility = input.value ? 'visible' : 'hidden';
      }
      on(input, 'input', sync);
      on(btn, 'click', function () {
        input.value = '';
        clearFieldError(input);
        input.focus();
        sync();
      });
      sync();
    });
  }

  // ---------------------------------------------------------------------
  // Theme toggle + palette picker
  // ---------------------------------------------------------------------
  function initThemeToggle() {
    var btn = $('#lc-theme-toggle');
    if (!btn) return;
    function label() {
      var mode = LoveCalc.theme.getMode();
      var labelMap = { light: 'Light', dark: 'Dark' };
      setText(btn, labelMap[mode] || 'Light');
      btn.setAttribute('aria-label', 'Light / Dark: ' + (labelMap[mode] || 'Light') + '. Click to change.');
    }
    on(btn, 'click', function () {
      LoveCalc.theme.cycleMode();
      label();
      toast(t('toast.themeSaved'), { duration: 1500 });
    });
    label();
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('lc-theme-changed', label);
    }
  }

  // ---------------------------------------------------------------------
  // Share website button (top bar) — single button, opens native share
  // ---------------------------------------------------------------------
  function initShareSite() {
    var btn = $('#lc-share-site');
    if (!btn) return;

    function doShare(e) {
      if (e) e.preventDefault();
      var url = window.location.origin + '/love-calculator/';
      var text = 'Check out this Love Calculator! Calculate your love percentage with names or thumbprints.';
      var fullText = text + ' ' + url;

      // Try navigator.share first (mobile)
      if (navigator.share) {
        navigator.share({
          title: 'Love Calculator',
          text: text,
          url: url
        }).then(function () {
          toast('Shared!', { duration: 1500 });
        }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          // Fallback: open WhatsApp web
          window.open('https://wa.me/?text=' + encodeURIComponent(fullText), '_blank', 'noopener,noreferrer');
          toast('Opening WhatsApp web...', { duration: 2000 });
        });
      } else {
        // Desktop: open WhatsApp web directly
        window.open('https://wa.me/?text=' + encodeURIComponent(fullText), '_blank', 'noopener,noreferrer');
        toast('Opening WhatsApp web...', { duration: 2000 });
      }
    }

    on(btn, 'click', doShare);
  }


  function initPalettePicker() {
    var swatches = $all('.lc-palette-swatch');
    function sync() {
      var current = LoveCalc.theme.getPalette();
      swatches.forEach(function (s) {
        var isActive = s.getAttribute('data-palette') === current;
        s.setAttribute('aria-checked', String(isActive));
        s.classList.toggle('lc-palette-swatch--active', isActive);
        s.setAttribute('role', 'radio');
      });
    }
    swatches.forEach(function (s) {
      on(s, 'click', function () {
        var p = s.getAttribute('data-palette');
        LoveCalc.theme.setPalette(p);
        sync();
        toast(t('themes.label') + ': ' + paletteLabel(p), { duration: 1500 });
      });
    });
    sync();
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('lc-theme-changed', sync);
    }
  }

  function paletteLabel(p) {
    var map = { rose: t('themes.rose'), midnight: t('themes.midnight'),
                ocean: t('themes.ocean'), aurora: t('themes.aurora'),
                sunset: t('themes.sunset') };
    return map[p] || p;
  }

  // ---------------------------------------------------------------------
  // Smooth scroll for anchor links
  // ---------------------------------------------------------------------
  function initAnchors() {
    $all('a[href^="#"]').forEach(function (a) {
      on(a, 'click', function (e) {
        var href = a.getAttribute('href');
        if (!href || href === '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
          target.scrollIntoView();
        }
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });

    // Section reveal on scroll using IntersectionObserver
    if ('IntersectionObserver' in window && !LoveCalc.animation.prefersReducedMotion()) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('lc-section--visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
      $all('.lc-section').forEach(function (section) {
        observer.observe(section);
      });
    } else {
      // Fallback: just show all sections
      $all('.lc-section').forEach(function (section) {
        section.classList.add('lc-section--visible');
      });
    }
  }

  // ---------------------------------------------------------------------
  // Bottom tab modal — About / Privacy / Terms / Contact / Disclaimer
  // ---------------------------------------------------------------------
  var TAB_CONTENT = {
    about: {
      title: 'About the Love Calculator',
      icon: '\u2764\uFE0F',
      body: '' +
        '<p>The Love Calculator is a free, browser-based tool that generates a love percentage from two names or thumbprints. It works fully offline &mdash; all calculations happen in your browser, with no servers, no logins, and no personal data collected.</p>' +
        '<p>Our mission is simple: to deliver a tiny moment of joy that you can share with friends, partners, or crushes, in any language and from any country. The algorithm is original, the design is mobile-first, and the experience is built to be fast, accessible, and respectful of every user&rsquo;s privacy.</p>' +
        '<p>The database also contains pre-saved results for famous celebrity couples from around the world &mdash; Bollywood, Hollywood, Tollywood, sports, music, and royalty &mdash; so when you search for your favorite stars, you get their official love score.</p>' +
        '<p>This tool is maintained by <strong>Shubham Raut</strong>. If you have feedback, ideas, or just want to say hello, you&rsquo;re always welcome to reach out.</p>'
    },
    privacy: {
      title: 'Privacy Policy',
      icon: '\uD83D\uDD12',
      body: '' +
        '<p>Your privacy comes first. The Love Calculator runs entirely in your browser &mdash; the names you type and the thumbprints you scan <strong>never leave your device</strong> and are <strong>never saved on any server</strong>.</p>' +
        '<p>We do not transmit, store, or share your inputs. We do not use accounts, email sign-ups, or login walls. We do not request location, contacts, camera, microphone, or notifications.</p>' +
        '<p>The only thing stored on your device is your color theme and light/dark preference, saved in your browser&rsquo;s local storage. No cookies are set by the calculator.</p>' +
        '<p>The server-side database contains only pre-seeded celebrity couple results &mdash; not visitor data. Your personal name searches stay on your device.</p>'
    },
    terms: {
      title: 'Terms of Use',
      icon: '\uD83D\uDCC4',
      body: '' +
        '<p>By using the Love Calculator, you agree to the following terms. The tool is provided free of charge for personal, non-commercial use only. The love percentage is generated by an original algorithm and is not a scientific, psychological, medical, or relationship measurement.</p>' +
        '<p>You must not use the tool to harass, demean, or pressure anyone, and you must not present the results as factual advice to others.</p>' +
        '<p>You may share your results freely, but you may not copy, republish, or resell the tool&rsquo;s code, design, or content without permission. The tool is provided &ldquo;as is&rdquo; without warranties of any kind. The maintainer is not liable for any consequences arising from the use or misuse of the calculator.</p>'
    },
    contact: {
      title: 'Contact',
      icon: '\u2709\uFE0F',
      body: '' +
        '<p>Have feedback, found a bug, or want to suggest a feature? I&rsquo;d love to hear from you. The Love Calculator is maintained by <strong>Shubham Raut</strong>, and you can reach out anytime.</p>' +
        '<p class="lc-contact-email"><a href="mailto:rautshubham186@gmail.com">rautshubham186@gmail.com</a></p>' +
        '<p class="lc-contact-hint">Please allow a few days for a reply. For bug reports, please include your browser, device, and a short description of what happened.</p>'
    },
    disclaimer: {
      title: 'Disclaimer',
      icon: '\u26A0\uFE0F',
      body: '' +
        '<p>The Love Calculator generates its percentage using a name- and thumbprint-based algorithm and is not a scientific measurement of love, compatibility, personality, attraction, loyalty, or relationship success. Names and thumbprints cannot predict whether a relationship will succeed, and any tool claiming otherwise is not being honest with you.</p>' +
        '<p>Real relationships are built by people &mdash; through care, communication, mutual respect, shared values, and the willingness to grow together. Those things live in actions, not in algorithms.</p>' +
        '<p>Use this calculator for a smile, share it with friends, and then go put real care into the people who matter to you. The maintainer is not responsible for decisions made based on the calculator&rsquo;s output.</p>'
    }
  };

  function openTabModal(tab) {
    var content = TAB_CONTENT[tab];
    if (!content) return;
    var modal = $('#lc-tab-modal');
    var titleEl = $('#lc-tab-modal-title');
    var bodyEl = $('#lc-tab-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.innerHTML = '<span class="lc-tab-modal__icon" aria-hidden="true">' + content.icon + '</span> ' + escapeHTML(content.title);
    bodyEl.innerHTML = content.body;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // Focus the close button for accessibility
    var closeBtn = $('#lc-tab-modal-close');
    if (closeBtn) setTimeout(function () { closeBtn.focus(); }, 100);
  }

  function closeTabModal() {
    var modal = $('#lc-tab-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function initBottomTabs() {
    // Footer links open the tab modal (bottom tab bar removed)
    $all('.lc-footer__links a[data-tab]').forEach(function (link) {
      on(link, 'click', function (e) {
        e.preventDefault();
        openTabModal(link.getAttribute('data-tab'));
      });
    });
    // Close modal
    on($('#lc-tab-modal-close'), 'click', closeTabModal);
    on($('#lc-tab-modal-backdrop'), 'click', closeTabModal);
    // Escape key closes modal
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = $('#lc-tab-modal');
        if (modal && !modal.hidden) closeTabModal();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function init() {
    var lang = LoveCalc.international.detectBaseLang();
    LoveCalc.international.prepareTranslation(lang);

    applyStaticText();
    renderFAQ();
    initCharCounters();
    initClearButtons();
    initModeSelector();
    initThumbpads();
    initThemeToggle();
    initPalettePicker();
    initAnchors();
    initBottomTabs();
    initShareSite();

    on($('#lc-calc-btn'), 'click', handleCalculate);
    on($('#lc-calc-form'), 'submit', function (e) {
      e.preventDefault();
      handleCalculate();
    });

    on($('#lc-try-again'), 'click', function () { handleReset(false); });
    on($('#lc-new-names'), 'click', function () { handleReset(true); });
    on($('#lc-reset'), 'click', function () { handleReset(true); });
    on($('#lc-share'), 'click', handleShare);
    on($('#lc-copy'), 'click', handleCopy);

    // Breakdown toggle (collapsible)
    on($('#lc-breakdown-toggle'), 'click', function () {
      var btn = $('#lc-breakdown-toggle');
      var panel = $('#lc-breakdown');
      if (!btn || !panel) return;
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
      var icon = btn.querySelector('.lc-breakdown-toggle-icon');
      if (icon) setText(icon, expanded ? '+' : '\u2212');
      // If opening, re-trigger the bar fill animations
      if (!expanded) {
        setTimeout(function () {
          $all('.lc-breakdown-item', panel).forEach(function (item) {
            var key = item.getAttribute('data-key');
            var fill = item.querySelector('.lc-breakdown-fill');
            if (fill) {
              fill.style.width = '0%';
              requestAnimationFrame(function () {
                var val = (state.lastResult && state.lastResult.secondary && state.lastResult.secondary[key]) || 0;
                fill.style.width = val + '%';
              });
            }
          });
        }, 50);
      }
    });

    on($('#lc-hero-cta'), 'click', function () {
      var calc = $('#lc-calculator');
      if (calc) {
        // Scroll to the calculator card (name + thumbprint inputs)
        try {
          var rect = calc.getBoundingClientRect();
          var win = calc.ownerDocument.defaultView;
          var targetTop = win.scrollY + rect.top - 80;
          win.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        } catch (e) {
          try { calc.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {}
        }
        // Focus the first name input so the visitor can start typing
        var n1 = $('#lc-name1');
        if (n1) setTimeout(function () { n1.focus(); }, 600);
      }
    });

    showEmpty();
    LoveCalc.animation.startAmbient();

    if (typeof global.addEventListener === 'function') {
      global.addEventListener('lc-locale-changed', function () {
        applyStaticText();
        renderFAQ();
      });
    }
  }

  LoveCalc.app = {
    init: init,
    handleCalculate: handleCalculate,
    handleReset: handleReset,
    toast: toast,
    state: state
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})(typeof window !== 'undefined' ? window : this);
