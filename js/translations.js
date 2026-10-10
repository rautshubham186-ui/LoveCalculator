/**
 * translations.js
 * ----------------
 * Central i18n dictionary for the Love Calculator.
 *
 * Design goals (per spec section 28 "INTERNATIONAL SEO READINESS"):
 *   - English is the live language today.
 *   - Other language keys exist as a *structure* so future translations
 *     can be added by filling in values, without touching app logic.
 *   - We never machine-translate content at runtime. Missing keys fall
 *     back to English so the page always renders fully.
 *
 * Usage:
 *   LoveCalc.i18n.t('hero.title')           // -> string in current lang
 *   LoveCalc.i18n.setLang('hi')             // switch (falls back to en)
 *   LoveCalc.i18n.getLang()                 // current lang code
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};

  // ---------------------------------------------------------------------
  // English (live)
  // ---------------------------------------------------------------------
  var en = {
    brand: {
      name: 'Love Calculator',
      tool: 'Love Calculator'
    },

    hero: {
      title: 'Love Calculator',
      subtitle: 'Discover your fun Love Match',
      description: 'Enter two names and reveal your love percentage — a moment worth sharing.',
      cta: 'Calculate Love',
      disclaimer: 'Not a scientific measure of real relationships.'
    },

    nav: {
      calculator: 'Love Calculator',
      howItWorks: 'How the Love Calculator Works',
      meaning: 'Score Meaning',
      faq: 'Love Calculator FAQ',
      privacy: 'Privacy'
    },

    calculator: {
      yourName: 'Your Name',
      yourNamePlaceholder: 'Type a name…',
      partnerName: 'Partner\u2019s Name',
      partnerNamePlaceholder: 'Type another name…',
      modeLabel: 'Calculation Mode',
      modeNames: 'Names Only',
      modeThumb: 'Thumbprint Only',
      modeBoth: 'Names + Thumbprint',
      modeNamesHint: 'Use names for a quick match.',
      modeThumbHint: 'Press both thumbprints for a tactile scan.',
      modeBothHint: 'Combine names + thumbprints for the deepest reading.',
      calculate: 'Calculate Love',
      calculating: 'Calculating…',
      tryAgain: 'Calculate Again',
      newNames: 'New Names',
      reset: 'Reset',
      clear: 'Clear',
      chars: 'chars',
      errorBothNames: 'Please enter both names to discover your fun match.',
      errorTooLong: 'Names are limited to 60 characters each. Try a shorter version.',
      errorInvalid: 'Hmm, that input doesn\u2019t look quite right. Try names using letters, spaces, hyphens, or apostrophes.',
      errorNeedThumb: 'Press both thumbprints to scan your love vibe.'
    },

    thumbprint: {
      pad1Label: 'Press your thumb here',
      pad2Label: 'Press your partner\u2019s thumb here',
      pad1Aria: 'Person 1 thumbprint pad — press briefly to scan',
      pad2Aria: 'Person 2 thumbprint pad — press briefly to scan',
      hint: 'You can use names, thumbprints, or both — whichever you like. Press each thumb pad briefly to scan.',
      scanning: 'Scanning…',
      captured: 'Scanned',
      reset: 'Re-scan',
      nameOptional: 'name optional'
    },

    themes: {
      rose: 'Rose Romance',
      midnight: 'Midnight Velvet',
      ocean: 'Ocean Breeze',
      aurora: 'Aurora',
      sunset: 'Sunset Glow',
      label: 'Color theme',
      lightDark: 'Light / Dark',
      light: 'Light',
      dark: 'Dark',
      system: 'System'
    },

    howTo: {
      title: 'How to Play',
      subtitle: 'A 30-second tour. No signup, no app, no login. Just names, smiles, and a little confetti.',
      step1Title: '1 \u2014 Pick a mode',
      step1Body: 'Choose one of the three calculation modes below: Names Only, Thumbprint Only, or Names + Thumbprint. Each mode gives a slightly different reading.',
      step2Title: '2 \u2014 Type the names',
      step2Body: 'Enter Your Name and your Partner\u2019s Name. Any language, any script \u2014 Latin, Devanagari, Arabic, CJK, accents, hyphens, apostrophes \u2014 all welcome. Names are optional in Thumbprint mode.',
      step3Title: '3 \u2014 (Optional) Press thumbprints',
      step3Body: 'In Thumbprint mode, press and hold each circular pad for about 1.5 seconds. A scan line animates while you hold. When both pads show \u201CCaptured\u201D, you\u2019re ready. Use Re-scan if you want to try again.',
      step4Title: '4 \u2014 Press Calculate Love',
      step4Body: 'The big pink button at the bottom of the form. After a short loading shimmer, your percentage, a personalized paragraph, the compatibility breakdown, and the Past / Present / Future timeline appear.',
      step5Title: '5 \u2014 Explore the timeline',
      step5Body: 'Scroll down a little to see three cards: Past (how it began), Present (where it is now), and Future (what could bloom). Each has its own score and paragraph.',
      step6Title: '6 \u2014 Share, copy, or reset',
      step6Body: 'Use the action buttons under your result to share via your device, copy a text summary, open WhatsApp, generate a share card image, or start over with new names.',
      legendTitle: 'Button legend',
      legendNames: 'Names Only mode \u2014 use names only',
      legendThumb: 'Thumbprint Only mode \u2014 use thumbprints only',
      legendBoth: 'Names + Thumbprint mode \u2014 combine both for the deepest reading',
      legendCalc: 'Calculate Love \u2014 runs the algorithm and reveals your result',
      legendShare: 'Share Result \u2014 opens your device\u2019s share sheet',
      legendCopy: 'Copy Result \u2014 copies a text summary to your clipboard',
      legendWhatsApp: 'WhatsApp \u2014 opens WhatsApp with a pre-filled message',
      legendCard: 'Create Share Card \u2014 downloads a PNG image of your result',
      legendReset: 'Reset \u2014 clears everything and starts fresh',
      navTitle: 'Navigation',
      navBody: 'Scroll down to read the result, the compatibility breakdown, the Past / Present / Future timeline, and the FAQ. Scroll up to enter new names or change modes. Use the top nav links (Calculator, How It Works, FAQ, Privacy) to jump to any section. Click the colored dots in the top-right corner to switch color themes; click the Light / Dark / System button to toggle brightness.',
      scrollDown: 'Scroll down',
      scrollUp: 'Scroll up',
      exampleTitle: 'See an example',
      exampleSubtitle: 'This is what a real calculation looks like. Press Calculate to make your own.',
      exampleButton: 'Try with my own names'
    },

    example: {
      name1: 'Romeo',
      name2: 'Juliet',
      label: 'Example result'
    },

    timeline: {
      title: 'Your Love Timeline',
      subtitle: 'Three chapters of the same names \u2014 how it began, where it is, and what could bloom.',
      past: 'Past',
      present: 'Present',
      future: 'Future',
      pastHint: 'How the connection likely began.',
      presentHint: 'Where the vibe is right now.',
      futureHint: 'What could blossom with care.',
      scoreLabel: 'Love Match'
    },

    empty: {
      title: 'Your result is waiting \u2764\uFE0F',
      hint: 'Enter two names, scan your thumbprints, or both \u2014 then press Calculate Love.'
    },

    loading: {
      title: 'Reading the stars of your names…',
      hint: 'Just a moment.'
    },

    result: {
      label: 'Love Match',
      youAndPartner: '{a} \u2764\uFE0F {b}',
      copyResult: 'Copy Result',
      shareResult: 'Share Result \u2764\uFE0F',
      copied: 'Result copied!',
      shared: 'Sharing opened',
      shareFailed: 'Sharing isn\u2019t available here — try Copy Result instead.',
      cardSaved: 'Share card downloaded',
      createCard: 'Create Share Card',
      challenge: 'Want to challenge your friend? \u2764\uFE0F'
    },

    breakdown: {
      title: 'Fun Compatibility Breakdown',
      subtitle: 'Vibes generated from your names.',
      loveVibe: 'Love Vibe',
      friendshipVibe: 'Friendship Vibe',
      chemistryVibe: 'Chemistry Vibe',
      communicationVibe: 'Communication Vibe',
      funFactor: 'Fun Factor',
      adventureVibe: 'Adventure Vibe',
      caringVibe: 'Caring Vibe'
    },

    howItWorks: {
      title: 'How the Love Calculator Works',
      lead: 'The Love Calculator is a small piece of joy. It takes two names, processes them through an original algorithm, and gives back a percentage.',
      step1Title: '1. Names are normalized',
      step1Body: 'Your names are gently cleaned up — accents, cases, and spaces are handled with full Unicode support so names from every writing system are treated respectfully. The original spelling is always preserved for display.',
      step2Title: '2. Multiple dimensions are measured',
      step2Body: 'The algorithm looks at several harmless signals in the names: shared characters, length harmony, position-based patterns, rhythm, and a deterministic hash. None of these are about you as a person — they are simply patterns in the text.',
      step3Title: '3. A score is composed',
      step3Body: 'Those dimensions are blended through an original formula to produce a number between 0 and 100. The same two names will always produce the same core score, so you can share and compare.',
      step4Title: '4. A message and celebration appear',
      step4Body: 'Based on the score range, a friendly message is chosen from a library of original lines, and a celebration animation tuned to the score plays out — from a gentle sparkle to a confetti burst.'
    },

    meaning: {
      title: 'What the Love Percentage Means',
      lead: 'Every score range has its own personality. Here\u2019s how to read your result — remember, this is not a scientific prediction.',
      ranges: [
        { range: '0\u201310', title: 'A Shy Spark', body: 'The calculator is feeling a little shy today. A quiet, curious start — friendship and laughter can do the rest.' },
        { range: '11\u201320', title: 'Gentle Acquaintance', body: 'A soft, easygoing vibe. There\u2019s room to grow through small, kind moments.' },
        { range: '21\u201330', title: 'Friendly Hello', body: 'A friendly connection in the air. Light conversations and shared smiles suit this pair.' },
        { range: '31\u201340', title: 'Warm Curiosity', body: 'Something warm is forming. Light teasing and shared interests feel natural here.' },
        { range: '41\u201350', title: 'Balanced Vibe', body: 'A balanced, even-keeled match. Equal parts friendship and flirtation, ready to be explored.' },
        { range: '51\u201360', title: 'Sweet Chemistry', body: 'A noticeably sweet chemistry. Comfort and curiosity mix in a pleasant way.' },
        { range: '61\u201370', title: 'Bright Spark', body: 'A genuine spark. Banter, inside jokes, and shared adventures feel right at home.' },
        { range: '71\u201380', title: 'Charming Connection', body: 'A charming connection. Warmth, humor, and a touch of magic are easy to find here.' },
        { range: '81\u201390', title: 'Romantic Energy', body: 'Strong romantic energy in the air. Hearts, flowers, and a generous helping of fun.' },
        { range: '91\u201395', title: 'Magical Moment', body: 'A magical moment of names. Big smiles, lots of laughter, and a beautiful buzz.' },
        { range: '96\u2013100', title: 'Celebration Mode', body: 'The calculator is throwing confetti. A grand, joyful, heart-bursting result — perfect for sharing.' }
      ]
    },

    faq: {
      title: 'Frequently Asked Questions',
      items: [
        {
          q: 'What is a Love Calculator?',
          a: 'A Love Calculator is a tool that uses two names — or other inputs — to generate a compatibility percentage. There is no scientific evidence that names can determine romantic compatibility.'
        },
        {
          q: 'How does the Love Calculator work?',
          a: 'It normalizes the names you enter, measures several harmless patterns in the text (such as shared characters and length harmony), and blends those signals through an original formula. The result is a number between 0 and 100.'
        },
        {
          q: 'Is the Love Calculator accurate?',
          a: 'No — and it isn\u2019t trying to be. The percentage is generated by a name-based algorithm. It is not a measurement of love, compatibility, personality, or relationship success.'
        },
        {
          q: 'Is the Love Calculator scientific?',
          a: 'No. The algorithm is original. It does not use psychology, biology, or any scientific method to predict relationships.'
        },
        {
          q: 'How is the love percentage calculated?',
          a: 'Several text-based signals are extracted from the normalized names — shared characters, position patterns, rhythm, length harmony, and a deterministic hash. These are combined into a single percentage. The same names always produce the same core score.'
        },
        {
          q: 'Can I use names from different countries?',
          a: 'Yes. The calculator fully supports Unicode, so names from any writing system — Latin, Devanagari, Arabic, CJK, Cyrillic, and more — are handled respectfully. Country selection is optional and only affects presentation hints, never the fairness of the result.'
        },
        {
          q: 'Can I use names in different languages?',
          a: 'Absolutely. Accents, diacritics, combining characters, apostrophes, hyphens, and non-Latin scripts are all supported. Your names are displayed exactly as you type them.'
        },
        {
          q: 'Can I calculate love compatibility with two names?',
          a: 'That is exactly what this tool does. Enter two names, press Calculate Love, and discover your percentage.'
        },
        {
          q: 'Does the calculator store my name?',
          a: 'No. All calculation happens in your browser. Names are not sent to any server, not stored permanently, and not tied to any account. The only thing saved on your device is your theme preference.'
        },
        {
          q: 'Can I share my result?',
          a: 'Yes. After calculating, you can share via your device\u2019s share sheet (where supported), copy the result as text, or generate a share card image. Nothing is shared automatically.'
        },
        {
          q: 'Can I use this for friends?',
          a: 'Of course! The Love Calculator works for any two names — friends, crushes, celebrity pairings, fictional characters. It\u2019s all in good fun.'
        },
        {
          q: 'Why did my result change?',
          a: 'The core score is deterministic — the same two names always give the same percentage. Only secondary elements like the exact message or decorative animation may vary slightly to keep repeat calculations interesting.'
        },
        {
          q: 'Is this Love Calculator free?',
          a: 'Yes. The calculator is free to use. No login, no email, no payment required.'
        }
      ]
    },

    disclaimer: {
      title: 'Disclaimer',
      body: 'This Love Calculator generates its percentage using a name- and thumbprint-based algorithm. The percentage is not a scientific measurement of love, compatibility, personality, or relationship success. Real relationships are built by people — through care, communication, and shared effort — not by percentages.'
    },

    privacy: {
      title: 'Privacy-Friendly by Design',
      body: 'Your names never leave your device. All calculations happen locally in your browser. We do not request location, contacts, camera, microphone, or notifications. We do not use login, email, or any personal account. The only thing stored on your device is your theme preference. If advertising or analytics are added in the future, they will be added with an appropriate consent mechanism and never as a condition of using the calculator.'
    },

    educational: {
      title: 'About Love Calculators',
      lead: 'A short, honest look at what love calculators are — and what they deliberately are not.',
      h2What: 'What is a love calculator, really?',
      pWhat: 'A love calculator is a small tool. You give it two names, it gives you back a percentage, and you smile, share, and try another pair. The format has been popular on the web for more than two decades because it is fast, social, and easy to enjoy.',
      h2Why: 'Why do people enjoy them?',
      pWhy: 'Curiosity is a powerful thing. Pairing two names and getting an instant verdict creates a tiny moment of shared joy — especially with friends, partners, or celebrity crushes. It is the same impulse that powers personality quizzes, fortune cookies, and personality memes.',
      h2Limit: 'What a love calculator cannot do',
      pLimit: 'It cannot predict whether a relationship will succeed. It cannot measure trust, attraction, loyalty, or compatibility. It cannot tell you whether to start, continue, or end a relationship. Names simply do not contain that information — and any tool claiming otherwise is not being honest with you.',
      h2Real: 'What actually makes a relationship work',
      pReal: 'Decades of relationship research point to the same themes: communication, mutual respect, shared values, emotional support, and the willingness to grow together. Those things live in actions, not in algorithms. Use this calculator for a smile — then go put real care into the people who matter to you.'
    },

    footer: {
      about: 'About',
      privacy: 'Privacy',
      terms: 'Terms',
      contact: 'Contact',
      disclaimer: 'Disclaimer',
      tagline: 'Made with care for a connected world.',
      rights: 'All rights reserved.'
    },

    toast: {
      themeSaved: 'Theme preference saved',
      resetDone: 'Calculator reset'
    },

    adLabel: 'Advertisement'
  };

  // ---------------------------------------------------------------------
  // Future-language placeholders (structure only — falls back to en).
  // Add full dictionaries over time by replacing the empty objects.
  // ---------------------------------------------------------------------
  var placeholders = {
    hi: {}, // Hindi
    mr: {}, // Marathi
    es: {}, // Spanish
    fr: {}, // French
    de: {}, // German
    pt: {}, // Portuguese
    ar: {}, // Arabic
    ja: {}, // Japanese
    ko: {}, // Korean
    zh: {}, // Chinese
    ru: {}, // Russian
    it: {}, // Italian
    nl: {}, // Dutch
    tr: {}, // Turkish
    id: {}, // Indonesian
    vi: {}, // Vietnamese
    th: {}  // Thai
  };

  // ---------------------------------------------------------------------
  // i18n module
  // ---------------------------------------------------------------------
  var currentLang = 'en';

  function deepGet(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function t(path, vars) {
    var val = deepGet(placeholders[currentLang], path);
    if (val === undefined) val = deepGet(en, path);
    if (val === undefined) return path;
    if (typeof val === 'string' && vars) {
      return val.replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] != null ? String(vars[k]) : '';
      });
    }
    return val;
  }

  function setLang(code) {
    if (code === 'en' || placeholders[code]) {
      currentLang = code;
    } else {
      currentLang = 'en';
    }
  }

  function getLang() { return currentLang; }

  function detectLang() {
    if (typeof navigator === 'undefined') return 'en';
    var lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var base = lang.split('-')[0];
    return placeholders[base] ? base : 'en';
  }

  LoveCalc.i18n = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    detectLang: detectLang,
    dictionary: { en: en, placeholders: placeholders }
  };

  // Expose en for SEO module's JSON-LD generation
  LoveCalc.i18n.en = en;

})(typeof window !== 'undefined' ? window : this);
