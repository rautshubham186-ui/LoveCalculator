/**
 * seo.js
 * ------
 * Centralized SEO metadata (spec sections 23, 25, 26, 27, 71).
 *
 *   - Injects JSON-LD for WebApplication + FAQPage.
 *   - Updates <title>, meta description, canonical, OG, Twitter tags
 *     dynamically so a single source of truth lives in code.
 *   - No fabricated reviews / ratings / user counts (spec section 26).
 *   - FAQPage schema is only emitted when visible FAQ content exists
 *     (spec section 25).
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  var SITE_NAME = 'Love Calculator';
  var CANONICAL = 'https://rautshubham186-ui.github.io/LoveCalculator/'; // placeholder
  var OG_IMAGE  = CANONICAL + 'og-cover.png'; // placeholder

  function ensureTag(selector, creator) {
    var el = document.querySelector(selector);
    if (!el) {
      el = creator();
      document.head.appendChild(el);
    }
    return el;
  }

  function setMeta(attr, key, content) {
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function applyBaseMeta() {
    var i18n = LoveCalc.i18n || {};
    var en = i18n.en || {};
    var brand = (en.brand && en.brand.tool) || 'Love Calculator';
    var hero = en.hero || {};
    var title = brand + ' \u2014 Fun Love Match Percentage';
    var description = hero.description ||
      'Enter two names and reveal your love percentage. Original algorithm, full Unicode support, mobile-first, accessible, privacy-friendly.';

    document.title = title;
    setMeta('name', 'description', description);
    setLink('canonical', CANONICAL);

    // Open Graph
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', CANONICAL);
    setMeta('property', 'og:image', OG_IMAGE);
    setMeta('property', 'og:image:alt', 'Two names inside a glowing heart with a love percentage.');

    // Twitter / X
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', OG_IMAGE);
    setMeta('name', 'twitter:image:alt', 'Two names inside a glowing heart with a love percentage.');

    // Robots
    setMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMeta('name', 'theme-color', '#fff5f8');
    setMeta('name', 'author', SITE_NAME);
    setMeta('name', 'application-name', brand);
    setMeta('name', 'apple-mobile-web-app-title', brand);
    setMeta('name', 'apple-mobile-web-app-capable', 'yes');
    setMeta('name', 'mobile-web-app-capable', 'yes');
    setMeta('name', 'apple-mobile-web-app-status-bar-style', 'default');
    // Light keyword hint (not stuffed — just the core terms users search)
    setMeta('name', 'keywords', 'love calculator, love percentage calculator, love match calculator, love compatibility calculator, name love calculator, couple love calculator, love test, fun love score');
  }

  // ---------------------------------------------------------------------
  // JSON-LD: WebApplication + FAQPage
  // ---------------------------------------------------------------------
  function buildWebApplication() {
    var i18n = LoveCalc.i18n || {};
    var en = i18n.en || {};
    var brand = (en.brand && en.brand.tool) || 'Love Calculator';

    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': brand,
      'applicationCategory': 'GameApplication',
      'applicationSubCategory': 'LifestyleApplication',
      'operatingSystem': 'Any (web browser)',
      'browserRequirements': 'Requires a modern web browser with JavaScript enabled.',
      'url': CANONICAL,
      'description': en.hero && en.hero.description,
      'inLanguage': ['en'],
      'isAccessibleForFree': true,
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'featureList': [
        'Original love score algorithm',
        'Full Unicode name support (Latin, Cyrillic, CJK, Arabic, Devanagari and more)',
        'Thumbprint scan mode for an extra dimension',
        'Names + thumbprint combined mode for the deepest reading',
        'Light, dark, and system modes with five color palettes',
        'Privacy-friendly: all calculations happen client-side',
        'Reduced-motion support',
        'Shareable results with canvas share card'
      ],
      'audience': {
        '@type': 'Audience',
        'audienceType': 'General public'
      },
      'publisher': {
        '@type': 'Organization',
        'name': SITE_NAME,
        'url': CANONICAL
      }
    };
  }

  function buildOrganization() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Love Calculator',
      'url': CANONICAL,
      'logo': OG_IMAGE,
      'description': 'Love Calculator is a small, polished, privacy-friendly tool for the web.'
    };
  }

  function buildBreadcrumb() {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': CANONICAL
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Love Calculator',
          'item': CANONICAL
        }
      ]
    };
  }

  function buildFAQPage() {
    var i18n = LoveCalc.i18n || {};
    var en = i18n.en || {};
    var faq = (en.faq && en.faq.items) || [];
    if (!faq.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faq.map(function (item) {
        return {
          '@type': 'Question',
          'name': item.q,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': item.a
          }
        };
      })
    };
  }

  function injectJsonLd(id, obj) {
    if (!obj) return;
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(obj);
    document.head.appendChild(script);
  }

  function applyStructuredData() {
    injectJsonLd('lc-jsonld-webapp', buildWebApplication());
    injectJsonLd('lc-jsonld-org', buildOrganization());
    injectJsonLd('lc-jsonld-breadcrumb', buildBreadcrumb());
    var faq = buildFAQPage();
    if (faq) injectJsonLd('lc-jsonld-faq', faq);
  }

  // ---------------------------------------------------------------------
  // Dynamic result-aware meta updates (e.g. share-card OG image)
  // Currently the OG image stays the static brand image (we don't store
  // per-result images server-side — spec section 38 privacy stance).
  // ---------------------------------------------------------------------
  function onResult(/* result */) {
    // Intentionally a no-op for now. Hook retained for future use
    // (e.g. updating twitter:title to include the score for sharing).
  }

  function init() {
    applyBaseMeta();
    applyStructuredData();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  LoveCalc.seo = {
    init: init,
    applyBaseMeta: applyBaseMeta,
    applyStructuredData: applyStructuredData,
    onResult: onResult,
    CANONICAL: CANONICAL,
    SITE_NAME: SITE_NAME
  };

})(typeof window !== 'undefined' ? window : this);
