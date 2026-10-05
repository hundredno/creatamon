// Creatamon sound: effects and background music made on the spot with the Web Audio API. No sound files.
// Nothing plays until the player has clicked or pressed something, which is when browsers allow audio to start.
const SFX = (() => {
  const KEY = 'creatamon-options-v1';
  // sfx, music: on or off. auto: battle messages move on by themselves.
  const opts = { sfx: true, music: true, auto: true };
  try { Object.assign(opts, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage unavailable */ }
  const saveOpts = () => { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* storage unavailable */ } };

  let ctx = null, out = null, noise = null;
  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);
    // A second of hiss, for thumps and crashes.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // One note: from `f` Hz, sliding to `to` if given, starting `at` seconds from now.
  function tone(f, dur, { type = 'square', vol = 0.05, to = 0, at = 0 } = {}) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(dur, vol = 0.08, at = 0) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = noise;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g); g.connect(out);
    s.start(t); s.stop(t + dur);
  }
  const run = (notes, step, o) => notes.forEach((f, i) => f && tone(f, step * 1.6, { ...o, at: i * step }));
  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;
  const SOUNDS = {
    blip: () => tone(900, 0.035, { vol: 0.022 }),
    select: () => tone(660, 0.06, { vol: 0.035, to: 990 }),
    back: () => tone(520, 0.06, { vol: 0.03, to: 360 }),
    hit: () => { hiss(0.12, 0.09); tone(170, 0.13, { type: 'sawtooth', vol: 0.06, to: 60 }); },
    strong: () => { hiss(0.16, 0.11); tone(220, 0.16, { type: 'sawtooth', vol: 0.07, to: 55 }); tone(1300, 0.18, { type: 'triangle', vol: 0.05, at: 0.05 }); },
    weak: () => { hiss(0.07, 0.05); tone(140, 0.09, { type: 'triangle', vol: 0.05, to: 90 }); },
    miss: () => tone(340, 0.16, { type: 'sine', vol: 0.05, to: 190 }),
    faint: () => tone(420, 0.5, { type: 'triangle', vol: 0.06, to: 70 }),
    heal: () => run([C5, E5, G5, C6], 0.07, { type: 'sine', vol: 0.05 }),
    item: () => run([E5, G5, C6], 0.07, { vol: 0.035 }),
    level: () => run([C5, E5, G5, C6, E6], 0.065, { vol: 0.04 }),
    badge: () => run([C5, C5, G5, 0, E5, G5, C6, 0, E6, G6], 0.11, { vol: 0.045 }),
    battle: () => run([440, 660, 440, 660, 440, 660, 880], 0.055, { vol: 0.04 }),
    alert: () => run([1180, 0, 1180], 0.07, { vol: 0.045 }),
    bump: () => tone(110, 0.06, { type: 'sine', vol: 0.05 }),
    coin: () => run([988, 1319], 0.06, { vol: 0.035 }),
  };
  function play(name) {
    if (!opts.sfx || !wake()) return;
    try { SOUNDS[name](); } catch (e) { /* audio hiccup: carry on silently */ }
  }

  // ---- Music ----
  // Two pieces, each sixteen bars of eight steps, played in a loop by a small sequencer:
  //   world  - an easy-going tune in C: soft chords, a plucked arpeggio, a wandering melody with a little echo, light drums
  //   battle - hard rock in E minor: chugging distorted power chords, driving bass, a full kit and a lead guitar
  // Notes are MIDI numbers (60 = middle C); 0 is a rest.
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  let bus = null, echo = null, drive = null;
  function rig() {
    if (bus) return;
    bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(out);
    // A soft repeating echo for the calm tune.
    echo = ctx.createDelay(1); echo.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(bus);
    // An overdriven amplifier for the guitars: hard clipping, then the fizz rolled off.
    drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let k = 0; k < 1024; k++) { const x = k / 512 - 1; curve[k] = Math.tanh(x * 9); }
    drive.curve = curve;
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 2600;
    const amp = ctx.createGain(); amp.gain.value = 0.16;
    drive.connect(cab); cab.connect(amp); amp.connect(bus);
  }
  // One voice at an exact time `t`. attack: seconds to swell in. into: where it plays (the bus unless said otherwise).
  function voice(type, f, t, dur, vol, { attack = 0.006, into = bus, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(into);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function drum(kind, t, vol) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.18);
      return;
    }
    // Snare, hi-hat and crash are all shaped hiss.
    const [len, kindOf, freq] = { snare: [0.16, 'bandpass', 1900], hat: [0.035, 'highpass', 7500], crash: [0.7, 'highpass', 4500] }[kind];
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; flt.type = kindOf; flt.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(flt); flt.connect(g); g.connect(bus); src.start(t); src.stop(t + len + 0.02);
    if (kind === 'snare') voice('triangle', 190, t, 0.09, vol * 0.5);
  }
  // A power chord (root, fifth, octave) through the amp. Short ones are the palm-muted chug between the hits.
  const power = (root, t, dur, vol) => [0, 7, 12].forEach((up, k) => voice('sawtooth', hz(root + up), t, dur, vol, { into: drive, detune: k * 6 - 6 }));

  const _ = 0;
  const WORLD = {
    step: 0.326,   // 92 beats a minute, in eighth notes
    //        C             G             Am            Em            F             C             Dm            G
    chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [55, 59, 64], [57, 60, 65], [60, 64, 67], [57, 62, 65], [59, 62, 67],
      //      C             G             Am            Em            F             G             C             C
      [60, 64, 67], [59, 62, 67], [57, 60, 64], [55, 59, 64], [57, 60, 65], [59, 62, 67], [60, 64, 67], [60, 64, 67]],
    roots: [48, 43, 45, 40, 41, 48, 38, 43, 48, 43, 45, 40, 41, 43, 48, 48],
    lead: [[76, _, 79, _, 76, _, 74, 72], [74, _, _, 71, 74, _, 67, _], [72, _, 76, _, 81, _, 79, 76], [79, _, _, 76, _, _, 71, _],
      [69, _, 72, _, 77, _, 76, 72], [76, _, _, 79, 76, _, 72, _], [74, _, 77, _, 81, _, 77, 74], [79, _, _, _, 74, _, 71, _],
      [84, _, 79, _, 76, _, 79, _], [83, _, 79, _, 74, _, 79, _], [81, _, 76, _, 72, _, 76, 81], [79, _, _, 76, _, 71, _, _],
      [77, _, 81, _, 84, _, 81, 77], [79, _, 83, _, 86, _, 83, 79], [88, _, _, 84, _, _, 79, _], [84, _, _, _, _, _, _, _]],
  };
  function worldStep(bar, st, t) {
    const W = WORLD, chord = W.chords[bar], len = W.step;
    // Chords swell in at the top of each bar and hang for the whole of it.
    if (st === 0) chord.forEach((m) => { voice('sine', hz(m), t, len * 8.4, 0.022, { attack: 0.5 }); voice('triangle', hz(m + 12), t, len * 8, 0.006, { attack: 0.8 }); });
    // Bass: root, then the fifth half-way through the bar.
    if (st === 0 || st === 4) { const m = W.roots[bar] + (st ? 7 : 0); voice('sine', hz(m), t, len * 3.6, 0.07, { attack: 0.02 }); voice('triangle', hz(m), t, len * 3, 0.018, { attack: 0.02 }); }
    // A plucked arpeggio rocking up and down the chord, an octave up, into the echo.
    voice('triangle', hz(chord[[0, 1, 2, 1, 0, 2, 1, 2][st]] + 12), t, len * 1.3, 0.014, { into: echo });
    // The melody: a rounder voice doubled an octave down, also echoed. It rests for the first two bars of every other pass.
    const m = W.lead[bar][st];
    if (m) { voice('triangle', hz(m), t, len * 2.2, 0.034, { attack: 0.02 }); voice('sine', hz(m - 12), t, len * 2.2, 0.016, { attack: 0.03 }); voice('sine', hz(m), t, len * 1.5, 0.012, { into: echo }); }
    // Brushed drums come in after the first four bars.
    if (bar >= 4) {
      if (st === 0 || st === 5) drum('kick', t, 0.11);
      if (st === 4) drum('snare', t, 0.028);
      if (st % 2) drum('hat', t, 0.016);
    }
  }

  const BATTLE = {
    step: 0.1875,   // 160 beats a minute, in eighth notes
    //      E5  E5  G5  A5  E5  E5  C5  D5  C5  D5  E5  E5  C5  D5  B5  B5
    roots: [40, 40, 43, 45, 40, 40, 48, 50, 48, 50, 40, 40, 48, 50, 47, 47],
    lead: [[_, _, _, _, _, _, _, _], [_, _, _, _, _, _, _, _], [_, _, _, _, _, _, _, _], [_, _, _, _, _, _, 71, 74],
      [76, _, 76, 79, _, 81, _, 79], [83, _, 81, 79, _, 76, _, _], [79, _, 79, 83, _, 86, _, 83], [81, _, 79, 76, _, 74, 76, _],
      [84, _, 79, 84, _, 88, _, 84], [86, _, 81, 86, _, 90, _, 86], [88, 86, 83, 86, 88, _, 91, 88], [83, _, 81, 79, _, 76, _, _],
      [79, 84, 88, 84, 79, 84, 88, 91], [81, 86, 90, 86, 81, 86, 90, 93], [83, _, 87, _, 90, _, 87, 83], [83, 83, _, 83, 83, _, 95, _]],
  };
  function battleStep(bar, st, t) {
    const B = BATTLE, root = B.roots[bar], len = B.step;
    // Rhythm guitar: full chords on the accents, a tight chug on the root in between.
    if ([0, 3, 6].includes(st)) power(root, t, len * 1.7, 0.5);
    else voice('sawtooth', hz(root), t, len * 0.55, 0.5, { into: drive });
    // Bass doubles the root an octave down on every eighth.
    voice('sawtooth', hz(root - 12), t, len * 0.9, 0.05); voice('sine', hz(root - 12), t, len * 0.95, 0.09);
    // Lead guitar: a hook, then a solo over the second half.
    const m = B.lead[bar][st];
    if (m) { voice('square', hz(m), t, len * 1.8, 0.3, { into: drive, attack: 0.004 }); voice('sawtooth', hz(m), t, len * 1.8, 0.012, { detune: 9 }); }
    // The kit: kick on one, the "and" of two, and three; snare on two and four; hats throughout; a crash every four bars.
    if ([0, 3, 4].includes(st) || (bar % 4 === 3 && st === 7)) drum('kick', t, 0.3);
    if (st === 2 || st === 6) drum('snare', t, 0.13);
    drum('hat', t, st % 2 ? 0.03 : 0.05);
    if (st === 0 && bar % 4 === 0) drum('crash', t, 0.07);
    // A snare roll into each new section.
    if (bar % 8 === 7 && st >= 4) drum('snare', t + len / 2, 0.09);
  }
  const TUNES = { world: [WORLD, worldStep], battle: [BATTLE, battleStep] };

  let tune = null, wanted = null, beat = 0, nextAt = 0, timer = null;
  function tick() {
    if (!tune || !ctx) return;
    const [data, play] = TUNES[tune];
    // Queue notes a little ahead of the clock so the rhythm stays even.
    while (nextAt < ctx.currentTime + 0.3) {
      try { play(Math.floor(beat / 8) % 16, beat % 8, Math.max(ctx.currentTime, nextAt)); } catch (e) { /* audio hiccup: skip the step */ }
      nextAt += data.step; beat++;
    }
  }
  // Start a tune by name, or pass null for quiet.
  function music(name) {
    wanted = name;
    const next = opts.music ? name : null;
    if (next === tune) return;
    tune = next;
    clearInterval(timer);
    if (!tune || !wake()) { tune = null; return; }
    rig();
    // Changing tune cuts the old one's tails short with a quick dip.
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    // The calm tune is written quietly, so it gets more of the bus than the rock one.
    bus.gain.exponentialRampToValueAtTime(tune === 'world' ? 1.1 : 0.62, ctx.currentTime + 0.25);
    beat = 0; nextAt = ctx.currentTime + 0.12;
    timer = setInterval(tick, 60);
  }
  function set(key, on) {
    opts[key] = on;
    saveOpts();
    if (key === 'music') { tune = on ? null : tune; music(wanted); }
  }
  // Browsers hold audio back until the first click or key press; pick the music up from there.
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { if (wanted && !tune && opts.music) music(wanted); }, { passive: true }));

  return { play, music, set, opts };
})();
