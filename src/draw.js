// Creatamon drawing: tiles, people, props, creatures and battle effects.
// The overworld is drawn in 32-unit tiles on a canvas at twice that resolution, so detail goes down to half a unit.
import { CM } from './world.js';

const GFX = (() => {
  const { ELEMENTS } = CM;
  const shade = (hex, f) => `#${[1, 3, 5].map((i) =>
    Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('')}`;
  const TINTS = { Plant: '#7d8496', League: '#e0483c', Stop: '#e8384f' };
  const tintOf = (name) => TINTS[name] || ELEMENTS[name].color;

  // ---------- Tiles ----------
  // [base, speck colours, speck count]
  const GROUND = {
    '.': ['#7ec850', ['#6fb845', '#93d862', '#64ad3e'], 16],
    '=': ['#dcc48e', ['#c9ad78', '#ecdcae', '#bfa26c'], 16],
    c: ['#b9b4a8', ['#a7a296', '#c9c4b8'], 8],
    S: ['#e3c98a', ['#d4b674', '#f0dba6', '#c9aa66'], 14],
    s: ['#eef4fb', ['#d9e6f4', '#ffffff', '#c9dbee'], 12],
    _: ['#7a7380', ['#6b6470', '#8a8390', '#5f5964'], 14],
    F: ['#ddd6c6', ['#d2cab8', '#e6e0d2'], 6],
  };
  const FLOWERS = ['#f08aa0', '#ffffff', '#f6d643', '#b58cf0'];
  const VALVE = { 1: '#e0483c', 2: '#f1c93a', 3: '#3d8fe0' };

  const tileHash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  // Things that stand up off the ground. The 3D view draws their ground here and stands them upright itself.
  const UPRIGHT = '#TkxBm';

  // The standing part of an UPRIGHT tile, without its ground. h is the tile's hash; lit is for braziers.
  function drawUp(g, ch, sx, sy, h, time, lit) {
    const pr = (i) => Math.imul(h + i * 7919, 2654435761) >>> 0;
    const R = (c, a, b, w, hh) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, hh); };
    const C = (c, a, b, r) => { g.fillStyle = c; g.beginPath(); g.arc(sx + a, sy + b, r, 0, 7); g.fill(); };
    const tri = (c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(sx + a, sy + b) : g.moveTo(sx + a, sy + b))); g.fill(); };
    if (ch === '#') {
      R('#6b4a2b', 13, 19, 6, 11); R('#523720', 17, 19, 2, 11); R('#84603c', 13.5, 20, 1, 9);
      C('#1f5f2c', 17, 15, 13); C('#2f7d3a', 16, 13, 12.5); C('#48a653', 11.5, 9, 6); C('#2f7d3a', 21, 17, 5.5);
      for (let i = 0; i < 9; i++) { const v = pr(i + 60); R(i % 3 ? '#1f5f2c' : '#48a653', 6 + v % 20, 4 + (v >>> 8) % 18, 1.5, 1); }
    } else if (ch === 'T') {
      R('#5a3d24', 14, 22, 4, 9);
      [[16, 2, 7], [16, 9, 10], [16, 16, 13]].forEach(([cx, top, half]) => {
        tri('#1f5a48', [[cx, top], [cx + half, top + 9], [cx - half, top + 9]]);
        tri('#f4f9ff', [[cx, top], [cx + half * 0.5, top + 4], [cx - half * 0.5, top + 4]]);
        R('#2c7a62', cx - half * 0.6, top + 6, 1.5, 1); R('#f4f9ff', cx + half * 0.3, top + 6.5, 2, 1);
      });
    } else if (ch === 'k') {
      tri('#6fb6d6', [[5, 28], [11, 6], [17, 14], [22, 4], [28, 28]]);
      tri('#b8e6f7', [[8, 28], [11, 9], [14, 28]]); tri('#b8e6f7', [[19, 28], [22, 7], [24, 28]]); R('#ffffff', 10.5, 11, 1, 5);
    } else if (ch === 'x') {
      C('#5d5666', 16, 17, 13); C('#7c7486', 15, 15, 11.5); C('#948c9e', 12, 11, 5);
      g.strokeStyle = '#2c2832'; g.lineWidth = 0.75; g.beginPath();
      [[16, 4], [14, 11], [18, 15], [13, 21], [16, 28]].forEach(([a, b], i) => (i ? g.lineTo(sx + a, sy + b) : g.moveTo(sx + a, sy + b)));
      g.moveTo(sx + 18, sy + 15); g.lineTo(sx + 25, sy + 12); g.moveTo(sx + 14, sy + 11); g.lineTo(sx + 7, sy + 13); g.stroke();
    } else if (ch === 'm') {
      R('#e9e2cf', 14.5, 16, 3, 9); R('#cfc7b0', 16.5, 16, 1, 9);
      g.fillStyle = '#39c7b3'; g.beginPath(); g.ellipse(sx + 16, sy + 15, 9, 6, 0, Math.PI, 0); g.fill();
      R('#2aa392', 7, 15, 18, 1); R('#bffff3', 11, 11, 2, 1.5); R('#bffff3', 18, 12.5, 1.5, 1); R('#bffff3', 15, 10, 1, 1);
    } else if (ch === 'B') {
      R('#3a3a52', 13, 18, 6, 11); R('#55557a', 13, 18, 1.5, 11);
      R('#2c2c3c', 6, 13, 20, 6); R('#6a6a92', 6, 13, 20, 1.5); R('#1c1c28', 8, 14.5, 16, 2);
      if (lit) {
        const fl = Math.sin(time / 90 + h) * 1.5;
        g.fillStyle = '#f47a45'; g.beginPath(); g.moveTo(sx + 8, sy + 15); g.quadraticCurveTo(sx + 9, sy + 4, sx + 16 + fl, sy + 0.5); g.quadraticCurveTo(sx + 23, sy + 6, sx + 24, sy + 15); g.fill();
        g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(sx + 11, sy + 15); g.quadraticCurveTo(sx + 12, sy + 8, sx + 16 - fl, sy + 5); g.quadraticCurveTo(sx + 20, sy + 9, sx + 21, sy + 15); g.fill();
        R('#fff3a8', 15, 11, 2, 4);
      }
    }
  }

  // Spray-paint designs, stencilled on the ground.
  const SPRAYS = {
    star: 'Star', smile: 'Smiley', heart: 'Heart', bolt: 'Bolt', skull: 'Skull', flower: 'Flower', paw: 'Paw', crown: 'Crown', swirl: 'Swirl', wolf: 'Wolf',
  };
  function drawSpray(g, id, sx, sy) {
    const P2 = (c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(sx + a, sy + b) : g.moveTo(sx + a, sy + b))); g.fill(); };
    const C = (c, a, b, r) => { g.fillStyle = c; g.beginPath(); g.arc(sx + a, sy + b, r, 0, 7); g.fill(); };
    const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, h); };
    g.save(); g.globalAlpha = 0.82;
    if (id === 'star') P2('#f1c93a', [[16, 3], [19.5, 12], [29, 12.5], [21.5, 18.5], [24, 28], [16, 22.5], [8, 28], [10.5, 18.5], [3, 12.5], [12.5, 12]]);
    else if (id === 'smile') { C('#f6d643', 16, 16, 12); C('#1c1c28', 11.5, 12.5, 1.8); C('#1c1c28', 20.5, 12.5, 1.8); g.strokeStyle = '#1c1c28'; g.lineWidth = 1.6; g.beginPath(); g.arc(sx + 16, sy + 16, 6.5, 0.3, Math.PI - 0.3); g.stroke(); }
    else if (id === 'heart') { C('#e0483c', 11, 12, 6.5); C('#e0483c', 21, 12, 6.5); P2('#e0483c', [[5, 15], [27, 15], [16, 28]]); }
    else if (id === 'bolt') P2('#f6d643', [[19, 2], [8, 17], [15, 17], [12, 30], [24, 13], [17, 13]]);
    else if (id === 'skull') { C('#e9e2cf', 16, 13, 10); R('#e9e2cf', 10, 19, 12, 8); C('#1c1c28', 12, 13, 2.6); C('#1c1c28', 20, 13, 2.6); R('#1c1c28', 15.5, 17, 1.2, 3); for (const x of [12, 15.5, 19]) R('#1c1c28', x, 23, 1, 4); }
    else if (id === 'flower') { for (let i = 0; i < 6; i++) C('#f08aa0', 16 + Math.cos(i * 1.047) * 8, 16 + Math.sin(i * 1.047) * 8, 5); C('#f6d643', 16, 16, 4.5); }
    else if (id === 'paw') { C('#8a5a2b', 16, 20, 7); for (const [a, b] of [[7, 12], [13, 7], [20, 7], [26, 12]]) C('#8a5a2b', a, b, 3.2); }
    else if (id === 'crown') { P2('#f1c93a', [[4, 26], [4, 9], [10, 16], [16, 5], [22, 16], [28, 9], [28, 26]]); R('#c79a12', 4, 23, 24, 3); C('#e0483c', 16, 19, 2); }
    else if (id === 'swirl') { g.strokeStyle = '#3d8fe0'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); for (let a = 0; a < 15; a += 0.2) { const r = 1 + a * 0.85; g.lineTo(sx + 16 + Math.cos(a) * r, sy + 16 + Math.sin(a) * r); } g.stroke(); }
    else if (id === 'wolf') { P2('#5b6f9e', [[6, 4], [11, 12], [21, 12], [26, 4], [26, 19], [16, 29], [6, 19]]); P2('#e9e2cf', [[12, 20], [20, 20], [16, 27]]); C('#f1c93a', 11.5, 16, 1.6); C('#f1c93a', 20.5, 16, 1.6); }
    g.restore();
  }

  // flat: draw only the ground of UPRIGHT tiles (for the 3D view).
  function drawTile(g, id, x, y, sx, sy, time, P, S, flat) {
    const ch = CM.charAt(id, x, y), k = `${x},${y}`;
    const h = tileHash(x, y);
    const up = (lit) => { if (!flat) drawUp(g, ch, sx, sy, h, time, lit); };
    const pr = (i) => Math.imul(h + i * 7919, 2654435761) >>> 0;
    const R = (c, a, b, w, hh) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, hh); };
    const C = (c, a, b, r) => { g.fillStyle = c; g.beginPath(); g.arc(sx + a, sy + b, r, 0, 7); g.fill(); };
    const ground = (t) => {
      const [base, specks, n] = GROUND[t] || GROUND['.'];
      R(base, 0, 0, 32, 32);
      for (let i = 0; i < n; i++) { const v = pr(i); R(specks[i % specks.length], v % 31, (v >>> 8) % 31, 1 + ((v >>> 16) & 1) * 0.5, 1); }
      // Fine grain a third of a unit across: more detail, and it takes the gloss off.
      for (let i = 0; i < 34; i++) { const v = pr(i + 200); R(i % 2 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)', (v % 96) / 3, ((v >>> 8) % 96) / 3, 1 / 3 + ((v >>> 20) & 1) / 3, 1 / 3); }
      if (t === 'c') {
        for (let j = 0; j < 4; j++) {
          R('#8f8a7e', 0, j * 8 + 7.5, 32, 0.5); R('#a39e92', 0, j * 8 + 7, 32, 1 / 3);
          for (let i = 0; i < 2; i++) R('#8f8a7e', (j % 2) * 8 + i * 16 + 3, j * 8, 0.5, 8);
        }
      } else if (t === 'F') {
        R('#c2baa8', 0, 0, 32, 0.5); R('#c2baa8', 0, 16, 32, 0.5); R('#c2baa8', 0, 0, 0.5, 32); R('#c2baa8', 16, 0, 0.5, 32);
        R('#efeadd', 0.5, 0.5, 15, 0.5); R('#efeadd', 16.5, 16.5, 15, 0.5);
      } else if (t === '.') {
        for (let i = 0; i < 4; i++) { const v = pr(i + 20), a = v % 28, b = 3 + (v >>> 8) % 26; R('#5fa53a', a, b, 0.5, 2); R('#5fa53a', a + 1.5, b - 0.5, 0.5, 2.5); R('#6aae42', a + 0.75, b + 0.5, 1 / 3, 1.5); }
      } else if (t === 's') {
        for (let i = 0; i < 5; i++) { const v = pr(i + 30); R('#dfe9f5', v % 30, (v >>> 8) % 30, 2, 1 / 3); R('#cddcee', v % 30 + 0.5, (v >>> 8) % 30 + 0.5, 1, 1 / 3); }
      } else if (t === 'S') {
        for (let i = 0; i < 3; i++) { const v = pr(i + 40); R('#cfae6c', v % 22, 4 + i * 10 + (v >>> 8) % 4, 9, 0.5); }
      }
    };
    const flower = (a, b, c) => { R(c, a - 1.5, b, 4, 1); R(c, a, b - 1.5, 1, 4); R(c, a - 1, b - 1, 3, 3); R('#f5b942', a, b, 1, 1); };
    const blades = (dark, mid, tip) => {
      for (let i = 0; i < 11; i++) {
        const v = pr(i + 50), a = 1 + (i % 6) * 5 + (v % 3), b = (i < 6 ? 3 : 17) + (v >>> 6) % 4, len = 9 + (v >>> 10) % 4;
        R(dark, a, b, 1.5, len); R(mid, a + 1.5, b + 1, 1, len - 1); R(tip, a + 0.5, b - 1, 1, 1.5);
      }
    };
    const wall = (base, lite, dark) => {
      R(base, 0, 0, 32, 32);
      for (let j = 0; j < 4; j++) {
        R(dark, 0, j * 8 + 7.5, 32, 0.5); R(lite, 0, j * 8, 32, 0.5);
        for (let i = 0; i < 2; i++) R(dark, (j % 2) * 8 + i * 16 + 4, j * 8, 0.5, 8);
      }
    };
    const gateBars = (c) => {
      R('#3a3a52', 0, 0, 32, 3); R('#3a3a52', 0, 29, 32, 3);
      for (let i = 0; i < 6; i++) { R(c, 2 + i * 5, 3, 3, 26); R(shade(c, 1.3), 2 + i * 5, 3, 1, 26); R(shade(c, 0.7), 4.5 + i * 5, 3, 0.5, 26); }
    };

    switch (ch) {
      case '#': ground('.'); R('#0002', 4, 26.5, 24, 4.5); up(); break;
      case 'T': ground('s'); R('#0002', 6, 27, 20, 4); up(); break;
      case '^':
        R('#4a4452', 0, 0, 32, 32); R('#5d5666', 1, 1, 30, 13); R('#6f6878', 3, 2, 12 + (h & 7), 2); R('#3a3542', 0, 27, 32, 5);
        for (let i = 0; i < 5; i++) { const v = pr(i + 70); R('#3a3542', v % 28, 6 + (v >>> 8) % 20, 3 + (v >>> 14) % 4, 0.5); R('#7c7486', v % 28 + 1, 5 + (v >>> 8) % 20, 2, 0.5); }
        R('#353040', 9 + (h & 7), 14, 0.5, 9); R('#353040', 9.5 + (h & 7), 19, 3, 0.5);
        break;
      case '~': {
        R('#3d8fe0', 0, 0, 32, 32); R('#3482d2', 0, 16, 32, 16);
        for (let i = 0; i < 7; i++) {
          const v = pr(i + 80), b = ((v >>> 8) % 32 + time / (36 + i * 4)) % 32;
          R(i % 2 ? '#62a9e6' : '#4f9ce2', v % 26, b, 5 + i % 3, 0.5); R('#3482d2', v % 26 + 1, b + 0.5, 3, 1 / 3);
        }
        const land = (dx, dy) => !'~b'.includes(CM.charAt(id, x + dx, y + dy));
        if (land(0, -1)) { R('#bfe3fb', 0, 0, 32, 1.5); R('#e9f6ff', 2 + (h & 7), 1.5, 5, 0.5); }
        if (land(-1, 0)) R('#bfe3fb', 0, 0, 1, 32);
        if (land(1, 0)) R('#bfe3fb', 31, 0, 1, 32);
        if (land(0, 1)) R('#2a6fb8', 0, 30.5, 32, 1.5);
        break;
      }
      case 'b':
        R('#3d8fe0', 0, 0, 32, 32); R('#8a6238', 3, 0, 26, 32);
        for (let j = 0; j < 4; j++) { R('#6d4a26', 3, j * 8 + 7.5, 26, 0.5); R('#a47a4c', 3, j * 8, 26, 0.5); R('#5a3d20', 7 + (j % 2) * 12, j * 8 + 3, 1, 1); }
        R('#5a3d20', 2, 0, 2, 32); R('#5a3d20', 28, 0, 2, 32); R('#c49a66', 2, 0, 0.5, 32); R('#c49a66', 28, 0, 0.5, 32);
        break;
      case ',': ground('.'); blades('#3f9a3a', '#57b04a', '#8fd65e'); break;
      case ';': R('#5aa846', 0, 0, 32, 32); blades('#1d5c2c', '#2c7a3a', '#4a9c50'); break;
      case '"': ground('s'); blades('#4f9a94', '#7fc4bd', '#ffffff'); break;
      case '*':
        ground('.'); blades('#57b04a', '#74c45c', '#a4e070');
        [[6, 7], [20, 12], [11, 23], [25, 26]].forEach(([a, b], i) => flower(a + (pr(i) & 3), b, FLOWERS[(pr(i) >>> 4) & 3]));
        break;
      case ':':
        ground('_');
        for (let i = 0; i < 4; i++) {
          const v = pr(i + 90), a = 3 + (i % 2) * 14 + v % 5, b = 4 + (i >> 1) * 14 + (v >>> 8) % 5;
          R('#57515c', a, b + 2, 8, 5); R('#8d8693', a + 1, b, 6, 5); R('#a59eab', a + 1.5, b + 0.5, 3, 1.5); R('#8fd9e8', a + 5, b + 2.5, 1.5, 1.5);
        }
        break;
      case 'x': {
        ground(CM.groundAt(id, x, y));
        if (S.smashed[`${id}:${k}`]) { for (let i = 0; i < 6; i++) { const v = pr(i); R('#6b6470', 3 + v % 24, 5 + (v >>> 8) % 22, 3, 2); R('#958e9b', 3 + v % 24, 5 + (v >>> 8) % 22, 1.5, 0.5); } break; }
        R('#0003', 3, 26, 26, 5); up();
        break;
      }
      case '=': case '.': case 'c': case 'S': case 's': case '_': case 'F':
        ground(ch);
        if (ch === '.' && h % 7 === 0) flower(8 + (h >> 16 & 15), 8 + (h >> 20 & 15), FLOWERS[h >> 24 & 3]);
        if (S.sprays && S.sprays[`${id}:${k}`]) drawSpray(g, S.sprays[`${id}:${k}`], sx, sy);
        break;
      case 'L': case 'o': case 'O': case 'C': ground('F'); break;
      case '<': case '>': case 'A': case 'V': {
        // A floor vent: chevrons stream the way it blows.
        const [dx, dy] = CM.DIRS[CM.GUSTS[ch]], t = (time / 260) % 1;
        R('#dfeee6', 0, 0, 32, 32); R('#c6ddd0', 1, 1, 30, 30); R('#b3cfc0', 2, 2, 28, 28);
        g.save(); g.translate(sx + 16, sy + 16); g.rotate(Math.atan2(dy, dx)); g.lineWidth = 2.2; g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const o = ((i + t) / 3) * 22 - 11;
          g.strokeStyle = `rgba(74,148,116,${0.25 + 0.6 * (1 - Math.abs(o) / 11)})`;
          g.beginPath(); g.moveTo(o - 3, -6); g.lineTo(o + 3, 0); g.lineTo(o - 3, 6); g.stroke();
        }
        g.restore();
        break;
      }
      case 'P':
        ground('F'); R('#3a3a52', 3, 3, 26, 26); R(P.blocks[k] ? '#6fd08a' : '#8a8fa0', 5, 5, 22, 22); R('#00000022', 5, 24, 22, 3);
        for (const [a, b] of [[7, 7], [23, 7], [7, 23], [23, 23]]) R('#3a3a52', a, b, 2, 2);
        break;
      case '4': case '5': case '6': case '7': case '8': case '9': {
        const c = ['#e0483c', '#f1a23a', '#f6d643', '#72cc5c', '#55a8ee', '#b58cf0'][+ch - 4], a0 = time / 500;
        ground('F'); C('#2a1f45', 16, 16, 13); C(shade(c, 0.7), 16, 16, 11.5);
        for (let i = 0; i < 3; i++) { g.strokeStyle = i % 2 ? c : '#f4f4f4'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx + 16, sy + 16, 3 + i * 3.2, a0 + i * 2, a0 + i * 2 + 4); g.stroke(); }
        break;
      }
      case 'm': {
        ground(CM.groundAt(id, x, y));
        const glow = 0.35 + 0.2 * Math.sin(time / 500 + h);
        C(`rgba(140,255,230,${glow})`, 16, 16, 12); up();
        break;
      }
      case 'H': {
        ground(CM.groundAt(id, x, y));
        const p = 0.5 + 0.5 * Math.sin(time / 400);
        R(`rgba(255,160,190,${0.25 + p * 0.3})`, 1, 1, 30, 30);
        R('#ffffff', 3, 3, 26, 26); R('#f2a0b8', 4.5, 4.5, 23, 23); R('#f7bfd0', 4.5, 4.5, 23, 2);
        R('#ffffff', 14, 8, 4, 16); R('#ffffff', 8, 14, 16, 4); R('#e58aa6', 14, 23, 4, 1); R('#e58aa6', 23, 14, 1, 4);
        break;
      }
      case 'R': case 'G': {
        const base = ch === 'G' ? shade(tintOf(CM.TINT[k]), 0.8) : '#b8553c';
        R(base, 0, 0, 32, 32);
        for (let j = 0; j < 4; j++) {
          R(shade(base, 0.7), 0, j * 8 + 7, 32, 1); R(shade(base, 0.9), 0, j * 8 + 3.5, 32, 1 / 3);
          for (let i = 0; i < 4; i++) R(shade(base, 0.8), (j % 2) * 4 + i * 8, j * 8, 0.5, 7);
        }
        if (CM.charAt(id, x, y - 1) !== ch) R(shade(base, 1.12), 0, 0, 32, 2);
        // A gym wears a big white roundel on the roof over its door.
        const below = CM.WARPS[`${id}:${x},${y + 1}`];
        if (ch === 'G' && below && below.map.startsWith('gym_')) {
          C('#2c2c3c', 16, 16, 14); C('#ffffff', 16, 16, 12.5); C(tintOf(CM.TINT[k]), 16, 16, 9);
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(sx + 16, sy + 9.5); g.lineTo(sx + 21.5, sy + 16); g.lineTo(sx + 16, sy + 22.5); g.lineTo(sx + 10.5, sy + 16); g.fill();
        }
        break;
      }
      case 'W': {
        const tint = CM.TINT[k];
        wall('#efe6d2', '#fbf6ea', '#d6cab0');
        R('#9a8f78', 0, 30, 32, 2);
        if (tint) { R(tintOf(tint), 0, 0, 32, 3); R(shade(tintOf(tint), 0.7), 0, 3, 32, 0.5); }
        if (tint === 'Stop') {
          // A shop front: a striped awning over a display window full of goods.
          for (let i = 0; i < 8; i++) R(i % 2 ? '#f4f4f4' : '#e8384f', i * 4, 3, 4, 6);
          R('#b82a3c', 0, 8.5, 32, 1); R('#5a4632', 5, 12, 22, 14); R('#bfe3fb', 6, 13, 20, 12); R('#e6f4fd', 6.5, 13.5, 6, 3);
          R('#f08aa0', 8, 19, 4, 6); R('#fff', 9, 18, 2, 1.5); R('#e0483c', 14, 20, 5, 5); R('#f4f4f4', 14, 22, 5, 1); R('#ffd24a', 21, 19.5, 4, 5.5);
          break;
        }
        if ((x + y) % 2 === 0) {
          R('#5a4632', 9, 9, 14, 14); R('#9fd4f2', 10, 10, 12, 12); R('#d3ecfb', 10.5, 10.5, 4, 3); R('#5a4632', 15.5, 10, 1, 12); R('#5a4632', 10, 15.5, 12, 1);
          R('#c9705a', 8, 23, 16, 1.5);
        }
        break;
      }
      case 'D': {
        const tint = CM.TINT[k], c = tint ? tintOf(tint) : '#5a8a4a';
        if (id === 'world' && !tint) { ground('.'); R('#6b4a2b', 0, 4, 3, 28); R('#6b4a2b', 29, 4, 3, 28); R('#3a2a1a', 3, 6, 26, 26); R('#54402a', 3, 6, 26, 2); R('#8a6a3b', 4, 9, 0.5, 23); R('#8a6a3b', 27.5, 9, 0.5, 23); break; }
        wall('#efe6d2', '#fbf6ea', '#d6cab0'); R(c, 0, 0, 32, 3);
        if (tint === 'Stop') { for (let i = 0; i < 8; i++) R(i % 2 ? '#f4f4f4' : '#e8384f', i * 4, 3, 4, 3); R('#ffd24a', 11, 0.3, 10, 2.4); }
        R('#3a2a1a', 6, 6, 20, 26); R('#6b4a2b', 7.5, 7.5, 8, 24.5); R('#6b4a2b', 16.5, 7.5, 8, 24.5);
        R('#84603c', 8, 8, 1, 23); R('#84603c', 17, 8, 1, 23); R('#f1c93a', 14, 19, 1.5, 1.5); R('#f1c93a', 17, 19, 1.5, 1.5);
        R(c, 9, 10, 5, 5); R(c, 18, 10, 5, 5); R(shade(c, 1.3), 9.5, 10.5, 2, 1);
        break;
      }
      case 'M': {
        wall('#c9a468', '#dcbb84', '#a8854e');
        if (S.f.mural) { R('#6b5a3c', 4, 12, 24, 20); R('#3c3222', 6, 14, 20, 18); C('#8d7a55', 16, 20, 5); R('#8d7a55', 12, 22, 8, 10); R('#b9a374', 14, 18, 1.5, 1); R('#b9a374', 17, 18, 1.5, 1); R('#8d7a55', 11, 14, 2, 4); R('#8d7a55', 19, 14, 2, 4); break; }
        R('#8a5a2b', 5, 6, 0.5, 22); R('#8a5a2b', 26, 6, 0.5, 22);
        C('#b0683c', 12, 11, 3); R('#b0683c', 10, 14, 4, 9); R('#b0683c', 9, 23, 2, 5); R('#b0683c', 13, 23, 2, 5);
        C('#3d6f8a', 21, 11, 3); R('#3d6f8a', 19, 14, 4, 9); R('#3d6f8a', 18, 23, 2, 5); R('#3d6f8a', 22, 23, 2, 5);
        R('#e9e2cf', 15, 6, 1, 12); R('#f1c93a', 24.5, 14, 3, 5);
        break;
      }
      case 'I': {
        const open = CM.charAt(id, x, y + 1) !== 'I' && CM.charAt(id, x, y + 1) !== ' ';
        R('#3a3a52', 0, 0, 32, 32); R('#4b4b68', 0, 0, 32, 2);
        if (open) { wall('#55557a', '#6a6a92', '#3f3f5c'); R('#2c2c3c', 0, 28, 32, 4); R('#7d7da6', 0, 0, 32, 1.5); }
        else for (let i = 0; i < 3; i++) R('#32324a', pr(i) % 26, 4 + (pr(i) >>> 8) % 24, 5, 0.5);
        break;
      }
      case ' ': R('#0d0d14', 0, 0, 32, 32); break;
      case 'E':
        ground(id === 'grove' ? '.' : 'F');
        if (id === 'grove') { R('#dcc48e', 6, 0, 20, 32); R('#c9ad78', 6, 0, 0.5, 32); R('#c9ad78', 25.5, 0, 0.5, 32); }
        else { R('#b8323a', 3, 2, 26, 30); R('#d94a52', 5, 4, 22, 28); R('#f1c93a', 5, 4, 22, 1); g.fillStyle = '#f7d7d9'; g.beginPath(); g.moveTo(sx + 16, sy + 27); g.lineTo(sx + 22, sy + 17); g.lineTo(sx + 10, sy + 17); g.fill(); R('#f7d7d9', 14, 9, 4, 8); }
        break;
      case 'g':
        ground('F');
        if (P.solved) { R('#3a3a52', 0, 0, 3, 32); R('#3a3a52', 29, 0, 3, 32); R('#f1c93a', 0, 0, 3, 2); R('#f1c93a', 29, 0, 3, 2); } else gateBars('#c9a23a');
        break;
      case 'r': case 'y': case 'u': case 'q': case 'j': case 'n': {
        const c = VALVE[CM.GATE[ch][0]];
        ground('F'); R(c, 0, 0, 2.5, 32); R(c, 29.5, 0, 2.5, 32);
        if (!CM.gateOpen(ch, P)) {
          R(shade(c, 0.85), 2.5, 0, 27, 32);
          for (let i = 0; i < 9; i++) { const v = pr(i), b = ((v >>> 8) % 32 + time / 14) % 32; R(shade(c, 1.35), 3 + (v % 25), b, 1, 5); R('#ffffffaa', 3 + (v % 25), b + 5, 1, 1); }
        } else { R(shade(c, 0.6), 2.5, 14, 27, 4); R('#4a4a62', 2.5, 15, 27, 2); }
        break;
      }
      case '1': case '2': case '3': {
        const c = VALVE[ch];
        ground('F'); C('#3a3a52', 16, 16, 11); C(shade(c, P.sw[ch] ? 0.65 : 1), 16, 16, 9.5); C(shade(c, P.sw[ch] ? 0.85 : 1.3), 14, 14, 4);
        R('#3a3a52', 15, 5, 2, 22); R('#3a3a52', 5, 15, 22, 2); C('#e9e2cf', 16, 16, 2.5);
        break;
      }
      case 'p':
        ground('F'); R('#e2c670', 3, 3, 26, 26); for (let i = 0; i < 12; i++) { const v = pr(i); R(i % 2 ? '#d1b45c' : '#f6e3a0', 4 + v % 22, 4 + (v >>> 8) % 23, 4, 0.5); }
        R('#8a5a2b', 1, 1, 30, 2); R('#8a5a2b', 1, 29, 30, 2); R('#8a5a2b', 1, 1, 2, 30); R('#8a5a2b', 29, 1, 2, 30); R('#b07c44', 1, 1, 30, 0.5);
        break;
      case 'v':
        ground('F');
        if (P.fill[k]) { C('#7c7486', 16, 16, 13); C('#948c9e', 14, 13, 8); R('#5d5666', 8, 20, 14, 1); }
        else { C('#3a3542', 16, 16, 14); C('#0d0d14', 16, 17, 12); R('#57515c', 6, 6, 5, 1); }
        break;
      case 'i':
        R('#c3e4f0', 0, 0, 32, 32);
        for (let i = 0; i < 26; i++) { const v = pr(i); R(i % 2 ? '#b4d9e8' : '#cdeaf4', (v % 90) / 3, ((v >>> 8) % 90) / 3, 1 + (v >>> 18) % 3, 1 / 3); }
        for (let i = 0; i < 2; i++) { const v = pr(i + 40), a = v % 22, b = (v >>> 8) % 26; for (let j = 0; j < 4; j++) R('#dff1f8', a + j * 1.5, b + 4 - j, 1.5, 1 / 3); }
        R('#a3cfe0', pr(5) % 24, pr(6) % 28, 6, 1 / 3);
        break;
      case 'k': R('#cfeefa', 0, 0, 32, 32); R('#0002', 4, 26, 24, 4); up(); break;
      case 'z': {
        const lit = P.lit[k];
        R('#2c2c3c', 0, 0, 32, 32); R(lit ? '#f6d643' : '#4b4b68', 2, 2, 28, 28); R(lit ? '#fff3a8' : '#5d5d80', 2, 2, 28, 2); R(lit ? '#d1b01c' : '#3a3a52', 2, 28, 28, 2);
        g.fillStyle = lit ? '#fff' : '#2c2c3c'; g.beginPath();
        [[17, 6], [10, 17], [15, 17], [13, 26], [22, 14], [17, 14]].forEach(([a, b], i) => (i ? g.lineTo(sx + a, sy + b) : g.moveTo(sx + a, sy + b))); g.fill();
        if (lit && ((h + Math.floor(time / 120)) & 3) === 0) R('#ffffff', 4 + pr(1) % 22, 4 + pr(2) % 22, 1.5, 1.5);
        break;
      }
      case 't': {
        const lit = P.lit[k], c = lit ? '#c58cff' : '#4a3a6a';
        ground('F'); C(lit ? 'rgba(197,140,255,.35)' : '#0000', 16, 16, 15); C('#2a1f45', 16, 16, 11); C(c, 16, 16, 9); C('#2a1f45', 16, 16, 6.5); C(c, 16, 16, 2.5);
        R(c, 15.5, 5, 1, 22); R(c, 5, 15.5, 22, 1);
        break;
      }
      case 'B': ground('F'); R('#0003', 6, 26, 20, 4); up(P.fire[CM.MAPS[id].fires.indexOf(k)]); break;
      case 'l':
        R('#d1401c', 0, 0, 32, 32);
        for (let i = 0; i < 7; i++) { const v = pr(i), a = (v % 28 + time / 90) % 30, b = (v >>> 8) % 29; R(i % 2 ? '#f47a45' : '#ffd24a', a, b, 4 + i % 3, 1); R('#8c231b', (a + 9) % 30, (b + 13) % 30, 3, 0.5); }
        C(`rgba(255,220,90,${0.5 + 0.5 * Math.sin(time / 300 + h)})`, 6 + h % 20, 8 + (h >> 5) % 18, 1.5);
        break;
      default: ground('.');
    }
  }

  // ---------- People ----------
  // L is a look (see NEW_LOOK in game.js). frame: 0 standing, 1 / 2 mid-stride on either foot.
  // The 3D view casts real shadows, and turns these painted ones off while it draws people.
  let painted = true;
  const shadows = (on) => { painted = on; };
  function drawPerson(g, sx, sy, L, dir, frame = 0, surfing = false, bike = false) {
    const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, h); };
    // Printed clothes are drawn as the shape they are cut from, with their design added on top.
    const cut = (id) => CM.CLOTHES[id] || {};
    const marks = { hat: cut(L.hat).mark, top: cut(L.top).mark, bottom: cut(L.bottom).mark };
    L = { ...L, hat: cut(L.hat).base || L.hat, top: cut(L.top).base || L.top, bottom: cut(L.bottom).base || L.bottom };
    // A small printed design centred on (cx, cy).
    const mark = (m, cx, cy) => {
      const P = (c, a, b, w, h) => R(c, cx + a, cy + b, w, h);
      if (m === 'star') { P('#ffd24a', -0.5, -2.5, 1, 5); P('#ffd24a', -2.5, -0.5, 5, 1); P('#fff3a8', -1, -1, 2, 2); }
      else if (m === 'heart') { P('#f0507a', -2.5, -2, 2, 2); P('#f0507a', 0.5, -2, 2, 2); P('#f0507a', -2.5, -1, 5, 2); P('#f0507a', -1.5, 1, 3, 1); P('#f0507a', -0.5, 2, 1, 1); }
      else if (m === 'bolt') { P('#ffe24a', 0, -3, 2, 2.5); P('#ffe24a', -1.5, -1, 3, 1.5); P('#ffe24a', -1.5, 0.5, 2, 2.5); }
      else if (m === 'flame') { P('#f47a45', -2, -1, 4, 3.5); P('#f47a45', -1, -3, 2, 2); P('#ffd24a', -1, 0, 2, 2.5); }
      else if (m === 'wave') { for (const [a, b] of [[-3, -1.5], [-3, 1]]) { P('#bfe3fb', a, b, 2, 1); P('#f4f4f4', a + 2, b - 1, 2, 1); P('#bfe3fb', a + 4, b, 2, 1); } }
      else if (m === 'leaf') { P('#2f9a3c', -2, -2, 4, 4); P('#8fe08a', -2, -2, 2, 2); P('#1f6a2c', -0.25, -2, 0.5, 5); }
      else if (m === 'skull') { P('#f4f4f4', -2.5, -2.5, 5, 3.5); P('#f4f4f4', -1.5, 1, 3, 1.5); P('#1c1c28', -1.5, -1.5, 1, 1.5); P('#1c1c28', 0.5, -1.5, 1, 1.5); P('#1c1c28', -0.25, 1, 0.5, 1.5); }
    };
    const whiteTop = ['scout_vest', 'overalls', 'labcoat'].includes(L.top);
    const top = whiteTop ? '#f4f4f4' : L.topColor, topDark = shade(top, 0.75), topLite = shade(top, 1.08);
    const tc = L.topColor, bc = L.bottomColor, bcDark = shade(bc, 0.75);
    const skinDark = shade(L.skin, 0.85), hairLite = shade(L.hair, 1.2), hairDark = shade(L.hair, 0.7);
    if (bike) {
      // The bike: seen side-on when riding left or right, end-on otherwise. On water it sits on a pair of floats.
      const side = dir === 'left' || dir === 'right', spin = frame ? 1 : 0;
      const wheel = (cx, cy, r) => {
        g.fillStyle = '#1c1c28'; g.beginPath(); g.arc(sx + cx, sy + cy, r, 0, 7); g.fill();
        g.fillStyle = '#c9ced8'; g.beginPath(); g.arc(sx + cx, sy + cy, r - 1.3, 0, 7); g.fill();
        g.fillStyle = '#1c1c28'; g.fillRect(sx + cx - (spin ? 0.3 : r - 1.3), sy + cy - (spin ? r - 1.3 : 0.3), spin ? 0.6 : (r - 1.3) * 2, spin ? (r - 1.3) * 2 : 0.6);
      };
      if (surfing) {
        g.fillStyle = '#ffffff66'; g.beginPath(); g.ellipse(sx + 16, sy + 30, 16, 3.5, 0, 0, 7); g.fill();
        for (const x of side ? [16] : [9, 23]) { g.fillStyle = '#f5b942'; g.beginPath(); g.ellipse(sx + x, sy + 29.5, side ? 14 : 4, 2.6, 0, 0, 7); g.fill(); g.fillStyle = '#fff3a8'; g.beginPath(); g.ellipse(sx + x, sy + 28.8, side ? 11 : 2.5, 1, 0, 0, 7); g.fill(); }
      } else if (painted) { g.fillStyle = '#0003'; g.beginPath(); g.ellipse(sx + 16, sy + 30.5, side ? 14 : 8, 2.2, 0, 0, 7); g.fill(); }
      if (side) {
        const f = dir === 'left' ? -1 : 1;
        wheel(16 - 9, 25.5, 5); wheel(16 + 9, 25.5, 5);
        g.strokeStyle = '#e0483c'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath();
        g.moveTo(sx + 16 - 9 * f, sy + 25.5); g.lineTo(sx + 16 - 2 * f, sy + 19); g.lineTo(sx + 16 + 6 * f, sy + 19); g.lineTo(sx + 16 + 9 * f, sy + 25.5);
        g.moveTo(sx + 16 - 2 * f, sy + 19); g.lineTo(sx + 16 + 1 * f, sy + 25.5); g.lineTo(sx + 16 - 9 * f, sy + 25.5);
        g.moveTo(sx + 16 + 6 * f, sy + 19); g.lineTo(sx + 16 + 7 * f, sy + 15.5); g.stroke();
        R('#1c1c28', 16 + 5.5 * f - 1.5, 14.5, 4, 1.4);
      } else {
        wheel(16, 26, 4.6); R('#1c1c28', 14.6, 21, 2.8, 10);
        R('#e0483c', 15.2, 16, 1.6, 8); R('#1c1c28', 8, 15, 16, 1.5); R('#8a94a6', 7, 14.5, 2.5, 2.5); R('#8a94a6', 22.5, 14.5, 2.5, 2.5);
      }
    } else if (surfing) {
      g.fillStyle = '#ffffff66'; g.beginPath(); g.ellipse(sx + 16, sy + 27, 15, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#55a8ee'; g.beginPath(); g.ellipse(sx + 16, sy + 25, 13, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#74b8f0'; g.beginPath(); g.ellipse(sx + 13, sy + 23, 6, 2, 0, 0, 7); g.fill();
      R('#fff', 6, 23, 2, 2); R('#1c1c28', 6.5, 23.5, 1, 1);
    } else if (painted) {
      g.fillStyle = '#0003'; g.beginPath(); g.ellipse(sx + 16, sy + 29.5, 9, 2.5, 0, 0, 7); g.fill();
    }
    if (L.top === 'champion_cape') { R('#7a3fc4', 5, 14, 22, 14); R('#5d2c9c', 5, 26.5, 22, 1.5); R('#8a50d0', 5, 14, 1, 14); }
    if (!surfing || bike) {
      const trousers = ['pants', 'jeans', 'leggings', 'joggers'].includes(L.bottom);
      [[10, frame === 1], [17, frame === 2]].forEach(([x, lifted]) => {
        const len = lifted ? 5 : 7;
        R(L.skin, x, 22, 5, len); R(skinDark, x + 4, 22, 1, len);
        if (trousers) {
          const w = L.bottom === 'leggings' ? 4 : 5;
          R(bc, x, 22, w, len); R(bcDark, x + w - 1, 22, 1, len);
          if (L.bottom === 'jeans') { R(shade(bc, 1.25), x, 20.5 + len, 5, 1); R(bcDark, x + 2, 22, 1 / 3, len - 2); R('#f1c93a', x + 0.5, 23, 1.5, 1 / 3); }
          if (L.bottom === 'joggers') { R('#f4f4f4', x + (x < 14 ? 0 : 4), 22, 1, len - 1.5); R(bcDark, x, 20 + len, 5, 1); }
        } else if (L.bottom === 'shorts') { R(bc, x, 22, 5, 4); R(bcDark, x, 25.5, 5, 0.5); }
        else if (L.bottom === 'cargo') { R(bc, x, 22, 5, 5.5); R(bcDark, x + (x < 14 ? 0 : 3), 24, 2, 2.5); R(bcDark, x, 27, 5, 0.5); }
        R('#1c1c28', x, 20 + len, 5, 2); R('#d8d8d8', x, 21.5 + len, 5, 0.5); R('#3a3a52', x + 0.5, 20 + len, 2, 1 / 3);
      });
      if (L.bottom === 'skirt') { R(bc, 8, 22, 16, 5); R(bcDark, 8, 26, 16, 1); for (const x of [11, 15, 19]) R(bcDark, x, 23, 0.5, 3); }
      if (marks.bottom) {
        const skirt = L.bottom === 'skirt', low = skirt ? 26 : L.bottom === 'shorts' ? 25 : 27.5;
        const legs = skirt ? [[8, 16]] : [[10, 5], [17, 5]];
        legs.forEach(([x, w], i) => {
          if (marks.bottom === 'stripe') R('#f4f4f4', skirt ? x : x + (i ? w - 1.2 : 0), 22, skirt ? w : 1.2, skirt ? 1 : low - 22);
          else if (marks.bottom === 'flame') { R('#f47a45', x, low - 2, w, 2); for (let a = x; a < x + w; a += 2) R('#ffd24a', a + 0.5, low - 3, 1, 1.5); }
          else if (marks.bottom === 'star') for (let a = x + 1; a < x + w; a += 3.5) { R('#ffd24a', a, 23.2 + (a % 2), 1, 1); R('#ffd24a', a + 1.5, 25 - (a % 2), 0.8, 0.8); }
          else if (marks.bottom === 'camo') for (let a = x; a < x + w - 1; a += 2.5) { R(bcDark, a, 22.6 + (a % 2) * 1.6, 1.8, 1.2); R(shade(bc, 1.25), a + 0.8, 24.6 - (a % 2), 1.4, 1); }
        });
      }
      if (L.bottom === 'long_skirt') { R(bc, 8, 22, 16, 7.5); R(bcDark, 8, 28.5, 16, 1); for (const x of [10.5, 14, 17.5, 21]) R(bcDark, x, 23, 1 / 3, 5.5); }
    }
    // Arms, swinging with the stride.
    const sleeve = ['hoodie', 'varsity', 'champion_cape', 'jersey', 'suit', 'puffer', 'kimono', 'labcoat'].includes(L.top) ? 7 : L.top === 'tank' ? 0 : 4;
    [[5, frame === 2], [24, frame === 1]].forEach(([x, swung]) => {
      const y = swung ? 13 : 14;
      R(L.skin, x, y, 3, 9); R(skinDark, x, y + 8, 3, 1);
      if (!sleeve) return;
      R(L.top === 'varsity' ? '#f4f4f4' : top, x, y, 3, sleeve); R(topDark, x, y + sleeve - 0.5, 3, 0.5);
      if (L.top === 'puffer') for (const b of [2, 4.5]) R(topDark, x, y + b, 3, 1 / 3);
    });
    R(top, 8, 13, 16, 11); R(topDark, 22.5, 13, 1.5, 11); R(topLite, 8, 13, 1, 11); R(topDark, 8, 23.5, 16, 0.5);
    R(L.skin, 13.5, 13, 5, 1.5);
    const front = dir !== 'up';
    switch (L.top) {
      case 'stripes': R('#f4f4f4', 8, 15.5, 16, 1.5); R('#f4f4f4', 8, 18.5, 16, 1.5); R('#f4f4f4', 8, 21.5, 16, 1.5); break;
      case 'hoodie': R(topDark, 9, 13, 14, 2); if (front) { R(topDark, 11, 19, 10, 3); R('#e4e4e4', 14, 15, 0.5, 3); R('#e4e4e4', 17.5, 15, 0.5, 3); } break;
      case 'dress': R(top, 7, 22, 18, 5); R(topDark, 7, 26, 18, 1); R(topDark, 8, 20.5, 16, 0.5); break;
      case 'jersey': if (front) { R('#f4f4f4', 8, 16, 16, 1); R('#f4f4f4', 14, 18, 1, 4); R('#f4f4f4', 16.5, 18, 2, 0.5); R('#f4f4f4', 16.5, 19.5, 2, 0.5); R('#f4f4f4', 16.5, 21.5, 2, 0.5); R('#f4f4f4', 18, 18, 0.5, 4); } break;
      case 'varsity': if (dir === 'down') { R('#f4f4f4', 15, 13, 2, 11); R(topDark, 15.75, 14, 0.5, 9); R('#f1c93a', 10, 16, 2, 2); } break;
      case 'scout_vest':
        if (!front) R('#4f8f4a', 8, 13, 16, 11);
        else { R('#4f8f4a', 8, 13, 5, 11); R('#4f8f4a', 19, 13, 5, 11); R('#f1c93a', 9.5, 16, 1.5, 1.5); R('#3d7038', 12.5, 13, 0.5, 11); R('#3d7038', 19, 13, 0.5, 11); }
        break;
      case 'champion_cape':
        if (!front) { R('#7a3fc4', 6, 13, 20, 15); R('#8a50d0', 6, 13, 20, 1); }
        else { R('#f1c93a', 13, 13, 6, 2); R('#e2bb30', 13.5, 13.5, 2, 0.5); }
        break;
      case 'tank': R(L.skin, 8, 13, 2.5, 3); R(L.skin, 21.5, 13, 2.5, 3); R(topDark, 10.5, 13, 0.5, 3); R(topDark, 21, 13, 0.5, 3); break;
      case 'polka': for (const [a, b] of [[10, 15], [15, 17], [20, 15], [12, 20], [18, 21], [21.5, 19]]) R('#f4f4f4', a, b, 1.5, 1.5); break;
      case 'overalls':
        R(tc, 8, 19, 16, 5); R(shade(tc, 0.75), 8, 23.5, 16, 0.5);
        if (front) { R(tc, 10.5, 15.5, 11, 4); R(tc, 10.5, 13, 2, 3); R(tc, 19.5, 13, 2, 3); R('#f1c93a', 11, 15.5, 1, 1); R('#f1c93a', 20, 15.5, 1, 1); R(shade(tc, 0.75), 13.5, 17.5, 5, 2.5); }
        else { R(tc, 10.5, 13, 2, 6); R(tc, 19.5, 13, 2, 6); }
        break;
      case 'suit':
        if (front) { R('#f4f4f4', 13.5, 14.5, 5, 5); R('#e0483c', 15.5, 14.5, 1, 6.5); R(topDark, 13, 14.5, 1, 6); R(topDark, 18, 14.5, 1, 6); R(topDark, 15.75, 21, 0.5, 3); R('#1c1c28', 15.5, 22, 1, 1); }
        break;
      case 'poncho':
        R(top, 4.5, 13, 23, 9); R(topDark, 4.5, 21, 23, 1); R(shade(tc, 1.25), 4.5, 16, 23, 1.5); R('#f4f4f4', 4.5, 18.5, 23, 2 / 3);
        for (let x = 5; x < 27; x += 2.5) R(topDark, x, 22, 1, 1.5);
        break;
      case 'puffer': for (const b of [15.5, 18, 20.5]) R(topDark, 8, b, 16, 1 / 3); if (front) R(shade(top, 0.6), 15.75, 13, 0.5, 11); R(shade(top, 1.15), 9, 13, 14, 1.5); break;
      case 'kimono':
        R(top, 7, 22, 18, 6); R(topDark, 7, 27.5, 18, 0.5);
        if (front) { R(shade(tc, 1.3), 12.5, 13, 1, 6); R(shade(tc, 1.3), 18.5, 13, 1, 6); R(L.skin, 14.5, 13, 3, 3); }
        R('#f1c93a', 8, 19, 16, 2.5); R('#c79a12', 8, 21, 16, 0.5);
        break;
      case 'labcoat':
        R(top, 7, 22, 18, 4.5); R('#d8d8d8', 7, 26, 18, 0.5);
        if (front) { R('#d8d8d8', 15.75, 15, 0.5, 11); for (const b of [16, 19, 22]) R('#9a9a9a', 17, b, 1, 1); R('#55a8ee', 13.5, 13, 5, 2.5); R('#e0483c', 10, 16.5, 1, 2.5); }
        break;
    }

    if (marks.top === 'rainbow') ['#e0483c', '#f5b942', '#72cc5c', '#55a8ee', '#9b3fd6'].forEach((c, n) => R(c, 8, 15.5 + n * 1.3, 16, 1.3));
    else if (marks.top && dir !== 'up') mark(marks.top, 16, 19);
    R(L.skin, 9, 3, 14, 11); R(skinDark, 9, 13, 14, 1); R(skinDark, 22, 4, 1, 9);
    const H = (a, b, w, h) => R(L.hair, a, b, w, h);
    if (L.hairStyle !== 'bald') {
      H(9, 2, 14, dir === 'up' ? 10 : 4); R(hairLite, 11, 2.5, 5, 1 / 3); R(hairDark, 9, dir === 'up' ? 11 : 5.5, 14, 0.5);
      if (dir === 'left') H(19, 2, 4, 9);
      if (dir === 'right') H(9, 2, 4, 9);
    } else if (dir === 'up') R(skinDark, 10, 4, 12, 1 / 3);
    const fall = { long: 16, bob: 11 }[L.hairStyle];
    const back = dir === 'left' ? 22 : 7;   // where hair trails on a side view
    if (fall) {
      if (dir === 'up') { H(8, 2, 16, fall + 1); R(hairLite, 11, 4, 1 / 3, fall - 3); R(hairDark, 20, 4, 0.5, fall - 3); }
      else if (dir === 'down') { H(7, 4, 3, fall); H(22, 4, 3, fall); R(hairDark, 9.5, 6, 0.5, fall - 2); R(hairDark, 22, 6, 0.5, fall - 2); }
      else H(dir === 'left' ? 19 : 7, 2, 6, fall + 1);
    }
    switch (L.hairStyle) {
      case 'spiky': H(10, 0, 3, 2); H(15, -1, 3, 3); H(20, 0, 3, 2); break;
      case 'ponytail':
        if (dir === 'up') { H(13.5, 9, 5, 11); R('#e0483c', 13.5, 9, 5, 1.5); R(hairDark, 15.75, 11, 0.5, 8); }
        else if (dir === 'down') { H(21.5, 3, 4, 3); H(23, 5, 3, 10); R('#e0483c', 22, 5, 3.5, 1.5); }
        else { H(back, 4, 3, 12); R('#e0483c', back, 4.5, 3, 1.5); }
        break;
      case 'pigtails':
        if (dir === 'left' || dir === 'right') { H(back, 5, 3.5, 10); R('#f08aa0', back, 5, 3.5, 1.5); }
        else { H(5, 5, 3.5, 10); H(23.5, 5, 3.5, 10); R('#f08aa0', 5, 5, 3.5, 1.5); R('#f08aa0', 23.5, 5, 3.5, 1.5); }
        break;
      case 'bun': H(13, -2.5, 6, 5); R(hairDark, 13, 2, 6, 0.5); R(hairLite, 14, -2, 2, 1 / 3); break;
      case 'mohawk': R(L.skin, 9, 2, 14, 2); R(hairDark, 9, 3.5, 14, 2); H(13.5, -4, 5, 9); R(hairLite, 14, -3.5, 1, 6); break;
      case 'afro': H(6, -3, 20, 8); H(4.5, -0.5, 23, 8); H(6, 6, 3, 4); H(23, 6, 3, 4); for (const [a, b] of [[8, -2], [14, -3], [20, -2], [5, 3], [25, 3]]) R(hairDark, a, b, 1.5, 1); break;
      case 'curly': for (const x of [7.5, 11, 14.5, 18, 21.5]) { H(x, -0.5, 4, 4); R(hairDark, x + 1, 2.5, 2, 0.5); } H(6.5, 4, 3, 7); H(22.5, 4, 3, 7); break;
    }
    const eye = (x) => { R('#ffffff', x - 0.5, 7.5, 3, 3.5); R('#1c1c28', x + (dir === 'left' ? -0.5 : dir === 'right' ? 1 : 0.25), 8, 1.5, 3); };
    if (dir === 'down') { eye(12); eye(18); R('#b0553c', 14.5, 12, 3, 0.5); R('#f08aa044', 10, 10.5, 2, 1); R('#f08aa044', 20, 10.5, 2, 1); R(skinDark, 15.5, 10, 1, 1 / 3); }
    if (dir === 'left') { eye(11); R('#b0553c', 10.5, 12, 2, 0.5); }
    if (dir === 'right') { eye(19); R('#b0553c', 19.5, 12, 2, 0.5); }

    const hc = L.hatColor, hd = shade(hc, 0.7), hl = shade(hc, 1.1);
    const brim = (c) => { R(c, 5, 4, 22, 2); R(shade(c, 0.75), 5, 5.5, 22, 0.5); };
    switch (L.hat) {
      case 'cap':
        R(hc, 8, 0, 16, 5); R(hl, 9, 0.5, 6, 1 / 3); R(hd, 8, 4.5, 16, 0.5);
        if (dir === 'down') { R(hd, 9, 5, 14, 2); R('#e4e4e4', 14.5, 1.5, 3, 2); }
        if (dir === 'left') R(hd, 3, 3, 6, 2);
        if (dir === 'right') R(hd, 23, 3, 6, 2);
        break;
      case 'beanie': R(hc, 8, 0, 16, 5); for (const x of [10, 13, 16, 19, 22]) R(hd, x, 0, 0.5, 4); R('#e9e9e9', 8, 4, 16, 2); R('#cfcfcf', 8, 5.5, 16, 0.5); R('#e9e9e9', 14, -3, 4, 3); break;
      case 'bow': R(hc, 10, -1, 5, 5); R(hc, 17, -1, 5, 5); R(hd, 10, 3, 5, 1); R(hd, 17, 3, 5, 1); R(hd, 15, 0, 2, 3); break;
      case 'straw_hat': brim('#e8d28a'); R('#e8d28a', 9, 0, 14, 4); for (const x of [10, 13, 16, 19]) R('#d4bc72', x, 0.5, 2, 1 / 3); R('#c0503c', 9, 3, 14, 1); break;
      case 'ranger_hat': brim('#6b4a2b'); R('#8a6a3b', 9, 0, 14, 4); R('#7a5c32', 10, 1.5, 12, 1 / 3); R('#2f7a2c', 9, 3, 14, 1); break;
      case 'wizard_hat':
        brim('#4b3391'); R('#5b3fa8', 9, 0, 14, 4); R('#5b3fa8', 12, -4, 8, 4); R('#5b3fa8', 15, -7, 3, 3); R('#4b3391', 12.5, -3.5, 1, 6);
        R('#ffd24a', 15, -1, 2, 2); R('#ffd24a', 19, 1, 1, 1);
        break;
      case 'miner_helmet':
        R('#e2bb30', 8, 0, 16, 5); R('#c79a12', 7, 4, 18, 1); R('#c79a12', 15.5, 0, 1, 4);
        if (dir === 'down') { R('#3a3a52', 13.5, 0.5, 5, 4); R('#f4f4f4', 14, 1, 4, 3); R('#bfe3fb', 14.5, 1.5, 1.5, 1); }
        break;
      case 'crown':
        R('#f1c93a', 9, 0, 14, 3); R('#c79a12', 9, 2.5, 14, 0.5);
        for (const x of [9, 15, 21]) R('#f1c93a', x, -2, 2, 2);
        R('#e0483c', 15, 1, 2, 1); R('#55a8ee', 10.5, 1, 1, 1); R('#55a8ee', 20.5, 1, 1, 1);
        break;
      case 'tophat': R(hc, 10, -7, 12, 11); R(hl, 10.5, -6.5, 1, 9); R(hd, 20.5, -7, 1.5, 11); R('#e0483c', 10, 1.5, 12, 2); R(hc, 6.5, 4, 19, 2); R(hd, 6.5, 5.5, 19, 0.5); break;
      case 'headband': R(hc, 9, 4, 14, 2); R(hd, 9, 5.5, 14, 0.5); if (dir !== 'down') { R(hc, back + 1, 5, 2, 5); R(hc, back + 2.5, 6, 1.5, 4); } break;
      case 'bucket': R(hc, 9, -0.5, 14, 5); R(hd, 9, 3.5, 14, 0.5); R(hc, 6, 4, 20, 2.5); R(hd, 6, 6, 20, 0.5); for (const x of [11, 15, 19]) R(hd, x, 0.5, 1 / 3, 3); break;
      case 'visor': R(hc, 9, 3, 14, 2); if (dir === 'down') R(hd, 8, 5, 16, 2.5); if (dir === 'left') R(hd, 3, 4, 7, 2); if (dir === 'right') R(hd, 22, 4, 7, 2); break;
      case 'headphones': R('#2c2c3c', 8, 0.5, 16, 1.5); R('#2c2c3c', 7.5, 1, 1.5, 6); R('#2c2c3c', 23, 1, 1.5, 6); R(hc, 6.5, 6, 3.5, 6); R(hc, 22, 6, 3.5, 6); R(hd, 6.5, 11, 3.5, 1); R(hd, 22, 11, 3.5, 1); break;
      case 'flower_crown': R('#2f7a2c', 9, 3.5, 14, 1.5); [['#f08aa0', 9.5], ['#f6d643', 13], ['#f4f4f4', 16.5], ['#b58cf0', 20]].forEach(([c, x]) => { R(c, x, 2, 3, 3); R('#f5b942', x + 1, 3, 1, 1); }); break;
      case 'cat_ears': for (const x of [9, 19]) { R(hc, x, -1, 4, 4); R(hc, x + 1, -2.5, 2, 2); R('#f08aa0', x + 1.25, 0, 1.5, 2); } break;
      case 'pirate': R('#1c1c28', 7, 0, 18, 5); R('#1c1c28', 9.5, -3, 13, 3.5); R('#3a3a52', 7, 4, 18, 1); R('#e9e2cf', 15, -0.5, 2, 2); R('#e9e2cf', 14, 2, 4, 2 / 3); R('#e9e2cf', 15.5, 1.5, 1, 2); break;
      case 'halo': R('#f1c93a', 10, -5, 12, 1.5); R('#f1c93a', 9, -4.5, 1.5, 2); R('#f1c93a', 21.5, -4.5, 1.5, 2); R('#f1c93a', 10, -3, 12, 1); R('#fff3a8', 12, -4.75, 6, 1 / 3); break;
      case 'party_hat': R(hc, 12, -1, 8, 4); R(hc, 13.5, -4, 5, 3); R(hc, 15, -7, 2, 3); R(hl, 12, 1, 8, 0.7); R('#f4f4f4', 14.5, -9, 3, 2.5); R(hd, 12, 2.5, 8, 0.5); break;
      case 'bunny_ears': for (const x of [10, 18]) { R(hc, x, -8, 4, 10); R('#f8c6d4', x + 1.2, -6.5, 1.6, 7); } R(hc, 9, 2, 14, 1.5); break;
      case 'horns': for (const [x, f] of [[8, 1], [21, -1]]) { R('#e9e2cf', x, 0, 3, 3); R('#e9e2cf', x + (f > 0 ? 0 : 1), -3, 2, 3); R('#c9bfa3', x + (f > 0 ? 0 : 2), -5, 1, 2); } break;
      case 'antenna': R('#2c2c3c', 8, 1, 16, 1.5); R('#8a94a6', 15.5, -6, 1, 7); R('#e0483c', 14.5, -8.5, 3, 3); R('#ff9a8f', 15, -8, 1, 1); break;
      case 'chef_hat': R('#f4f4f4', 9, 0, 14, 5); R('#f4f4f4', 7.5, -6, 17, 6.5); R('#dcdcdc', 12, -5, 0.5, 5); R('#dcdcdc', 16, -5, 0.5, 5); R('#dcdcdc', 20, -5, 0.5, 5); R('#cfcfcf', 9, 4.5, 14, 0.5); break;
      case 'viking': R('#8a94a6', 8, 0, 16, 5); R('#566070', 8, 4.3, 16, 0.7); R('#c9ced8', 10, 0.5, 5, 0.6); R('#f1c93a', 15, 0, 2, 5); for (const [x, f] of [[4.5, 1], [24.5, -1]]) { R('#e9e2cf', x, 0, 3, 3); R('#e9e2cf', x + (f > 0 ? 0 : 1), -3.5, 2, 3.5); } break;
      case 'tiara': R('#f1c93a', 10, 2.5, 12, 1.5); R('#f1c93a', 15, -0.5, 2, 3); R('#f1c93a', 11.5, 1, 1.5, 1.5); R('#f1c93a', 19, 1, 1.5, 1.5); R('#f29ad0', 15.4, 0.3, 1.2, 1.2); break;
      case 'propeller': R(hc, 8, 0, 16, 5); R(hd, 8, 4.5, 16, 0.5); R(hl, 12, 0, 0.6, 4.5); R(hl, 19.4, 0, 0.6, 4.5); R('#2c2c3c', 15.5, -3, 1, 3); R('#e0483c', 9, -4, 6.5, 1.5); R('#55a8ee', 16.5, -4, 6.5, 1.5); break;
      case 'mushroom': R(hc, 6, 0, 20, 5.5); R(hc, 8, -3, 16, 3); R(hc, 11, -5, 10, 2); R(hd, 6, 5, 20, 0.6); for (const [a, b] of [[9, -1], [15, -3.5], [20, 0.5], [12.5, 2]]) R('#f4f4f4', a, b, 2.5, 2); break;
      case 'santa': R('#e0483c', 8, -1, 16, 5); R('#e0483c', 12, -5, 11, 4); R('#e0483c', 19, -8, 6, 3.5); R('#f4f4f4', 7, 3.5, 18, 2.5); R('#f4f4f4', 23.5, -9.5, 3.5, 3.5); R('#c0352c', 8, 3, 16, 0.5); break;
      case 'feather': R(hc, 9, 3.5, 14, 2); R(hd, 9, 5, 14, 0.5); R('#f4f4f4', 19, -6, 2.5, 10); R('#e0483c', 19, -6, 2.5, 3); R('#cfcfcf', 20, -5, 0.5, 9); break;
      case 'goggles': R('#3a2412', 8, 3.5, 16, 1.5); for (const x of [9.5, 16.5]) { R('#8a6a3b', x, 1.5, 6, 5); R('#bfe3fb', x + 1, 2.5, 4, 3); R('#f4f4f4', x + 1.3, 2.8, 1.3, 1); } break;
      case 'bandana': R(hc, 8.5, 0, 15, 5.5); R(hd, 8.5, 5, 15, 0.5); for (const [a, b] of [[11, 1.5], [15, 3], [19, 1.5]]) R('#f4f4f4', a, b, 1.2, 1.2); if (dir !== 'down') { R(hc, back + 1, 4.5, 2.5, 4); R(hd, back + 1, 8, 2.5, 0.5); } break;
      case 'fez': R('#c0352c', 11, -4, 10, 8); R('#a02a22', 11, 3.3, 10, 0.7); R('#e25a4c', 11.6, -3.5, 1, 7); R('#f1c93a', 15.5, -5, 1, 1.5); R('#f1c93a', 16, -5, 5, 0.6); R('#f1c93a', 20.5, -5, 0.8, 5); break;
      case 'sombrero': R('#e3c98a', 2.5, 3.5, 27, 2.5); R('#c9a95f', 2.5, 5.5, 27, 0.6); R('#e3c98a', 10.5, -4, 11, 8); R('#e0483c', 10.5, 1.5, 11, 1.4); R('#2f7a2c', 10.5, 0.6, 11, 0.7); for (let x = 4; x < 28; x += 3) R('#e0483c', x, 4.2, 1.2, 1.2); break;
      case 'jester': R(hc, 8, 1, 16, 4.5); R(hd, 8, 5, 16, 0.5); R(hc, 5, -3, 6, 5); R(hc, 21, -3, 6, 5); R(hl, 13, -5, 6, 6.5); for (const [a, b] of [[4.5, -5], [25.5, -5], [15, -7]]) R('#f1c93a', a, b, 2, 2); break;
    }
    if (marks.hat && dir === 'down') mark(marks.hat, 16, L.hat === 'tophat' ? -3 : L.hat === 'headband' ? 5 : 2);
  }

  // Things that stand on a tile but are not people.
  function drawProp(g, kind, sx, sy, time, o = {}) {
    const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, h); };
    const C = (c, a, b, r) => { g.fillStyle = c; g.beginPath(); g.arc(sx + a, sy + b, r, 0, 7); g.fill(); };
    if (kind === 'sparkle') {
      // A pickup: a little cluster of twinkles. Blue ones are clothes, pink ones spray designs.
      const c = o.outfit ? '#8fc4ff' : o.spray ? '#ff9ad5' : '#ffe27a';
      [[16, 20, 0], [9, 25, 2.1], [23, 24, 4.2], [14, 13, 1.1]].forEach(([a, b, ph], i) => {
        const tw = 0.5 + 0.5 * Math.sin(time / 260 + ph + sx), r = (i ? 2 : 3.6) * (0.45 + tw * 0.55);
        g.globalAlpha = 0.45 + tw * 0.55;
        R(c, a - r, b - 1 / 3, r * 2, 2 / 3); R(c, a - 1 / 3, b - r, 2 / 3, r * 2); R('#ffffff', a - r * 0.35, b - r * 0.35, r * 0.7, r * 0.7);
      });
      g.globalAlpha = 1;
    } else if (kind === 'banner') {
      // A gym banner: a tall pole flying the element's colours, with a beacon on top that pulses until the badge is won.
      const { color, dark } = ELEMENTS[o.el], wave = Math.sin(time / 280 + sx) * 1.2, pulse = 0.5 + 0.5 * Math.sin(time / 320);
      R('#0003', 10, 28, 12, 3); R('#3a2412', 14.5, -6, 3, 36); R('#8a6a3b', 15, -6, 1, 36);
      if (!o.won) { g.globalAlpha = 0.25 + 0.35 * pulse; C('#fff3a8', 16, -5, 5 + pulse * 2.5); g.globalAlpha = 1; }
      C(o.won ? '#9a9a9a' : '#ffd24a', 16, -5, 2.6);
      R(dark, 17.5, -2, 14, 15); R(color, 17.5, -1 + wave * 0.3, 13, 13); R(shade(color, 1.25), 17.5, -1 + wave * 0.3, 13, 2);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(sx + 24, sy + 2 + wave * 0.3); g.lineTo(sx + 28, sy + 6 + wave * 0.3); g.lineTo(sx + 24, sy + 10 + wave * 0.3); g.lineTo(sx + 20, sy + 6 + wave * 0.3); g.fill();
      R(dark, 17.5, 13, 4, 3 + wave); R(dark, 26.5, 13, 4, 3 - wave);
    } else if (kind === 'stop') {
      // A Creatastop: a market stall under a striped awning, with goods on the counter.
      R('#0003', 1, 28, 30, 3); R('#6b4a2b', 2, 6, 2, 24); R('#6b4a2b', 28, 6, 2, 24);
      R('#8a5a2b', 2, 18, 28, 11); R('#a9744a', 2, 18, 28, 2); R('#6b4a2b', 2, 28, 28, 1);
      for (let i = 0; i < 7; i++) R(i % 2 ? '#f4f4f4' : '#e8384f', i * 4.6, -3, 4.6, 9);
      for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#dcdcdc' : '#b82a3c'; g.beginPath(); g.arc(sx + i * 4.6 + 2.3, sy + 6, 2.3, 0, Math.PI); g.fill(); }
      R('#f08aa0', 6, 13, 4, 5); R('#fff', 7, 12, 2, 1.5); R('#e0483c', 13, 14, 5, 4); R('#f4f4f4', 13, 15.7, 5, 0.8); R('#55a8ee', 21, 13, 5, 5); R('#ffd24a', 22.5, 14.5, 2, 2);
      R('#ffd24a', 12, 21, 8, 5); R('#1d2437', 13.2, 22.3, 5.6, 2.4);
    } else if (kind === 'C') {
      R('#0003', 3, 27, 26, 4); R('#566070', 4, 6, 24, 23); R('#8a94a6', 5.5, 7.5, 21, 20); R('#6c7688', 5.5, 24, 21, 3.5);
      R('#566070', 4, 16, 24, 2); R('#566070', 15, 6, 2, 23);
      for (const [a, b] of [[7, 9], [24, 9], [7, 25], [24, 25]]) R('#2c2c3c', a, b, 1.5, 1.5);
    } else if (kind === 'chest') {
      const body = o.opened ? '#6d5a48' : o.outfit ? '#4a7fd0' : '#b5772e';
      R('#0003', 4, 26, 24, 4); R('#3a2412', 5, 9, 22, 18); R(body, 6.5, 10.5, 19, 15); R(shade(body, 1.3), 6.5, 10.5, 19, 1.5); R(shade(body, 0.7), 6.5, 16, 19, 1);
      R('#3a2412', 9, 10.5, 1, 15); R('#3a2412', 22, 10.5, 1, 15);
      if (o.opened) R('#1c1c28', 8, 11, 16, 4); else { R('#ffd24a', 14, 14.5, 4, 5); R('#fff3a8', 14.5, 15, 1, 1); R('#3a2412', 15.5, 16.5, 1, 2); }
    } else if (kind === 'o') {
      const bob = Math.sin(time / 300 + sx) * 0.7;
      R('#0003', 5, 27, 22, 3); R('#3a3a52', 9, 24, 3, 5); R('#3a3a52', 20, 24, 3, 5);
      [[11, 16], [17, 13], [22, 17], [15, 20], [20, 21], [10, 21]].forEach(([a, b]) => C('#f4efe3', a, b + bob, 6));
      [[12, 14], [18, 11]].forEach(([a, b]) => C('#ffffff', a, b + bob, 3));
      R('#3a3a52', 8, 15 + bob, 6, 5); R('#fff', 9, 16 + bob, 1.5, 1.5); R('#fff', 11.5, 16 + bob, 1.5, 1.5); R('#f08aa0', 10, 18.5 + bob, 2, 0.5);
    } else if (kind === 'O') {
      R('#0003', 3, 26, 26, 5); C('#5d5666', 16, 17, 13); C('#7c7486', 15, 15, 11.5); C('#948c9e', 11, 10, 5); C('#aaa2b3', 10, 9, 2);
      R('#5d5666', 18, 20, 5, 1); R('#5d5666', 9, 19, 3, 1); R('#4a4452', 20, 12, 1, 4);
    } else if (kind === 'fog' || kind === 'beast') {
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(240,244,255,${0.35 + 0.15 * Math.sin(time / 500 + i)})`; g.beginPath(); g.ellipse(sx + 16 + Math.sin(time / 700 + i * 2) * 6, sy + 6 + i * 5.5, 17 - i, 6, 0, 0, 7); g.fill(); }
      if (kind === 'beast') {
        const c = '#5b6f9ecc';
        R(c, 9, 14, 15, 8); R(c, 6, 9, 8, 8); R(c, 6, 5, 2.5, 5); R(c, 11, 5, 2.5, 5); R(c, 10, 22, 3, 7); R(c, 20, 22, 3, 7); R(c, 23, 11, 5, 3);
        R('#f1c93a', 3, 12, 6, 1.5); R('#ffe9a0', 7.5, 11, 1.5, 1.5);
      }
    } else if (kind === 'altar') {
      R('#0003', 2, 27, 28, 4); R('#8d8693', 3, 18, 26, 11); R('#a59eab', 3, 18, 26, 2); R('#6b6470', 3, 27, 26, 2); R('#57515c', 9, 21, 0.5, 5); R('#57515c', 20, 23, 3, 0.5);
      R('#4f8f4a', 4, 17, 5, 2); R('#4f8f4a', 22, 17.5, 4, 1.5);
      if (!o.taken) { R('#8a5a2b', 15, 3, 2, 4); R('#a0764a', 12, 7, 8, 1.5); R('#9c7a5a', 15, 8.5, 2, 10); R('#c2a184', 15, 8.5, 0.5, 10); }
    } else if (kind === 'boss') {
      const p = Math.sin(time / 350) * 1.5;
      C('rgba(155,63,214,.35)', 16, 14, 18 + p);
      R('#33284f', 6, 10, 20, 14); R('#8a78bd', 8, 12, 16, 10); R('#e0483c', 10, 14, 4, 3); R('#e0483c', 18, 14, 4, 3); R('#fff', 11, 15, 1.5, 1); R('#fff', 19, 15, 1.5, 1);
      R('#33284f', 2, 4 + p, 5, 12); R('#33284f', 25, 4 - p, 5, 12); R('#33284f', 12, 2, 2, 8); R('#33284f', 18, 2, 2, 8); R('#33284f', 11, 24, 10, 6); R('#e0483c', 14, 20, 4, 1);
    }
  }

  // ---------- Creatures ----------
  // Sprites are drawn in a 100x100 box facing left; flip makes them face right.
  // The easter egg uses img/modulo-yuji.png when that file exists, else a drawn stand-in.
  // Its Max Mode form likewise uses img/sukuna.png if present.
  const eggImg = new Image(), sukunaImg = new Image();
  eggImg.src = 'img/modulo-yuji.png';
  sukunaImg.src = 'img/sukuna.png';
  const artCache = new Map();
  function artImage(src, onLoad) {
    let im = artCache.get(src);
    if (!im) { im = new Image(); im.src = src; artCache.set(src, im); }
    if (!im.complete) im.addEventListener('load', onLoad, { once: true });
    return im;
  }

  function drawCreature(cv, c, flip) {
    const g = cv.getContext('2d'), s = cv.width / 100;
    cv.shown = c;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const egg = CM.isEgg(c), sukuna = egg && c.max;
    const eggArt = sukuna ? sukunaImg : eggImg;
    const im = egg ? (eggArt.naturalWidth ? eggArt : null)
      : c.art ? artImage(c.art, () => { if (cv.shown === c) drawCreature(cv, c, flip); }) : null;
    if (im) {
      if (!im.naturalWidth) return;
      g.imageSmoothingEnabled = egg || !!c.artUp;
      g.setTransform(flip ? -1 : 1, 0, 0, 1, flip ? cv.width : 0, 0);
      const k = Math.min(cv.width / im.naturalWidth, cv.height / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      g.drawImage(im, (cv.width - w) / 2, cv.height - h, w, h);
      return;
    }
    g.setTransform(flip ? -s : s, 0, 0, s, flip ? cv.width : 0, 0);
    const { color, dark } = ELEMENTS[c.element];
    g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = egg ? '#1c1c28' : dark;
    // Bodies are lit from the upper left so they read as rounded. A trainer's Creatamon (c.sketch) is instead
    // drawn the way its owner would: flat crayon colour, hatching, and an outline gone over twice.
    const sketch = !egg && c.sketch;
    let wobN = 0;
    const wob = () => ((Math.imul((sketch || 1) + wobN++ * 7919, 2654435761) >>> 0) % 100) / 100 - 0.5;
    const lit = (fill, x, y, r) => {
      if (sketch || fill.length !== 7) return fill;
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.25);
      gr.addColorStop(0, shade(fill, 1.14)); gr.addColorStop(0.55, fill); gr.addColorStop(1, shade(fill, 0.7));
      return gr;
    };
    const shape = (trace, fill, x, y, r) => {
      g.beginPath(); trace(); g.fillStyle = lit(fill, x, y, r); g.fill();
      if (!sketch) return g.stroke();
      const style = g.strokeStyle, width = g.lineWidth;
      g.save(); g.clip(); g.strokeStyle = '#00000026'; g.lineWidth = 1.1; g.beginPath();
      for (let d = -100; d < 100; d += 5.5) { const o = wob() * 3; g.moveTo(d + o, 0); g.lineTo(d + o + 100, 100); }
      g.stroke(); g.restore();
      g.strokeStyle = style; g.lineWidth = Math.max(1.4, width * 0.6);
      for (let pass = 0; pass < 2; pass++) { g.save(); g.translate(wob() * 2.4, wob() * 2.4); g.beginPath(); trace(); g.stroke(); g.restore(); }
      g.lineWidth = width;
    };
    const ell = (x, y, rx, ry, fill) => shape(() => g.ellipse(x, y, rx, ry, 0, 0, 7), fill, x, y, Math.max(rx, ry));
    const poly = (pts, fill) => {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      shape(() => { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }, fill, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2);
    };
    if (egg) {
      // Hooded figure against a red glow: face lost in the hood's shadow, one cheek catching the light.
      const line = (x1, y1, x2, y2, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
      const glow = g.createRadialGradient(50, 50, 8, 50, 50, 50);
      glow.addColorStop(0, '#e60a0a'); glow.addColorStop(0.75, '#8a0c0ccc'); glow.addColorStop(1, '#8a0c0c00');
      g.fillStyle = glow; g.fillRect(0, 0, 100, 100);
      g.strokeStyle = '#000'; g.lineWidth = 2.5;
      poly([[2, 100], [10, 80], [30, 68], [70, 68], [90, 80], [98, 100]], '#1c1c1b');
      g.beginPath(); g.moveTo(24, 76);
      g.bezierCurveTo(8, 52, 20, 6, 52, 3); g.bezierCurveTo(82, 6, 92, 50, 77, 76);
      g.closePath(); g.fillStyle = '#272725'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(30, 60); g.bezierCurveTo(16, 40, 30, 12, 50, 8);
      g.bezierCurveTo(40, 22, 40, 36, 46, 46); g.closePath(); g.fillStyle = '#161615'; g.fill();
      g.beginPath(); g.ellipse(51, 57, 23, 16, 0, 0, 7); g.fillStyle = '#050505'; g.fill(); g.stroke();
      g.lineWidth = 1.5;
      poly([[36, 54], [66, 54], [63, 64], [55, 73], [46, 73], [38, 64]], '#5b3b28');
      poly([[52, 54], [66, 54], [63, 64], [56, 68], [53, 62]], '#e9a468');
      g.beginPath(); g.moveTo(28, 56); g.bezierCurveTo(36, 44, 66, 44, 74, 56);
      g.bezierCurveTo(64, 53, 40, 53, 28, 56); g.fillStyle = '#050505'; g.fill();
      poly([[49, 53], [52, 53], [53, 62], [48, 63]], '#050505');
      line(43, 67, 57, 66, '#050505', 1.6);
      line(32, 30, 60, 16, '#3a3a37', 1.2); line(70, 22, 76, 50, '#111', 1.4); line(26, 44, 30, 62, '#111', 1.4);
      line(50, 77, 50, 100, '#050505', 5); line(50, 78, 50, 100, '#8d8d8d', 2);
      line(58, 77, 58, 90, '#c2553f', 1.8);
      if (sukuna) {
        // The hood is thrown back: markings on brow, cheeks and chin, and a second pair of eyes below the first.
        poly([[34, 30], [40, 14], [46, 26], [52, 10], [57, 26], [64, 14], [68, 32], [60, 44], [42, 44]], '#e88ea0');
        poly([[36, 44], [66, 44], [64, 62], [56, 73], [46, 73], [38, 62]], '#e9a468');
        line(47, 46, 55, 46, '#050505', 2); line(51, 44, 51, 50, '#050505', 2);
        line(38, 58, 45, 60, '#050505', 2.2); line(64, 58, 57, 60, '#050505', 2.2);
        line(39, 63, 45, 64, '#050505', 1.6); line(63, 63, 57, 64, '#050505', 1.6);
        line(49, 70, 53, 70, '#050505', 1.6);
        for (const [x, y, r] of [[44, 53, 2.6], [58, 53, 2.6], [44, 58.5, 1.6], [58, 58.5, 1.6]]) {
          g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#e60a0a'; g.fill();
          g.beginPath(); g.arc(x, y, r * 0.4, 0, 7); g.fillStyle = '#050505'; g.fill();
        }
        line(46, 66, 56, 65, '#050505', 1.8); line(56, 65, 58, 63, '#050505', 1.8);
      }
      return;
    }
    // Each evolution stage stands bigger; the final form has an aura behind it.
    const stage = c.stage || 0, grow = [0.8, 0.9, 1][stage];
    g.translate(50, 95); g.scale(grow, grow); g.translate(-50, -95);
    if (stage === 2) {
      const aura = g.createRadialGradient(50, 58, 14, 50, 58, 52);
      aura.addColorStop(0, `${color}aa`); aura.addColorStop(1, `${color}00`);
      g.fillStyle = aura; g.fillRect(-10, 0, 120, 110);
    }
    let eyes, top;
    if (c.shape === 'Beast') {
      poly([[80, 62], [97, 46], [90, 68]], color);
      for (const x of [40, 52, 66, 78]) poly([[x - 4, 74], [x + 4, 74], [x + 4, 90], [x - 4, 90]], dark);
      ell(60, 64, 27, 17, color);
      poly([[20, 38], [18, 18], [31, 31]], color);
      poly([[36, 31], [45, 15], [47, 36]], color);
      ell(32, 48, 18, 16, color);
      eyes = [[25, 46], [38, 46]]; top = [66, 48];
    } else if (c.shape === 'Bird') {
      poly([[72, 62], [96, 54], [92, 74]], dark);
      poly([[44, 80], [44, 92], [38, 92]], '#f5b942');
      poly([[58, 80], [58, 92], [52, 92]], '#f5b942');
      ell(50, 58, 25, 23, color);
      poly([[48, 54], [84, 36], [70, 68]], dark);
      poly([[28, 54], [10, 60], [28, 65]], '#f5b942');
      eyes = [[36, 48]]; top = [50, 36];
    } else if (c.shape === 'Shell') {
      ell(34, 84, 8, 6, dark); ell(74, 84, 8, 6, dark);
      ell(22, 66, 13, 11, color);
      g.beginPath(); g.arc(56, 80, 31, Math.PI, 0); g.closePath(); g.fillStyle = dark; g.fill(); g.stroke();
      g.beginPath(); g.arc(56, 80, 19, Math.PI, 0); g.closePath(); g.fillStyle = color; g.fill(); g.stroke();
      eyes = [[17, 63]]; top = [56, 50];
    } else if (c.shape === 'Serpent') {
      poly([[80, 72], [97, 58], [90, 80]], dark);
      ell(58, 79, 30, 12, color);
      ell(54, 67, 21, 10, color);
      poly([[36, 64], [30, 44], [46, 40], [58, 62]], color);
      poly([[18, 41], [5, 37], [9, 41], [5, 46]], '#e0483c');
      ell(32, 38, 16, 12, color);
      eyes = [[27, 35]]; top = [38, 26];
    } else if (c.shape === 'Bug') {
      for (const x of [40, 52, 66]) poly([[x - 2, 72], [x + 3, 72], [x - 3, 91], [x - 8, 91]], dark);
      poly([[24, 46], [10, 24], [14, 23], [28, 44]], dark);
      poly([[32, 45], [28, 20], [32, 20], [36, 45]], dark);
      ell(68, 62, 23, 17, dark);
      poly([[52, 50], [86, 30], [92, 44], [64, 58]], '#ffffffb0');
      ell(46, 62, 16, 15, color);
      ell(27, 56, 14, 13, color);
      eyes = [[21, 54]]; top = [48, 47];
    } else {
      ell(36, 88, 10, 5, dark); ell(64, 88, 10, 5, dark);
      ell(50, 62, 32, 28, color);
      g.beginPath(); g.arc(46, 70, 7, 0.2, Math.PI - 0.2); g.stroke();
      eyes = [[36, 56], [56, 56]]; top = [50, 35];
    }
    for (const [ex, ey] of eyes) {
      const x = ex + (sketch ? wob() * 2.5 : 0), y = ey + (sketch ? wob() * 2.5 : 0), r = sketch ? 4.6 + wob() * 2.4 : 5.5;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#fff'; g.fill();
      if (sketch) { g.lineWidth = 1.2; g.stroke(); }
      g.beginPath(); g.arc(x - 1.5, y, 2.6, 0, 7); g.fillStyle = '#1c1c28'; g.fill();
    }
    const [ax, ay] = top;
    if (sketch) {
      // Whatever its owner doodled on: a bow, spots, a star or a scarf, in their favourite colour.
      const col = ['#e0483c', '#55a8ee', '#f6d643', '#f08aa0', '#72cc5c', '#b58cf0'][sketch % 6], [ex, ey] = eyes[0];
      g.lineWidth = 1.5; g.strokeStyle = '#1c1c28';
      const doodle = (sketch >>> 3) % 4;
      if (doodle === 0) { poly([[ex + 4, ey - 12], [ex - 4, ey - 17], [ex - 4, ey - 7]], col); poly([[ex + 4, ey - 12], [ex + 12, ey - 17], [ex + 12, ey - 7]], col); }
      else if (doodle === 1) for (const [a, b, r] of [[ax + 4, ay + 16, 4], [ax + 13, ay + 22, 3], [ax - 4, ay + 24, 2.5]]) { g.beginPath(); g.arc(a, b, r, 0, 7); g.fillStyle = `${col}cc`; g.fill(); }
      else if (doodle === 2) poly([[ax + 8, ay + 8], [ax + 10, ay + 13], [ax + 15, ay + 13], [ax + 11, ay + 16], [ax + 13, ay + 21], [ax + 8, ay + 18], [ax + 3, ay + 21], [ax + 5, ay + 16], [ax + 1, ay + 13], [ax + 6, ay + 13]], col);
      else poly([[ex + 5, ey + 9], [ex + 22, ey + 11], [ex + 21, ey + 16], [ex + 14, ey + 15], [ex + 12, ey + 24], [ex + 7, ey + 23], [ex + 8, ey + 14]], col);
      g.strokeStyle = dark;
    }
    if (stage >= 1) {
      // Evolved markings on the brow; the final form adds a crest.
      g.strokeStyle = dark; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i < 2 + stage; i++) { g.moveTo(ax + 9 + i * 5, ay + 5); g.lineTo(ax + 12 + i * 5, ay + 11); }
      g.stroke();
      if (stage === 2) poly([[ax + 10, ay + 2], [ax + 16, ay - 12], [ax + 20, ay], [ax + 27, ay - 9], [ax + 29, ay + 5]], dark);
    }
    // The element's emblem grows with each stage.
    g.translate(ax, ay); g.scale(1 + stage * 0.3, 1 + stage * 0.3); g.translate(-ax, -ay);
    g.strokeStyle = dark;
    g.lineWidth = 2;
    if (c.element === 'Fire') poly([[ax - 8, ay], [ax - 4, ay - 11], [ax, ay - 5], [ax + 4, ay - 18], [ax + 9, ay]], '#ffd24a');
    if (c.element === 'Water') poly([[ax, ay - 18], [ax + 6, ay - 6], [ax, ay], [ax - 6, ay - 6]], '#c9ecff');
    if (c.element === 'Grass') poly([[ax, ay], [ax - 12, ay - 10], [ax + 1, ay - 18], [ax + 5, ay - 8]], '#2f9a3c');
    if (c.element === 'Electric') poly([[ax - 2, ay], [ax + 5, ay - 9], [ax, ay - 9], [ax + 5, ay - 20], [ax - 6, ay - 6], [ax - 1, ay - 6]], '#fff9a8');
    if (c.element === 'Rock') poly([[ax - 9, ay], [ax - 5, ay - 10], [ax, ay - 3], [ax + 5, ay - 13], [ax + 10, ay]], '#6d5a48');
    if (c.element === 'Ice') poly([[ax, ay - 20], [ax + 4, ay - 12], [ax + 10, ay - 10], [ax + 4, ay - 6], [ax, ay], [ax - 4, ay - 6], [ax - 10, ay - 10], [ax - 4, ay - 12]], '#eafcff');
    if (c.element === 'Shadow') poly([[ax - 10, ay], [ax - 12, ay - 16], [ax - 4, ay - 6], [ax, ay - 10], [ax + 4, ay - 6], [ax + 12, ay - 16], [ax + 10, ay]], '#2a1f45');
    if (c.element === 'Wind') { g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax - 9, ay - 2); g.bezierCurveTo(ax - 9, ay - 20, ax + 12, ay - 20, ax + 9, ay - 8); g.bezierCurveTo(ax + 7, ay - 1, ax - 2, ay - 4, ax + 1, ay - 10); g.stroke(); }
    if (c.element === 'Metal') { poly([[ax - 6, ay], [ax - 9, ay - 6], [ax - 6, ay - 13], [ax, ay - 16], [ax + 6, ay - 13], [ax + 9, ay - 6], [ax + 6, ay]], '#dfe4ec'); g.beginPath(); g.arc(ax, ay - 7.5, 3, 0, 7); g.fillStyle = dark; g.fill(); }
    if (c.element === 'Mind') { poly([[ax, ay - 17], [ax + 7, ay - 9], [ax, ay - 1], [ax - 7, ay - 9]], '#ffd9f0'); g.beginPath(); g.arc(ax, ay - 9, 2.4, 0, 7); g.fillStyle = dark; g.fill(); }
  }

  // ---------- Battle effects ----------
  // Plays a move's animation on the overlay canvas: something in the move's element travels from `from` to `to`
  // and bursts there ('heal' glows on `from` instead). Resolves when it is over.
  function playFx(cv, kind, from, to) {
    const g = cv.getContext('2d'), T = 640;
    const seed = Array.from({ length: 16 }, () => Math.random());
    const { color, dark } = ELEMENTS[kind] || ELEMENTS.Normal;
    const circle = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(0, r), 0, 7); g.fill(); };
    const line = (x1, y1, x2, y2, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    // Where particle i is at time t on its arc across the field, or null if it has not left or has landed.
    const flight = (t, i, n) => {
      const p = t / 0.62 * (1 + n * 0.06) - i * 0.06;
      if (p <= 0 || p >= 1) return null;
      return { x: from.x + (to.x - from.x) * p + (seed[i] - 0.5) * 26, y: from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 46 + (seed[i + 4] - 0.5) * 26, p };
    };
    const burst = (t, n, fn) => {
      const q = (t - 0.6) / 0.4;
      if (q <= 0) return;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + seed[i] * 0.6; fn(to.x + Math.cos(a) * q * 62, to.y + Math.sin(a) * q * 62, 1 - q, a); }
    };
    const frame = (t) => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.globalAlpha = 1;
      if (kind === 'heal') {
        for (let i = 0; i < 12; i++) {
          const x = from.x + (seed[i] - 0.5) * 150, y = from.y + 70 - ((t * 1.4 + seed[(i + 5) % 16]) % 1) * 150;
          g.globalAlpha = Math.sin(t * Math.PI);
          g.fillStyle = i % 2 ? '#8dff9a' : '#fff9a8'; g.fillRect(x - 3, y - 10, 6, 20); g.fillRect(x - 10, y - 3, 20, 6);
        }
        circle(from.x, from.y, 60 + t * 50, `rgba(140,255,160,${0.25 * Math.sin(t * Math.PI)})`);
      } else if (kind === 'Electric') {
        if (t < 0.75) for (let b = 0; b < 3; b++) {
          let x = to.x + (seed[b] - 0.5) * 120, y = 0;
          g.strokeStyle = b ? '#f6d643' : '#fff'; g.lineWidth = b ? 5 : 3; g.lineJoin = 'miter'; g.beginPath(); g.moveTo(x, y);
          while (y < to.y) { y += 18 + Math.random() * 22; x += (to.x - x) * 0.35 + (Math.random() - 0.5) * 44; g.lineTo(x, Math.min(y, to.y)); }
          g.stroke();
        }
        if (t < 0.2 || (t > 0.4 && t < 0.5)) { g.fillStyle = '#fff9a855'; g.fillRect(0, 0, cv.width, cv.height); }
        burst(t, 10, (x, y, a) => line(to.x, to.y, x, y, `rgba(246,214,67,${a})`, 4));
      } else if (kind === 'Rock') {
        for (let i = 0; i < 6; i++) {
          const p = Math.min(1, Math.max(0, t / 0.6 * 1.4 - i * 0.08)), x = to.x + (seed[i] - 0.5) * 130, y = -40 + (to.y + 40) * p * p;
          if (p < 1) { circle(x, y, 17 + seed[i + 6] * 10, dark); circle(x - 4, y - 4, 10 + seed[i + 6] * 6, color); }
        }
        burst(t, 12, (x, y, a) => circle(x, y + 30, 14 * a + 3, `rgba(179,148,116,${a})`));
      } else if (kind === 'Normal') {
        const p = Math.min(1, t / 0.55);
        for (let i = 0; i < 4; i++) line(from.x + (to.x - from.x) * Math.max(0, p - 0.25), from.y + (to.y - from.y) * Math.max(0, p - 0.25) + (i - 1.5) * 16,
          from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p + (i - 1.5) * 16, `rgba(255,255,255,${0.9 - p * 0.5})`, 5);
        burst(t, 8, (x, y, a, ang) => {
          g.fillStyle = `rgba(255,236,150,${a})`; g.beginPath();
          g.moveTo(to.x, to.y); g.lineTo(x + Math.cos(ang + 0.25) * 12, y + Math.sin(ang + 0.25) * 12); g.lineTo(x + Math.cos(ang - 0.25) * 12, y + Math.sin(ang - 0.25) * 12); g.fill();
        });
      } else if (kind === 'Cursed') {
        g.fillStyle = `rgba(20,0,10,${0.75 * Math.sin(t * Math.PI)})`; g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 5; i++) {
          const p = Math.min(1, Math.max(0, t * 2.2 - i * 0.18));
          if (p > 0) line(to.x - 110 + i * 22, to.y - 100 + seed[i] * 30, to.x - 110 + i * 22 + 170 * p, to.y - 100 + seed[i] * 30 + 190 * p, i % 2 ? '#e60a0a' : '#000', 7);
        }
        burst(t, 9, (x, y, a) => circle(x, y, 12 * a, `rgba(230,10,10,${a})`));
      } else {
        // Fire, Water, Grass, Ice and Shadow: a volley flies across, then bursts.
        const n = kind === 'Shadow' ? 3 : 9;
        for (let i = 0; i < n; i++) {
          const f = flight(t, i, n);
          if (!f) continue;
          if (kind === 'Fire') { circle(f.x, f.y, 15, '#f47a4588'); circle(f.x, f.y, 10, '#f47a45'); circle(f.x + 2, f.y - 2, 5, '#ffd24a'); }
          else if (kind === 'Water') { circle(f.x, f.y, 10, '#3d8fe0'); circle(f.x - 3, f.y - 3, 4, '#c9ecff'); circle(f.x - 12, f.y + 6, 5, '#55a8ee99'); }
          else if (kind === 'Grass') {
            g.save(); g.translate(f.x, f.y); g.rotate(f.p * 14 + i); g.fillStyle = i % 2 ? '#72cc5c' : '#2f9a3c';
            g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, 7); g.fill(); g.fillStyle = '#1f5f2c'; g.fillRect(-12, -1, 24, 2); g.restore();
          } else if (kind === 'Ice') {
            g.save(); g.translate(f.x, f.y); g.rotate(i + f.p * 4); g.fillStyle = '#eafcff';
            g.beginPath(); g.moveTo(0, -15); g.lineTo(6, 0); g.lineTo(0, 15); g.lineTo(-6, 0); g.fill(); g.fillStyle = '#9fe3ef'; g.fillRect(-1, -11, 2, 22); g.restore();
          } else if (kind === 'Wind') {
            g.strokeStyle = i % 2 ? '#e8fbf0' : '#8fd2ac'; g.lineWidth = 4; g.lineCap = 'round';
            g.beginPath(); g.arc(f.x, f.y, 12 + (i % 3) * 3, f.p * 9 + i, f.p * 9 + i + 3.6); g.stroke();
          } else if (kind === 'Metal') {
            g.save(); g.translate(f.x, f.y); g.rotate(f.p * 16 + i); g.fillStyle = i % 2 ? '#dfe4ec' : '#8a94a6';
            g.fillRect(-9, -9, 18, 18); g.fillStyle = '#566070'; g.fillRect(-3, -3, 6, 6); g.restore();
          } else if (kind === 'Mind') {
            g.strokeStyle = i % 2 ? '#f29ad0' : '#ffd9f0'; g.lineWidth = 3;
            g.beginPath(); g.ellipse(f.x, f.y, 8 + f.p * 14, 5 + f.p * 9, f.p * 3, 0, 7); g.stroke();
          } else { circle(f.x, f.y, 26, '#8a78bd55'); circle(f.x, f.y, 18, '#33284f'); circle(f.x - 5, f.y - 5, 6, '#b9a6ee'); }
        }
        if (kind === 'Shadow' && t > 0.6) for (let i = 0; i < 3; i++) line(to.x - 50 + i * 28, to.y - 60, to.x - 80 + i * 28, to.y + 60, `rgba(60,30,110,${1.4 - t})`, 8);
        burst(t, 12, (x, y, a, ang) => {
          if (kind === 'Ice') line(to.x + Math.cos(ang) * 14, to.y + Math.sin(ang) * 14, x, y, `rgba(234,252,255,${a})`, 4);
          else circle(x, y - (kind === 'Water' ? a * 24 : 0), 13 * a + 2, kind === 'Fire' ? `rgba(255,${120 + i2(a)},40,${a})` : `${color}${Math.round(a * 255).toString(16).padStart(2, '0')}`);
        });
      }
      g.globalAlpha = 1;
    };
    const i2 = (a) => Math.round(a * 110);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / T);
        frame(t);
        if (t < 1) requestAnimationFrame(tick);
        else { g.clearRect(0, 0, cv.width, cv.height); resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }

  return { shadows, drawTile, drawUp, drawPerson, drawProp, drawCreature, drawSpray, playFx, shade, tileHash, UPRIGHT, SPRAYS };
})();
export { GFX };
