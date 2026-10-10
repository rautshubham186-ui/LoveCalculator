/**
 * sharing.js
 * ----------
 * Share / copy / share-card module (spec sections 17, 18, 36, 37, 38).
 *
 *   - Web Share API where available, with clean fallbacks.
 *   - Copy Result: clean text with names, score, short interpretation,
 *     site name, and disclaimer.
 *   - Copy Link: location URL (no names embedded — privacy safe).
 *   - WhatsApp share link (web fallback).
 *   - Optional "Create Share Card": client-side canvas PNG with names,
 *     score, original graphics, site name, and disclaimer.
 *
 * Privacy:
 *   - We never store names on a server to build share URLs.
 *   - The share URL is just the page URL — no query params with names
 *     (spec section 38).
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  var SITE_NAME = 'Love Calculator';
  var SITE_URL = 'https://bit.ly/4AXDOfJ'; // placeholder; replace at deploy

  // ---------------------------------------------------------------------
  // Text composition
  // ---------------------------------------------------------------------
  function createShareText(result) {
    var paragraph = result.paragraph || '';
    // Keep share text short: first sentence of the paragraph
    var firstSentence = paragraph.split(/(?<=[.!?])\s/)[0] || '';
    var body = firstSentence ? '\n' + firstSentence : '';
    return 'We got ' + result.score + '% on the Love Calculator \u2764\uFE0F ' +
           'Try yours!' + body + '\n\n' +
           '(' + result.display1 + ' \u2764\uFE0F ' + result.display2 + ' \u2014 ' + result.score + '%)\n' +
           SITE_URL;
  }

  function createCopyText(result) {
    var msg = result.message || {};
    var paragraph = result.paragraph || '';
    var secondary = result.secondary || {};
    var breakdown = '';
    var keys = LoveCalc.calculator.SECONDARY_KEYS;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (secondary[k] != null) {
        breakdown += '   - ' + prettyKey(k) + ': ' + secondary[k] + '%\n';
      }
    }
    return [
      'Love Calculator Result',
      '======================',
      '',
      result.display1 + ' \u2764\uFE0F ' + result.display2,
      'Love Match: ' + result.score + '%',
      'Title: ' + (msg.title || ''),
      '',
      paragraph,
      '',
      'Fun Compatibility Breakdown:',
      breakdown,
      'Not a scientific measurement of love, compatibility, or relationship success.',
      'Made with ' + SITE_NAME + '.'
    ].join('\n');
  }

  function prettyKey(k) {
    var map = {
      loveVibe: 'Love Vibe',
      friendshipVibe: 'Friendship Vibe',
      chemistryVibe: 'Chemistry Vibe',
      communicationVibe: 'Communication Vibe',
      funFactor: 'Fun Factor',
      adventureVibe: 'Adventure Vibe',
      caringVibe: 'Caring Vibe'
    };
    return map[k] || k;
  }

  // ---------------------------------------------------------------------
  // Web Share API
  // ---------------------------------------------------------------------
  function shareResult(result) {
    var text = createShareText(result);
    var data = {
      title: 'Love Calculator \u2014 ' + result.score + '%',
      text: text,
      url: SITE_URL
    };

    if (navigator.share) {
      return navigator.share(data).then(function () {
        return { ok: true, method: 'native' };
      }).catch(function (err) {
        // User cancellation is normal — propagate but mark as cancelled
        if (err && err.name === 'AbortError') {
          return { ok: false, cancelled: true };
        }
        return { ok: false, error: err };
      });
    }

    // Fallback: try WhatsApp web link with the text pre-filled
    return Promise.resolve({ ok: false, fallback: true, text: text });
  }

  function shareViaWhatsApp(result) {
    var text = createShareText(result);
    var url = 'https://wa.me/?text=' + encodeURIComponent(text);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    return { ok: true, method: 'whatsapp' };
  }

  // ---------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return { ok: true, method: 'async' };
      }).catch(function () {
        return execCommandCopy(text);
      });
    }
    return Promise.resolve(execCommandCopy(text));
  }

  function execCommandCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return { ok: ok, method: 'execCommand' };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  function copyResult(result) {
    var text = createCopyText(result);
    return copyText(text);
  }

  function copyLink() {
    var url = (typeof window !== 'undefined') ? window.location.href : SITE_URL;
    return copyText(url);
  }

  // ---------------------------------------------------------------------
  // Share Card (canvas PNG) — spec section 37
  //   - Original graphics (CSS-drawn hearts on canvas).
  //   - Names + score + site name + disclaimer.
  //   - Triggered only on explicit user interaction.
  // ---------------------------------------------------------------------
  function drawHeart(ctx, cx, cy, size, color) {
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

  function drawHeartOutline(ctx, cx, cy, size, color, lineWidth) {
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

  function createShareCard(result) {
    return new Promise(function (resolve, reject) {
      try {
        var W = 1080, H = 1350; // 4:5 social-friendly size
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }

        var pal = result.palette || { primary: '#E8849B', accent: '#F8B7C8' };

        // Background gradient
        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#fff5f8');
        bg.addColorStop(0.5, '#ffe4ec');
        bg.addColorStop(1, '#ffd1dc');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Decorative background hearts (faint)
        for (var i = 0; i < 18; i++) {
          var x = Math.random() * W;
          var y = Math.random() * H;
          var s = 30 + Math.random() * 70;
          ctx.globalAlpha = 0.06 + Math.random() * 0.05;
          drawHeart(ctx, x, y, s, pal.primary);
        }
        ctx.globalAlpha = 1;

        // Central main heart
        var cx = W / 2, cy = H * 0.36;
        ctx.globalAlpha = 0.25;
        drawHeart(ctx, cx, cy, 360, pal.primary);
        ctx.globalAlpha = 1;
        drawHeartOutline(ctx, cx, cy, 360, pal.primary, 4);

        // Score text inside heart
        ctx.fillStyle = pal.primary;
        ctx.font = 'bold 180px Georgia, "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(result.score) + '%', cx, cy + 20);

        // Score label
        ctx.fillStyle = '#7a2a3f';
        ctx.font = '600 48px -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Love Match', cx, cy + 130);

        // Names
        ctx.fillStyle = '#2a0d18';
        ctx.font = '600 56px -apple-system, "Segoe UI", Roboto, sans-serif';
        var names = result.display1 + '  \u2764\uFE0F  ' + result.display2;
        // Truncate if too long
        var maxW = W - 160;
        while (ctx.measureText(names).width > maxW && names.length > 4) {
          names = names.slice(0, -2);
        }
        if (names.length < (result.display1 + '  \u2764\uFE0F  ' + result.display2).length) {
          names = names + '\u2026';
        }
        ctx.fillText(names, cx, H * 0.66);

        // Title (e.g. "Sweet Chemistry")
        if (result.message && result.message.title) {
          ctx.fillStyle = pal.primary;
          ctx.font = 'italic 44px Georgia, serif';
          ctx.fillText(result.message.title, cx, H * 0.72);
        }

        // Footer: site name + disclaimer
        ctx.fillStyle = '#5a2a3a';
        ctx.font = '500 32px -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(SITE_NAME, cx, H - 110);

        ctx.fillStyle = '#8a5a6a';
        ctx.font = '400 26px -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Not a scientific measurement.', cx, H - 70);
        ctx.fillText('Not a scientific measurement of love.', cx, H - 40);

        // Trigger download
        var triggerDownload = function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'love-calculator-' + result.score + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          resolve({ ok: true, blob: blob });
        };

        if (canvas.toBlob) {
          canvas.toBlob(triggerDownload, 'image/png');
        } else {
          var dataUrl = canvas.toDataURL('image/png');
          fetch(dataUrl).then(function (r) { return r.blob(); }).then(triggerDownload);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  LoveCalc.sharing = {
    createShareText: createShareText,
    createCopyText: createCopyText,
    shareResult: shareResult,
    shareViaWhatsApp: shareViaWhatsApp,
    copyResult: copyResult,
    copyLink: copyLink,
    createShareCard: createShareCard,
    SITE_NAME: SITE_NAME,
    SITE_URL: SITE_URL
  };

})(typeof window !== 'undefined' ? window : this);
