(() => {
  'use strict';

  /* =========================================================
     Small helpers
     ========================================================= */
  const $ = (selector, root = document) => root.querySelector(selector);
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inverseLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const now = () => performance.now();
  const DEBUG = new URLSearchParams(location.search).has('debug');

  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function formatNumber(n) {
    const value = Math.max(0, Math.floor(n));
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function roundRectPath(c, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  }

  function starPath(c, cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = rotation + (i * Math.PI) / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  }

  function heartPath(c, cx, cy, s) {
    c.beginPath();
    c.moveTo(cx, cy + s * 0.88);
    c.bezierCurveTo(cx - s * 0.2, cy + s * 0.63, cx - s * 1.1, cy + s * 0.14, cx - s * 0.78, cy - s * 0.34);
    c.bezierCurveTo(cx - s * 0.48, cy - s * 0.82, cx, cy - s * 0.54, cx, cy - s * 0.25);
    c.bezierCurveTo(cx, cy - s * 0.54, cx + s * 0.48, cy - s * 0.82, cx + s * 0.78, cy - s * 0.34);
    c.bezierCurveTo(cx + s * 1.1, cy + s * 0.14, cx + s * 0.2, cy + s * 0.63, cx, cy + s * 0.88);
    c.closePath();
  }

  function rgba(c, a = 1) {
    if (Array.isArray(c)) return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    return c;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixRgb(a, b, t) {
    return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
  }

  function mixColors(a, b, t) {
    return `rgb(${mixRgb(a, b, t).join(',')})`;
  }

  const FONT_ROUND = '"Hiragino Maru Gothic ProN","Hiragino Maru Gothic Pro","Hiragino Sans","Yu Gothic","Noto Sans JP",-apple-system,sans-serif';
  const FONT_NUMBER = '"Arial Rounded MT Bold","Hiragino Maru Gothic ProN","Avenir Next","Trebuchet MS",sans-serif';

  /* =========================================================
     Save data
     ========================================================= */
  const SAVE_KEY = 'purin-rush-save-v1';

  const MISSIONS = [
    { id: 'sweets', stat: 'sweets', title: 'スイーツを40個あつめる', icon: '★', target: 40, reward: 80 },
    { id: 'distance', stat: 'distance', title: 'きょう600mはしる', icon: '↗', target: 600, reward: 100 },
    { id: 'fever', stat: 'fevers', title: 'フィーバーを1回おこす', icon: '✧', target: 1, reward: 120 },
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function freshDaily() {
    return { date: todayKey(), sweets: 0, distance: 0, fevers: 0, claimed: [false, false, false] };
  }

  function defaultSave() {
    return {
      version: 1,
      best: 0,
      coins: 0,
      selected: 'purin',
      owned: ['purin'],
      sound: true,
      tutorialSeen: false,
      daily: freshDaily(),
    };
  }

  function normalizeSave(raw) {
    const base = defaultSave();
    if (!raw || typeof raw !== 'object') return base;
    const out = base;
    out.best = Number.isFinite(raw.best) ? Math.max(0, Math.floor(raw.best)) : 0;
    out.coins = Number.isFinite(raw.coins) ? Math.max(0, Math.floor(raw.coins)) : 0;
    out.sound = raw.sound !== false;
    out.tutorialSeen = raw.tutorialSeen === true;
    out.owned = Array.isArray(raw.owned) && raw.owned.includes('purin') ? raw.owned.filter((x) => typeof x === 'string') : ['purin'];
    if (!out.owned.includes('purin')) out.owned.unshift('purin');
    out.selected = typeof raw.selected === 'string' && out.owned.includes(raw.selected) ? raw.selected : 'purin';
    if (raw.daily && typeof raw.daily === 'object') {
      out.daily.date = typeof raw.daily.date === 'string' ? raw.daily.date : todayKey();
      out.daily.sweets = Number.isFinite(raw.daily.sweets) ? Math.max(0, raw.daily.sweets) : 0;
      out.daily.distance = Number.isFinite(raw.daily.distance) ? Math.max(0, raw.daily.distance) : 0;
      out.daily.fevers = Number.isFinite(raw.daily.fevers) ? Math.max(0, raw.daily.fevers) : 0;
      out.daily.claimed = Array.isArray(raw.daily.claimed) ? raw.daily.claimed.map(Boolean).slice(0, 3) : [false, false, false];
      while (out.daily.claimed.length < 3) out.daily.claimed.push(false);
    }
    return out;
  }

  let save = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) save = normalizeSave(JSON.parse(raw));
  } catch (err) {
    save = defaultSave();
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      /* Storage can be unavailable in private mode. The game still works. */
    }
  }

  function ensureDaily() {
    if (!save.daily || save.daily.date !== todayKey()) {
      save.daily = freshDaily();
      persist();
      refreshDailyDot();
      return true;
    }
    return false;
  }

  function missionProgress(mission) {
    return Math.max(0, Number(save.daily[mission.stat]) || 0);
  }

  function missionComplete(mission, index) {
    return missionProgress(mission) >= mission.target && !save.daily.claimed[index];
  }

  function hasClaimableMission() {
    return MISSIONS.some((m, i) => missionComplete(m, i));
  }

  /* =========================================================
     Characters
     ========================================================= */
  const SKINS = [
    {
      id: 'purin',
      name: 'プリン',
      trait: 'バランスタイプ。はじめてのひとりに。',
      cost: 0,
      garnish: 'cherry',
      colors: {
        bodyLight: '#FFF0AD',
        body: '#FFD76E',
        bodyDark: '#F6BA4F',
        caramelLight: '#C97A3F',
        caramel: '#A95B2F',
        caramelDark: '#7D4327',
        outline: '#593628',
        cheek: '#FF8FA1',
        foot: '#8B4B2C',
        accent: '#F04A62',
        leaf: '#6CB860',
        highlight: '#FFF8D4',
      },
    },
    {
      id: 'mint',
      name: 'ミント',
      trait: 'ジャンプがすこし高い。風のような身軽さ。',
      cost: 250,
      garnish: 'mint',
      jumpBoost: 1.055,
      colors: {
        bodyLight: '#EDFFF6',
        body: '#C6F2D8',
        bodyDark: '#A6E2C2',
        caramelLight: '#A9E4CC',
        caramel: '#72C5A5',
        caramelDark: '#4F9D80',
        outline: '#365B50',
        cheek: '#FF9FB6',
        foot: '#4D967C',
        accent: '#F46A90',
        leaf: '#4C9C72',
        highlight: '#FCFFFA',
      },
    },
    {
      id: 'choco',
      name: 'ショコラ',
      trait: 'スライドがながい。するりとくぐりぬける。',
      cost: 650,
      garnish: 'choco',
      slideBoost: 1.24,
      colors: {
        bodyLight: '#F5D2AF',
        body: '#DBA77A',
        bodyDark: '#BF865A',
        caramelLight: '#85543C',
        caramel: '#5D392A',
        caramelDark: '#3F251C',
        outline: '#3B251F',
        cheek: '#F599A9',
        foot: '#6A4130',
        accent: '#FF6B8B',
        leaf: '#75B878',
        highlight: '#FFF0DC',
      },
    },
    {
      id: 'berry',
      name: 'ベリー',
      trait: 'スイーツをひきよせやすい。あまいものだいすき。',
      cost: 1200,
      garnish: 'strawberry',
      magnetBoost: 1.45,
      colors: {
        bodyLight: '#FFE7EE',
        body: '#FFC5D5',
        bodyDark: '#F4A6BE',
        caramelLight: '#FFA3BA',
        caramel: '#E87496',
        caramelDark: '#C25477',
        outline: '#653B45',
        cheek: '#FF7E9C',
        foot: '#C25875',
        accent: '#E93660',
        leaf: '#65B66F',
        highlight: '#FFF9FB',
      },
    },
  ];

  function getSkin(id = save.selected) {
    return SKINS.find((skin) => skin.id === id) || SKINS[0];
  }

  function selectedSkin() {
    return getSkin(save.selected);
  }

  function selectedPerks() {
    const skin = selectedSkin();
    return {
      jump: skin.jumpBoost || 1,
      slide: skin.slideBoost || 1,
      magnet: skin.magnetBoost || 1,
    };
  }

  /* =========================================================
     Stages & palettes
     ========================================================= */
  const STAGES = [
    {
      name: 'いちごヒルズ',
      en: 'STRAWBERRY HILLS',
      threshold: 0,
      palette: {
        skyTop: '#8ED9F6', skyMid: '#BFE8F8', skyBottom: '#FFE4EC',
        sun: '#FFF1A5', sunGlow: '#FFE8AE',
        cloud: '#FFF9F0', cloudShade: '#FFD8E5',
        hillFar: '#FFC7DA', hillNear: '#A5DFC6',
        pathTop: '#FFF2D1', path: '#F9C5B6', pathDark: '#EE9EA8',
        decor1: '#FF98AF', decor2: '#79D2B3', decor3: '#FFD26A',
        accent: '#FF789A', outline: '#6B4537', night: 0,
      },
    },
    {
      name: 'ミントフォレスト',
      en: 'MINT FOREST',
      threshold: 450,
      palette: {
        skyTop: '#8ADCE4', skyMid: '#BFF3EA', skyBottom: '#E8FFE9',
        sun: '#FFF3B0', sunGlow: '#DFFFD8',
        cloud: '#FFFCF2', cloudShade: '#C9F1DF',
        hillFar: '#B6EED4', hillNear: '#79CFAF',
        pathTop: '#EFFFE9', path: '#BEE7D1', pathDark: '#83C9AE',
        decor1: '#6DD2AC', decor2: '#F49AB2', decor3: '#FFD86C',
        accent: '#48B98D', outline: '#38594E', night: 0,
      },
    },
    {
      name: 'キャラメルタウン',
      en: 'CARAMEL TOWN',
      threshold: 1000,
      palette: {
        skyTop: '#F39A6E', skyMid: '#F7BF83', skyBottom: '#FFE0A8',
        sun: '#FFE494', sunGlow: '#FFB96E',
        cloud: '#FFEAD4', cloudShade: '#EFA88E',
        hillFar: '#DE8E7A', hillNear: '#A96A72',
        pathTop: '#FFE8B7', path: '#D89A6B', pathDark: '#A96C4D',
        decor1: '#C87850', decor2: '#F5B768', decor3: '#FF8A7A',
        accent: '#FF845A', outline: '#58362E', night: 0.08,
      },
    },
    {
      name: 'シュガーナイト',
      en: 'SUGAR NIGHT',
      threshold: 1600,
      palette: {
        skyTop: '#1F285A', skyMid: '#3E3575', skyBottom: '#72578F',
        sun: '#FFE8A6', sunGlow: '#B99CFF',
        cloud: '#665A97', cloudShade: '#4B447D',
        hillFar: '#45417C', hillNear: '#2D2C5D',
        pathTop: '#D1B6F3', path: '#594879', pathDark: '#33294F',
        decor1: '#9B7FD4', decor2: '#5EC7B8', decor3: '#FFCD72',
        accent: '#FF8CCB', outline: '#241F3D', night: 1,
      },
    },
  ];

  const PALETTE_KEYS = Object.keys(STAGES[0].palette);

  function makePalette(def) {
    const out = {};
    for (const key of PALETTE_KEYS) {
      out[key] = key === 'night' ? def[key] : hexToRgb(def[key]);
    }
    return out;
  }

  function mixPalettes(a, b, t) {
    const out = {};
    for (const key of PALETTE_KEYS) {
      out[key] = key === 'night' ? lerp(a[key], b[key], t) : mixRgb(a[key], b[key], t);
    }
    return out;
  }

  const stagePalettes = STAGES.map((s) => makePalette(s.palette));

  let currentPalette = makePalette(STAGES[0].palette);
  let paletteFrom = currentPalette;
  let paletteTo = currentPalette;
  let paletteT = 1;
  let paletteDuration = 1.4;

  function setStagePalette(index, instant = false) {
    paletteFrom = currentPalette;
    paletteTo = stagePalettes[index] || stagePalettes[0];
    paletteT = instant ? 1 : 0;
    paletteDuration = instant ? 0.01 : 1.5;
    if (instant) currentPalette = paletteTo;
  }

  function updatePalette(dt) {
    if (paletteT >= 1) return;
    paletteT = Math.min(1, paletteT + dt / paletteDuration);
    currentPalette = mixPalettes(paletteFrom, paletteTo, easeInOutSine(paletteT));
  }

  /* =========================================================
     Audio
     ========================================================= */
  const audio = (() => {
    let ctx = null;
    let master = null;
    let musicGain = null;
    let sfxGain = null;
    let enabled = save.sound !== false;
    let musicTimer = null;
    let musicStarted = false;
    let nextStepTime = 0;
    let stepIndex = 0;
    let energy = 1;
    let noiseBuffer = null;
    const stepDur = 60 / 116 / 4;

    function init() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
      } catch (err) {
        ctx = null;
        return;
      }
      master = ctx.createGain();
      master.gain.value = enabled ? 0.72 : 0.0001;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.105;
      musicGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.52;
      sfxGain.connect(master);

      const len = Math.floor(ctx.sampleRate * 0.3);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    function resume() {
      init();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }

    function midi(n) {
      return 440 * Math.pow(2, (n - 69) / 12);
    }

    function tone({ freq, endFreq = freq, dur = 0.12, type = 'sine', vol = 0.1, at = 0, dest = 'sfx', attack = 0.006 }) {
      if (!ctx || !enabled) return;
      const t0 = ctx.currentTime + at;
      const target = dest === 'music' ? musicGain : sfxGain;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(target);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    function noise({ dur = 0.12, vol = 0.08, freq = 1800, q = 0.8, at = 0, type = 'highpass', dest = 'sfx' }) {
      if (!ctx || !enabled || !noiseBuffer) return;
      const t0 = ctx.currentTime + at;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(freq, t0);
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest === 'music' ? musicGain : sfxGain);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }

    const melody = [
      [76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 72, 0, 74, 0],
      [72, 0, 76, 0, 79, 0, 76, 74, 72, 0, 69, 0, 72, 0, 0, 0],
      [77, 0, 81, 0, 84, 0, 81, 79, 77, 0, 76, 0, 74, 0, 72, 0],
      [79, 0, 83, 0, 86, 0, 83, 81, 79, 0, 77, 0, 74, 0, 76, 0],
    ];
    const bassRoots = [48, 45, 41, 43];
    const chords = [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ];

    function playStep(step, time) {
      if (!ctx || !enabled) return;
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;
      const note = melody[bar][s];
      const at = Math.max(0, time - ctx.currentTime);
      if (note) {
        tone({ freq: midi(note), dur: 0.105, type: 'triangle', vol: 0.058 * energy, at, dest: 'music' });
        if (s % 4 === 0) {
          tone({ freq: midi(note - 12), dur: 0.12, type: 'sine', vol: 0.025 * energy, at, dest: 'music' });
        }
      }
      if (s === 0 || s === 6 || s === 8 || s === 14) {
        tone({ freq: midi(bassRoots[bar] - 12), dur: 0.18, type: 'sine', vol: 0.06 * energy, at, dest: 'music' });
      }
      if (s === 0 || s === 8) {
        for (const n of chords[bar]) {
          tone({ freq: midi(n), dur: 0.42, type: 'sine', vol: 0.017 * energy, at, dest: 'music', attack: 0.04 });
        }
      }
      if (s % 2 === 0) {
        noise({ dur: 0.025, vol: 0.012 * energy, freq: 7000, at, dest: 'music', type: 'highpass' });
      }
      if (s === 2 || s === 10) {
        noise({ dur: 0.045, vol: 0.025 * energy, freq: 2300, at, dest: 'music', type: 'bandpass' });
      }
      if (s === 0 || s === 7) {
        tone({ freq: 95, endFreq: 52, dur: 0.13, type: 'sine', vol: 0.045 * energy, at, dest: 'music' });
      }
    }

    function scheduler() {
      if (!ctx || !musicStarted) return;
      while (nextStepTime < ctx.currentTime + 0.17) {
        playStep(stepIndex, nextStepTime);
        nextStepTime += stepDur;
        stepIndex = (stepIndex + 1) % 64;
      }
    }

    function startMusic() {
      init();
      if (!ctx) return;
      resume();
      if (musicStarted) return;
      musicStarted = true;
      nextStepTime = ctx.currentTime + 0.08;
      stepIndex = 0;
      scheduler();
      musicTimer = window.setInterval(scheduler, 55);
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      save.sound = enabled;
      if (enabled) {
        init();
        resume();
        if (!musicStarted) startMusic();
        if (ctx) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.linearRampToValueAtTime(0.72, ctx.currentTime + 0.18);
        }
      } else if (ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      }
      persist();
    }

    function setEnergy(value) {
      energy = clamp(value, 0.6, 1.5);
      if (musicGain && ctx) {
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.linearRampToValueAtTime(0.105 * energy, ctx.currentTime + 0.3);
      }
    }

    return {
      unlock: () => {
        init();
        resume();
        if (enabled) startMusic();
      },
      startMusic,
      setEnabled,
      get enabled() {
        return enabled;
      },
      setEnergy,
      click() {
        resume();
        tone({ freq: 620, endFreq: 760, dur: 0.055, type: 'triangle', vol: 0.065 });
      },
      jump() {
        tone({ freq: 330, endFreq: 650, dur: 0.13, type: 'triangle', vol: 0.12 });
        noise({ dur: 0.09, vol: 0.025, freq: 2600, type: 'bandpass' });
      },
      doubleJump() {
        tone({ freq: 520, endFreq: 1050, dur: 0.15, type: 'triangle', vol: 0.11 });
        tone({ freq: 790, endFreq: 1250, dur: 0.12, type: 'sine', vol: 0.05, at: 0.04 });
      },
      slide() {
        noise({ dur: 0.18, vol: 0.06, freq: 1000, type: 'bandpass', q: 0.7 });
        tone({ freq: 240, endFreq: 160, dur: 0.11, type: 'sine', vol: 0.035 });
      },
      coin(combo = 0) {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
        const semitone = scale[combo % scale.length];
        const freq = 880 * Math.pow(2, semitone / 12);
        tone({ freq, dur: 0.075, type: 'sine', vol: 0.052 });
        tone({ freq: freq * 2, dur: 0.045, type: 'triangle', vol: 0.016, at: 0.015 });
      },
      gold() {
        [0, 4, 7, 12].forEach((semi, i) => {
          tone({ freq: 740 * Math.pow(2, semi / 12), dur: 0.11, type: 'triangle', vol: 0.06, at: i * 0.045 });
        });
      },
      heart() {
        [0, 4, 7].forEach((semi, i) => {
          tone({ freq: 660 * Math.pow(2, semi / 12), dur: 0.16, type: 'sine', vol: 0.075, at: i * 0.07 });
        });
      },
      hit() {
        tone({ freq: 165, endFreq: 55, dur: 0.26, type: 'sawtooth', vol: 0.12 });
        noise({ dur: 0.17, vol: 0.11, freq: 800, type: 'lowpass' });
      },
      fever() {
        [0, 4, 7, 12, 16, 19, 24].forEach((semi, i) => {
          tone({ freq: 523 * Math.pow(2, semi / 12), dur: 0.22, type: 'triangle', vol: 0.075, at: i * 0.06 });
        });
        noise({ dur: 0.5, vol: 0.04, freq: 4200, type: 'highpass' });
      },
      stage() {
        [0, 7, 12, 16].forEach((semi, i) => {
          tone({ freq: 523 * Math.pow(2, semi / 12), dur: 0.2, type: 'sine', vol: 0.06, at: i * 0.075 });
        });
      },
      nearMiss() {
        tone({ freq: 1180, endFreq: 1560, dur: 0.075, type: 'sine', vol: 0.035 });
      },
      reward() {
        [0, 4, 7, 12, 16].forEach((semi, i) => {
          tone({ freq: 660 * Math.pow(2, semi / 12), dur: 0.14, type: 'triangle', vol: 0.055, at: i * 0.055 });
        });
      },
      buy() {
        [0, 7, 12, 19].forEach((semi, i) => {
          tone({ freq: 620 * Math.pow(2, semi / 12), dur: 0.14, type: 'sine', vol: 0.065, at: i * 0.05 });
        });
      },
      error() {
        tone({ freq: 180, endFreq: 140, dur: 0.12, type: 'triangle', vol: 0.06 });
      },
      gameover() {
        [72, 67, 64, 60].forEach((n, i) => {
          tone({ freq: midi(n), dur: 0.28, type: 'triangle', vol: 0.065, at: i * 0.12 });
        });
      },
      best() {
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => {
          tone({ freq: midi(n), dur: 0.17, type: 'triangle', vol: 0.06, at: i * 0.065 });
        });
      },
    };
  })();

  /* =========================================================
     DOM references
     ========================================================= */
  const app = $('#app');
  const canvas = $('#gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const homeScreen = $('#homeScreen');
  const pauseScreen = $('#pauseScreen');
  const resultScreen = $('#resultScreen');
  const shopScreen = $('#shopScreen');
  const missionsScreen = $('#missionsScreen');
  const hud = $('#hud');
  const controls = $('#controls');
  const heartsEl = $('#hearts');
  const scoreValueEl = $('#scoreValue');
  const distanceValueEl = $('#distanceValue');
  const coinRunValueEl = $('#coinRunValue');
  const coinRunEl = $('.run-coins');
  const feverFillEl = $('#feverFill');
  const pauseButton = $('#pauseButton');
  const jumpVisual = $('#jumpVisual');
  const slideVisual = $('#slideVisual');
  const announceEl = $('#announce');
  const announceKickerEl = $('#announceKicker');
  const announceTitleEl = $('#announceTitle');
  const toastEl = $('#toast');
  const homeBestEl = $('#homeBest');
  const homeCoinsEl = $('#homeCoins');
  const homeSoundButton = $('#homeSoundButton');
  const shopCoinsEl = $('#shopCoins');
  const missionsCoinsEl = $('#missionsCoins');
  const dailyDotEl = $('#dailyDot');
  const shopListEl = $('#shopList');
  const missionListEl = $('#missionList');
  const playButton = $('#playButton');
  const shopButton = $('#shopButton');
  const missionsButton = $('#missionsButton');
  const resultTitleEl = $('#resultTitle');
  const resultScoreEl = $('#resultScore');
  const resultDistanceEl = $('#resultDistance');
  const resultSweetsEl = $('#resultSweets');
  const resultCoinsEl = $('#resultCoins');
  const resultComboEl = $('#resultCombo');
  const resultDailyEl = $('#resultDaily');
  const newBestEl = $('#newBest');
  const retryButton = $('#retryButton');
  const resultHomeButton = $('#resultHomeButton');
  const resumeButton = $('#resumeButton');
  const pauseHomeButton = $('#pauseHomeButton');
  const pauseSoundButton = $('#pauseSoundButton');
  const pauseSoundLabel = $('.pause-sound-label');

  /* =========================================================
     Canvas / viewport state
     ========================================================= */
  let W = 390;
  let H = 844;
  let DPR = 1;
  let baseDpr = 1;
  let renderQuality = 1;
  let qualitySampleStart = 0;
  let qualityFrames = 0;
  const QUALITY_MIN = 0.62;
  let S = 1;
  let groundY = 640;
  let homeGroundY = 535;
  let runX = 92;
  let clock = 0;
  let lastFrame = now();
  let resizeRaf = 0;
  let mode = 'home';

  const thumbnails = {};

  const stars = Array.from({ length: 32 }, (_, i) => ({
    x: hash(i * 5.13 + 2.1),
    y: hash(i * 9.73 + 8.4) * 0.48,
    size: 0.7 + hash(i * 2.71) * 1.8,
    phase: hash(i * 6.17) * TAU,
    bright: 0.35 + hash(i * 3.91) * 0.65,
  }));

  const speedLines = Array.from({ length: 20 }, (_, i) => ({
    x: hash(i * 3.1 + 4.2) * 1000,
    y: hash(i * 8.8 + 2.3),
    len: 18 + hash(i * 5.4) * 60,
    speed: 0.7 + hash(i * 7.9) * 1.1,
    alpha: 0.05 + hash(i * 4.2) * 0.1,
  }));

  /* =========================================================
     Game state
     ========================================================= */
  const FEVER_MAX = 100;
  const FEVER_DURATION = 7.5;
  const BASE_JUMP = 1030;
  const BASE_GRAVITY = 3400;

  const game = {
    speed: 300,
    camX: 0,
    distanceM: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    comboTimerMax: 2.25,
    maxCombo: 0,
    comboPulse: 0,
    hearts: 3,
    fever: 0,
    feverActive: false,
    feverTime: 0,
    feverFx: 0,
    runCoins: 0,
    sweets: 0,
    fevers: 0,
    stage: 0,
    spawnObstacle: 2.4,
    spawnCandy: 0.55,
    nextGold: 9,
    nextHeart: 20,
    time: 0,
    hitstop: 0,
    shake: 0,
    flash: 0,
    flashColor: '#ffffff',
    deathTimer: 0,
    deathEndsAt: 0,
    deathAngle: 0,
    runCommitted: false,
    newBest: false,
    resultScoreTarget: 0,
    tutorialPulse: false,
    intro: 0,
  };

  const player = {
    x: runX,
    y: groundY,
    vy: 0,
    onGround: true,
    jumps: 0,
    jumpBuffer: 0,
    sliding: false,
    slideTimer: 0,
    slideQueued: false,
    fastFall: false,
    runPhase: 0,
    invincible: 0,
    hurtTimer: 0,
    landSquash: 0,
    spinTimer: 0,
    spinDir: 1,
    dead: false,
    deadAngle: 0,
    blinkTimer: 2.5,
    blink: 0,
    blinkCd: 2.7,
    footstep: 0,
  };

  let obstacles = [];
  let candies = [];
  let particles = [];
  let floaters = [];
  let rings = [];

  let activeSheet = null;
  let toastTimer = 0;
  let announceTimer = 0;
  let resultNumberRaf = 0;
  let lastHeartsRendered = -1;

  /* =========================================================
     Resize
     ========================================================= */
  function resizeCanvas() {
    const rect = app.getBoundingClientRect();
    const oldGround = groundY;
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(480, Math.round(rect.height));
    baseDpr = Math.min(window.devicePixelRatio || 1, 2);
    // Keep the canvas lighter on devices that struggle. Crisp by default, never below 1x.
    DPR = Math.max(1, baseDpr * renderQuality);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = clamp(W / 390, 0.8, 1.34);
    groundY = Math.round(H * 0.765);
    homeGroundY = Math.round(H * (H < 720 ? 0.59 : 0.635));
    runX = Math.round(W * 0.235);
    player.x = runX;
    if (mode === 'home') {
      player.y = homeGroundY;
    } else if (player.onGround) {
      player.y = groundY;
    } else {
      player.y += groundY - oldGround;
    }
    if (mode !== 'playing') player.x = mode === 'home' ? W / 2 : player.x;
    render();
  }

  function scheduleResize() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resizeCanvas();
    });
  }

  /* =========================================================
     Character drawing
     ========================================================= */
  function drawPurin(c, x, y, scale, opt = {}) {
    const skin = opt.skin || selectedSkin();
    const p = skin.colors;
    const pose = opt.pose || 'idle';
    const phase = opt.phase || 0;
    const time = opt.time === undefined ? clock : opt.time;
    const bob = pose === 'run'
      ? Math.abs(Math.sin(phase * 2)) * 2.2
      : pose === 'idle'
        ? Math.sin(time * 2.4) * 1.8
        : 0;
    const slide = pose === 'slide';
    const tilt = opt.tilt || 0;
    const sx = opt.sx || 1;
    const sy = opt.sy || 1;

    c.save();
    c.translate(x, y);
    if (opt.rotate) c.rotate(opt.rotate);
    c.rotate(tilt);
    c.scale(scale * sx, scale * sy);
    if (slide) {
      c.translate(2, 0);
      c.rotate(-0.035);
      c.scale(1.22, 0.54);
    }

    // Feet stay planted while the pudding body bobs.
    const swing = Math.sin(phase);
    let footL = 0;
    let footR = 0;
    if (pose === 'run') {
      footL = Math.max(0, swing) * 6;
      footR = Math.max(0, -swing) * 6;
    }
    drawFoot(c, -16 + swing * 2, -3 - footL, -0.08 + swing * 0.08, p);
    drawFoot(c, 14 - swing * 2, -3 - footR, 0.08 - swing * 0.08, p);

    c.save();
    c.translate(0, -bob);

    // Back arm
    const armSwing = pose === 'run' ? swing * 0.65 : 0;
    drawArm(c, -27, -42, 0.45 + armSwing, p, true);
    if (opt.waving) {
      drawArm(c, 27, -43, -1.12 + Math.sin(time * 3.1) * 0.18, p, false);
    }

    // Pudding body
    c.beginPath();
    c.moveTo(-25, -70);
    c.bezierCurveTo(-34, -59, -34, -28, -31, -15);
    c.bezierCurveTo(-26, -6, 26, -6, 31, -15);
    c.bezierCurveTo(34, -29, 34, -58, 25, -70);
    c.bezierCurveTo(15, -77, -15, -77, -25, -70);
    c.closePath();

    const bodyGrad = c.createLinearGradient(0, -78, 0, -7);
    bodyGrad.addColorStop(0, p.bodyLight);
    bodyGrad.addColorStop(0.52, p.body);
    bodyGrad.addColorStop(1, p.bodyDark);
    c.fillStyle = bodyGrad;
    c.fill();
    c.lineWidth = 4.4;
    c.strokeStyle = p.outline;
    c.lineJoin = 'round';
    c.stroke();

    // Soft bottom edge
    c.beginPath();
    c.ellipse(0, -12, 27, 6, 0, 0.15, Math.PI - 0.15);
    c.fillStyle = rgba(p.bodyDark, 0.32);
    c.fill();

    // Highlight
    c.save();
    c.translate(-14, -57);
    c.rotate(-0.32);
    c.beginPath();
    c.ellipse(0, 0, 8, 15, 0, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.43)';
    c.fill();
    c.restore();

    // Caramel cap with drips
    c.beginPath();
    c.moveTo(-25, -70);
    c.bezierCurveTo(-12, -78, 14, -78, 25, -70);
    c.bezierCurveTo(30, -66, 31, -61, 27, -57);
    c.bezierCurveTo(25, -49, 21, -50, 19, -57);
    c.bezierCurveTo(15, -48, 10, -50, 8, -57);
    c.bezierCurveTo(5, -47, 0, -48, -2, -57);
    c.bezierCurveTo(-5, -47, -11, -49, -13, -57);
    c.bezierCurveTo(-17, -49, -22, -51, -24, -57);
    c.bezierCurveTo(-29, -61, -30, -66, -25, -70);
    c.closePath();
    const caramelGrad = c.createLinearGradient(0, -78, 0, -47);
    caramelGrad.addColorStop(0, p.caramelLight);
    caramelGrad.addColorStop(0.58, p.caramel);
    caramelGrad.addColorStop(1, p.caramelDark);
    c.fillStyle = caramelGrad;
    c.fill();
    c.lineWidth = 4.1;
    c.strokeStyle = p.outline;
    c.stroke();

    // Caramel shine
    c.save();
    c.translate(-10, -69);
    c.rotate(-0.25);
    c.beginPath();
    c.ellipse(0, 0, 12, 4, 0, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fill();
    c.restore();

    drawAccent(c, skin, time);

    // Face
    drawFace(c, p, pose, opt, time);

    // Front arm
    if (!opt.waving) {
      drawArm(c, 27, -42, -0.45 - armSwing, p, false);
    }

    c.restore();
    c.restore();
  }

  function drawFoot(c, x, y, rotation, p) {
    c.save();
    c.translate(x, y);
    c.rotate(rotation);
    c.beginPath();
    c.ellipse(0, 0, 8.2, 5.7, 0, 0, TAU);
    c.fillStyle = p.foot;
    c.fill();
    c.lineWidth = 3.2;
    c.strokeStyle = p.outline;
    c.stroke();
    c.beginPath();
    c.ellipse(-2, -1.3, 2.6, 1.5, -0.3, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.fill();
    c.restore();
  }

  function drawArm(c, x, y, angle, p, back) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    roundRectPath(c, -5, 0, 10, 23, 5);
    c.fillStyle = p.body;
    c.fill();
    c.lineWidth = 3.4;
    c.strokeStyle = p.outline;
    c.stroke();
    c.beginPath();
    c.arc(0, 20, 6.1, 0, TAU);
    c.fillStyle = p.bodyLight;
    c.fill();
    c.stroke();
    if (!back) {
      c.beginPath();
      c.arc(-1.8, 18, 2, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fill();
    }
    c.restore();
  }

  function drawFace(c, p, pose, opt, time) {
    const hurt = opt.hurt;
    const blink = opt.blink;
    const happy = opt.happy || pose === 'slide';
    const eyeY = -38;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    if (hurt) {
      c.strokeStyle = p.outline;
      c.lineWidth = 2.5;
      for (const ex of [-11, 11]) {
        c.beginPath();
        c.moveTo(ex - 3.5, eyeY - 3.5);
        c.lineTo(ex + 3.5, eyeY + 3.5);
        c.moveTo(ex + 3.5, eyeY - 3.5);
        c.lineTo(ex - 3.5, eyeY + 3.5);
        c.stroke();
      }
    } else if (blink || happy) {
      c.strokeStyle = p.outline;
      c.lineWidth = 2.7;
      for (const ex of [-11, 11]) {
        c.beginPath();
        c.arc(ex, eyeY, 4.1, 0.15, Math.PI - 0.15);
        c.stroke();
      }
    } else {
      for (const ex of [-11, 11]) {
        c.beginPath();
        c.ellipse(ex, eyeY, 3.5, 4.9, 0, 0, TAU);
        c.fillStyle = p.outline;
        c.fill();
        c.beginPath();
        c.ellipse(ex - 1.2, eyeY - 1.7, 1.25, 1.55, -0.2, 0, TAU);
        c.fillStyle = 'rgba(255,255,255,0.86)';
        c.fill();
      }
    }

    // Blush
    c.globalAlpha = 0.58;
    c.fillStyle = p.cheek;
    c.beginPath();
    c.ellipse(-19.5, -28.5, 4.8, 2.8, -0.1, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(19.5, -28.5, 4.8, 2.8, 0.1, 0, TAU);
    c.fill();
    c.globalAlpha = 1;

    // Mouth
    c.strokeStyle = p.outline;
    c.fillStyle = p.outline;
    c.lineWidth = 2.1;
    if (hurt) {
      c.beginPath();
      c.ellipse(0, -27, 2.7, 3.4, 0, 0, TAU);
      c.stroke();
    } else if (happy || opt.happy) {
      c.beginPath();
      c.arc(0, -29.5, 5.2, 0.15, Math.PI - 0.15);
      c.stroke();
      c.beginPath();
      c.ellipse(0, -25.7, 3.4, 2.1, 0, 0, Math.PI);
      c.fillStyle = p.cheek;
      c.fill();
    } else {
      c.beginPath();
      c.arc(-2.7, -28.5, 2.7, 0.05, Math.PI - 0.05);
      c.arc(2.7, -28.5, 2.7, 0.05, Math.PI - 0.05);
      c.stroke();
    }
  }

  function drawAccent(c, skin, time) {
    const p = skin.colors;
    c.save();
    c.translate(8, -78);
    c.rotate(-0.12 + Math.sin(time * 2.2) * 0.04);

    if (skin.garnish === 'cherry') {
      c.strokeStyle = p.leaf;
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, -2);
      c.bezierCurveTo(1, -9, -1, -13, 0, -18);
      c.stroke();
      c.save();
      c.translate(-3, -13);
      c.rotate(-0.65);
      c.beginPath();
      c.ellipse(0, 0, 6.4, 3, 0, 0, TAU);
      c.fillStyle = p.leaf;
      c.fill();
      c.lineWidth = 1.3;
      c.strokeStyle = p.outline;
      c.stroke();
      c.restore();
      c.beginPath();
      c.arc(0, 0, 7.2, 0, TAU);
      c.fillStyle = p.accent;
      c.fill();
      c.lineWidth = 3.2;
      c.strokeStyle = p.outline;
      c.stroke();
      c.beginPath();
      c.arc(-2.2, -2.4, 1.7, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.fill();
    } else if (skin.garnish === 'mint') {
      c.strokeStyle = p.leaf;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 3);
      c.quadraticCurveTo(-1, -9, 5, -16);
      c.stroke();
      for (const leaf of [
        { x: -2, y: -8, r: -0.7, s: 1 },
        { x: 4, y: -12, r: 0.4, s: 0.85 },
        { x: -4, y: -3, r: -1.1, s: 0.7 },
      ]) {
        c.save();
        c.translate(leaf.x, leaf.y);
        c.rotate(leaf.r);
        c.scale(leaf.s, leaf.s);
        c.beginPath();
        c.ellipse(-4, 0, 7.4, 3.6, 0, 0, TAU);
        c.fillStyle = p.leaf;
        c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = p.outline;
        c.stroke();
        c.beginPath();
        c.moveTo(-9, 0);
        c.lineTo(1, 0);
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 0.9;
        c.stroke();
        c.restore();
      }
      c.beginPath();
      c.arc(8, -2, 5, 0, TAU);
      c.fillStyle = '#FFFDF4';
      c.fill();
      c.lineWidth = 2.4;
      c.strokeStyle = p.outline;
      c.stroke();
    } else if (skin.garnish === 'strawberry') {
      c.strokeStyle = p.leaf;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -5);
      c.lineTo(0, -12);
      c.stroke();
      c.beginPath();
      c.moveTo(0, -3);
      c.bezierCurveTo(-9, -3, -9, 9, 0, 12);
      c.bezierCurveTo(9, 9, 9, -3, 0, -3);
      c.closePath();
      c.fillStyle = p.accent;
      c.fill();
      c.lineWidth = 2.8;
      c.strokeStyle = p.outline;
      c.stroke();
      c.fillStyle = '#FFE4A4';
      for (const seed of [[-3, 2], [3, 2], [-2, 6], [2, 6]]) {
        c.beginPath();
        c.ellipse(seed[0], seed[1], 0.8, 1.3, 0, 0, TAU);
        c.fill();
      }
      starPath(c, 0, -6, 4.4, 1.9, 5, -Math.PI / 2);
      c.fillStyle = p.leaf;
      c.fill();
      c.lineWidth = 1.2;
      c.strokeStyle = p.outline;
      c.stroke();
    } else {
      // Chocolate square with a cream puff
      c.save();
      c.rotate(0.18);
      roundRectPath(c, -7, -6, 14, 14, 3);
      c.fillStyle = p.caramelDark;
      c.fill();
      c.lineWidth = 2.5;
      c.strokeStyle = p.outline;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-5, 1);
      c.lineTo(5, 1);
      c.moveTo(0, -4);
      c.lineTo(0, 6);
      c.stroke();
      c.restore();
      c.beginPath();
      c.arc(7, -5, 4.8, 0, TAU);
      c.fillStyle = '#FFF8E7';
      c.fill();
      c.lineWidth = 2.2;
      c.strokeStyle = p.outline;
      c.stroke();
    }
    c.restore();
  }

  function makeCharacterThumb(skin) {
    const cv = document.createElement('canvas');
    cv.width = 192;
    cv.height = 192;
    const g = cv.getContext('2d');
    drawPurin(g, 96, 172, 1.48, { skin, pose: 'idle', phase: 1.2, time: 0.6, blink: false });
    return cv.toDataURL('image/png');
  }

  function buildThumbnails() {
    for (const skin of SKINS) {
      thumbnails[skin.id] = makeCharacterThumb(skin);
    }
  }

  /* =========================================================
     Background drawing
     ========================================================= */
  function drawBackground() {
    const p = currentPalette;
    const sky = ctx.createLinearGradient(0, 0, 0, groundY + 40);
    sky.addColorStop(0, rgba(p.skyTop));
    sky.addColorStop(0.62, rgba(p.skyMid));
    sky.addColorStop(1, rgba(p.skyBottom));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY + 48);

    drawSunMoon();
    drawRainbow();
    drawStars();
    drawSkySparkles();
    drawClouds();
    drawLowClouds();
    drawSkyIslands();
    drawBalloon();
    drawHills();
    drawDecorations(0.16, 250, 0.58, 0.44);
    drawDecorations(0.32, 235, 0.7, 0.62);
    drawGround(mode === 'home' ? homeGroundY : groundY);
  }

  function drawSunMoon() {
    const p = currentPalette;
    const night = clamp(p.night, 0, 1);
    const sx = W * 0.78;
    const sy = H * 0.185;

    if (night < 0.985) {
      ctx.save();
      ctx.globalAlpha = 1 - night;
      const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 112 * S);
      glow.addColorStop(0, rgba(p.sunGlow, 0.58));
      glow.addColorStop(0.42, rgba(p.sunGlow, 0.22));
      glow.addColorStop(1, rgba(p.sunGlow, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 112 * S, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(clock * 0.018);
      ctx.strokeStyle = rgba(p.sun, 0.38);
      ctx.lineWidth = 3.4 * S;
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const inner = (42 + (i % 2) * 3) * S;
        const outer = (54 + (i % 2) * 7) * S;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(sx, sy, 31 * S, 0, TAU);
      ctx.fillStyle = rgba(p.sun);
      ctx.fill();
      ctx.globalAlpha = (1 - night) * 0.36;
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 2 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(sx - 9 * S, sy - 1 * S, 2.1 * S, 0.2, Math.PI - 0.2);
      ctx.arc(sx + 9 * S, sy - 1 * S, 2.1 * S, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy + 4 * S, 6 * S, 0.25, Math.PI - 0.25);
      ctx.stroke();
      ctx.restore();
    }

    if (night > 0.015) {
      ctx.save();
      ctx.globalAlpha = night;
      const glow = ctx.createRadialGradient(sx, sy, 3, sx, sy, 98 * S);
      glow.addColorStop(0, rgba(p.sunGlow, 0.32));
      glow.addColorStop(1, rgba(p.sunGlow, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 98 * S, 0, TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx, sy, 28 * S, 0, TAU);
      ctx.fillStyle = '#FFF3C7';
      ctx.fill();
      ctx.globalAlpha = night * 0.3;
      ctx.fillStyle = '#D4C3A0';
      for (const crater of [[-8, -7, 6], [7, 3, 8], [-2, 11, 4], [12, -9, 3]]) {
        ctx.beginPath();
        ctx.arc(sx + crater[0] * S, sy + crater[1] * S, crater[2] * S, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = night * 0.4;
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 1.7 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(sx - 8 * S, sy - 2 * S, 3.3 * S, 0.2, Math.PI - 0.2);
      ctx.arc(sx + 8 * S, sy - 2 * S, 3.3 * S, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy + 5 * S, 4 * S, 0.15, Math.PI - 0.15);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawStars() {
    const night = clamp(currentPalette.night, 0, 1);
    if (night < 0.02) return;
    ctx.save();
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const twinkle = 0.62 + Math.sin(clock * (1.2 + st.phase * 0.08) + st.phase) * 0.38;
      const alpha = night * st.bright * twinkle;
      const x = st.x * W;
      const y = st.y * groundY;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFF6D9';
      if (i % 6 === 0) {
        const r = st.size * 2.8 * S;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.28, y - r * 0.28);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x + r * 0.28, y + r * 0.28);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.28, y + r * 0.28);
        ctx.lineTo(x - r, y);
        ctx.lineTo(x - r * 0.28, y - r * 0.28);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, st.size * S, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRainbow() {
    const p = currentPalette;
    const night = clamp(p.night, 0, 1);
    const fade = 1 - night;
    if (fade < 0.06) return;

    const cx = W * 0.46;
    const cy = groundY + 34 * S;
    const r = Math.min(H * 0.46, W * 1.02);
    const bands = ['#FFB2C8', '#FFD0A2', '#FFF0A8', '#C3F1D8', '#BEE0FF', '#D6C4FF'];

    ctx.save();
    ctx.lineCap = 'butt';
    for (let i = 0; i < bands.length; i++) {
      const rr = r - i * 14 * S;
      if (rr < 30 * S) break;
      ctx.globalAlpha = (0.09 + (i % 2) * 0.015) * fade;
      ctx.strokeStyle = bands[i];
      ctx.lineWidth = 15 * S;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.PI * 1.035, Math.PI * 1.965);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSkySparkles() {
    const p = currentPalette;
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const drift = (game.camX * 0.012 + i * 97) % (W + 60);
      const x = drift - 30 + Math.sin(clock * 0.16 + i * 1.8) * 9 * S;
      const y = H * (0.135 + hash(i * 5.93 + 2.4) * 0.45);
      const twinkle = 0.5 + Math.sin(clock * (0.9 + hash(i * 2.1) * 0.7) + i * 2.3) * 0.5;
      const size = (1.5 + hash(i * 7.7) * 2.4) * S;
      ctx.globalAlpha = (0.12 + twinkle * 0.24) * (1 - clamp(p.night, 0, 1) * 0.55);
      ctx.fillStyle = rgba(p.cloud);
      starPath(ctx, x, y, size, size * 0.4, 4, clock * 0.1 + i);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLowClouds() {
    const p = currentPalette;
    const spacing = W * 0.94;
    const scroll = game.camX * 0.032;
    const start = Math.floor(scroll / spacing) - 1;
    for (let i = start; i < start + 4; i++) {
      const seed = hash(i * 8.7 + 4.3);
      const x = i * spacing - scroll + seed * W * 0.45;
      const y = H * (0.28 + hash(i * 3.9 + 7.1) * 0.15) + Math.sin(clock * 0.22 + i * 1.9) * 2.5 * S;
      const s = (0.3 + seed * 0.3) * S;
      ctx.globalAlpha = 0.24 + seed * 0.16;
      drawCloud(x, y, s, p.cloud, p.cloudShade);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatingIsland(x, y, s, seed) {
    const p = currentPalette;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Haze so the island sits deep in the sky.
    const haze = ctx.createRadialGradient(0, 2, 8, 0, 2, 92);
    haze.addColorStop(0, rgba(p.cloud, 0.18));
    haze.addColorStop(1, rgba(p.cloud, 0));
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(0, 2, 92, 0, TAU);
    ctx.fill();

    // Tiny cloud shelf behind the island.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = rgba(p.cloud, 0.84);
    for (const puff of [[-52, 9, 15], [-35, 2, 20], [-14, 8, 13], [43, 8, 14], [27, 1, 18]]) {
      ctx.beginPath();
      ctx.arc(puff[0], puff[1], puff[2], 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Wafer underside.
    ctx.beginPath();
    ctx.moveTo(-55, -2);
    ctx.bezierCurveTo(-51, 22, -31, 42, -6, 57);
    ctx.bezierCurveTo(7, 51, 29, 35, 45, 14);
    ctx.bezierCurveTo(50, 8, 54, 3, 57, -2);
    ctx.closePath();
    ctx.fillStyle = rgba(p.hillFar, 0.94);
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.22);
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Wafer layers.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-55, -2);
    ctx.bezierCurveTo(-51, 22, -31, 42, -6, 57);
    ctx.bezierCurveTo(7, 51, 29, 35, 45, 14);
    ctx.bezierCurveTo(50, 8, 54, 3, 57, -2);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = rgba(p.pathTop, 0.28);
    ctx.lineWidth = 3;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, i * 14, 60 - i * 6, 8, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    ctx.restore();

    // Frosting cap.
    ctx.beginPath();
    ctx.ellipse(0, -3, 57, 15, 0, 0, TAU);
    ctx.fillStyle = rgba(p.pathTop, 0.98);
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.25);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = rgba(p.pathTop, 0.98);
    const drips = [[-44, 9, 8], [-28, 12, 7], [-9, 10, 8], [10, 13, 6], [30, 11, 7], [45, 8, 6]];
    for (const d of drips) {
      ctx.beginPath();
      ctx.arc(d[0], d[1], d[2], 0, TAU);
      ctx.fill();
    }

    // Sugar trees & tiny sweets.
    drawIslandLollipop(19, -4, 1.05, p);
    drawIslandLollipop(-27, -3, 0.78, p);
    ctx.fillStyle = rgba(p.decor3, 0.95);
    ctx.beginPath();
    ctx.arc(44, -10, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(p.accent, 0.9);
    ctx.beginPath();
    ctx.ellipse(2, -14, 8, 4, 0.2, 0, TAU);
    ctx.fill();

    // Hanging sugar drops.
    for (const d of [[-15, 61], [11, 54]]) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = rgba(p.pathTop);
      ctx.beginPath();
      ctx.arc(d[0], d[1], 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawIslandLollipop(x, y, size, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.strokeStyle = rgba(p.outline, 0.52);
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -24);
    ctx.stroke();
    ctx.strokeStyle = rgba(p.cloud, 0.72);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -34, 13, 0, TAU);
    ctx.fillStyle = rgba(p.decor1, 0.92);
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.3);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.strokeStyle = rgba(p.cloud, 0.78);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -34, 6, -0.4, 3.8);
    ctx.stroke();
    ctx.restore();
  }

  function drawSkyIslands() {
    const stage = game.stage;
    const spacing = W * 0.78;
    const scroll = game.camX * 0.085;
    const start = Math.floor(scroll / spacing) - 1;
    const count = Math.ceil(W / spacing) + 3;
    for (let i = start; i < start + count; i++) {
      const seed = hash(i * 6.13 + stage * 17.7);
      const x = i * spacing - scroll + hash(i * 3.4 + 6.8) * spacing * 0.36;
      if (x < -100 || x > W + 100) continue;
      const y = H * (0.275 + hash(i * 5.7 + 1.9) * 0.135) + Math.sin(clock * 0.55 + i * 2.2) * 4 * S;
      const s = (0.54 + seed * 0.3) * S;
      ctx.save();
      ctx.globalAlpha = 0.76;
      drawFloatingIsland(x, y, s, seed);
      ctx.restore();
    }
  }

  function drawBalloon() {
    const p = currentPalette;
    const spacing = W * 1.75;
    const scroll = game.camX * 0.045;
    const start = Math.floor(scroll / spacing) - 1;
    for (let i = start; i < start + 3; i++) {
      const x = i * spacing - scroll + W * 0.24;
      if (x < -90 || x > W + 90) continue;
      const seed = hash(i * 9.7 + 3.1);
      const y = H * (0.235 + seed * 0.075) + Math.sin(clock * 0.4 + i * 1.7) * 5 * S;
      const s = (0.62 + seed * 0.22) * S;
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.translate(x, y);
      ctx.scale(s, s);

      // Balloon envelope.
      ctx.beginPath();
      ctx.moveTo(0, -44);
      ctx.bezierCurveTo(-26, -43, -34, -21, -25, -2);
      ctx.bezierCurveTo(-19, 10, -8, 17, 0, 20);
      ctx.bezierCurveTo(8, 17, 19, 10, 25, -2);
      ctx.bezierCurveTo(34, -21, 26, -43, 0, -44);
      ctx.closePath();
      ctx.fillStyle = rgba(p.decor1, 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(p.outline, 0.34);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.clip();
      ctx.fillStyle = rgba(p.cloud, 0.55);
      ctx.fillRect(-8, -48, 16, 72);
      ctx.fillStyle = rgba(p.decor3, 0.7);
      ctx.fillRect(-27, -56, 10, 84);
      ctx.fillRect(17, -56, 10, 84);
      ctx.restore();

      // Basket & ropes.
      ctx.strokeStyle = rgba(p.outline, 0.55);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-16, 15);
      ctx.lineTo(-7, 29);
      ctx.moveTo(16, 15);
      ctx.lineTo(7, 29);
      ctx.stroke();
      roundRectPath(ctx, -9, 27, 18, 11, 3);
      ctx.fillStyle = rgba(p.decor1, 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(p.outline, 0.4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCloud(x, y, s, fill, shade) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(fill, 0.92);
    ctx.beginPath();
    ctx.arc(-30, 4, 17, 0, TAU);
    ctx.arc(-12, -7, 22, 0, TAU);
    ctx.arc(12, -6, 25, 0, TAU);
    ctx.arc(33, 5, 16, 0, TAU);
    ctx.arc(0, 10, 25, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = rgba(shade);
    ctx.beginPath();
    ctx.ellipse(4, 14, 36, 8, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-1, -10, 14, Math.PI * 1.08, Math.PI * 1.68);
    ctx.stroke();
    ctx.restore();
  }

  function drawClouds() {
    const p = currentPalette;
    const spacing = W * 0.68;
    const scroll = game.camX * 0.055;
    const start = Math.floor(scroll / spacing) - 2;
    for (let i = start; i < start + 7; i++) {
      const x = i * spacing - scroll + hash(i * 8.1 + 3.7) * W * 0.25;
      const y = H * (0.08 + hash(i * 4.3 + 2.2) * 0.19);
      const s = (0.56 + hash(i * 2.1 + 8.8) * 0.48) * S;
      ctx.globalAlpha = 0.72 + hash(i * 1.7) * 0.22;
      drawCloud(x, y, s, p.cloud, p.cloudShade);
    }
    ctx.globalAlpha = 1;
  }

  function hillY(x, scroll, base, amp, freq) {
    const wx = x + scroll;
    return base - (Math.sin(wx * freq) * 0.55 + Math.sin(wx * freq * 2.17 + 1.4) * 0.22 + 0.75) * amp;
  }

  function drawHillLayer(parallax, base, amp, freq, color, edge) {
    const scroll = game.camX * parallax;
    ctx.beginPath();
    ctx.moveTo(-20, groundY + 30);
    for (let x = -20; x <= W + 24; x += 14) {
      ctx.lineTo(x, hillY(x, scroll, groundY - base * S, amp * S, freq));
    }
    ctx.lineTo(W + 24, groundY + 30);
    ctx.closePath();
    ctx.fillStyle = rgba(color);
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = rgba(edge, 0.2);
      ctx.lineWidth = 2.2 * S;
      ctx.stroke();
    }
  }

  function drawHills() {
    const p = currentPalette;
    drawHillLayer(0.08, 64, 54, 0.0058, p.hillFar, p.skyBottom);
    drawHillLayer(0.17, 20, 38, 0.0084, p.hillNear, p.pathTop);

    // Sprinkles nestled on the near hills
    const scroll = game.camX * 0.17;
    ctx.save();
    ctx.globalAlpha = 0.42;
    for (let i = -2; i < 18; i++) {
      const x = i * 67 - (scroll % 67);
      const y = hillY(x, scroll, groundY - 20 * S, 38 * S, 0.0084) + 13 * S;
      if (y > groundY - 5) continue;
      const seed = hash(i * 8.8 + 6.2);
      ctx.fillStyle = i % 3 === 0 ? rgba(p.accent) : i % 3 === 1 ? rgba(p.decor3) : rgba(p.cloud);
      ctx.beginPath();
      ctx.arc(x + seed * 14, y, (1.4 + seed * 1.2) * S, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  const DECOR_TYPES = [
    ['lollipop', 'macaron', 'candyTree', 'cupcake'],
    ['candyTree', 'cane', 'mushroom', 'lollipop'],
    ['cupcake', 'lollipop', 'cane', 'macaron'],
    ['mushroom', 'starLamp', 'candyTree', 'cane'],
  ];

  function drawDecorations(parallax, spacing, size, alpha) {
    const stage = game.stage || 0;
    const types = DECOR_TYPES[stage] || DECOR_TYPES[0];
    const scroll = game.camX * parallax;
    const scaledSpacing = spacing * S;
    const start = Math.floor(scroll / scaledSpacing) - 2;
    const count = Math.ceil(W / scaledSpacing) + 4;
    for (let i = start; i < start + count; i++) {
      const seed = hash(i * 6.73 + stage * 31.7);
      const x = i * scaledSpacing - scroll + hash(i * 2.37 + 4.1) * scaledSpacing * 0.42;
      if (x < -180 * S || x > W + 180 * S) continue;
      const scale = size * S * (0.82 + seed * 0.4);
      const type = types[(hash(i * 4.91 + stage * 9.3) * types.length) | 0];
      ctx.save();
      ctx.globalAlpha = alpha;
      drawDecor(type, x, groundY + 6 * S, scale, i + stage * 100);
      ctx.restore();
    }
  }

  function drawDecor(type, x, y, s, seed) {
    const p = currentPalette;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (type === 'lollipop') {
      const lean = (hash(seed * 1.3) - 0.5) * 0.16;
      ctx.rotate(lean);
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -70);
      ctx.stroke();
      ctx.strokeStyle = rgba(p.pathTop);
      ctx.lineWidth = 4;
      ctx.stroke();

      const r = 28;
      ctx.beginPath();
      ctx.arc(0, -96, r, 0, TAU);
      ctx.fillStyle = rgba(p.decor2);
      ctx.fill();
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 3.4;
      ctx.stroke();

      ctx.save();
      ctx.translate(0, -96);
      ctx.strokeStyle = rgba(p.pathTop, 0.92);
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      const turns = 2.25;
      const steps = 70;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * TAU * turns;
        const rr = 3 + t * 19;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-10, -105, 6, 3.5, -0.5, 0, TAU);
      ctx.fill();
    } else if (type === 'candyTree') {
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -46);
      ctx.stroke();
      ctx.strokeStyle = rgba(p.caramel || p.decor1, 1);
      ctx.lineWidth = 5;
      ctx.stroke();

      const blobs = [
        [-23, -63, 24, p.decor2],
        [20, -66, 25, p.decor1],
        [-1, -90, 29, p.decor2],
        [4, -62, 23, p.pathTop],
      ];
      for (const b of blobs) {
        ctx.beginPath();
        ctx.arc(b[0], b[1], b[2], 0, TAU);
        ctx.fillStyle = rgba(b[3]);
        ctx.fill();
        ctx.strokeStyle = rgba(p.outline, 0.9);
        ctx.lineWidth = 2.8;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (const dot of [[-12, -78], [14, -85], [26, -59], [-26, -56]]) {
        ctx.beginPath();
        ctx.arc(dot[0], dot[1], 2.4, 0, TAU);
        ctx.fill();
      }
    } else if (type === 'macaron') {
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 3;
      const shells = [
        { y: -20, w: 31, color: p.decor3 },
        { y: -52, w: 26, color: p.decor1 },
      ];
      for (const shell of shells) {
        ctx.beginPath();
        ctx.ellipse(0, shell.y, shell.w, 15, 0, Math.PI, TAU);
        ctx.fillStyle = rgba(shell.color);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, shell.y + 6, shell.w - 2, 7, 0, 0, Math.PI);
        ctx.fillStyle = rgba(p.pathTop);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0, -25, 30, 5, 0, 0, TAU);
      ctx.fillStyle = rgba(p.pathTop);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-11, -38, 4, 2.2, -0.2, 0, TAU);
      ctx.fill();
    } else if (type === 'cupcake') {
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-25, -2);
      ctx.lineTo(-19, -48);
      ctx.quadraticCurveTo(0, -42, 20, -48);
      ctx.lineTo(26, -2);
      ctx.closePath();
      ctx.fillStyle = rgba(p.decor1);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 2;
      for (let i = -14; i <= 14; i += 9) {
        ctx.beginPath();
        ctx.moveTo(i - 2, -44);
        ctx.lineTo(i - 5, -7);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-27, -48);
      ctx.bezierCurveTo(-38, -55, -34, -72, -18, -70);
      ctx.bezierCurveTo(-16, -86, 10, -90, 16, -74);
      ctx.bezierCurveTo(34, -78, 40, -58, 28, -48);
      ctx.quadraticCurveTo(2, -40, -27, -48);
      ctx.closePath();
      ctx.fillStyle = rgba(p.pathTop);
      ctx.fill();
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 3.1;
      ctx.stroke();
      starPath(ctx, 4, -84, 11, 5, 5, -Math.PI / 2);
      ctx.fillStyle = rgba(p.decor3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(-10, -63, 5.5, 3, -0.4, 0, TAU);
      ctx.fill();
    } else if (type === 'cane') {
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.quadraticCurveTo(-6, -56, 7, -82);
      ctx.quadraticCurveTo(18, -103, 38, -93);
      ctx.quadraticCurveTo(52, -84, 42, -68);
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 17;
      ctx.stroke();
      ctx.strokeStyle = rgba(p.pathTop);
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = rgba(p.accent);
      ctx.lineWidth = 11;
      ctx.setLineDash([9, 13]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath();
      ctx.arc(0, -75, 2.5, 0, TAU);
      ctx.fill();
    } else if (type === 'mushroom') {
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRectPath(ctx, -8, -38, 16, 37, 7);
      ctx.fillStyle = rgba(p.pathTop);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -46, 29, 22, 0, Math.PI, TAU);
      ctx.fillStyle = rgba(p.decor2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -45, 32, 5, 0, 0, Math.PI);
      ctx.fillStyle = rgba(p.decor1);
      ctx.fill();
      ctx.stroke();
      for (const dot of [[-13, -52], [8, -57], [18, -47]]) {
        ctx.beginPath();
        ctx.arc(dot[0], dot[1], 3.2, 0, TAU);
        ctx.fillStyle = rgba(p.pathTop);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(0, -48, 2, 0, -48, 38);
      glow.addColorStop(0, rgba(p.decor3, 0.16));
      glow.addColorStop(1, rgba(p.decor3, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -48, 38, 0, TAU);
      ctx.fill();
    } else if (type === 'starLamp') {
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -65);
      ctx.stroke();
      const glow = ctx.createRadialGradient(0, -86, 2, 0, -86, 42);
      glow.addColorStop(0, rgba(p.decor3, 0.3));
      glow.addColorStop(1, rgba(p.decor3, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -86, 42, 0, TAU);
      ctx.fill();
      starPath(ctx, 0, -86, 16, 7, 5, -Math.PI / 2);
      ctx.fillStyle = rgba(p.decor3);
      ctx.fill();
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 2.3;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawGround(g) {
    const p = currentPalette;
    const pathGrad = ctx.createLinearGradient(0, g, 0, H);
    pathGrad.addColorStop(0, rgba(p.pathTop));
    pathGrad.addColorStop(0.24, rgba(p.path));
    pathGrad.addColorStop(1, rgba(p.pathDark));
    ctx.fillStyle = pathGrad;
    ctx.fillRect(0, g, W, H - g);

    // Diagonal candy stripes
    const band = 96 * S;
    const offset = ((game.camX % band) + band) % band;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g + 18 * S, W, H - g);
    ctx.clip();
    ctx.globalAlpha = 0.075;
    ctx.fillStyle = rgba(p.pathTop);
    for (let x = -band - offset; x < W + band; x += band) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 32 * S, g + 24 * S);
      ctx.lineTo(x + 52 * S, g + 24 * S);
      ctx.lineTo(x + 20 * S, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Frosting edge
    ctx.fillStyle = rgba(p.pathTop);
    ctx.fillRect(0, g, W, 9 * S);
    const icingGap = 58 * S;
    const icingOff = ((game.camX % icingGap) + icingGap) % icingGap;
    for (let x = -icingOff; x < W + icingGap; x += icingGap) {
      const rr = 9.5 * S;
      ctx.beginPath();
      ctx.arc(x, g + 9 * S, rr, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillRect(0, g + 1 * S, W, 2 * S);

    // Sprinkles
    const tile = 58 * S;
    const start = Math.floor(game.camX / tile) - 1;
    const count = Math.ceil(W / tile) + 3;
    ctx.save();
    for (let i = start; i < start + count; i++) {
      const seed = hash(i * 2.39 + 8.7);
      const x = i * tile - game.camX + seed * tile;
      const y = g + 34 * S + hash(i * 7.2 + 1.6) * Math.max(24, (H - g) * 0.48);
      if (x < -10 || x > W + 10 || y > H - 12) continue;
      const color = seed > 0.62 ? p.accent : seed > 0.3 ? p.pathTop : p.decor3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hash(i * 9.3) * Math.PI);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = rgba(color);
      roundRectPath(ctx, -1.6 * S, -4.5 * S, 3.2 * S, 9 * S, 2 * S);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Soft shading at the very bottom
    const bottomShade = ctx.createLinearGradient(0, H * 0.82, 0, H);
    bottomShade.addColorStop(0, 'rgba(74,42,39,0)');
    bottomShade.addColorStop(1, 'rgba(74,42,39,0.2)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(0, H * 0.82, W, H * 0.18);
  }

  /* =========================================================
     Particles & floating feedback
     ========================================================= */
  const CANDY_COLORS = [
    { fill: '#FF7F9F', light: '#FFD1DD', dark: '#C34D70' },
    { fill: '#74DDB8', light: '#D6FFF0', dark: '#3B9F7D' },
    { fill: '#FFD45F', light: '#FFF2B5', dark: '#B9821F' },
    { fill: '#AF9BFF', light: '#EADFFF', dark: '#6D5AB7' },
  ];

  function spawnParticle(x, y, color, opts = {}) {
    if (particles.length > 190) particles.shift();
    const life = opts.life || rand(0.36, 0.7);
    particles.push({
      x,
      y,
      vx: opts.vx === undefined ? rand(-80, 80) : opts.vx,
      vy: opts.vy === undefined ? rand(-160, -30) : opts.vy,
      gravity: opts.gravity === undefined ? 500 : opts.gravity,
      life,
      maxLife: life,
      size: opts.size || rand(2, 5) * S,
      color,
      shape: opts.shape || 'circle',
      rotation: opts.rotation === undefined ? rand(0, TAU) : opts.rotation,
      vr: opts.vr === undefined ? rand(-5, 5) : opts.vr,
      alpha: opts.alpha === undefined ? 1 : opts.alpha,
    });
  }

  function spawnBurst(x, y, colors, count = 8, power = 180, shape = 'circle') {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const speed = rand(power * 0.35, power);
      const color = Array.isArray(colors) ? pick(colors) : colors;
      spawnParticle(x, y, color, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - power * 0.15,
        gravity: rand(280, 680),
        life: rand(0.32, 0.72),
        size: rand(2, 5.5) * S,
        shape: Math.random() < 0.35 ? 'star' : shape,
        vr: rand(-8, 8),
      });
    }
  }

  function spawnDust(x, y, force = 1) {
    for (let i = 0; i < 3; i++) {
      spawnParticle(x + rand(-12, 12) * S, y - rand(1, 6) * S, 'rgba(255,247,229,0.9)', {
        vx: rand(-110, -30) * force,
        vy: rand(-95, -20),
        gravity: 90,
        life: rand(0.25, 0.5),
        size: rand(3, 7) * S,
        alpha: 0.65,
        shape: 'circle',
      });
    }
  }

  function addRing(x, y, color, opts = {}) {
    rings.push({
      x,
      y,
      r: opts.r || 6 * S,
      maxR: opts.maxR || 55 * S,
      life: opts.life || 0.36,
      maxLife: opts.life || 0.36,
      width: opts.width || 4 * S,
      color,
      alpha: opts.alpha === undefined ? 0.7 : opts.alpha,
    });
  }

  function addFloater(text, x, y, color = '#fff8e8', size = 17, vy = -54) {
    floaters.push({ text, x, y, color, size: size * S, life: 0.82, maxLife: 0.82, vy: vy * S });
    if (floaters.length > 22) floaters.shift();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rotation += p.vr * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      r.r = lerp(r.r, r.maxR, 1 - Math.pow(0.001, dt));
      r.alpha = (1 - t) * 0.7;
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 0.985;
    }
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = clamp(t, 0, 1) * p.alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.shape === 'star') {
        starPath(ctx, 0, 0, p.size, p.size * 0.46, 5, -Math.PI / 2);
        ctx.fill();
      } else if (p.shape === 'heart') {
        heartPath(ctx, 0, 0, p.size);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.fillRect(-p.size * 0.6, -p.size * 0.6, p.size * 1.2, p.size * 1.2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const r of rings) {
      ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1) * r.alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, r.width * (r.life / r.maxLife));
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of floaters) {
      const t = clamp(f.life / f.maxLife, 0, 1);
      const alpha = t < 0.7 ? t / 0.7 : 1;
      const scale = t > 0.82 ? 1 + (t - 0.82) * 1.7 : 1;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font = `900 ${Math.round(f.size * scale)}px ${FONT_ROUND}`;
      ctx.strokeStyle = 'rgba(255,249,237,0.94)';
      ctx.lineWidth = Math.max(3, f.size * 0.29);
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawSpeedLines() {
    if (game.speed < 1) return;
    const p = currentPalette;
    const intensity = clamp((game.speed / (450 * S) - 0.6) * 0.7, 0, 0.5) + (game.feverActive ? 0.15 : 0);
    if (intensity <= 0.02) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(p.pathTop);
    for (const line of speedLines) {
      const y = line.y * H * 0.93;
      const len = line.len * S * (0.6 + game.speed / (420 * S));
      ctx.globalAlpha = intensity * line.alpha * 5;
      ctx.lineWidth = 1.2 + line.alpha * 4;
      ctx.beginPath();
      ctx.moveTo(line.x, y);
      ctx.lineTo(line.x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateSpeedLines(dt) {
    for (const line of speedLines) {
      line.x -= (game.speed * line.speed * 1.28 + 60) * dt;
      if (line.x + line.len * S < -20) {
        line.x = W + rand(20, W * 0.9);
        line.y = Math.random();
      }
    }
  }

  /* =========================================================
     Run setup & scoring
     ========================================================= */
  function comboMultiplier() {
    return Math.min(5, 1 + Math.floor(game.combo / 8));
  }

  function addFever(amount) {
    if (game.feverActive) return;
    game.fever = clamp(game.fever + amount, 0, FEVER_MAX);
    if (game.fever >= FEVER_MAX) startFever();
  }

  function startFever() {
    if (game.feverActive || mode !== 'playing') return;
    game.feverActive = true;
    game.feverTime = FEVER_DURATION;
    game.fever = FEVER_MAX;
    game.fevers++;
    game.flash = 0.75;
    game.flashColor = '#FFF1B7';
    game.shake = Math.max(game.shake, 7 * S);
    game.hitstop = Math.max(game.hitstop, 0.035);
    showAnnounce('SWEET FEVER', 'フィーバー！', 'fever', 1550);
    audio.fever();
    audio.setEnergy(1.28);
    for (let i = 0; i < 18; i++) {
      spawnParticle(player.x + rand(-30, 30) * S, player.y - rand(20, 90) * S, pick(['#FFDA6A', '#FF8FAF', '#86E5C4', '#BFA2FF']), {
        vx: rand(-150, 150),
        vy: rand(-250, -30),
        gravity: 180,
        life: rand(0.5, 1.1),
        size: rand(2, 5) * S,
        shape: 'star',
        vr: rand(-8, 8),
      });
    }
    addRing(player.x, player.y - 34 * S, 'rgba(255,244,196,0.9)', { maxR: 120 * S, life: 0.55, width: 5 * S });
  }

  function endFever() {
    game.feverActive = false;
    game.feverTime = 0;
    game.fever = 0;
    audio.setEnergy(1);
  }

  function commitRun() {
    if (game.runCommitted) return;
    game.runCommitted = true;
    ensureDaily();
    const scoreInt = Math.floor(game.score);
    game.newBest = scoreInt > save.best;
    if (game.newBest) save.best = scoreInt;
    save.coins += game.runCoins;
    save.daily.sweets += game.sweets;
    save.daily.distance += Math.floor(game.distanceM);
    save.daily.fevers += game.fevers;
    persist();
    updateHomeStats();
    refreshDailyDot();
  }

  function resetRun() {
    obstacles = [];
    candies = [];
    particles = [];
    floaters = [];
    rings = [];

    game.speed = 240 * S;
    game.camX = 0;
    game.distanceM = 0;
    game.score = 0;
    game.combo = 0;
    game.comboTimer = 0;
    game.maxCombo = 0;
    game.comboPulse = 0;
    game.hearts = 3;
    game.fever = 0;
    game.feverActive = false;
    game.feverTime = 0;
    game.feverFx = 0;
    game.runCoins = 0;
    game.sweets = 0;
    game.fevers = 0;
    game.stage = 0;
    game.spawnObstacle = 3.35;
    game.spawnCandy = 0.5;
    game.nextGold = 10;
    game.nextHeart = 14;
    game.time = 0;
    game.hitstop = 0;
    game.shake = 0;
    game.flash = 0;
    game.deathTimer = 0;
    game.deathEndsAt = 0;
    game.runCommitted = false;
    game.newBest = false;
    game.intro = 1;
    game.tutorialPulse = !save.tutorialSeen;

    player.x = runX;
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
    player.jumpBuffer = 0;
    player.sliding = false;
    player.slideTimer = 0;
    player.slideQueued = false;
    player.fastFall = false;
    player.runPhase = 0;
    player.invincible = 0;
    player.hurtTimer = 0;
    player.landSquash = 0;
    player.spinTimer = 0;
    player.spinDir = 1;
    player.dead = false;
    player.deadAngle = 0;
    player.footstep = 0;

    setStagePalette(0, true);
    syncHearts(true);
    syncHud(true);

    // A welcoming trail of candy right in front of the player.
    for (let i = 0; i < 5; i++) {
      spawnCandy(W * 0.82 + i * 42 * S, groundY - (35 + Math.sin((i / 4) * Math.PI) * 10) * S, 'candy', i % 4);
    }
  }

  function startRun() {
    ensureDaily();
    closeSheets();
    homeScreen.classList.add('is-leaving');
    homeScreen.classList.remove('is-active');
    resultScreen.classList.remove('is-active');
    resultScreen.setAttribute('aria-hidden', 'true');
    pauseScreen.classList.remove('is-active');
    pauseScreen.setAttribute('aria-hidden', 'true');
    resetRun();
    mode = 'playing';
    hud.classList.remove('is-hidden');
    hud.setAttribute('aria-hidden', 'false');
    controls.classList.remove('is-hidden');
    controls.classList.remove('tutorial-pulse');
    controls.setAttribute('aria-hidden', 'false');
    if (game.tutorialPulse) {
      controls.classList.add('tutorial-pulse');
      window.setTimeout(() => controls.classList.remove('tutorial-pulse'), 3600);
    }
    if (!save.tutorialSeen) {
      save.tutorialSeen = true;
      persist();
    }
    audio.unlock();
    audio.startMusic();
    audio.setEnergy(1);
    showAnnounce('READY?', 'GO!', '', 760);
    if (game.tutorialPulse) {
      window.setTimeout(() => {
        if (mode === 'playing') showToast('右タップでジャンプ / 左タップでスライド', 2000);
      }, 1000);
    }
    syncHud(true);
  }

  function startDeath() {
    if (mode !== 'playing') return;
    mode = 'dying';
    player.dead = true;
    player.vy = -540 * S;
    player.onGround = false;
    game.deathTimer = 1.0;
    // Use wall-clock time so a slow frame never drags the result screen out.
    game.deathEndsAt = now() + 1000;
    game.deathAngle = 0;
    game.shake = 18 * S;
    game.flash = 0.42;
    game.flashColor = '#FF8A9F';
    controls.classList.add('is-hidden');
    addRing(player.x, player.y - 32 * S, 'rgba(255,111,141,0.8)', { maxR: 150 * S, life: 0.5, width: 6 * S });
    for (let i = 0; i < 20; i++) {
      spawnParticle(player.x + rand(-18, 18) * S, player.y - rand(18, 70) * S, pick(['#FF7496', '#FFD16A', '#FFF4D7', '#BCA4FF']), {
        vx: rand(-220, 220),
        vy: rand(-330, -60),
        gravity: 720,
        life: rand(0.5, 1),
        size: rand(2.5, 6) * S,
        shape: Math.random() < 0.4 ? 'star' : 'circle',
      });
    }
    audio.hit();
    audio.gameover();
    audio.setEnergy(0.9);
    commitRun();
  }

  function showResult() {
    if (mode === 'result') return;
    mode = 'result';
    hud.classList.add('is-hidden');
    hud.setAttribute('aria-hidden', 'true');
    controls.classList.add('is-hidden');
    controls.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.control-button').forEach((el) => el.classList.remove('is-pressed'));
    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = 0;
    }
    announceEl.classList.remove('is-show');

    resultTitleEl.textContent = game.newBest ? 'あたらしいきろく！' : 'ランしゅうりょう';
    resultDistanceEl.textContent = `${formatNumber(game.distanceM)} m`;
    resultSweetsEl.textContent = formatNumber(game.sweets);
    resultCoinsEl.textContent = `+${formatNumber(game.runCoins)}`;
    resultComboEl.textContent = formatNumber(game.maxCombo);

    resultDailyEl.textContent = hasClaimableMission()
      ? 'デイリーミッション達成！ホームでうけとってね'
      : game.sweets > 0
        ? `デイリーに +${formatNumber(game.sweets)} スイーツ`
        : '';

    newBestEl.hidden = true;
    if (game.newBest) {
      requestAnimationFrame(() => {
        newBestEl.hidden = false;
      });
    }

    animateResultScore(Math.floor(game.score));
    resultScreen.classList.add('is-active');
    resultScreen.setAttribute('aria-hidden', 'false');
    audio.setEnergy(0.82);
    if (game.newBest) audio.best();
    updateHomeStats();
  }

  function animateResultScore(target) {
    if (resultNumberRaf) cancelAnimationFrame(resultNumberRaf);
    const start = now();
    const duration = 720;
    function tick(t) {
      const t0 = clamp((t - start) / duration, 0, 1);
      const eased = easeOutCubic(t0);
      resultScoreEl.textContent = formatNumber(target * eased);
      if (t0 < 1) resultNumberRaf = requestAnimationFrame(tick);
      else {
        resultScoreEl.textContent = formatNumber(target);
        resultNumberRaf = 0;
      }
    }
    resultScoreEl.textContent = '0';
    resultNumberRaf = requestAnimationFrame(tick);
  }

  function enterHome(opts = {}) {
    mode = 'home';
    closeSheets();
    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = 0;
    }
    announceEl.classList.remove('is-show');
    resultScreen.classList.remove('is-active');
    resultScreen.setAttribute('aria-hidden', 'true');
    pauseScreen.classList.remove('is-active');
    pauseScreen.setAttribute('aria-hidden', 'true');
    hud.classList.add('is-hidden');
    hud.setAttribute('aria-hidden', 'true');
    controls.classList.add('is-hidden');
    controls.setAttribute('aria-hidden', 'true');
    homeScreen.classList.remove('is-leaving');
    homeScreen.classList.add('is-active');

    obstacles = [];
    candies = [];
    particles = [];
    floaters = [];
    rings = [];
    game.stage = 0;
    game.feverActive = false;
    game.fever = 0;
    game.shake = 0;
    game.speed = 0;
    game.camX = 0;
    game.deathTimer = 0;
    game.deathEndsAt = 0;
    game.runCommitted = true;
    setStagePalette(0);
    player.x = W / 2;
    player.y = homeGroundY;
    player.vy = 0;
    player.onGround = true;
    player.sliding = false;
    player.slideTimer = 0;
    player.dead = false;
    player.deadAngle = 0;
    player.invincible = 0;
    player.hurtTimer = 0;
    player.landSquash = 0;
    ensureDaily();
    updateHomeStats();
    refreshDailyDot();
    audio.setEnergy(0.82);
    if (opts.toast) {
      window.setTimeout(() => showToast(opts.toast, 1900), 240);
    }
  }

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused';
    pauseScreen.classList.add('is-active');
    pauseScreen.setAttribute('aria-hidden', 'false');
    controls.classList.add('is-hidden');
    controls.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.control-button').forEach((el) => el.classList.remove('is-pressed'));
    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = 0;
    }
    announceEl.classList.remove('is-show');
    audio.setEnergy(0.62);
    audio.click();
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'playing';
    pauseScreen.classList.remove('is-active');
    pauseScreen.setAttribute('aria-hidden', 'true');
    controls.classList.remove('is-hidden');
    controls.setAttribute('aria-hidden', 'false');
    audio.setEnergy(game.feverActive ? 1.25 : 1);
    audio.click();
  }

  function quitToHome() {
    if (mode === 'playing' || mode === 'paused' || mode === 'dying') {
      if (mode === 'dying') {
        // The run is already committed; just leave cleanly.
      } else {
        commitRun();
      }
    }
    const earned = game.runCoins;
    enterHome({ toast: earned > 0 ? `コイン +${formatNumber(earned)} ほぞんしたよ` : '' });
  }

  /* =========================================================
     Player actions
     ========================================================= */
  function doJump(isDouble) {
    const perks = selectedPerks();
    const jumpPower = BASE_JUMP * S * perks.jump;
    player.onGround = false;
    player.sliding = false;
    player.slideTimer = 0;
    player.slideQueued = false;
    player.fastFall = false;
    player.jumpBuffer = 0;
    player.landSquash = 0;
    if (isDouble) {
      player.vy = -jumpPower * 0.9;
      player.jumps = 2;
      player.spinTimer = 0.34;
      player.spinDir = Math.random() < 0.5 ? -1 : 1;
      audio.doubleJump();
      addRing(player.x, player.y - 32 * S, 'rgba(255,247,204,0.85)', { maxR: 66 * S, life: 0.32, width: 3.5 * S });
      for (let i = 0; i < 8; i++) {
        spawnParticle(player.x + rand(-18, 18) * S, player.y - rand(4, 38) * S, pick(['#FFD86C', '#FFF7D2', '#FFA2B8']), {
          vx: rand(-120, 120),
          vy: rand(-150, 40),
          gravity: 280,
          life: rand(0.25, 0.55),
          size: rand(2, 4) * S,
          shape: 'star',
        });
      }
    } else {
      player.vy = -jumpPower;
      player.jumps = 1;
      audio.jump();
      spawnDust(player.x, player.y, 1.2);
    }
  }

  function tryJump() {
    if (mode !== 'playing') return;
    if (player.sliding) {
      player.sliding = false;
      player.slideTimer = 0;
      doJump(false);
      return;
    }
    if (player.onGround) {
      doJump(false);
    } else if (player.jumps < 2) {
      doJump(true);
    } else {
      player.jumpBuffer = 0.13;
    }
  }

  function startSlide() {
    const duration = 0.86 * selectedPerks().slide;
    player.sliding = true;
    player.slideTimer = duration;
    player.slideQueued = false;
    player.fastFall = false;
    player.spinTimer = 0;
    audio.slide();
    spawnDust(player.x + 4 * S, player.y, 0.8);
    for (let i = 0; i < 4; i++) {
      spawnParticle(player.x - rand(-4, 18) * S, player.y - rand(0, 5) * S, 'rgba(255,247,230,0.9)', {
        vx: rand(-200, -50),
        vy: rand(-55, -10),
        gravity: 80,
        life: rand(0.2, 0.4),
        size: rand(2, 5) * S,
      });
    }
  }

  function trySlide() {
    if (mode !== 'playing') return;
    if (player.onGround) {
      if (player.sliding) {
        player.slideTimer = Math.max(player.slideTimer, 0.25);
      } else {
        startSlide();
      }
    } else {
      player.fastFall = true;
      player.slideQueued = true;
      player.vy = Math.max(player.vy, 560 * S);
      audio.slide();
      addRing(player.x, player.y - 22 * S, 'rgba(255,255,255,0.5)', { maxR: 36 * S, life: 0.25, width: 2.5 * S });
    }
  }

  /* =========================================================
     Spawning
     ========================================================= */
  const OBSTACLE_SPECS = {
    cake: { w: 58, h: 53 },
    pancake: { w: 72, h: 84 },
    macaron: { w: 92, h: 52 },
    overhead: { w: 112, h: 108, opening: 57 },
  };

  function spawnObstacle() {
    const distance = game.distanceM;
    let type = 'cake';
    const roll = Math.random();

    if (distance < 90) {
      type = roll < 0.68 ? 'cake' : 'macaron';
    } else if (distance < 260) {
      type = roll < 0.4 ? 'cake' : roll < 0.65 ? 'macaron' : roll < 0.86 ? 'pancake' : 'overhead';
    } else if (distance < 700) {
      type = roll < 0.27 ? 'cake' : roll < 0.49 ? 'macaron' : roll < 0.72 ? 'pancake' : 'overhead';
    } else {
      type = roll < 0.2 ? 'cake' : roll < 0.43 ? 'macaron' : roll < 0.68 ? 'pancake' : 'overhead';
    }

    if (type === 'overhead' && (distance < 190 || obstacles.some((o) => o.type === 'overhead' && !o.dead))) {
      type = roll < 0.5 ? 'macaron' : 'pancake';
    }

    const spec = OBSTACLE_SPECS[type];
    const widthJitter = type === 'overhead' ? rand(-6, 8) : rand(-4, 5);
    const w = (spec.w + widthJitter) * S;
    const o = {
      type,
      x: W + 64 * S,
      w,
      h: spec.h * S,
      opening: (spec.opening || 0) * S,
      seed: rand(0, 100),
      hit: false,
      dead: false,
      passed: false,
      near: false,
      minGap: 9999,
    };
    obstacles.push(o);
    spawnGuideCandies(o);
  }

  function spawnGuideCandies(o) {
    if (o.type === 'overhead') {
      const count = 3;
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        spawnCandy(o.x + o.w * t, groundY - 27 * S, 'candy', i % 4);
      }
    } else {
      const count = 4;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const y = groundY - (o.h + 42 * S + Math.sin(t * Math.PI) * 42 * S);
        spawnCandy(o.x - 12 * S + t * (o.w + 24 * S), y, 'candy', i % 4);
      }
    }
  }

  function spawnCandy(x, y, type = 'candy', colorIndex = 0) {
    const radius = type === 'gold' ? 18 : type === 'heart' ? 16 : 12;
    candies.push({
      x,
      y: clamp(y, 52 * S, groundY - 20 * S),
      type,
      r: radius * S,
      phase: rand(0, TAU),
      colorIndex,
      magnet: false,
      dead: false,
    });
  }

  function adjustCandyForObstacles(x, y) {
    let cy = y;
    for (const o of obstacles) {
      if (o.dead) continue;
      if (x > o.x - 12 * S && x < o.x + o.w + 12 * S) {
        if (o.type === 'overhead') {
          const bottom = groundY - o.opening;
          if (cy < bottom + 5 * S) cy = groundY - Math.min(27 * S, o.opening * 0.48);
        } else {
          const top = groundY - o.h;
          if (cy > top - 18 * S) cy = top - 38 * S;
        }
      }
    }
    return clamp(cy, 54 * S, groundY - 20 * S);
  }

  function spawnCandyPattern() {
    const count = 3 + ((Math.random() * 3) | 0);
    const spacing = rand(37, 50) * S;
    const x0 = W + 24 * S;
    const pattern = (Math.random() * 4) | 0;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      let y;
      if (pattern === 0) {
        y = groundY - (34 + Math.sin(t * Math.PI) * 9) * S;
      } else if (pattern === 1) {
        y = groundY - (72 + Math.sin(t * Math.PI) * 67) * S;
      } else if (pattern === 2) {
        y = groundY - (53 + Math.sin(t * TAU) * 38) * S;
      } else {
        // A high arc that rewards a well-timed double jump.
        y = groundY - (110 + Math.sin(t * Math.PI) * 78) * S;
      }
      const x = x0 + i * spacing;
      spawnCandy(x, adjustCandyForObstacles(x, y), 'candy', i % 4);
    }
  }

  function spawnGold() {
    const x = W + 44 * S;
    const y = adjustCandyForObstacles(x, groundY - rand(84, 124) * S);
    spawnCandy(x, y, 'gold', 2);
    for (let i = 0; i < 3; i++) {
      spawnParticle(x + rand(-20, 20) * S, y + rand(-20, 20) * S, 'rgba(255,228,142,0.8)', {
        vx: rand(-20, 20),
        vy: rand(-35, -8),
        gravity: 0,
        life: rand(0.3, 0.6),
        size: rand(2, 4) * S,
        shape: 'star',
      });
    }
  }

  function spawnHeart() {
    const x = W + 42 * S;
    const y = adjustCandyForObstacles(x, groundY - 104 * S);
    spawnCandy(x, y, 'heart', 0);
  }

  function updateSpawning(dt) {
    const diff = clamp(game.distanceM / 1800, 0, 1);

    game.spawnObstacle -= dt;
    if (game.spawnObstacle <= 0) {
      spawnObstacle();
      game.spawnObstacle = rand(1.72, 2.18) - diff * 0.4;
    }

    game.spawnCandy -= dt;
    if (game.spawnCandy <= 0) {
      spawnCandyPattern();
      game.spawnCandy = rand(1.42, 2.12);
    }

    game.nextGold -= dt;
    if (game.nextGold <= 0) {
      spawnGold();
      game.nextGold = rand(14, 22);
    }

    game.nextHeart -= dt;
    if (game.nextHeart <= 0) {
      if (game.hearts < 3) {
        spawnHeart();
        game.nextHeart = rand(17, 24);
      } else {
        game.nextHeart = rand(6, 10);
      }
    }
  }

  /* =========================================================
     Gameplay update
     ========================================================= */
  function playerHitbox() {
    const h = (player.sliding ? 30 : 66) * S;
    const w = (player.sliding ? 48 : 34) * S;
    return { x: player.x - w / 2, y: player.y - h, w, h };
  }

  function obstacleBox(o) {
    if (o.type === 'overhead') {
      return {
        x: o.x + 7 * S,
        y: groundY - o.opening - o.h + 5 * S,
        w: o.w - 14 * S,
        h: o.h - 8 * S,
      };
    }
    return {
      x: o.x + 6 * S,
      y: groundY - o.h + 3 * S,
      w: o.w - 12 * S,
      h: o.h - 5 * S,
    };
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updatePlayer(dt) {
    player.invincible = Math.max(0, player.invincible - dt);
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    if (player.landSquash > 0) player.landSquash = Math.max(0, player.landSquash - dt * 4.6);
    if (player.spinTimer > 0) player.spinTimer = Math.max(0, player.spinTimer - dt);
    if (player.blink > 0) player.blink -= dt;
    player.blinkCd -= dt;
    if (player.blinkCd <= 0) {
      player.blink = 0.11;
      player.blinkCd = rand(2.2, 4.2);
    }
    if (player.jumpBuffer > 0) player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

    if (player.sliding) {
      player.slideTimer -= dt;
      if (player.slideTimer <= 0) {
        player.sliding = false;
        spawnDust(player.x, player.y, 0.55);
      }
    }

    if (!player.onGround) {
      const gravity = BASE_GRAVITY * S * (player.fastFall ? 1.45 : 1);
      player.vy += gravity * dt;
      player.y += player.vy * dt;

      if (player.y >= groundY) {
        const impact = Math.abs(player.vy);
        player.y = groundY;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
        player.fastFall = false;
        player.spinTimer = 0;
        player.landSquash = clamp(impact / (1100 * S), 0.25, 1);
        spawnDust(player.x, player.y, 0.8 + impact / (1800 * S));
        if (impact > 700 * S) addRing(player.x, player.y, 'rgba(255,245,221,0.7)', { maxR: 46 * S, life: 0.3, width: 2.5 * S });
        if (player.jumpBuffer > 0) {
          player.jumpBuffer = 0;
          doJump(false);
        } else if (player.slideQueued) {
          startSlide();
        }
      }
    } else {
      player.y = groundY;
      if (player.jumpBuffer > 0) {
        player.jumpBuffer = 0;
        doJump(false);
      }
    }

    player.x = runX;
    player.runPhase += dt * (player.onGround ? game.speed / (34 * S) : 5.5);

    player.footstep -= dt;
    if (player.footstep <= 0) {
      if (player.onGround && !player.sliding) {
        player.footstep = 0.1;
        spawnDust(player.x - 10 * S, player.y, 0.45);
      } else if (player.sliding) {
        player.footstep = 0.065;
        spawnParticle(player.x - rand(14, 30) * S, player.y - rand(1, 6) * S, 'rgba(255,248,231,0.8)', {
          vx: rand(-210, -70),
          vy: rand(-40, -4),
          gravity: 50,
          life: rand(0.18, 0.34),
          size: rand(1.5, 4) * S,
        });
      } else {
        player.footstep = 0.08;
        spawnParticle(player.x - 4 * S, player.y - rand(18, 48) * S, 'rgba(255,247,224,0.72)', {
          vx: rand(-100, -20),
          vy: rand(-15, 30),
          gravity: 30,
          life: rand(0.18, 0.38),
          size: rand(1.5, 3.5) * S,
          shape: 'star',
        });
      }
    }
  }

  function updateObstacles(dt) {
    const box = playerHitbox();
    const move = game.speed * dt;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= move;
      if (o.dead) {
        obstacles.splice(i, 1);
        continue;
      }
      if (o.x + o.w < -150 * S) {
        obstacles.splice(i, 1);
        continue;
      }

      const ob = obstacleBox(o);
      const horizontal = box.x < ob.x + ob.w && box.x + box.w > ob.x;

      if (horizontal && intersects(box, ob)) {
        if (game.feverActive) {
          smashObstacle(o);
          obstacles.splice(i, 1);
          continue;
        }
        if (player.invincible <= 0 && !player.dead) {
          hitObstacle(o);
          obstacles.splice(i, 1);
          continue;
        }
      }

      if (horizontal && !o.hit) {
        let gap;
        if (o.type === 'overhead') {
          gap = box.y - (ob.y + ob.h);
        } else {
          gap = ob.y - (box.y + box.h);
        }
        if (gap >= 0) o.minGap = Math.min(o.minGap, gap);
      }

      if (!o.passed && o.x + o.w < box.x) {
        o.passed = true;
        if (!o.hit && player.invincible <= 0 && o.minGap < 15 * S) {
          awardNearMiss(o);
        }
      }
    }
  }

  function updateCandies(dt) {
    const perks = selectedPerks();
    const centerX = player.x;
    const centerY = player.y - (player.sliding ? 17 : 35) * S;
    const normalMagnet = 47 * S * perks.magnet;
    const magnetRange = game.feverActive ? W * 0.9 : normalMagnet;
    const pickupPadding = 21 * S;

    for (let i = candies.length - 1; i >= 0; i--) {
      const c = candies[i];
      if (c.dead) {
        candies.splice(i, 1);
        continue;
      }
      c.x -= game.speed * dt;
      const dx = centerX - c.x;
      const dy = centerY - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < magnetRange) {
        c.magnet = true;
      }
      if (c.magnet) {
        const pullSpeed = (game.feverActive ? 1260 : 660) * S;
        const pull = 1 - Math.min(0.82, dist / (magnetRange * 1.4));
        c.x += (dx / dist) * pullSpeed * pull * dt;
        c.y += (dy / dist) * pullSpeed * pull * dt;
      }

      const ndx = centerX - c.x;
      const ndy = centerY - c.y;
      if (Math.sqrt(ndx * ndx + ndy * ndy) < c.r + pickupPadding) {
        collectCandy(c);
        candies.splice(i, 1);
        continue;
      }

      if (c.x < -100 * S) candies.splice(i, 1);
    }
  }

  function collectCandy(c) {
    if (c.type === 'heart') {
      game.hearts = Math.min(3, game.hearts + 1);
      syncHearts(true);
      addFloater('ハート回復!', player.x, player.y - 120 * S, '#FF6E8F', 17);
      addRing(c.x, c.y, 'rgba(255,121,153,0.9)', { maxR: 75 * S, life: 0.45, width: 4 * S });
      spawnBurst(c.x, c.y, ['#FF7898', '#FFD0D8', '#FFF8E8'], 12, 190, 'heart');
      audio.heart();
      return;
    }

    game.combo++;
    game.comboTimer = game.comboTimerMax;
    game.comboPulse = 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.sweets++;
    const mult = comboMultiplier();
    const feverMult = game.feverActive ? 2 : 1;

    if (c.type === 'gold') {
      game.runCoins += 8;
      game.score += 240 * mult * feverMult;
      addFever(5);
      addFloater('+8', c.x, c.y - 18 * S, '#FFC54A', 22);
      spawnBurst(c.x, c.y, ['#FFE17C', '#FFF5C4', '#FFB05A'], 15, 230, 'star');
      addRing(c.x, c.y, 'rgba(255,218,104,0.9)', { maxR: 70 * S, life: 0.4, width: 4 * S });
      audio.gold();
      if (coinRunEl) {
        coinRunEl.classList.remove('coin-bump');
        void coinRunEl.offsetWidth;
        coinRunEl.classList.add('coin-bump');
      }
    } else {
      const color = CANDY_COLORS[c.colorIndex % CANDY_COLORS.length];
      game.runCoins += 1;
      game.score += 30 * mult * feverMult;
      addFever(1.35);
      spawnBurst(c.x, c.y, [color.fill, color.light, '#FFF9EC'], 6, 140, 'circle');
      audio.coin(game.combo);
      if (game.combo > 0 && game.combo % 8 === 0) {
        addFloater(`COMBO ×${mult}!`, player.x, player.y - 128 * S, '#FF6A8D', 18);
        audio.nearMiss();
      }
    }

    if (c.type === 'gold') {
      addFloater(`+${240 * mult * feverMult}`, player.x + 24 * S, player.y - 100 * S, '#FFF1B6', 15);
    }
  }

  function smashObstacle(o) {
    o.hit = true;
    o.dead = true;
    const mult = comboMultiplier();
    game.score += 80 * mult * (game.feverActive ? 2 : 1);
    game.feverTime = Math.min(FEVER_DURATION, game.feverTime + 0.14);
    const cx = o.x + o.w * 0.5;
    const cy = groundY - o.h * 0.6;
    spawnBurst(cx, cy, ['#FFDA6A', '#FF8FAF', '#FFF4CE', '#ADF2D9'], 18, 330, 'star');
    addRing(cx, cy, 'rgba(255,240,178,0.9)', { maxR: 105 * S, life: 0.42, width: 5 * S });
    addFloater('SMASH!', cx, cy - 20 * S, '#FFF2B0', 16);
    game.shake = Math.max(game.shake, 6 * S);
    audio.nearMiss();
  }

  function hitObstacle(o) {
    o.hit = true;
    o.dead = true;
    game.hearts--;
    syncHearts(true);
    game.combo = 0;
    game.comboTimer = 0;
    game.fever = Math.max(0, game.fever - 18);
    player.invincible = 1.85;
    player.hurtTimer = 0.58;
    game.shake = 16 * S;
    game.flash = 0.5;
    game.flashColor = '#FF8A9C';
    game.hitstop = 0.075;
    addRing(player.x, player.y - 34 * S, 'rgba(255,116,142,0.9)', { maxR: 96 * S, life: 0.4, width: 5 * S });
    spawnBurst(player.x, player.y - 38 * S, ['#FF7894', '#FFC0C9', '#FFF3D8', '#FFD36E'], 18, 280, 'star');
    audio.hit();
    syncHud(true);
    if (game.hearts <= 0) {
      startDeath();
    } else {
      addFloater('いたたっ', player.x, player.y - 128 * S, '#FF5E7D', 18);
    }
  }

  function awardNearMiss(o) {
    o.near = true;
    const mult = comboMultiplier();
    const points = 60 * mult * (game.feverActive ? 2 : 1);
    game.score += points;
    addFever(5.5);
    addFloater('スレスレ!', player.x + 8 * S, player.y - 112 * S, '#FFF8E8', 17);
    addFloater(`+${points}`, player.x + 42 * S, player.y - 88 * S, '#FFD36E', 13);
    for (let i = 0; i < 8; i++) {
      spawnParticle(player.x + rand(-10, 20) * S, player.y - rand(10, 55) * S, pick(['#FFF2B7', '#FFA9C0', '#B8F3DD']), {
        vx: rand(-90, 130),
        vy: rand(-90, 20),
        gravity: 100,
        life: rand(0.25, 0.5),
        size: rand(1.5, 3.5) * S,
        shape: 'star',
      });
    }
    audio.nearMiss();
  }

  function updateStage() {
    let next = game.stage;
    while (next < STAGES.length - 1 && game.distanceM >= STAGES[next + 1].threshold) next++;
    if (next !== game.stage) {
      game.stage = next;
      setStagePalette(next);
      showAnnounce(`STAGE ${next + 1}`, STAGES[next].name, 'stage', 1850);
      audio.stage();
    }
  }

  function updatePlaying(dt) {
    game.time += dt;
    const diff = clamp(game.distanceM / 1800, 0, 1);
    let targetSpeed = lerp(300, 460, diff) * S;
    if (game.feverActive) targetSpeed *= 1.07;
    game.speed += (targetSpeed - game.speed) * (1 - Math.exp(-2.2 * dt));
    const move = game.speed * dt;
    game.camX += move;
    const meters = move / (23.5 * S);
    game.distanceM += meters;
    game.score += meters * 12 * (game.feverActive ? 2 : 1);

    if (game.feverActive) {
      game.feverTime = Math.max(0, game.feverTime - dt);
      game.fever = (game.feverTime / FEVER_DURATION) * FEVER_MAX;
      game.feverFx += dt;
      if (game.feverTime <= 0) endFever();
      if (game.feverFx > 0.075) {
        game.feverFx = 0;
        spawnParticle(player.x + rand(-70, 20) * S, player.y - rand(10, 160) * S, pick(['#FFE079', '#FF9FBB', '#9FEBD2', '#C6ADFF']), {
          vx: rand(-160, -40),
          vy: rand(-60, 50),
          gravity: 40,
          life: rand(0.35, 0.8),
          size: rand(1.5, 4) * S,
          shape: 'star',
          vr: rand(-6, 6),
        });
      }
    }

    if (game.comboTimer > 0) {
      game.comboTimer = Math.max(0, game.comboTimer - dt);
      if (game.comboTimer <= 0) game.combo = 0;
    }
    game.comboPulse = Math.max(0, game.comboPulse - dt * 3.8);

    updatePlayer(dt);
    updateObstacles(dt);
    updateCandies(dt);
    updateSpawning(dt);
    updateStage();
    updateParticles(dt);
    updateSpeedLines(dt);

    game.shake = Math.max(0, game.shake - dt * 52 * S);
    game.flash = Math.max(0, game.flash - dt * 3.1);
    if (game.intro > 0) game.intro = Math.max(0, game.intro - dt);
    syncHud();
  }

  function updateDying(dt) {
    game.time += dt;
    game.deathTimer = Math.max(0, (game.deathEndsAt - now()) / 1000);
    game.speed = Math.max(0, game.speed - dt * 650 * S);
    game.camX += game.speed * dt;
    const move = game.speed * dt;
    for (const o of obstacles) o.x -= move;
    for (const c of candies) c.x -= move;

    player.vy += 1900 * S * dt;
    player.y += player.vy * dt;
    if (player.y > groundY + 30 * S) {
      player.y = groundY + 30 * S;
      player.vy *= -0.36;
      if (Math.abs(player.vy) < 60) player.vy = 0;
    }
    player.deadAngle += dt * 4.2;
    game.shake = Math.max(0, game.shake - dt * 45 * S);
    game.flash = Math.max(0, game.flash - dt * 3.1);
    updateParticles(dt);
    updateSpeedLines(dt);
    syncHud();
    if (now() >= game.deathEndsAt) showResult();
  }

  function updateHome(dt) {
    game.time += dt;
    game.camX += 39 * S * dt;
    player.x = W / 2;
    player.y = homeGroundY;
    player.onGround = true;
    player.runPhase += dt * 1.5;
    if (player.blink > 0) player.blink -= dt;
    player.blinkCd -= dt;
    if (player.blinkCd <= 0) {
      player.blink = 0.13;
      player.blinkCd = rand(2.3, 4.4);
    }
    updateParticles(dt);
  }

  function updatePaletteSafe(dt) {
    updatePalette(dt);
  }

  /* =========================================================
     Obstacles & candy rendering
     ========================================================= */
  function drawObstacles() {
    for (const o of obstacles) {
      if (o.dead) continue;
      ctx.save();
      ctx.globalAlpha = 1;
      drawObstacleShadow(o);
      if (o.type === 'cake') drawCakeObstacle(o);
      else if (o.type === 'pancake') drawPancakeObstacle(o);
      else if (o.type === 'macaron') drawMacaronObstacle(o);
      else drawOverheadObstacle(o);
      ctx.restore();
    }
  }

  function drawObstacleShadow(o) {
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = 'rgba(74,44,38,1)';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, groundY + 4 * S, o.w * 0.53, 5.5 * S, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCakeObstacle(o) {
    const p = currentPalette;
    const x = o.x;
    const w = o.w;
    const h = o.h;
    const gy = groundY;
    const top = gy - h;
    const cx = x + w / 2;

    // Plate
    ctx.beginPath();
    ctx.ellipse(cx, gy - 1 * S, w * 0.55, 5 * S, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,246,224,0.82)';
    ctx.fill();
    ctx.lineWidth = 2.2 * S;
    ctx.strokeStyle = rgba(p.outline, 0.85);
    ctx.stroke();

    // Cake wedge
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(x + 5 * S, gy - 6 * S);
      ctx.quadraticCurveTo(x + w * 0.5, top + 12 * S, x + w - 5 * S, gy - 6 * S);
      ctx.quadraticCurveTo(cx, gy - 1 * S, x + 5 * S, gy - 6 * S);
      ctx.closePath();
    };
    body();
    const cakeGrad = ctx.createLinearGradient(0, top, 0, gy);
    cakeGrad.addColorStop(0, '#FFE8D5');
    cakeGrad.addColorStop(0.5, '#FFC8B4');
    cakeGrad.addColorStop(1, '#F2A994');
    ctx.fillStyle = cakeGrad;
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = '#FFF6E5';
    ctx.fillRect(x, top + h * 0.31, w, 7 * S);
    ctx.fillRect(x, top + h * 0.6, w, 6 * S);
    ctx.fillStyle = '#E87B83';
    ctx.fillRect(x, top + h * 0.4, w, 4 * S);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.38, top + h * 0.55, w * 0.2, h * 0.2, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();

    body();
    ctx.lineWidth = 3.4 * S;
    ctx.strokeStyle = rgba(p.outline);
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Cream and strawberry on top
    ctx.beginPath();
    ctx.arc(cx + 3 * S, top + 10 * S, 7 * S, 0, TAU);
    ctx.arc(cx - 5 * S, top + 12 * S, 5 * S, 0, TAU);
    ctx.arc(cx + 10 * S, top + 13 * S, 4.5 * S, 0, TAU);
    ctx.fillStyle = '#FFF9EA';
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.8);
    ctx.lineWidth = 1.8 * S;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + 1 * S, top + 2 * S, 6.4 * S, Math.PI, TAU);
    ctx.fillStyle = '#F15068';
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#5DA957';
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(cx + 1 * S, top - 2 * S);
    ctx.quadraticCurveTo(cx + 4 * S, top - 8 * S, cx + 8 * S, top - 8 * S);
    ctx.stroke();
  }

  function drawPancakeObstacle(o) {
    const p = currentPalette;
    const x = o.x;
    const w = o.w;
    const gy = groundY;
    const cx = x + w / 2;

    ctx.beginPath();
    ctx.ellipse(cx, gy - 1 * S, w * 0.58, 6 * S, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,246,225,0.78)';
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.85);
    ctx.lineWidth = 2.2 * S;
    ctx.stroke();

    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const ly = gy - 9 * S - i * 23 * S;
      const lw = w * (1 - i * 0.035);
      const lx = cx - lw / 2;
      ctx.beginPath();
      ctx.ellipse(cx, ly + 7 * S, lw * 0.5, 6.5 * S, 0, 0, TAU);
      ctx.fillStyle = i === 1 ? '#EAA76F' : '#F4BC84';
      ctx.fill();
      roundRectPath(ctx, lx + 2 * S, ly - 8 * S, lw - 4 * S, 16 * S, 7 * S);
      const grad = ctx.createLinearGradient(0, ly - 8 * S, 0, ly + 8 * S);
      grad.addColorStop(0, '#FFDCA8');
      grad.addColorStop(1, '#E9A367');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = rgba(p.outline);
      ctx.lineWidth = 2.7 * S;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, ly - 6 * S, lw * 0.46, 5 * S, 0, 0, TAU);
      ctx.fillStyle = 'rgba(255,241,197,0.65)';
      ctx.fill();
    }

    // Syrup
    ctx.beginPath();
    ctx.moveTo(cx - 13 * S, gy - 64 * S);
    ctx.quadraticCurveTo(cx - 3 * S, gy - 46 * S, cx + 13 * S, gy - 62 * S);
    ctx.lineWidth = 6 * S;
    ctx.strokeStyle = '#B86B37';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Butter and strawberry
    const butterY = gy - 82 * S;
    roundRectPath(ctx, cx - 9 * S, butterY - 2 * S, 18 * S, 10 * S, 2.5 * S);
    ctx.fillStyle = '#FFF1A9';
    ctx.fill();
    ctx.lineWidth = 2 * S;
    ctx.strokeStyle = rgba(p.outline);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, butterY - 4 * S, 6.2 * S, Math.PI, TAU);
    ctx.fillStyle = '#F3536F';
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline);
    ctx.lineWidth = 2 * S;
    ctx.stroke();
    ctx.strokeStyle = '#5CA55D';
    ctx.beginPath();
    ctx.moveTo(cx, butterY - 9 * S);
    ctx.lineTo(cx + 4 * S, butterY - 13 * S);
    ctx.stroke();
  }

  function drawMacaronObstacle(o) {
    const p = currentPalette;
    const x = o.x;
    const w = o.w;
    const gy = groundY;
    const cx = x + w / 2;

    ctx.beginPath();
    ctx.ellipse(cx, gy - 1 * S, w * 0.54, 6 * S, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,246,225,0.75)';
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.85);
    ctx.lineWidth = 2.2 * S;
    ctx.stroke();

    // Cream between the shells
    ctx.beginPath();
    ctx.ellipse(cx, gy - 24 * S, w * 0.38, 10 * S, 0, 0, TAU);
    ctx.fillStyle = '#FFF0D0';
    ctx.fill();
    ctx.lineWidth = 3 * S;
    ctx.strokeStyle = rgba(p.outline);
    ctx.stroke();

    // Bottom shell
    ctx.beginPath();
    ctx.moveTo(x + 5 * S, gy - 21 * S);
    ctx.bezierCurveTo(x + 2 * S, gy - 40 * S, x + w - 2 * S, gy - 40 * S, x + w - 5 * S, gy - 21 * S);
    ctx.quadraticCurveTo(cx, gy - 12 * S, x + 5 * S, gy - 21 * S);
    ctx.closePath();
    const g1 = ctx.createLinearGradient(0, gy - 42 * S, 0, gy - 12 * S);
    g1.addColorStop(0, '#FFB4C7');
    g1.addColorStop(1, '#F27996');
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline);
    ctx.lineWidth = 3.2 * S;
    ctx.stroke();

    // Top shell
    ctx.beginPath();
    ctx.ellipse(cx, gy - 45 * S, w * 0.5, 19 * S, 0, Math.PI, TAU);
    ctx.quadraticCurveTo(cx, gy - 35 * S, x + 4 * S, gy - 45 * S);
    ctx.closePath();
    const g2 = ctx.createLinearGradient(0, gy - 64 * S, 0, gy - 34 * S);
    g2.addColorStop(0, '#FFC4D3');
    g2.addColorStop(1, '#EF7E9A');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline);
    ctx.lineWidth = 3.2 * S;
    ctx.stroke();

    // Sprinkles
    ctx.fillStyle = '#FFF9E9';
    for (const dot of [[-18, -44], [13, -50], [28, -40], [-3, -53], [7, -39]]) {
      ctx.beginPath();
      ctx.ellipse(cx + dot[0] * S, gy + dot[1] * S, 2.3 * S, 1.3 * S, -0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - 14 * S, gy - 51 * S, 5 * S, 2.5 * S, -0.2, 0, TAU);
    ctx.fill();
  }

  function drawOverheadObstacle(o) {
    const p = currentPalette;
    const x = o.x;
    const w = o.w;
    const h = o.h;
    const gy = groundY;
    const bottom = gy - o.opening;
    const top = bottom - h;
    const sway = Math.sin(clock * 2 + o.seed) * 1.2 * S;

    // Ground shadow
    ctx.fillStyle = 'rgba(74,44,38,0.09)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, gy + 3 * S, w * 0.42, 4.5 * S, 0, 0, TAU);
    ctx.fill();

    // Ropes
    ctx.strokeStyle = '#FFF3D4';
    ctx.lineWidth = 3.2 * S;
    const rope1 = x + w * 0.24;
    const rope2 = x + w * 0.76;
    ctx.beginPath();
    ctx.moveTo(rope1 + sway, -10);
    ctx.quadraticCurveTo(rope1 - 5 * S, top * 0.45, rope1, top + 7 * S);
    ctx.moveTo(rope2 + sway, -10);
    ctx.quadraticCurveTo(rope2 + 5 * S, top * 0.45, rope2, top + 7 * S);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(99,59,45,0.2)';
    ctx.lineWidth = 1.4 * S;
    ctx.stroke();

    // Cloth
    ctx.save();
    ctx.translate(sway, 0);
    const cloth = () => {
      ctx.beginPath();
      ctx.moveTo(x + 7 * S, top + 4 * S);
      ctx.quadraticCurveTo(x + w * 0.5, top - 7 * S, x + w - 7 * S, top + 4 * S);
      ctx.lineTo(x + w - 3 * S, bottom - 10 * S);
      for (let i = 5; i >= 0; i--) {
        const bx = x + 3 * S + (i / 6) * (w - 6 * S);
        ctx.quadraticCurveTo(bx + (w - 6 * S) / 12, bottom + 5 * S, bx, bottom - 1 * S);
      }
      ctx.closePath();
    };

    cloth();
    const clothGrad = ctx.createLinearGradient(0, top, 0, bottom);
    clothGrad.addColorStop(0, '#FF8BA2');
    clothGrad.addColorStop(0.48, '#F46386');
    clothGrad.addColorStop(1, '#D94870');
    ctx.fillStyle = clothGrad;
    ctx.fill();
    ctx.lineWidth = 3.4 * S;
    ctx.strokeStyle = rgba(p.outline);
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Stripes and trim
    ctx.save();
    cloth();
    ctx.clip();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#FFF8E8';
    for (let sx = x - w; sx < x + w * 2; sx += 36 * S) {
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.lineTo(sx + 15 * S, top);
      ctx.lineTo(sx + 32 * S, bottom);
      ctx.lineTo(sx + 17 * S, bottom);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFF2C9';
    ctx.fillRect(x, bottom - 13 * S, w, 5 * S);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#6F3B44';
    ctx.fillRect(x, bottom - 8 * S, w, 3 * S);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Center emblem
    ctx.beginPath();
    ctx.arc(x + w / 2, top + h * 0.47, 17 * S, 0, TAU);
    ctx.fillStyle = '#FFF4D1';
    ctx.fill();
    ctx.lineWidth = 2.3 * S;
    ctx.strokeStyle = rgba(p.outline, 0.9);
    ctx.stroke();
    starPath(ctx, x + w / 2, top + h * 0.47, 10 * S, 4.5 * S, 5, -Math.PI / 2);
    ctx.fillStyle = '#F5AE43';
    ctx.fill();
    ctx.lineWidth = 1.4 * S;
    ctx.stroke();

    // Little bows on the rope
    const bowX = rope1;
    ctx.fillStyle = '#FFCF56';
    ctx.strokeStyle = rgba(p.outline);
    ctx.lineWidth = 1.6 * S;
    ctx.beginPath();
    ctx.ellipse(bowX - 6 * S, top + 5 * S, 6 * S, 4 * S, -0.5, 0, TAU);
    ctx.ellipse(bowX + 5 * S, top + 5 * S, 6 * S, 4 * S, 0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bowX, top + 5 * S, 2.5 * S, 0, TAU);
    ctx.fillStyle = '#E38C38';
    ctx.fill();
    ctx.restore();
  }

  function drawCandies() {
    for (const c of candies) {
      if (c.dead) continue;
      drawCandy(c);
    }
  }

  function drawCandy(c) {
    const bob = c.magnet ? 0 : Math.sin(clock * 3.4 + c.phase) * 2.8 * S;
    const x = c.x;
    const y = c.y + bob;
    const p = currentPalette;
    const angle = Math.sin(clock * 2.6 + c.phase) * 0.08;

    ctx.save();
    if (c.type === 'gold') {
      const pulse = 0.82 + Math.sin(clock * 5 + c.phase) * 0.18;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 38 * S * pulse);
      glow.addColorStop(0, 'rgba(255,231,147,0.62)');
      glow.addColorStop(0.5, 'rgba(255,206,92,0.2)');
      glow.addColorStop(1, 'rgba(255,206,92,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 38 * S, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#FFF2B0';
      ctx.lineWidth = 2 * S;
      ctx.lineCap = 'round';
      const rays = 4;
      for (let i = 0; i < rays; i++) {
        const a = clock * 0.7 + (i / rays) * TAU;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 24 * S, y + Math.sin(a) * 24 * S);
        ctx.lineTo(x + Math.cos(a) * 33 * S, y + Math.sin(a) * 33 * S);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.translate(x, y);
      ctx.rotate(angle);
      starPath(ctx, 0, 0, 18 * S, 8.3 * S, 5, -Math.PI / 2);
      ctx.fillStyle = '#FFD454';
      ctx.fill();
      ctx.lineWidth = 3.2 * S;
      ctx.strokeStyle = '#A76B20';
      ctx.stroke();
      starPath(ctx, -1 * S, -1 * S, 9 * S, 4 * S, 5, -Math.PI / 2);
      ctx.fillStyle = 'rgba(255,251,202,0.58)';
      ctx.fill();
      ctx.restore();
      return;
    }

    if (c.type === 'heart') {
      const pulse = 1 + Math.sin(clock * 5 + c.phase) * 0.06;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 32 * S);
      glow.addColorStop(0, 'rgba(255,111,145,0.25)');
      glow.addColorStop(1, 'rgba(255,111,145,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 32 * S, 0, TAU);
      ctx.fill();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(clock * 2 + c.phase) * 0.08);
      ctx.scale(pulse, pulse);
      heartPath(ctx, 0, 1 * S, 16 * S);
      ctx.fillStyle = '#FF6D8D';
      ctx.fill();
      ctx.lineWidth = 3 * S;
      ctx.strokeStyle = '#8F3A4F';
      ctx.stroke();
      ctx.strokeStyle = '#5EA65C';
      ctx.lineWidth = 3 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -13 * S);
      ctx.quadraticCurveTo(2 * S, -20 * S, 7 * S, -21 * S);
      ctx.stroke();
      ctx.fillStyle = '#6BB667';
      ctx.beginPath();
      ctx.ellipse(4 * S, -19 * S, 5 * S, 2.5 * S, -0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFEAC2';
      for (const seed of [[-5, -1], [4, -4], [-1, 6], [6, 3]]) {
        ctx.beginPath();
        ctx.ellipse(seed[0] * S, seed[1] * S, 0.8 * S, 1.2 * S, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-6 * S, -5 * S, 3 * S, 1.8 * S, -0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }

    const color = CANDY_COLORS[c.colorIndex % CANDY_COLORS.length];
    // Soft halo
    const halo = ctx.createRadialGradient(x, y, 1, x, y, 26 * S);
    halo.addColorStop(0, `${color.fill}22`);
    halo.addColorStop(1, `${color.fill}00`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 26 * S, 0, TAU);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(angle);
    starPath(ctx, 0, 0, 13.2 * S, 6 * S, 5, -Math.PI / 2);
    ctx.fillStyle = color.fill;
    ctx.fill();
    ctx.lineWidth = 2.7 * S;
    ctx.strokeStyle = color.dark;
    ctx.stroke();
    starPath(ctx, -1.7 * S, -2 * S, 6.7 * S, 3 * S, 5, -Math.PI / 2);
    ctx.fillStyle = color.light;
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-4 * S, -5 * S, 1.3 * S, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (c.magnet) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color.light;
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.moveTo(18 * S, 0);
      ctx.lineTo(30 * S, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* =========================================================
     Player & home scene rendering
     ========================================================= */
  function drawPlayer() {
    const inHome = mode === 'home';
    const baseY = inHome ? homeGroundY : groundY;
    const airHeight = Math.max(0, baseY - player.y);
    const airT = clamp(airHeight / (160 * S), 0, 1);
    const shadowW = (player.sliding ? 34 : 25) * S * (1 + airT * 0.3);

    ctx.save();
    ctx.globalAlpha = 0.2 - airT * 0.1;
    ctx.fillStyle = 'rgba(73,40,37,1)';
    ctx.beginPath();
    ctx.ellipse(player.x, baseY + 5 * S, shadowW, 6.5 * S, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (inHome) drawHomePedestal(player.x, homeGroundY);
    if (game.feverActive && !inHome) drawFeverAura();

    let pose;
    if (inHome) pose = 'idle';
    else if (player.dead) pose = 'hurt';
    else if (player.sliding) pose = 'slide';
    else if (!player.onGround) pose = player.vy < 0 ? 'jump' : 'fall';
    else pose = 'run';

    let alpha = 1;
    if (player.invincible > 0 && !game.feverActive && !player.dead) {
      alpha = 0.48 + Math.abs(Math.sin(clock * 28)) * 0.52;
    }

    let tilt = 0;
    if (!inHome) {
      if (player.dead) tilt = player.deadAngle;
      else if (!player.onGround) tilt = clamp(player.vy / (5200 * S), -0.09, 0.12);
      else tilt = 0.025 + Math.sin(player.runPhase * 0.6) * 0.01;
    } else {
      tilt = Math.sin(clock * 1.7) * 0.015;
    }

    let sx = 1;
    let sy = 1;
    if (!inHome && !player.onGround && !player.dead) {
      const stretch = clamp(-player.vy / (4800 * S), -0.13, 0.16);
      sy += stretch;
      sx -= stretch * 0.36;
    }
    if (player.landSquash > 0) {
      sx += player.landSquash * 0.13;
      sy -= player.landSquash * 0.15;
    }
    if (game.feverActive && !inHome) {
      sx *= 1 + Math.sin(clock * 7) * 0.012;
      sy *= 1 + Math.cos(clock * 7) * 0.012;
    }

    const baseScale = (inHome ? 1.26 : 1.03) * S;
    ctx.globalAlpha = alpha;
    drawPurin(ctx, player.x, player.y, baseScale, {
      pose,
      phase: player.runPhase,
      time: clock,
      blink: player.blink > 0,
      hurt: player.hurtTimer > 0 || player.dead,
      tilt,
      sx,
      sy,
      waving: inHome,
      skin: selectedSkin(),
    });
    ctx.globalAlpha = 1;

    if (inHome) drawHomeCharms();
  }

  function drawFeverAura() {
    ctx.save();
    const cx = player.x;
    const cy = player.y - 40 * S;
    for (let i = 0; i < 3; i++) {
      const progress = (clock * 0.55 + i * 0.33) % 1;
      const radius = (48 + progress * 45) * S;
      ctx.globalAlpha = (1 - progress) * 0.34;
      ctx.strokeStyle = `hsl(${(clock * 90 + i * 120) % 360} 90% 72%)`;
      ctx.lineWidth = 3.5 * S;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 75 * S);
    glow.addColorStop(0, 'rgba(255,244,185,0.26)');
    glow.addColorStop(0.55, 'rgba(255,155,192,0.12)');
    glow.addColorStop(1, 'rgba(255,155,192,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 75 * S, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawHomePedestal(cx, y) {
    const p = currentPalette;
    const w = 172 * S;
    ctx.save();

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = 'rgba(76,43,39,1)';
    ctx.beginPath();
    ctx.ellipse(cx, y + 16 * S, w * 0.5, 15 * S, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cake-stand tiers
    ctx.beginPath();
    ctx.ellipse(cx, y + 10 * S, w * 0.48, 15 * S, 0, 0, TAU);
    ctx.fillStyle = rgba(p.pathTop);
    ctx.fill();
    ctx.lineWidth = 2.4 * S;
    ctx.strokeStyle = rgba(p.outline, 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, y + 5 * S, w * 0.44, 13 * S, 0, 0, TAU);
    ctx.fillStyle = '#FFF6E2';
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.6);
    ctx.stroke();

    // Scalloped frosting rim
    ctx.fillStyle = '#FFF9EA';
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 18 * S, y + 8 * S, 8 * S, 0.15, Math.PI - 0.15);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.ellipse(cx, y + 3 * S, w * 0.36, 9 * S, 0, 0, TAU);
    ctx.fillStyle = '#FFE79A';
    ctx.fill();
    ctx.strokeStyle = rgba(p.outline, 0.35);
    ctx.lineWidth = 1.5 * S;
    ctx.stroke();

    // Sprinkles on the platform
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.4;
      const rx = Math.cos(a) * w * 0.36;
      const ry = Math.sin(a) * 9 * S;
      ctx.save();
      ctx.translate(cx + rx, y + 3 * S + ry);
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#FF8FA5' : '#7CD9B9';
      roundRectPath(ctx, -1.4 * S, -3.5 * S, 2.8 * S, 7 * S, 1.4 * S);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHomeCharms() {
    const cx = player.x;
    const baseY = homeGroundY;
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const t = clock * (0.45 + i * 0.05) + i * 1.7;
      const orbit = 78 + (i % 3) * 22;
      const x = cx + Math.cos(t * 0.8 + i) * orbit * S;
      const y = baseY - 110 * S + Math.sin(t + i * 2.1) * 42 * S;
      const size = (3.5 + (i % 3) * 1.6) * S;
      const alpha = 0.4 + Math.sin(t * 1.7) * 0.18;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      if (i % 3 === 1) {
        heartPath(ctx, x, y, size * 0.95);
        ctx.fillStyle = '#FF9DB2';
        ctx.fill();
      } else {
        starPath(ctx, x, y, size, size * 0.45, 4, t);
        ctx.fillStyle = i % 2 ? '#FFF0A5' : '#FFF9E6';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* =========================================================
     HUD overlays drawn on canvas
     ========================================================= */
  function drawComboBadge() {
    if (mode !== 'playing' && mode !== 'dying') return;
    if (game.combo < 2 || game.comboTimer <= 0) return;

    const mult = comboMultiplier();
    const y = Math.max(120, H * 0.17);
    const width = (126 + (mult > 1 ? 12 : 0)) * S;
    const height = 35 * S;
    const pulse = 1 + game.comboPulse * 0.11;
    const timerT = clamp(game.comboTimer / game.comboTimerMax, 0, 1);

    ctx.save();
    ctx.translate(W / 2, y);
    ctx.scale(pulse, pulse);
    roundRectPath(ctx, -width / 2, -height / 2, width, height, height / 2);
    ctx.fillStyle = game.feverActive ? 'rgba(255,246,218,0.9)' : 'rgba(255,250,239,0.82)';
    ctx.fill();
    ctx.lineWidth = 2 * S;
    ctx.strokeStyle = game.feverActive ? 'rgba(255,180,93,0.9)' : 'rgba(255,125,150,0.6)';
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `900 ${Math.round(8 * S)}px ${FONT_NUMBER}`;
    ctx.fillStyle = 'rgba(99,59,45,0.56)';
    ctx.fillText('COMBO', -width / 2 + 13 * S, -1 * S);

    ctx.font = `900 ${Math.round(19 * S)}px ${FONT_NUMBER}`;
    ctx.fillStyle = game.feverActive ? '#B76130' : '#633B2D';
    ctx.fillText(String(game.combo), -width / 2 + 52 * S, 0);

    const chipX = width / 2 - 18 * S;
    ctx.beginPath();
    ctx.arc(chipX, 0, 12 * S, 0, TAU);
    ctx.fillStyle = game.feverActive ? '#FFB45B' : '#FF7897';
    ctx.fill();
    ctx.font = `900 ${Math.round(11 * S)}px ${FONT_NUMBER}`;
    ctx.fillStyle = '#FFF9EA';
    ctx.textAlign = 'center';
    ctx.fillText(`×${mult}`, chipX, 0);

    // Combo countdown
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 10 * S, height / 2 - 4 * S);
    ctx.lineTo(-width / 2 + 10 * S + (width - 20 * S) * timerT, height / 2 - 4 * S);
    ctx.strokeStyle = game.feverActive ? 'rgba(255,186,92,0.9)' : 'rgba(255,112,141,0.7)';
    ctx.lineWidth = 2 * S;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawFeverScreen() {
    if (!game.feverActive) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock * 7.5);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.12, W / 2, H * 0.46, H * 0.7);
    glow.addColorStop(0, 'rgba(255,235,167,0)');
    glow.addColorStop(0.58, `rgba(255,126,169,${0.035 + pulse * 0.025})`);
    glow.addColorStop(1, `rgba(151,201,255,${0.12 + pulse * 0.05})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Rotating rays behind the runner
    ctx.translate(player.x, player.y - 36 * S);
    ctx.globalAlpha = 0.055 + pulse * 0.025;
    for (let i = 0; i < 10; i++) {
      const a = clock * 0.35 + (i / 10) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.045) * W * 1.4, Math.sin(a - 0.045) * W * 1.4);
      ctx.lineTo(Math.cos(a + 0.045) * W * 1.4, Math.sin(a + 0.045) * W * 1.4);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#FFF1A9' : '#FF9EC4';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlash() {
    if (game.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(game.flash * 0.72, 0, 0.68);
    ctx.fillStyle = game.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawVignette() {
    if (mode === 'home') return;
    ctx.save();
    const v = ctx.createRadialGradient(W / 2, H * 0.47, H * 0.25, W / 2, H * 0.47, H * 0.76);
    v.addColorStop(0, 'rgba(66,36,39,0)');
    v.addColorStop(1, 'rgba(66,36,39,0.16)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* =========================================================
     Render main
     ========================================================= */
  function render() {
    if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (game.shake > 0.2 && mode !== 'paused') {
      const shake = game.shake;
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
    }

    drawBackground();
    if (mode !== 'home') drawSpeedLines();

    if (mode === 'home') {
      drawPlayer();
      drawParticles();
    } else {
      drawCandies();
      drawObstacles();
      drawPlayer();
      drawParticles();
    }

    ctx.restore();

    drawFeverScreen();
    drawComboBadge();
    drawFlash();
    drawVignette();
  }

  /* =========================================================
     HUD & UI sync
     ========================================================= */
  function buildHearts() {
    const path = 'M8 14.7S1.2 10.5 1.2 5.6C1.2 3.1 3.1 1.5 5.1 1.5c1.2 0 2.3.6 2.9 1.7.6-1.1 1.7-1.7 2.9-1.7 2 0 3.9 1.6 3.9 4.1 0 4.9-6.8 9.1-6.8 9.1z';
    heartsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.className = 'heart';
      span.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
      heartsEl.appendChild(span);
    }
    lastHeartsRendered = -1;
    syncHearts(false);
  }

  function syncHearts(animate = false) {
    if (!heartsEl.children.length) buildHearts();
    const children = heartsEl.children;
    for (let i = 0; i < children.length; i++) {
      const full = i < game.hearts;
      children[i].classList.toggle('empty', !full);
      children[i].classList.toggle('lost', !full && animate && i === game.hearts);
    }
    heartsEl.setAttribute('aria-label', `のこりハート ${game.hearts}`);
    lastHeartsRendered = game.hearts;
  }

  let lastHudPaint = 0;
  let lastHud = { score: -1, distance: -1, coins: -1, fever: -1, feverActive: null };

  function syncHud(force = false) {
    const t = now();
    if (!force && t - lastHudPaint < 48) return;
    lastHudPaint = t;
    const score = Math.floor(game.score);
    const distance = Math.floor(game.distanceM);
    if (force || score !== lastHud.score) {
      scoreValueEl.textContent = formatNumber(score);
      lastHud.score = score;
    }
    if (force || distance !== lastHud.distance) {
      distanceValueEl.textContent = formatNumber(distance);
      lastHud.distance = distance;
    }
    if (force || game.runCoins !== lastHud.coins) {
      coinRunValueEl.textContent = formatNumber(game.runCoins);
      lastHud.coins = game.runCoins;
    }
    const feverPct = game.feverActive ? (game.feverTime / FEVER_DURATION) * 100 : game.fever;
    const roundedFever = Math.round(feverPct);
    if (force || roundedFever !== lastHud.fever) {
      feverFillEl.style.width = `${clamp(feverPct, 0, 100)}%`;
      lastHud.fever = roundedFever;
    }
    if (force || game.feverActive !== lastHud.feverActive) {
      hud.classList.toggle('fever', game.feverActive);
      lastHud.feverActive = game.feverActive;
    }
    if (lastHeartsRendered !== game.hearts) syncHearts(true);
  }

  function updateHomeStats() {
    homeBestEl.textContent = formatNumber(save.best);
    homeCoinsEl.textContent = formatNumber(save.coins);
    shopCoinsEl.textContent = formatNumber(save.coins);
    missionsCoinsEl.textContent = formatNumber(save.coins);
  }

  function refreshDailyDot() {
    if (!dailyDotEl) return;
    dailyDotEl.hidden = !hasClaimableMission();
  }

  function refreshSoundUI() {
    const on = audio.enabled;
    homeSoundButton.classList.toggle('is-muted', !on);
    homeSoundButton.setAttribute('aria-label', on ? 'サウンドをOFFにする' : 'サウンドをONにする');
    if (pauseSoundLabel) pauseSoundLabel.textContent = on ? 'サウンド ON' : 'サウンド OFF';
  }

  function toggleSound() {
    audio.unlock();
    audio.setEnabled(!audio.enabled);
    refreshSoundUI();
    audio.click();
    showToast(audio.enabled ? 'サウンド ON' : 'サウンド OFF', 1000);
  }

  function showToast(message, duration = 1800) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('toast-game', mode === 'playing' || mode === 'dying' || mode === 'paused');
    toastEl.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove('is-show');
      toastTimer = 0;
    }, duration);
  }

  function showAnnounce(kicker, title, kind = '', duration = 1500) {
    if (announceTimer) clearTimeout(announceTimer);
    announceEl.className = `announce${kind ? ` ${kind}` : ''}`;
    void announceEl.offsetWidth;
    announceKickerEl.textContent = kicker;
    announceTitleEl.textContent = title;
    announceEl.classList.add('is-show');
    announceTimer = window.setTimeout(() => {
      announceEl.classList.remove('is-show');
      announceTimer = 0;
    }, duration);
  }

  /* =========================================================
     Sheets: friends & daily missions
     ========================================================= */
  function openSheet(name) {
    if (mode !== 'home') return;
    closeSheets();
    activeSheet = name;
    const screen = name === 'shop' ? shopScreen : missionsScreen;
    screen.classList.add('is-active');
    screen.setAttribute('aria-hidden', 'false');
    if (name === 'shop') renderShop();
    else renderMissions();
    updateHomeStats();
    refreshDailyDot();
    audio.unlock();
    audio.click();
  }

  function closeSheets() {
    shopScreen.classList.remove('is-active');
    shopScreen.setAttribute('aria-hidden', 'true');
    missionsScreen.classList.remove('is-active');
    missionsScreen.setAttribute('aria-hidden', 'true');
    activeSheet = null;
  }

  function renderShop() {
    shopListEl.innerHTML = SKINS.map((skin) => {
      const owned = save.owned.includes(skin.id);
      const selected = save.selected === skin.id;
      const affordable = save.coins >= skin.cost;
      let actionClass = 'friend-action';
      let actionLabel = '';
      let disabled = '';
      if (!owned) {
        actionClass += affordable ? '' : ' is-locked';
        actionLabel = `<span class="friend-cost"><span class="tiny-star">★</span>${formatNumber(skin.cost)}</span>`;
      } else if (selected) {
        actionClass += ' is-selected';
        actionLabel = 'えらんだ';
        disabled = ' disabled';
      } else {
        actionClass += ' is-owned';
        actionLabel = 'えらぶ';
      }
      return `
        <article class="friend-card${selected ? ' is-selected' : ''}">
          <div class="friend-preview"><img src="${thumbnails[skin.id] || ''}" alt="" draggable="false"></div>
          <div class="friend-info">
            <div class="friend-name-line">
              <span class="friend-name">${skin.name}</span>
              ${selected ? '<span class="friend-badge">いまのなかま</span>' : ''}
            </div>
            <p class="friend-trait">${skin.trait}</p>
          </div>
          <button class="${actionClass}" data-skin="${skin.id}" type="button"${disabled}>${actionLabel}</button>
        </article>`;
    }).join('');
    updateHomeStats();
  }

  function buyOrSelectSkin(id) {
    const skin = getSkin(id);
    const owned = save.owned.includes(id);
    if (!owned) {
      if (save.coins < skin.cost) {
        audio.error();
        showToast('コインがたりないよ。ランであつめよう！', 1700);
        return;
      }
      save.coins -= skin.cost;
      save.owned.push(id);
      save.selected = id;
      persist();
      audio.buy();
      updateHomeStats();
      renderShop();
      refreshDailyDot();
      showToast(`${skin.name}が なかまになったよ！`, 1700);
      return;
    }
    if (save.selected !== id) {
      save.selected = id;
      persist();
      audio.click();
      renderShop();
      updateHomeStats();
      showToast(`${skin.name}に きがえたよ`, 1200);
    }
  }

  function renderMissions() {
    ensureDaily();
    updateHomeStats();
    missionListEl.innerHTML = MISSIONS.map((mission, index) => {
      const progress = missionProgress(mission);
      const complete = progress >= mission.target;
      const claimed = Boolean(save.daily.claimed[index]);
      const shown = Math.min(progress, mission.target);
      const pct = clamp((progress / mission.target) * 100, 0, 100);
      let button;
      if (claimed) {
        button = '<button class="mission-claim is-claimed" disabled>うけとった</button>';
      } else if (complete) {
        button = `<button class="mission-claim" data-claim="${index}" type="button">うけとる</button>`;
      } else {
        button = '<button class="mission-claim" disabled>まだ</button>';
      }
      return `
        <article class="mission-card${complete ? ' mission-complete' : ''}">
          <div class="mission-icon" aria-hidden="true">${mission.icon}</div>
          <div class="mission-content">
            <div class="mission-head">
              <span class="mission-title">${mission.title}</span>
              <span class="mission-reward">★ ${mission.reward}</span>
            </div>
            <div class="mission-progress-row">
              <div class="mission-progress"><span style="width:${pct}%"></span></div>
              <span class="mission-count">${formatNumber(shown)} / ${formatNumber(mission.target)}</span>
            </div>
          </div>
          ${button}
        </article>`;
    }).join('');
    if (MISSIONS.every((m, i) => save.daily.claimed[i])) {
      missionListEl.insertAdjacentHTML(
        'beforeend',
        '<div class="mission-empty">きょうのミッションは<br>ぜんぶクリア！ また明日も走ろう。</div>'
      );
    }
    refreshDailyDot();
  }

  function claimMission(index) {
    ensureDaily();
    const mission = MISSIONS[index];
    if (!mission) return;
    if (missionProgress(mission) < mission.target || save.daily.claimed[index]) return;
    save.daily.claimed[index] = true;
    save.coins += mission.reward;
    persist();
    audio.reward();
    updateHomeStats();
    renderMissions();
    refreshDailyDot();
    showToast(`コイン +${mission.reward} うけとったよ！`, 1600);
  }

  /* =========================================================
     Input
     ========================================================= */
  function flashControl(el) {
    if (!el) return;
    el.classList.add('is-pressed');
    if (el._pressTimer) clearTimeout(el._pressTimer);
    el._pressTimer = window.setTimeout(() => el.classList.remove('is-pressed'), 135);
  }

  function handleGamePointer(e) {
    if (mode !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('[data-ui], button, .screen.is-active, .sheet')) return;
    const rect = app.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      trySlide();
      flashControl(slideVisual);
    } else {
      tryJump();
      flashControl(jumpVisual);
    }
    e.preventDefault();
  }

  function handleKeyDown(e) {
    if (e.repeat) return;
    const code = e.code;

    if (activeSheet) {
      if (code === 'Escape') {
        closeSheets();
        audio.click();
      }
      return;
    }

    if (mode === 'playing') {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
        e.preventDefault();
        tryJump();
        flashControl(jumpVisual);
      } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        trySlide();
        flashControl(slideVisual);
      } else if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        pauseGame();
      }
      return;
    }

    if (mode === 'paused') {
      if (code === 'Escape' || code === 'KeyP' || code === 'Enter') {
        e.preventDefault();
        resumeGame();
      }
      return;
    }

    if (mode === 'result') {
      if (code === 'Enter' || code === 'KeyR') {
        if (e.target.closest && e.target.closest('button')) return;
        e.preventDefault();
        startRun();
      } else if (code === 'Escape') {
        quitToHome();
      }
      return;
    }

    if (mode === 'home') {
      if ((code === 'Space' || code === 'Enter') && !(e.target.closest && e.target.closest('button'))) {
        e.preventDefault();
        startRun();
      }
    }
  }

  function bindEvents() {
    app.addEventListener('pointerdown', handleGamePointer, { passive: false });
    app.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

    playButton.addEventListener('click', () => {
      audio.click();
      startRun();
    });
    shopButton.addEventListener('click', () => openSheet('shop'));
    missionsButton.addEventListener('click', () => openSheet('missions'));
    homeSoundButton.addEventListener('click', toggleSound);
    pauseButton.addEventListener('click', (e) => {
      e.stopPropagation();
      pauseGame();
    });
    resumeButton.addEventListener('click', resumeGame);
    pauseHomeButton.addEventListener('click', quitToHome);
    pauseSoundButton.addEventListener('click', toggleSound);
    retryButton.addEventListener('click', () => startRun());
    resultHomeButton.addEventListener('click', quitToHome);

    shopListEl.addEventListener('click', (e) => {
      const button = e.target.closest('[data-skin]');
      if (!button) return;
      buyOrSelectSkin(button.getAttribute('data-skin'));
    });
    missionListEl.addEventListener('click', (e) => {
      const button = e.target.closest('[data-claim]');
      if (!button) return;
      claimMission(Number(button.getAttribute('data-claim')));
    });
    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => {
        closeSheets();
        audio.click();
      });
    });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', scheduleResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', () => setTimeout(scheduleResize, 160));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && mode === 'playing') pauseGame();
    });

    app.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    window.addEventListener('pagehide', () => {
      if (mode === 'playing' && !game.runCommitted) {
        commitRun();
      }
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        lastFrame = now();
        if (mode === 'playing') pauseGame();
      }
    });
  }

  /* =========================================================
     Local QA helpers (only available with ?debug)
     ========================================================= */
  function installDebugApi() {
    if (!DEBUG) return;
    window.__PURIN__ = {
      get mode() {
        return mode;
      },
      get state() {
        return {
          mode,
          score: game.score,
          distance: game.distanceM,
          hearts: game.hearts,
          combo: game.combo,
          maxCombo: game.maxCombo,
          fever: game.fever,
          feverActive: game.feverActive,
          stage: game.stage,
          speed: game.speed,
          player: {
            x: player.x,
            y: player.y,
            vy: player.vy,
            onGround: player.onGround,
            jumps: player.jumps,
            sliding: player.sliding,
            invincible: player.invincible,
          },
          obstacles: obstacles.map((o) => ({ type: o.type, x: o.x, w: o.w, h: o.h, opening: o.opening })),
          candies: candies.length,
          save: { best: save.best, coins: save.coins, selected: save.selected, owned: save.owned.slice() },
        };
      },
      get player() {
        return player;
      },
      get game() {
        return game;
      },
      get save() {
        return save;
      },
      get obstacles() {
        return obstacles;
      },
      get candies() {
        return candies;
      },
      startRun,
      pause: pauseGame,
      resume: resumeGame,
      home: () => enterHome(),
      die: startDeath,
      warp(metres) {
        game.distanceM = metres;
        updateStage();
      },
      setStage(index) {
        game.stage = clamp(index, 0, STAGES.length - 1);
        setStagePalette(game.stage, true);
      },
      fever() {
        startFever();
      },
      addCoins(amount) {
        save.coins = Math.max(0, save.coins + amount);
        persist();
        updateHomeStats();
      },
      spawnObstacle,
      spawnCandyPattern,
    };
  }

  /* =========================================================
     Main loop
     ========================================================= */
  function monitorRenderQuality(timestamp) {
    if (DEBUG || mode !== 'playing') {
      qualitySampleStart = 0;
      qualityFrames = 0;
      return;
    }
    if (!qualitySampleStart) {
      qualitySampleStart = timestamp;
      qualityFrames = 0;
      return;
    }
    qualityFrames++;
    const elapsed = timestamp - qualitySampleStart;
    if (elapsed < 2200) return;

    const fps = (qualityFrames * 1000) / elapsed;
    qualitySampleStart = timestamp;
    qualityFrames = 0;
    if (fps < 42 && renderQuality > QUALITY_MIN) {
      renderQuality = Math.max(QUALITY_MIN, renderQuality - 0.14);
      resizeCanvas();
    }
  }

  function frame(timestamp) {
    const dt = Math.min(0.05, Math.max(0.0001, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    monitorRenderQuality(timestamp);

    if (mode !== 'paused') clock += dt;
    updatePaletteSafe(mode === 'paused' ? 0 : dt);

    if (mode === 'playing') {
      if (game.hitstop > 0) {
        game.hitstop = Math.max(0, game.hitstop - dt);
        updateParticles(dt * 0.25);
        game.flash = Math.max(0, game.flash - dt * 1.2);
      } else {
        updatePlaying(dt);
      }
    } else if (mode === 'home') {
      updateHome(dt);
    } else if (mode === 'dying') {
      updateDying(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  function init() {
    installDebugApi();
    buildThumbnails();
    buildHearts();
    ensureDaily();
    updateHomeStats();
    refreshDailyDot();
    refreshSoundUI();
    bindEvents();
    resizeCanvas();
    mode = 'home';
    player.x = W / 2;
    player.y = homeGroundY;
    requestAnimationFrame((t) => {
      lastFrame = t;
      frame(t);
    });
  }

  init();
})();
