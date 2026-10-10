/**
 * calculator.js
 * -------------
 * Original love-score algorithm (spec sections 7, 8, 9,
 * 13, 14, 15, 42, 43, 49, 50, 51, 52, 86, 87).
 *
 * Design principles:
 *   - Score is always 0..100, integer.
 *   - Deterministic: same (name1, name2) -> same core score, always.
 *   - Case-insensitive and Unicode-safe (handled by international.js).
 *   - Multi-dimensional: combines 7 internal signals so the result
 *     never looks like a single trivial hash.
 *   - Secondary scores (Love Vibe, Friendship Vibe, etc.) derive from
 *     the same hash with deterministic offsets — never random.
 *   - Messages are drawn from a large original library, picked by a
 *     deterministic seed so repeat runs feel fresh without changing
 *     the core score (spec section 52 "FUN VARIATION").
 *   - All output language is light, positive, non-harmful. Even a 0%
 *     score stays light and friendly (spec section 86, 87).
 */

(function (global) {
  'use strict';

  var LoveCalc = global.LoveCalc = global.LoveCalc || {};
  var intl = LoveCalc.international;

  // ---------------------------------------------------------------------
  // Validation (spec section 4, 41, 43)
  //   - Allows letters from any script, spaces, hyphens, apostrophes,
  //     combining marks, and (tolerated) emoji.
  //   - Rejects only: empty / whitespace-only, excessively long, or
  //     control-char-only strings.
  //   - NEVER rejects legitimate international names.
  // ---------------------------------------------------------------------
  var MAX_NAME_LEN = 60;

  function validateName(raw) {
    var disp = intl.normalizeForDisplay(raw);
    if (!disp) {
      return { ok: false, reason: 'empty' };
    }
    if (disp.length > MAX_NAME_LEN) {
      return { ok: false, reason: 'tooLong' };
    }
    // Strip allowed punctuation to check whether ANY letters exist.
    // We use Unicode property syntax where supported; fallback: accept
    // anything non-whitespace.
    var hasLetter = false;
    try {
      hasLetter = /\p{L}/u.test(disp);
    } catch (e) {
      hasLetter = /[^\s\p{P}\p{S}]/u.test(disp);
    }
    if (!hasLetter) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, value: disp };
  }

  // ---------------------------------------------------------------------
  // Hashing (FNV-1a, 32-bit) — deterministic, fast, dependency-free.
  // Used both for the main score and as a seed for secondary variation.
  // ---------------------------------------------------------------------
  function fnv1a(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    // Convert to unsigned 32-bit
    return hash >>> 0;
  }

  function hashName(s) {
    return fnv1a(s);
  }

  // A second, independent hash (used to decorrelate secondary metrics).
  function hashNameAlt(s) {
    var hash = 0x84222325;
    for (var i = 0; i < s.length; i++) {
      hash = Math.imul(hash ^ strCharCode(s, i), 0x9E3779B1) >>> 0;
      hash = ((hash << 13) | (hash >>> 19)) >>> 0;
    }
    return hash >>> 0;
  }
  function strCharCode(s, i) { return s.charCodeAt(i); }

  // A small, fast PRNG seeded from a 32-bit integer (mulberry32).
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------
  // Helpers for the dimensional analysis
  // ---------------------------------------------------------------------
  var VOWELS = {};
  ('aeiouy\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5\u00E8\u00E9\u00EA\u00EB' +
   '\u00EC\u00ED\u00EE\u00EF\u00F2\u00F3\u00F4\u00F5\u00F6\u00F9\u00FA' +
   '\u00FB\u00FC\u0101\u0103\u0105\u0113\u0115\u0117\u0119\u012B\u012D' +
   '\u012F\u014D\u014F\u0151\u016B\u016D\u016F\u0171\u0173').split('').forEach(function (v) {
    VOWELS[v] = true;
  });

  function isVowel(ch) { return !!VOWELS[ch]; }
  function isLetter(ch) {
    try { return /\p{L}/u.test(ch); } catch (e) { return /[a-z]/i.test(ch); }
  }

  function charBag(s) {
    var bag = {};
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (isLetter(ch)) {
        bag[ch] = (bag[ch] || 0) + 1;
      }
    }
    return bag;
  }

  function bagIntersection(a, b) {
    var sum = 0;
    for (var k in a) {
      if (a.hasOwnProperty(k) && b[k]) {
        sum += Math.min(a[k], b[k]);
      }
    }
    return sum;
  }

  function bagUnionSize(a, b) {
    var keys = {};
    for (var k in a) if (a.hasOwnProperty(k)) keys[k] = true;
    for (var j in b) if (b.hasOwnProperty(j)) keys[j] = true;
    return Object.keys(keys).length;
  }

  // ---------------------------------------------------------------------
  // Dimensional signals (each returns 0..1)
  // ---------------------------------------------------------------------

  // 1. Deterministic hash component
  function dimensionHash(h1, h2) {
    var x = (h1 ^ h2) >>> 0;
    // Mix with another prime to spread bits.
    x = (Math.imul(x, 0x85EBCA6B) ^ (x >>> 13)) >>> 0;
    return (x % 10000) / 10000;
  }

  // 2. Shared-character relationship (Jaccard-like)
  function dimensionShared(s1, s2) {
    var a = charBag(s1), b = charBag(s2);
    var inter = bagIntersection(a, b);
    var union = bagUnionSize(a, b);
    if (union === 0) return 0.5;
    return inter / union;
  }

  // 3. Name-length interaction — penalize extreme mismatch, reward
  //    similar lengths. Also reward not being trivially short.
  function dimensionLength(s1, s2) {
    var l1 = s1.length, l2 = s2.length;
    if (l1 === 0 && l2 === 0) return 0.5;
    var min = Math.min(l1, l2);
    var max = Math.max(l1, l2);
    if (max === 0) return 0.5;
    var ratio = min / max; // 0..1, 1 = same length
    // Length floor: extremely short names feel flatter.
    var lengthFloor = Math.min(1, (min / 5));
    return 0.5 * ratio + 0.5 * lengthFloor;
  }

  // 4. Position-based interaction — same letters at same positions
  function dimensionPosition(s1, s2) {
    var n = Math.min(s1.length, s2.length);
    if (n === 0) return 0.5;
    var matches = 0;
    for (var i = 0; i < n; i++) {
      if (s1.charAt(i) === s2.charAt(i)) matches++;
    }
    return (matches / n) * 0.7 + 0.15;
  }

  // 5. Character rhythm — vowel/consonant alternation similarity
  function rhythmSignature(s) {
    var sig = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (!isLetter(ch)) continue;
      sig += isVowel(ch) ? 'V' : 'C';
    }
    return sig;
  }

  function dimensionRhythm(s1, s2) {
    var r1 = rhythmSignature(s1);
    var r2 = rhythmSignature(s2);
    if (!r1 || !r2) return 0.5;
    var n = Math.min(r1.length, r2.length);
    if (n === 0) return 0.5;
    var same = 0;
    for (var i = 0; i < n; i++) {
      if (r1.charAt(i) === r2.charAt(i)) same++;
    }
    return same / n;
  }

  // 6. Letter-pattern harmony — distribution similarity (cosine-like)
  function dimensionPatternHarmony(s1, s2) {
    var a = charBag(s1), b = charBag(s2);
    var keys = {};
    for (var k in a) if (a.hasOwnProperty(k)) keys[k] = true;
    for (var j in b) if (b.hasOwnProperty(j)) keys[j] = true;
    var list = Object.keys(keys);
    if (list.length === 0) return 0.5;
    var dot = 0, magA = 0, magB = 0;
    for (var i = 0; i < list.length; i++) {
      var x = a[list[i]] || 0;
      var y = b[list[i]] || 0;
      dot += x * y;
      magA += x * x;
      magB += y * y;
    }
    if (magA === 0 || magB === 0) return 0.5;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  // 7. Name harmony — combined letters-to-length ratio & distinctness
  function dimensionNameHarmony(s1, s2) {
    var a = charBag(s1), b = charBag(s2);
    var distinct1 = Object.keys(a).length;
    var distinct2 = Object.keys(b).length;
    var total1 = s1.replace(/[^a-z]/gi, '').length;
    var total2 = s2.replace(/[^a-z]/gi, '').length;
    if (total1 === 0 || total2 === 0) return 0.5;
    var ratio1 = distinct1 / total1;
    var ratio2 = distinct2 / total2;
    var closeness = 1 - Math.abs(ratio1 - ratio2);
    return 0.5 * closeness + 0.5 * (Math.min(distinct1, distinct2) >= 3 ? 1 : 0.5);
  }

  // ---------------------------------------------------------------------
  // Master score
  // ---------------------------------------------------------------------
  function calculateLoveScore(rawName1, rawName2) {
    var n1 = intl.normalizeInternationalName(rawName1);
    var n2 = intl.normalizeInternationalName(rawName2);
    var s1 = n1.calc, s2 = n2.calc;

    // Handle same-name magic (spec section 42) — still deterministic,
    // still in 0..100, just slightly elevated because identical names
    // are a fun special case.
    var sameName = (s1 === s2) && s1.length > 0;

    var h1 = hashName(s1);
    var h2 = hashName(s2);
    var alt1 = hashNameAlt(s1);
    var alt2 = hashNameAlt(s2);

    var dims = {
      hash:            dimensionHash(h1, h2),
      shared:          dimensionShared(s1, s2),
      length:          dimensionLength(s1, s2),
      position:        dimensionPosition(s1, s2),
      rhythm:          dimensionRhythm(s1, s2),
      patternHarmony:  dimensionPatternHarmony(s1, s2),
      nameHarmony:     dimensionNameHarmony(s1, s2)
    };

    var weights = {
      hash:            0.22,
      shared:          0.16,
      length:          0.12,
      position:        0.12,
      rhythm:          0.12,
      patternHarmony:  0.14,
      nameHarmony:     0.12
    };

    var raw = 0;
    for (var k in weights) {
      if (weights.hasOwnProperty(k)) {
        raw += weights[k] * dims[k];
      }
    }

    // Deterministic small hash-based shimmer to spread values so the
    // distribution looks more interesting (still 0..1).
    var shimmer = ((Math.imul(h1 ^ h2, 0x9E3779B1) >>> 0) % 1000) / 1000;
    raw = raw * 0.85 + shimmer * 0.15;

    if (sameName) {
      // Gentle, transparent boost (spec section 42 — must not be the
      // sole reason for an unusually high score, so we cap the boost).
      raw = Math.min(1, raw * 1.05 + 0.03);
    }

    // Map to a slightly more dramatic curve so users see a satisfying
    // spread across the full 0..100 range (no compression near the
    // middle). The curve is monotonic so deterministic ordering holds.
    var curved = 0.5 + 0.5 * Math.sin((raw - 0.5) * Math.PI);
    // curved ∈ (0,1); push slightly toward the middle so very-low and
    // very-high scores remain genuinely rare.
    curved = 0.55 * curved + 0.45 * raw;

    var score = Math.round(curved * 100);
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return {
      score: score,
      display1: n1.display,
      display2: n2.display,
      calc1: s1,
      calc2: s2,
      sameName: sameName,
      dims: dims,
      seed: ((h1 ^ h2) >>> 0),
      altSeed: ((alt1 ^ alt2) >>> 0)
    };
  }

  // ---------------------------------------------------------------------
  // Secondary scores (spec section 15)
  //   Each is a deterministic function of the main seed + a per-metric
  //   salt, projected around the main score so they feel related but
  //   not identical.
  // ---------------------------------------------------------------------
  var SECONDARY_KEYS = [
    'loveVibe',
    'friendshipVibe',
    'chemistryVibe',
    'communicationVibe',
    'funFactor',
    'adventureVibe',
    'caringVibe'
  ];

  var SECONDARY_SALTS = {
    loveVibe:           0x9E3779B1,
    friendshipVibe:     0x85EBCA6B,
    chemistryVibe:      0xC2B2AE35,
    communicationVibe:  0x27D4EB2F,
    funFactor:          0x165667B1,
    adventureVibe:      0x6D2B79F5,
    caringVibe:         0xB5297A4D
  };

  function calculateSecondaryScores(core) {
    var base = core.score;
    var seed = core.seed;
    var alt = core.altSeed;
    var out = {};

    SECONDARY_KEYS.forEach(function (key, i) {
      var salt = SECONDARY_SALTS[key];
      var mixed = (Math.imul(seed ^ salt ^ (i * 0x9E3779B1), 0x85EBCA6B) ^ alt) >>> 0;
      var rng = mulberry32(mixed);
      // Project the secondary score around the main score, with a
      // controlled spread so each metric tells its own story.
      var spread = 18; // +- 18 from the core
      var offset = Math.round((rng() - 0.5) * 2 * spread);
      var val = base + offset;
      // Different metrics lean in different directions for personality.
      if (key === 'friendshipVibe') val += 4;  // friendship is forgiving
      if (key === 'funFactor')      val += 3;
      if (key === 'caringVibe')     val += 2;
      if (key === 'chemistryVibe')  val -= 1;
      if (key === 'adventureVibe')  val -= 2;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      out[key] = val;
    });

    return out;
  }

  // ---------------------------------------------------------------------
  // Score categories (spec section 50) — 11 ranges
  // ---------------------------------------------------------------------
  function getScoreCategory(score) {
    if (score <= 10) return { id: 'r0_10',  index: 0  };
    if (score <= 20) return { id: 'r11_20', index: 1  };
    if (score <= 30) return { id: 'r21_30', index: 2  };
    if (score <= 40) return { id: 'r31_40', index: 3  };
    if (score <= 50) return { id: 'r41_50', index: 4  };
    if (score <= 60) return { id: 'r51_60', index: 5  };
    if (score <= 70) return { id: 'r61_70', index: 6  };
    if (score <= 80) return { id: 'r71_80', index: 7  };
    if (score <= 90) return { id: 'r81_90', index: 8  };
    if (score <= 95) return { id: 'r91_95', index: 9  };
    return { id: 'r96_100', index: 10 };
  }

  // ---------------------------------------------------------------------
  // Animation intensity (spec section 11)
  // ---------------------------------------------------------------------
  function getAnimationIntensity(score) {
    if (score <= 19) return { level: 1, name: 'gentle' };
    if (score <= 39) return { level: 2, name: 'soft' };
    if (score <= 59) return { level: 3, name: 'moderate' };
    if (score <= 79) return { level: 4, name: 'strong' };
    if (score <= 94) return { level: 5, name: 'rich' };
    return { level: 6, name: 'grand' };
  }

  // ---------------------------------------------------------------------
  // Result-color logic (spec section 48) — used by both UI and share card
  // ---------------------------------------------------------------------
  function getResultPalette(score) {
    if (score <= 19)  return { primary: '#7A8FA6', accent: '#A9BCD3', glow: 'rgba(122,143,166,0.35)', name: 'calm'   };
    if (score <= 39)  return { primary: '#E5A0B0', accent: '#F4C2CF', glow: 'rgba(229,160,176,0.40)', name: 'soft'   };
    if (score <= 59)  return { primary: '#E8849B', accent: '#F8B7C8', glow: 'rgba(232,132,155,0.45)', name: 'warm'   };
    if (score <= 79)  return { primary: '#E5637C', accent: '#FF8FAB', glow: 'rgba(229,99,124,0.55)',  name: 'bright'};
    if (score <= 94)  return { primary: '#D6336C', accent: '#FF6B9D', glow: 'rgba(214,51,108,0.60)',  name: 'rich'   };
    return                { primary: '#C2185B', accent: '#FF4D8D', glow: 'rgba(255,77,141,0.70)',    name: 'grand'  };
  }

  // ---------------------------------------------------------------------
  // Message library (spec section 13, 14, 49)
  //   Each range has multiple 4-5 line original messages. A deterministic
  //   seed picks one for repeatability-with-variety (spec section 52).
  //   Tone: light, positive, non-harmful. Low scores stay light and friendly.
  // ---------------------------------------------------------------------
  var MESSAGE_LIBRARY = {
    r0_10: [
      {
        title: 'A Shy Spark',
        lines: [
          'The calculator is feeling a little shy today \u2764\uFE0F',
          'There\u2019s a quiet, curious beginning hiding in these names.',
          'Friendship and laughter can do the heavy lifting from here.',
          'Keep things light, kind, and full of small good moments.',
          'Real magic is built by people \u2014 not by percentages.'
        ]
      },
      {
        title: 'A Whispered Hello',
        lines: [
          'A tiny, timid spark \u2014 and that\u2019s perfectly okay!',
          'Some of the best stories start with very quiet openings.',
          'A shared joke could change everything between these names.',
          'Curiosity, kindness, and time are doing their slow work.',
          'Numbers are silly; people are the real magic.'
        ]
      }
    ],
    r11_20: [
      {
        title: 'Gentle Acquaintance',
        lines: [
          'A soft, easygoing vibe is shimmering between these names.',
          'There\u2019s space here for warmth to grow at its own pace.',
          'Small, kind gestures will mean more than grand ones today.',
          'Friendship may be the doorway to something sweeter later.',
          'Remember: real bonds are built, never just predicted.'
        ]
      },
      {
        title: 'A Quiet Beginning',
        lines: [
          'A gentle start \u2014 a few sparkles, a lot of potential.',
          'These names hum at a calm, friendly frequency together.',
          'A shared interest could be the bridge worth crossing.',
          'Be patient, be curious, and keep the conversation flowing.',
          'The best love stories are written by people, not formulas.'
        ]
      }
    ],
    r21_30: [
      {
        title: 'Friendly Hello',
        lines: [
          'A friendly connection is glowing between these names.',
          'Conversations feel easy; laughter feels close at hand.',
          'A small adventure together could spark something new.',
          'Keep things light \u2014 lightness is your superpower today.',
          'Real warmth is grown, never just calculated.'
        ]
      },
      {
        title: 'Soft Sunshine',
        lines: [
          'A pleasant, sunny little match is forming here.',
          'These names share a gentle rhythm worth exploring.',
          'Curiosity and humor will take you further than effort.',
          'Let the small moments add up; they always do.',
          'People \u2014 not percentages \u2014 make the real magic.'
        ]
      }
    ],
    r31_40: [
      {
        title: 'Warm Curiosity',
        lines: [
          'Something warm is gently forming between these names.',
          'Light teasing and shared interests feel natural here.',
          'A smile, a story, an inside joke \u2014 they add up quickly.',
          'Keep the door open for unexpected little adventures.',
          'The calculator is smiling; people make it real.'
        ]
      },
      {
        title: 'A Friendly Glow',
        lines: [
          'A friendly, promising glow is wrapping these names.',
          'There\u2019s room for banter, kindness, and small surprises.',
          'Notice the good moments \u2014 they\u2019re worth collecting.',
          'A shared laugh may be the start of something lovely.',
          'Real connection lives in care, not in numbers.'
        ]
      }
    ],
    r41_50: [
      {
        title: 'Balanced Vibe',
        lines: [
          'A balanced, even-keeled match is humming along here.',
          'Friendship and flirtation share the stage nicely today.',
          'Honesty and humor will keep the energy flowing.',
          'Little adventures together are warmly recommended.',
          'Real relationships are built, never just measured.'
        ]
      },
      {
        title: 'Easy Harmony',
        lines: [
          'These names sit together in a comfortable, easy harmony.',
          'Conversation likely flows; silences feel kind, not awkward.',
          'A gentle spark is present \u2014 worth tending with care.',
          'Shared curiosity will open new doors for both of you.',
          'Percentages are play; people are the truth.'
        ]
      }
    ],
    r51_60: [
      {
        title: 'Sweet Chemistry',
        lines: [
          'A noticeably sweet chemistry is dancing between these names.',
          'Comfort and curiosity mix in a really pleasant way here.',
          'Inside jokes are practically writing themselves today.',
          'Kindness and warmth will take this far.',
          'Real love is built daily \u2014 never just calculated.'
        ]
      },
      {
        title: 'A Warm Pull',
        lines: [
          'There\u2019s a warm, friendly pull between these two names.',
          'Moods seem to lift when these names are side by side.',
          'A small surprise or shared adventure could land beautifully.',
          'Be honest, be warm, and let the good moments breathe.',
          'The score is fun; the relationship is the real thing.'
        ]
      }
    ],
    r61_70: [
      {
        title: 'Bright Spark',
        lines: [
          'A genuine spark is lighting up this combination.',
          'Banter, inside jokes, and easy smiles feel right at home.',
          'Adventures \u2014 big or small \u2014 are warmly encouraged today.',
          'Warmth and humor are doing beautiful work between you.',
          'Remember: people build love. Calculators only smile.'
        ]
      },
      {
        title: 'Lively Connection',
        lines: [
          'These names bring out a lively, friendly energy together.',
          'Conversations probably feel easy, fun, and a little electric.',
          'Laughter seems to follow this pair wherever it goes.',
          'Keep being kind, keep being curious, keep showing up.',
          'Real magic is made of moments, not measurements.'
        ]
      }
    ],
    r71_80: [
      {
        title: 'Charming Connection',
        lines: [
          'A charming connection is blooming between these names.',
          'Warmth, humor, and a touch of magic are easy to find here.',
          'Hearts are quietly doing a happy little dance today.',
          'Cherish the small things \u2014 they\u2019re the big things, really.',
          'The calculator celebrates; people make it true.'
        ]
      },
      {
        title: 'Heartfelt Vibe',
        lines: [
          'A heartfelt, lovely vibe is wrapping this pairing warmly.',
          'There\u2019s a comfortable glow that feels very natural here.',
          'Laughter and tenderness are sharing the same stage.',
          'Show up, be kind, and the rest will keep unfolding.',
          'Numbers hint; love is real.'
        ]
      }
    ],
    r81_90: [
      {
        title: 'Romantic Energy',
        lines: [
          'Strong romantic energy is shimmering all around these names!',
          'Hearts, flowers, and a generous helping of fun are in season.',
          'A beautiful buzz is in the air \u2014 enjoy every little bit.',
          'Be honest, be warm, be present; the rest will follow.',
          'The score is high; the relationship is the real prize.'
        ]
      },
      {
        title: 'Glowing Match',
        lines: [
          'A glowing, romantic match is doing its happy dance here.',
          'Warmth and laughter seem to come easily to this pair.',
          'Adventures are calling \u2014 and you should probably answer.',
          'Celebrate each other; small kindnesses matter most.',
          'Real love is grown \u2014 never just generated.'
        ]
      }
    ],
    r91_95: [
      {
        title: 'Magical Moment',
        lines: [
          'A magical moment of names is unfolding right here!',
          'Big smiles, lots of laughter, and a beautiful buzz are present.',
          'The calculator is genuinely delighted by this combination.',
          'Cherish it, share it, and keep building the real thing daily.',
          'People \u2014 not percentages \u2014 write the true love stories.'
        ]
      },
      {
        title: 'Sparkling Match',
        lines: [
          'A sparkling, almost-cinematic match is glowing brightly!',
          'Hearts are floating; flowers are blooming; joy is in the air.',
          'This is the kind of pairing that fills a room with warmth.',
          'Be kind, be honest, be warm \u2014 and enjoy every moment.',
          'Real love is what you build with it; the score is just confetti.'
        ]
      }
    ],
    r96_100: [
      {
        title: 'Celebration Mode',
        lines: [
          'The calculator is throwing confetti \u2014 full celebration mode!',
          'A grand, joyful, heart-bursting result is shining right here.',
          'Perfect for sharing, screenshotting, and smiling about.',
          'Remember: this is play. Real love is what you do next.',
          'People are the magic; percentages are just the party.'
        ]
      },
      {
        title: 'Grand Fireworks',
        lines: [
          'Grand fireworks of names are lighting up the screen!',
          'The calculator is genuinely cheering for this combination.',
          'A wonderful, share-worthy, smile-spreading moment is here.',
          'Take the joy, pass it on, and keep being kind to each other.',
          'The real celebration is the love you build every day.'
        ]
      }
    ]
  };

  function pickMessage(categoryId, seed) {
    var lib = MESSAGE_LIBRARY[categoryId] || MESSAGE_LIBRARY.r41_50;
    var rng = mulberry32(seed ^ 0x5BD1E995);
    var idx = Math.floor(rng() * lib.length) % lib.length;
    return lib[idx];
  }

  // ---------------------------------------------------------------------
  // Same-name special handling (spec section 42)
  // ---------------------------------------------------------------------
  var SAME_NAME_MESSAGES = [
    {
      title: 'Same-Name Magic!',
      lines: [
        'Same-name magic! \u2764\uFE0F A fun little twist on the calculator.',
        'These names echo each other in a charming way.',
        'There\u2019s a friendly symmetry here that\u2019s hard to ignore.',
        'Keep the curiosity warm and the laughter close at hand.',
        'Real magic always comes from people, not from formulas.'
      ]
    },
    {
      title: 'Mirror Hearts',
      lines: [
        'Mirror hearts! \u2764\uFE0F The calculator loves a same-name pair.',
        'A symmetry ripples through every part of this match.',
        'There\u2019s a sweet familiarity that feels both cozy and curious.',
        'Lean into the warmth, the inside jokes, and the shared smiles.',
        'Numbers play; people make love real.'
      ]
    }
  ];

  function generateResultMessage(core) {
    if (core.sameName) {
      var rng = mulberry32(core.seed ^ 0x12345);
      var idx = Math.floor(rng() * SAME_NAME_MESSAGES.length) % SAME_NAME_MESSAGES.length;
      return SAME_NAME_MESSAGES[idx];
    }
    var cat = getScoreCategory(core.score);
    return pickMessage(cat.id, core.seed);
  }

  // ---------------------------------------------------------------------
  // Thumbprint signature (spec addition: thumbprint mode)
  //   - The DOM layer (app.js) captures press timing, position variance,
  //     and duration while the user holds each pad.
  //   - It passes a "thumbprint signature" object here. We hash it into
  //     a 32-bit seed and use it as either the sole input (thumb-only
  //     mode) or as a modifier to the name-based score (combined mode).
  //   - The signature is fully deterministic for the same press data, so
  //     the same two thumbprints always give the same score.
  //   - We never claim this is real biometrics — it is a simulated
  //     simulation of a "love scan" using how-long-and-how-you-pressed.
  // ---------------------------------------------------------------------
  function hashThumbSignature(sig) {
    if (!sig) return 0;
    var s = [
      sig.duration || 0,
      sig.avgX || 0,
      sig.avgY || 0,
      sig.varX || 0,
      sig.varY || 0,
      sig.samples || 0,
      sig.maxX || 0,
      sig.maxY || 0,
      sig.minX || 0,
      sig.minY || 0,
      sig.area || 0
    ].join('|');
    return fnv1a('thumb:' + s);
  }

  function combineSeeds(nameSeed, thumb1Seed, thumb2Seed) {
    // Mix all three with a final avalanche step so even small changes
    // in any one input propagate fully.
    var x = (nameSeed ^ thumb1Seed ^ thumb2Seed) >>> 0;
    x = (Math.imul(x, 0x85EBCA6B) ^ (x >>> 13)) >>> 0;
    x = (Math.imul(x, 0xC2B2AE35) ^ (x >>> 16)) >>> 0;
    return x >>> 0;
  }

  // ---------------------------------------------------------------------
  // Personalized paragraph generator (spec addition)
  //   - Replaces the old 4-5-line message with a flowing 4-5-sentence
  //     paragraph that uses both names and references the actual
  //     dimensional insights of the calculation.
  //   - Tone: warm, positive. Even low scores stay
  //     light (spec section 86, 87).
  //   - Multiple original templates per range, deterministically picked
  //     so repeat runs feel consistent yet varied.
  // ---------------------------------------------------------------------
  var PARAGRAPH_LIBRARY = {
    r0_10: [
      'Right now, the sparks between {a} and {b} are quiet and shy, like the very first hello of two people who haven\u2019t quite figured each other out yet. There\u2019s a soft curiosity hiding in the way their names sit together, and a gentle warmth that could grow with a little patience. Friendship and shared laughter would be the sweetest doorway here, far more than grand gestures. The calculator is smiling quietly \u2014 and that\u2019s okay, because every great story starts somewhere small. Real connection is built by people, never just measured by a number.'
    ],
    r11_20: [
      'There\u2019s a soft, easygoing vibe forming between {a} and {b}, like two melodies that haven\u2019t synced up yet but are clearly listening to each other. Small kind gestures would mean more than big dramatic ones right now, and a shared interest could be the bridge worth crossing. The chemistry is gentle, the friendship potential is real, and there\u2019s room for warmth to grow at its own pace. Keep things light and curious \u2014 the best chapters of any bond are written slowly. Numbers play; people make love real.'
    ],
    r21_30: [
      'A friendly, pleasant little glow wraps around {a} and {b}, the kind that makes conversations easy and silences comfortable. There\u2019s a clear friendship rhythm in the air, and lightness would do far more than seriousness right now. A shared joke, a small adventure, an inside smile \u2014 those are the threads worth pulling. The calculator sees potential here, even if it isn\u2019t shouting from the rooftops. Real warmth is grown, never just predicted.'
    ],
    r31_40: [
      'Something warm is gently forming between {a} and {b}, with friendship and flirtation sharing the stage nicely. Light teasing feels natural, shared interests feel easy, and there\u2019s a clear curiosity pulling the two names toward each other. Honesty and humor will take this pairing further than effort or grandeur. Notice the good moments \u2014 they\u2019re worth collecting. The calculator is smiling; people make it real.'
    ],
    r41_50: [
      'A balanced, even-keeled match hums between {a} and {b}, where friendship and a touch of romance share the spotlight equally. Conversation likely flows, silences feel kind rather than awkward, and a small adventure together could spark something new. There\u2019s enough warmth here to be hopeful and enough room to keep growing. Keep the door open for unexpected little moments \u2014 they add up. Real relationships are built, never just measured.'
    ],
    r51_60: [
      'A noticeably sweet chemistry is dancing between {a} and {b}, the kind that makes a room feel a little warmer when they walk in together. Comfort and curiosity mix in a really pleasant way, and inside jokes are practically writing themselves. There\u2019s a gentle pull that feels both easy and exciting, with friendship as the steady foundation and romance as the soft accent. Keep being kind, keep being curious, keep showing up. The score is fun; the relationship is the real thing.'
    ],
    r61_70: [
      'A genuine spark lights up the pairing of {a} and {b}, with banter, easy smiles, and shared adventure feeling right at home. Warmth and humor are doing beautiful work between them, and laughter seems to follow this pair wherever it goes. There\u2019s enough chemistry to be exciting and enough comfort to be safe \u2014 a really nice balance. Keep being honest, keep being warm, keep being present. People build love; calculators only smile.'
    ],
    r71_80: [
      'A charming connection is blooming between {a} and {b}, where warmth, humor, and a touch of magic are easy to find. Hearts are quietly doing a happy little dance, and a comfortable glow wraps around the pairing naturally. Both friendship and romance get to share the stage here, with kindness as the steady heartbeat. Cherish the small things \u2014 they\u2019re the big things, really. The calculator celebrates; people make it true.'
    ],
    r81_90: [
      'Strong romantic energy shimmers all around {a} and {b}, with hearts, flowers, and a generous helping of fun clearly in season. A beautiful buzz is in the air, the kind that makes ordinary moments feel a little cinematic. Warmth and laughter come easily, adventures are calling, and the chemistry is unmistakable. Be honest, be warm, be present \u2014 the rest will follow. The score is high; the relationship is the real prize.'
    ],
    r91_95: [
      'A magical moment of names is unfolding between {a} and {b}, with big smiles, lots of laughter, and a beautiful buzz wrapping around them. The calculator is genuinely delighted by this combination, and there\u2019s a sparkling, almost-cinematic quality to the chemistry. Hearts are floating, flowers are blooming, and joy seems to follow this pair wherever it goes. Cherish it, share it, and keep building the real thing daily. People \u2014 not percentages \u2014 write the true love stories.'
    ],
    r96_100: [
      'The calculator is throwing confetti for {a} and {b} \u2014 full celebration mode, with grand fireworks of names lighting up the screen. A wonderful, share-worthy, smile-spreading moment is here, and the calculator is genuinely cheering for this pairing. Take the joy, pass it on, and keep being kind to each other, because that\u2019s where the real magic lives. This is play at its most delightful, and the real celebration is the love you build every day. People are the magic; percentages are just the party.'
    ]
  };

  var SAME_NAME_PARAGRAPHS = [
    'Same-name magic! {a} and {b} echo each other in a charming way, with a friendly symmetry that\u2019s hard to ignore. There\u2019s a sweet familiarity here that feels both cozy and curious, like two notes of the same chord resonating together. Lean into the warmth, the inside jokes, and the shared smiles \u2014 symmetry this pretty deserves to be enjoyed. The calculator loves a same-name pair, but real magic always comes from people, not from formulas. Numbers play; people make love real.'
  ];

  function pickParagraph(categoryId, seed, name1, name2) {
    var lib = PARAGRAPH_LIBRARY[categoryId] || PARAGRAPH_LIBRARY.r41_50;
    var rng = mulberry32(seed ^ 0x5BD1E995);
    var idx = Math.floor(rng() * lib.length) % lib.length;
    var template = lib[idx];
    return template.replace(/\{a\}/g, name1).replace(/\{b\}/g, name2);
  }

  function generateResultParagraph(core) {
    var name1 = core.display1 || 'You';
    var name2 = core.display2 || 'your partner';
    if (core.sameName) {
      var rng = mulberry32(core.seed ^ 0xABCDE123);
      var idx = Math.floor(rng() * SAME_NAME_PARAGRAPHS.length) % SAME_NAME_PARAGRAPHS.length;
      return SAME_NAME_PARAGRAPHS[idx].replace(/\{a\}/g, name1).replace(/\{b\}/g, name2);
    }
    var cat = getScoreCategory(core.score);
    return pickParagraph(cat.id, core.seed, name1, name2);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function compute(rawName1, rawName2, thumb1, thumb2, mode, firstVisit) {
    // mode: 'names' | 'thumb' | 'both' (default: 'names' if names present,
    // 'thumb' if only thumbprints present, 'both' if all four).
    // firstVisit: if true, boost the score to 98-100 for first-time visitors
    var nameCore = calculateLoveScore(rawName1, rawName2);
    var t1Seed = hashThumbSignature(thumb1);
    var t2Seed = hashThumbSignature(thumb2);
    var thumbSeed = combineSeeds(0, t1Seed, t2Seed);
    var combinedSeed = combineSeeds(nameCore.seed, t1Seed, t2Seed);

    // Decide which seed drives the score
    var effectiveSeed;
    var source;
    if (mode === 'thumb') {
      effectiveSeed = thumbSeed;
      source = 'thumb';
    } else if (mode === 'both') {
      effectiveSeed = combinedSeed;
      source = 'both';
    } else {
      effectiveSeed = nameCore.seed;
      source = 'names';
    }

    // Build a "core" that uses the effective seed to derive the score.
    // We reuse the dimensional analysis from the name core for names mode,
    // and synthesize comparable dimensions for thumb mode using the seed.
    var core;
    if (source === 'names') {
      core = nameCore;
    } else {
      // For thumb / both modes, derive dimensions from the effective seed
      // so the score has the same multi-dimensional flavor as names mode.
      var rng = mulberry32(effectiveSeed);
      var dims = {
        hash:           rng(),
        shared:         rng(),
        length:         rng(),
        position:       rng(),
        rhythm:         rng(),
        patternHarmony: rng(),
        nameHarmony:    rng()
      };
      var weights = { hash: 0.22, shared: 0.16, length: 0.12, position: 0.12,
                      rhythm: 0.12, patternHarmony: 0.14, nameHarmony: 0.12 };
      var raw = 0;
      for (var k in weights) if (weights.hasOwnProperty(k)) raw += weights[k] * dims[k];
      var shimmer = ((Math.imul(effectiveSeed, 0x9E3779B1) >>> 0) % 1000) / 1000;
      raw = raw * 0.85 + shimmer * 0.15;
      var curved = 0.5 + 0.5 * Math.sin((raw - 0.5) * Math.PI);
      curved = 0.55 * curved + 0.45 * raw;
      var score = Math.max(0, Math.min(100, Math.round(curved * 100)));

      core = {
        score: score,
        display1: nameCore.display1 || ('Thumb 1'),
        display2: nameCore.display2 || ('Thumb 2'),
        calc1: nameCore.calc1,
        calc2: nameCore.calc2,
        sameName: false,
        dims: dims,
        seed: effectiveSeed,
        altSeed: nameCore.altSeed ^ thumbSeed
      };
    }

    // First-visit boost: give first-time visitors a high score (98-100)
    // to make their first experience joyful and share-worthy. The exact
    // score is deterministic from the seed so the same names always give
    // the same boosted score on first visit. Subsequent calculations use
    // the normal algorithm.
    if (firstVisit) {
      var boostRng = mulberry32(core.seed ^ 0x46495253); // 'FIRS'
      var boostedScore = 98 + Math.floor(boostRng() * 3); // 98, 99, or 100
      core.score = boostedScore;
      // Regenerate the sameName flag based on the boosted score (keep original)
      // The dims stay the same but the score is now high
    }

    var secondary = calculateSecondaryScores(core);
    // On first visit, also boost secondary scores so they match the high main score
    if (firstVisit) {
      for (var sk in secondary) {
        if (secondary.hasOwnProperty(sk)) {
          secondary[sk] = Math.max(secondary[sk], 92 + Math.floor(mulberry32(core.seed ^ (sk.charCodeAt(0) * 0x111))() * 8));
        }
      }
    }
    var message = generateResultMessage(core);
    var paragraph = generateResultParagraph(core);
    var category = getScoreCategory(core.score);
    var intensity = getAnimationIntensity(core.score);
    var palette = getResultPalette(core.score);

    // Past / Present / Future timeline — three deterministic variations
    // of the score that tell a "love story" of growth. Each phase has
    // its own score, paragraph, and title. The seeds are derived from
    // the main score with different salts so they're deterministic but
    // feel like distinct chapters. The "present" is the main score.
    var timeline = generateTimeline(core, source);

    return {
      score: core.score,
      display1: core.display1,
      display2: core.display2,
      sameName: core.sameName,
      message: message,
      paragraph: paragraph,
      secondary: secondary,
      category: category,
      intensity: intensity,
      palette: palette,
      seed: core.seed,
      source: source,
      timeline: timeline,
      firstVisit: !!firstVisit
    };
  }

  // ---------------------------------------------------------------------
  // Past / Present / Future timeline
  //   - Past: how the connection likely began — slightly lower score,
  //     softer paragraph about the early spark.
  //   - Present: the main score (already calculated). A snapshot of
  //     where the vibe is right now.
  //   - Future: where the bond could grow — slightly higher score,
  //     warmer paragraph about what could blossom.
  //   - All three are deterministic functions of the same name/thumb
  //     seed, so repeat runs always show the same timeline.
  // ---------------------------------------------------------------------
  var PAST_SALT     = 0x50415354; // 'PAST'
  var FUTURE_SALT   = 0x46555455; // 'FUTU'

  var TIMELINE_TITLES = {
    past:   ['First Hello', 'A Quiet Beginning', 'Early Spark', 'A Gentle Start', 'The First Whisper'],
    present:['Right Now', 'The Current Vibe', 'Today\u2019s Pulse', 'Where You Are', 'This Moment'],
    future: ['What Could Bloom', 'The Road Ahead', 'Tomorrow\u2019s Promise', 'A Warmer Tomorrow', 'What May Grow']
  };

  var TIMELINE_PARAGRAPHS = {
    past: [
      'In the beginning, {a} and {b} were just two names learning each other\u2019s rhythm. There was a shy curiosity in those early days \u2014 small greetings, careful smiles, the quiet thrill of noticing someone new. The connection was tiny but real, like the first warm note of a song that hasn\u2019t found its melody yet. Even the gentlest beginnings carry the seeds of everything that comes after.'
    ],
    present: [
      'Right now, {a} and {b} are right here in this moment \u2014 a snapshot of all the small choices, shared laughs, and quiet understandings that have brought them to today. The chemistry has settled into something recognizable: comfortable in some places, electric in others, always in motion. This is the present they\u2019re living, and it\u2019s the only place love actually happens.'
    ],
    future: [
      'Looking ahead, {a} and {b} have a real chance to grow something warmer. If kindness keeps showing up, if honesty stays in the room, if laughter stays on the menu \u2014 the bond could deepen in ways neither of them has imagined yet. Tomorrow isn\u2019t promised, but it\u2019s shaped by today. Every small good moment is a seed for what could bloom.'
    ]
  };

  function deriveTimelineScore(baseSeed, salt, baseScore) {
    // Mix the seed with the salt to get a phase-specific seed
    var phaseSeed = (Math.imul(baseSeed ^ salt, 0x85EBCA6B) ^ (baseSeed >>> 13)) >>> 0;
    var rng = mulberry32(phaseSeed);
    // Past: shift down by 5–15 points (clamped to a floor of 8)
    // Future: shift up by 5–15 points (clamped to a ceiling of 99)
    // Present: stays the same
    if (salt === PAST_SALT) {
      var pastDrop = 5 + Math.floor(rng() * 11); // 5..15
      var pastScore = Math.max(8, baseScore - pastDrop);
      return pastScore;
    } else if (salt === FUTURE_SALT) {
      var futureRise = 5 + Math.floor(rng() * 11); // 5..15
      var futureScore = Math.min(99, baseScore + futureRise);
      return futureScore;
    }
    return baseScore;
  }

  function pickTimelineParagraph(phase, seed, name1, name2) {
    var lib = TIMELINE_PARAGRAPHS[phase] || TIMELINE_PARAGRAPHS.present;
    var rng = mulberry32(seed ^ (phase === 'past' ? 0x1111 : phase === 'future' ? 0x2222 : 0x3333));
    var idx = Math.floor(rng() * lib.length) % lib.length;
    return lib[idx].replace(/\{a\}/g, name1).replace(/\{b\}/g, name2);
  }

  function pickTimelineTitle(phase, seed) {
    var lib = TIMELINE_TITLES[phase] || TIMELINE_TITLES.present;
    var rng = mulberry32(seed ^ (phase === 'past' ? 0x4444 : phase === 'future' ? 0x5555 : 0x6666));
    var idx = Math.floor(rng() * lib.length) % lib.length;
    return lib[idx];
  }

  function generateTimeline(core, source) {
    var name1 = core.display1 || 'You';
    var name2 = core.display2 || 'your partner';
    var baseSeed = core.seed;
    var baseScore = core.score;

    var pastScore   = deriveTimelineScore(baseSeed, PAST_SALT, baseScore);
    var futureScore = deriveTimelineScore(baseSeed, FUTURE_SALT, baseScore);

    return {
      past: {
        phase: 'past',
        score: pastScore,
        title: pickTimelineTitle('past', baseSeed),
        paragraph: pickTimelineParagraph('past', baseSeed, name1, name2),
        palette: getResultPalette(pastScore),
        category: getScoreCategory(pastScore)
      },
      present: {
        phase: 'present',
        score: baseScore,
        title: pickTimelineTitle('present', baseSeed),
        paragraph: core.sameName
          ? pickTimelineParagraph('present', baseSeed, name1, name2)
          : core.paragraph || pickTimelineParagraph('present', baseSeed, name1, name2),
        palette: getResultPalette(baseScore),
        category: getScoreCategory(baseScore)
      },
      future: {
        phase: 'future',
        score: futureScore,
        title: pickTimelineTitle('future', baseSeed),
        paragraph: pickTimelineParagraph('future', baseSeed, name1, name2),
        palette: getResultPalette(futureScore),
        category: getScoreCategory(futureScore)
      }
    };
  }

  function resetCalculator() {
    // No-op here — actual DOM reset happens in app.js. This hook exists
    // for spec compliance (section 63) and is exposed for testing.
    return true;
  }

  LoveCalc.calculator = {
    MAX_NAME_LEN: MAX_NAME_LEN,
    validateName: validateName,
    normalizeName: intl.normalizeInternationalName,
    hashName: hashName,
    calculateLoveScore: calculateLoveScore,
    calculateSecondaryScores: calculateSecondaryScores,
    generateResultMessage: generateResultMessage,
    generateResultParagraph: generateResultParagraph,
    generateTimeline: generateTimeline,
    hashThumbSignature: hashThumbSignature,
    combineSeeds: combineSeeds,
    getScoreCategory: getScoreCategory,
    getAnimationIntensity: getAnimationIntensity,
    getResultPalette: getResultPalette,
    compute: compute,
    resetCalculator: resetCalculator,
    SECONDARY_KEYS: SECONDARY_KEYS,
    MESSAGE_LIBRARY: MESSAGE_LIBRARY,
    PARAGRAPH_LIBRARY: PARAGRAPH_LIBRARY
  };

})(typeof window !== 'undefined' ? window : this);
