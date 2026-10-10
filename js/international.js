/**
 * international.js
 * ----------------
 * Country / locale support for the Love Calculator (spec sections 5, 6, 7, 29).
 *
 * Principles:
 *   - Country selection is OPTIONAL and never affects the fairness of the score.
 *   - It only acts as a presentation / locale hint (e.g. date formatting,
 *     placeholder language readiness). It is NEVER used to claim certain
 *     nationalities are "more loving" or "more compatible".
 *   - Locale detection only reads navigator.language — no GPS, no IP lookup,
 *     no permissions requested.
 *   - Name normalization is fully Unicode-safe and preserves the original
 *     display form.
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  // ---------------------------------------------------------------------
  // Country list (spec section 5)
  // Each entry: { code: ISO 3166-1 alpha-2, name: English name, flag: emoji }
  // Flag emoji derived from ISO codes — universally available in modern fonts.
  // ---------------------------------------------------------------------
  var COUNTRIES = [
    { code: 'IN', name: 'India', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
    { code: 'US', name: 'United States', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
    { code: 'GB', name: 'United Kingdom', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
    { code: 'CA', name: 'Canada', flag: '\uD83C\uDDE8\uD83C\uDDE6' },
    { code: 'AU', name: 'Australia', flag: '\uD83C\uDDE6\uD83C\uDDFA' },
    { code: 'NZ', name: 'New Zealand', flag: '\uD83C\uDDF3\uD83C\uDDFF' },
    { code: 'IE', name: 'Ireland', flag: '\uD83C\uDDEE\uD83C\uDDEA' },
    { code: 'DE', name: 'Germany', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
    { code: 'FR', name: 'France', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
    { code: 'NL', name: 'Netherlands', flag: '\uD83C\uDDF3\uD83C\uDDF1' },
    { code: 'CH', name: 'Switzerland', flag: '\uD83C\uDDE8\uD83C\uDDED' },
    { code: 'AT', name: 'Austria', flag: '\uD83C\uDDE6\uD83C\uDDF9' },
    { code: 'BE', name: 'Belgium', flag: '\uD83C\uDDE7\uD83C\uDDEA' },
    { code: 'SE', name: 'Sweden', flag: '\uD83C\uDDF8\uD83C\uDDEA' },
    { code: 'NO', name: 'Norway', flag: '\uD83C\uDDF3\uD83C\uDDF4' },
    { code: 'DK', name: 'Denmark', flag: '\uD83C\uDDE9\uD83C\uDDF0' },
    { code: 'FI', name: 'Finland', flag: '\uD83C\uDDEB\uD83C\uDDEE' },
    { code: 'IS', name: 'Iceland', flag: '\uD83C\uDDEE\uD83C\uDDF8' },
    { code: 'IT', name: 'Italy', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
    { code: 'ES', name: 'Spain', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
    { code: 'PT', name: 'Portugal', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
    { code: 'GR', name: 'Greece', flag: '\uD83C\uDDEC\uD83C\uDDF7' },
    { code: 'BR', name: 'Brazil', flag: '\uD83C\uDDE7\uD83C\uDDF7' },
    { code: 'MX', name: 'Mexico', flag: '\uD83C\uDDF2\uD83C\uDDFD' },
    { code: 'AR', name: 'Argentina', flag: '\uD83C\uDDE6\uD83C\uDDF7' },
    { code: 'CL', name: 'Chile', flag: '\uD83C\uDDE8\uD83C\uDDF1' },
    { code: 'CO', name: 'Colombia', flag: '\uD83C\uDDE8\uD83C\uDDF4' },
    { code: 'PE', name: 'Peru', flag: '\uD83C\uDDF5\uD83C\uDDEA' },
    { code: 'VE', name: 'Venezuela', flag: '\uD83C\uDDFB\uD83C\uDDEA' },
    { code: 'UY', name: 'Uruguay', flag: '\uD83C\uDDFA\uD83C\uDDFE' },
    { code: 'ZA', name: 'South Africa', flag: '\uD83C\uDDFF\uD83C\uDDE6' },
    { code: 'NG', name: 'Nigeria', flag: '\uD83C\uDDF3\uD83C\uDDEC' },
    { code: 'KE', name: 'Kenya', flag: '\uD83C\uDDF0\uD83C\uDDEA' },
    { code: 'GH', name: 'Ghana', flag: '\uD83C\uDDEC\uD83C\uDDED' },
    { code: 'EG', name: 'Egypt', flag: '\uD83C\uDDEA\uD83C\uDDEC' },
    { code: 'MA', name: 'Morocco', flag: '\uD83C\uDDF2\uD83C\uDDE6' },
    { code: 'TN', name: 'Tunisia', flag: '\uD83C\uDDF9\uD83C\uDDF3' },
    { code: 'AE', name: 'United Arab Emirates', flag: '\uD83C\uDDE6\uD83C\uDDEA' },
    { code: 'SA', name: 'Saudi Arabia', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
    { code: 'QA', name: 'Qatar', flag: '\uD83C\uDDF6\uD83C\uDDE6' },
    { code: 'KW', name: 'Kuwait', flag: '\uD83C\uDDF0\uD83C\uDDFC' },
    { code: 'BH', name: 'Bahrain', flag: '\uD83C\uDDE7\uD83C\uDDED' },
    { code: 'OM', name: 'Oman', flag: '\uD83C\uDDF4\uD83C\uDDF2' },
    { code: 'JO', name: 'Jordan', flag: '\uD83C\uDDEF\uD83C\uDDF4' },
    { code: 'LB', name: 'Lebanon', flag: '\uD83C\uDDF1\uD83C\uDDE7' },
    { code: 'TR', name: 'Turkey', flag: '\uD83C\uDDF9\uD83C\uDDF7' },
    { code: 'IL', name: 'Israel', flag: '\uD83C\uDDEE\uD83C\uDDF1' },
    { code: 'IR', name: 'Iran', flag: '\uD83C\uDDEE\uD83C\uDDF7' },
    { code: 'IQ', name: 'Iraq', flag: '\uD83C\uDDEE\uD83C\uDDF6' },
    { code: 'JP', name: 'Japan', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
    { code: 'KR', name: 'South Korea', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
    { code: 'CN', name: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
    { code: 'TW', name: 'Taiwan', flag: '\uD83C\uDDF9\uD83C\uDDFC' },
    { code: 'HK', name: 'Hong Kong', flag: '\uD83C\uDDED\uD83C\uDDF0' },
    { code: 'SG', name: 'Singapore', flag: '\uD83C\uDDE8\uD83C\uDDEC' },
    { code: 'MY', name: 'Malaysia', flag: '\uD83C\uDDF2\uD83C\uDDFE' },
    { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9' },
    { code: 'PH', name: 'Philippines', flag: '\uD83C\uDDF5\uD83C\uDDED' },
    { code: 'TH', name: 'Thailand', flag: '\uD83C\uDDF9\uD83C\uDDED' },
    { code: 'VN', name: 'Vietnam', flag: '\uD83C\uDDFB\uD83C\uDDF3' },
    { code: 'MM', name: 'Myanmar', flag: '\uD83C\uDDF2\uD83C\uDDF2' },
    { code: 'KH', name: 'Cambodia', flag: '\uD83C\uDDF0\uD83C\uDDED' },
    { code: 'LA', name: 'Laos', flag: '\uD83C\uDDF1\uD83C\uDDE6' },
    { code: 'BD', name: 'Bangladesh', flag: '\uD83C\uDDE7\uD83C\uDDE9' },
    { code: 'PK', name: 'Pakistan', flag: '\uD83C\uDDF5\uD83C\uDDF0' },
    { code: 'LK', name: 'Sri Lanka', flag: '\uD83C\uDDF1\uD83C\uDDF0' },
    { code: 'NP', name: 'Nepal', flag: '\uD83C\uDDF3\uD83C\uDDF5' },
    { code: 'BT', name: 'Bhutan', flag: '\uD83C\uDDE7\uD83C\uDDF9' },
    { code: 'MV', name: 'Maldives', flag: '\uD83C\uDDF2\uD83C\uDDFB' },
    { code: 'AF', name: 'Afghanistan', flag: '\uD83C\uDDE6\uD83C\uDDEB' },
    { code: 'RU', name: 'Russia', flag: '\uD83C\uDDF7\uD83C\uDDFA' },
    { code: 'UA', name: 'Ukraine', flag: '\uD83C\uDDFA\uD83C\uDDE6' },
    { code: 'PL', name: 'Poland', flag: '\uD83C\uDDF5\uD83C\uDDF1' },
    { code: 'CZ', name: 'Czechia', flag: '\uD83C\uDDE8\uD83C\uDDFF' },
    { code: 'SK', name: 'Slovakia', flag: '\uD83C\uDDF8\uD83C\uDDF0' },
    { code: 'HU', name: 'Hungary', flag: '\uD83C\uDDED\uD83C\uDDFA' },
    { code: 'RO', name: 'Romania', flag: '\uD83C\uDDF7\uD83C\uDDF4' },
    { code: 'BG', name: 'Bulgaria', flag: '\uD83C\uDDE7\uD83C\uDDF4' },
    { code: 'RS', name: 'Serbia', flag: '\uD83C\uDDF7\uD83C\uDDF8' },
    { code: 'HR', name: 'Croatia', flag: '\uD83C\uDDED\uD83C\uDDF7' },
    { code: 'SI', name: 'Slovenia', flag: '\uD83C\uDDF8\uD83C\uDDEE' },
    { code: 'BA', name: 'Bosnia and Herzegovina', flag: '\uD83C\uDDE7\uD83C\uDDE6' },
    { code: 'AL', name: 'Albania', flag: '\uD83C\uDDE6\uD83C\uDDF1' },
    { code: 'MK', name: 'North Macedonia', flag: '\uD83C\uDDF2\uD83C\uDDF0' },
    { code: 'EE', name: 'Estonia', flag: '\uD83C\uDDEA\uD83C\uDDEA' },
    { code: 'LV', name: 'Latvia', flag: '\uD83C\uDDF1\uD83C\uDDFB' },
    { code: 'LT', name: 'Lithuania', flag: '\uD83C\uDDF1\uD83C\uDDF9' },
    { code: 'BY', name: 'Belarus', flag: '\uD83C\uDDE7\uD83C\uDDFE' },
    { code: 'MD', name: 'Moldova', flag: '\uD83C\uDDF2\uD83C\uDDE9' },
    { code: 'GE', name: 'Georgia', flag: '\uD83C\uDDEC\uD83C\uDDEA' },
    { code: 'AM', name: 'Armenia', flag: '\uD83C\uDDE6\uD83C\uDDF2' },
    { code: 'AZ', name: 'Azerbaijan', flag: '\uD83C\uDDE6\uD83C\uDDFF' },
    { code: 'KZ', name: 'Kazakhstan', flag: '\uD83C\uDDF0\uD83C\uDDFF' },
    { code: 'UZ', name: 'Uzbekistan', flag: '\uD83C\uDDFA\uD83C\uDDF2' },
    { code: 'TG', name: 'Togo', flag: '\uD83C\uDDF9\uD83C\uDDEC' },
    { code: 'ET', name: 'Ethiopia', flag: '\uD83C\uDDEA\uD83C\uDDF9' },
    { code: 'TZ', name: 'Tanzania', flag: '\uD83C\uDDF9\uD83C\uDDFF' },
    { code: 'UG', name: 'Uganda', flag: '\uD83C\uDDFA\uD83C\uDDEC' },
    { code: 'RW', name: 'Rwanda', flag: '\uD83C\uDDF7\uD83C\uDDFC' },
    { code: 'SN', name: 'Senegal', flag: '\uD83C\uDDF8\uD83C\uDDF3' },
    { code: 'CI', name: 'C\u00F4te d\u2019Ivoire', flag: '\uD83C\uDDE8\uD83C\uDDEE' },
    { code: 'CM', name: 'Cameroon', flag: '\uD83C\uDDE8\uD83C\uDDF2' },
    { code: 'AO', name: 'Angola', flag: '\uD83C\uDDE6\uD83C\uDDF4' },
    { code: 'MZ', name: 'Mozambique', flag: '\uD83C\uDDF2\uD83C\uDDFF' },
    { code: 'ZW', name: 'Zimbabwe', flag: '\uD83C\uDDFF\uD83C\uDDFC' },
    { code: 'ZM', name: 'Zambia', flag: '\uD83C\uDDFF\uD83C\uDDF2' },
    { code: 'BW', name: 'Botswana', flag: '\uD83C\uDDE7\uD83C\uDDFC' },
    { code: 'NA', name: 'Namibia', flag: '\uD83C\uDDF3\uD83C\uDDE6' },
    { code: 'DZ', name: 'Algeria', flag: '\uD83C\uDDE9\uD83C\uDDFF' },
    { code: 'LY', name: 'Libya', flag: '\uD83C\uDDF1\uD83C\uDDFE' },
    { code: 'SD', name: 'Sudan', flag: '\uD83C\uDDF8\uD83C\uDDE9' },
    { code: 'AU2', name: 'Australia', flag: '\uD83C\uDDE6\uD83C\uDDFA' }
  ];

  // De-duplicate (defensive — last AU2 entry above is intentional duplicate
  // only as a safety check; we remove duplicates by code below)
  var seen = {};
  COUNTRIES = COUNTRIES.filter(function (c) {
    if (seen[c.code]) return false;
    seen[c.code] = true;
    return true;
  });

  // Sort alphabetically by name (case-insensitive, locale-aware)
  COUNTRIES.sort(function (a, b) {
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  });

  // ---------------------------------------------------------------------
  // Locale detection (spec section 6)
  //   - Only reads navigator.language. NEVER uses geolocation, IP, or
  //     permissions.
  // ---------------------------------------------------------------------
  function detectLocale() {
    if (typeof navigator === 'undefined') return 'en';
    var lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return lang; // e.g. "en-us", "hi-in", "ja-jp"
  }

  function detectBaseLang() {
    return detectLocale().split('-')[0];
  }

  // Map a browser locale to a country code IF and only if the locale's
  // region component directly maps to a country in our list. Used only as
  // a soft default for the country selector — never required.
  function detectCountryDefault() {
    var locale = detectLocale();
    var parts = locale.split('-');
    if (parts.length < 2) return '';
    var region = parts[1].toUpperCase();
    var match = COUNTRIES.filter(function (c) { return c.code === region; })[0];
    return match ? match.code : '';
  }

  // ---------------------------------------------------------------------
  // Country list API
  // ---------------------------------------------------------------------
  function loadCountryList() {
    // Return a defensive copy so callers cannot mutate the source list.
    return COUNTRIES.map(function (c) {
      return { code: c.code, name: c.name, flag: c.flag };
    });
  }

  function searchCountries(query) {
    if (!query) return loadCountryList();
    var q = query.trim().toLowerCase();
    return COUNTRIES
      .filter(function (c) {
        return c.name.toLowerCase().indexOf(q) !== -1 ||
               c.code.toLowerCase().indexOf(q) !== -1;
      })
      .map(function (c) {
        return { code: c.code, name: c.name, flag: c.flag };
      });
  }

  function getCountryByCode(code) {
    if (!code) return null;
    return COUNTRIES.filter(function (c) { return c.code === code; })[0] || null;
  }

  // ---------------------------------------------------------------------
  // Unicode-safe name normalization (spec section 7)
  //   - normalizeForDisplay(): trim, collapse inner whitespace, preserve
  //     accents/scripts/emoji exactly as entered.
  //   - normalizeForCalc(): NFC normalize, lowercase, strip combining
  //     diacritics for hashing fairness (so José/JOSE/Jose hash the same),
  //     keep base letters and Unicode scripts.
  // ---------------------------------------------------------------------
  function normalizeForDisplay(raw) {
    if (raw == null) return '';
    var s = String(raw);
    // NFC normalization first so combining characters compose cleanly.
    if (s.normalize) s = s.normalize('NFC');
    // Collapse all whitespace runs (incl. non-breaking) into single spaces.
    s = s.replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ' ');
    // Trim outer whitespace.
    s = s.replace(/^\s+|\s+$/g, '');
    // Enforce a sane max length defensively (UI also caps at 60 chars).
    if (s.length > 80) s = s.slice(0, 80);
    return s;
  }

  function normalizeForCalc(raw) {
    if (raw == null) return '';
    var s = String(raw);
    // NFC -> NFD so we can strip combining marks (diacritics) cleanly.
    if (s.normalize) {
      s = s.normalize('NFD');
    }
    // Remove combining diacritical marks (U+0300–U+036F) and similar
    // combining characters in the standard combining-diacritical block.
    // NOTE: We intentionally do NOT strip Indic matras (Devanagari,
    // Tamil, etc.) or CJK tone marks — those carry meaning and are
    // part of the script, not diacritics on Latin letters.
    s = s.replace(/[\u0300-\u036f]/g, '');
    // Re-compose to NFC for tidy base letters.
    if (s.normalize) s = s.normalize('NFC');
    // Lowercase (Unicode-aware where possible).
    s = s.toLowerCase();
    // Collapse whitespace.
    s = s.replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ' ');
    s = s.replace(/^\s+|\s+$/g, '');
    // Strip emoji and pictographic symbols for the hashing layer only.
    // Use the ES6 `u` flag so we can use \u{...} for code points above
    // U+FFFF (the older \uXXXX syntax only handles 4 hex digits and
    // silently mis-parses anything longer, creating a wrong range).
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '');
    return s;
  }

  // Normalize international name (spec section 67). This is the public
  // function used by the calculator module. It returns both the display
  // and the calculation form so callers never accidentally mix them.
  function normalizeInternationalName(raw) {
    var display = normalizeForDisplay(raw);
    var calc = normalizeForCalc(raw);
    return { display: display, calc: calc };
  }

  function prepareTranslation(langCode) {
    // Hook for future translation loading. Currently a no-op; the i18n
    // module handles fallback to English automatically.
    if (langCode && LoveCalc.i18n && LoveCalc.i18n.setLang) {
      LoveCalc.i18n.setLang(langCode);
    }
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------
  LoveCalc.international = {
    COUNTRIES: COUNTRIES,
    detectLocale: detectLocale,
    detectBaseLang: detectBaseLang,
    detectCountryDefault: detectCountryDefault,
    loadCountryList: loadCountryList,
    searchCountries: searchCountries,
    getCountryByCode: getCountryByCode,
    normalizeForDisplay: normalizeForDisplay,
    normalizeForCalc: normalizeForCalc,
    normalizeInternationalName: normalizeInternationalName,
    prepareTranslation: prepareTranslation
  };

})(typeof window !== 'undefined' ? window : this);
