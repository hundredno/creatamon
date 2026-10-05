// Creatamon 3D: draws the overworld as a lit WebGL scene, seen from the south at a tilt.
// The ground is the 2D tile art laid flat and filtered smooth. Cliffs and walls are blocks raised out of it,
// buildings have pitched roofs, trees are low-poly rounded canopies, and people stand upright with real depth.
// Sunlight warms the lit faces and cools the shaded ones, everything tall casts a soft shadow, and the
// distance fades into haze. Props are upright cards. No libraries.
const GL3D = (() => {
  const { drawTile, drawUp, tileHash, shade } = GFX;
  const RES = 3;                    // texture pixels per unit: a third of a unit is the finest detail
  const TS = 32 * RES;              // texture pixels per tile
  const GW = 25, GH = 19;           // tiles of ground kept drawn around the camera
  const NORTH = 11, WEST = 12;      // how far that window reaches north and west of the camera target
  const CELL_W = 32, CELL_H = 40;   // one upright sprite, in units; the tile's own 32x32 sits at the bottom
  const COLS = 16, ROWS = 6;        // sprite cells per sheet
  const PITCH = 46 * Math.PI / 180, DIST = 18, FOV = 34 * Math.PI / 180;
  // Upright things face the camera, standing FOOT of the way down their tile.
  const TALL = CELL_H / 32, FOOT = 0.9;
  // Block heights in tiles. Indoor walls stay low so they do not hide the floor behind them.
  const HEIGHT = { '^': 0.8, I: 0.4, M: 1.6 };
  const HOUSE = 'RGWD', EAVE = 1.35, RIDGE = 0.32;   // walls rise to EAVE; the ridge adds RIDGE per tile of depth
  const VIEW_W = 480, VIEW_H = 352;
  // The ground texture is redrawn this often (ms). Water and lava move slowly enough not to need more.
  const REFRESH = 100;

  // b is where the vertex's object touches the ground: a sprite leans back to face the camera,
  // but is hidden or shown by the depth of its feet, so it never cuts into what stands behind it.
  const VS = `attribute vec3 p; attribute vec3 b; attribute vec2 uv; attribute float sh; uniform mat4 m; varying vec2 vuv; varying float vsh; varying float vd;
    void main() { vec4 q = m * vec4(b, 1.0); gl_Position = m * vec4(p, 1.0); gl_Position.z = q.z / q.w * gl_Position.w; vuv = uv; vsh = sh; vd = gl_Position.w; }`;
  // sh is how squarely a face meets the sun: lit faces lean warm, shaded ones cool. fog: x = where haze starts, y = where it is total.
  const FS = `precision mediump float; uniform sampler2D t; uniform float cut; uniform vec3 haze; uniform vec2 fog; varying vec2 vuv; varying float vsh; varying float vd;
    void main() {
      vec4 c = texture2D(t, vuv); if (c.a <= cut) discard;
      float l = clamp((vsh - 0.55) / 0.45, 0.0, 1.0);
      vec3 lit = c.rgb * vsh * mix(vec3(0.78, 0.86, 1.12), vec3(1.08, 1.04, 0.94), l);
      lit = mix(vec3(dot(lit, vec3(0.3, 0.59, 0.11))), lit, 1.14);
      gl_FragColor = vec4(mix(lit, haze, smoothstep(fog.x, fog.y, vd)), c.a);
    }`;
  // Towards the sun: high up, to the west and a little south, so shadows fall to the east.
  const SUN = (() => { const v = [-0.5, 0.78, 0.38], n = Math.hypot(...v); return v.map((a) => a / n); })();
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

  const mul = (a, b) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  };
  const perspective = (fov, aspect, near, far) => {
    const t = 1 / Math.tan(fov / 2);
    return [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
  };
  // A camera at `eye` looking north and down at PITCH.
  const view = (eye) => {
    const s = Math.sin(PITCH), c = Math.cos(PITCH);
    // rows of the rotation: right (1,0,0), up (0,c,-s), back (0,s,c)
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, -eye[0], -(c * eye[1] - s * eye[2]), -(s * eye[1] + c * eye[2]), 1];
  };

  function create(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const loc = { p: gl.getAttribLocation(prog, 'p'), b: gl.getAttribLocation(prog, 'b'), uv: gl.getAttribLocation(prog, 'uv'), sh: gl.getAttribLocation(prog, 'sh'),
      m: gl.getUniformLocation(prog, 'm'), cut: gl.getUniformLocation(prog, 'cut'), haze: gl.getUniformLocation(prog, 'haze'), fog: gl.getUniformLocation(prog, 'fog') };
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    [[loc.p, 3, 0], [loc.uv, 2, 12], [loc.sh, 1, 20], [loc.b, 3, 24]].forEach(([l, n, off]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 36, off); });
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.05, 0.05, 0.08, 1);

    const sheet = (w, h) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return { cv, g, tex, verts: [] };
    };
    const ground = sheet(GW * TS, GH * TS);
    const fixed = sheet(COLS * CELL_W * RES, CELL_H * RES);          // rocks and tree textures, drawn once
    const moving = sheet(COLS * CELL_W * RES, ROWS * CELL_H * RES);  // people and props, redrawn each frame
    // Soft shadows: a round blob for trees and people, and two fading strips for the foot of walls.
    const shadow = sheet(96, 32);
    {
      const g = shadow.g, blob = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      blob.addColorStop(0, 'rgba(10,20,40,.42)'); blob.addColorStop(0.6, 'rgba(10,20,40,.28)'); blob.addColorStop(1, 'rgba(10,20,40,0)');
      g.fillStyle = blob; g.fillRect(0, 0, 32, 32);
      const across = g.createLinearGradient(33, 0, 63, 0), down = g.createLinearGradient(0, 1, 0, 31);
      [across, down].forEach((gr) => { gr.addColorStop(0, 'rgba(10,20,40,.4)'); gr.addColorStop(1, 'rgba(10,20,40,0)'); });
      g.fillStyle = across; g.fillRect(33, 1, 30, 30); g.fillStyle = down; g.fillRect(65, 1, 30, 30);
    }
    const SHADE = { blob: [1 / 96, 1 / 32, 31 / 96, 31 / 32], across: [34 / 96, 2 / 32, 62 / 96, 30 / 32], down: [66 / 96, 2 / 32, 94 / 96, 30 / 32] };
    const LIFT = 0.02;   // shadows lie just above the ground
    const blob = (cx, cz, rx, rz) => quad(shadow, [cx - rx, LIFT, cz - rz], [cx + rx, LIFT, cz - rz], [cx + rx, LIFT, cz + rz], [cx - rx, LIFT, cz + rz], ...SHADE.blob, 1);
    const upload = (s) => { gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.cv); };
    const flush = (s, cut) => {
      if (!s.verts.length) return;
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform1f(loc.cut, cut);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(s.verts), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, s.verts.length / 9);
    };
    // Corners go top-left, top-right, bottom-right, bottom-left. foot: the shared ground point of a sprite.
    upload(shadow);
    const quad = (s, a, b, c, d, u0, v0, u1, v1, sh, foot) => {
      const v = (p, u, w) => s.verts.push(...p, u, w, sh, ...(foot || p));
      v(a, u0, v0); v(b, u1, v0); v(c, u1, v1); v(a, u0, v0); v(c, u1, v1); v(d, u0, v1);
    };
    const cellUV = (s, i) => {
      const col = i % COLS, row = Math.floor(i / COLS), w = s.cv.width, h = s.cv.height, e = 0.5;
      return [(col * CELL_W * RES + e) / w, (row * CELL_H * RES + e) / h, ((col + 1) * CELL_W * RES - e) / w, ((row + 1) * CELL_H * RES - e) / h];
    };
    const UP_Y = TALL * Math.cos(PITCH), UP_Z = -TALL * Math.sin(PITCH);
    const stand = (s, i, x, y) => {
      const z = y + FOOT;
      quad(s, [x, UP_Y, z + UP_Z], [x + 1, UP_Y, z + UP_Z], [x + 1, 0, z], [x, 0, z], ...cellUV(s, i), 1, [x + 0.5, 0, z]);
    };
    // A person, standing upright with some depth to them: the sprite is cut into head, body and legs, each a slab whose
    // front shows that band of the picture, with the crown of the head and the outer sides closed in from its edge colours.
    const GROW = 1.3;   // upright figures are seen foreshortened from above, so they stand a little taller than their art
    const figure = (s, i, x, y) => {
      const [u0, v0, u1, v1] = cellUV(s, i), zc = y + 0.62;
      const U = (ax) => u0 + (u1 - u0) * ax / CELL_W, V = (ay) => v0 + (v1 - v0) * ay / CELL_H;
      const X = (ax) => x + ax / 32, H = (ay) => (CELL_H - ay) / 32 * GROW;
      // [top, bottom] rows of the cell, depth, [left, right] edges of the body there
      for (const [t, b, d, l, r] of [[0, 22, 0.42, 9, 23], [22, 31, 0.3, 5, 27], [31, 40, 0.2, 10, 22]]) {
        const zf = zc + d / 2, zb = zc - d / 2;
        quad(s, [x, H(t), zf], [x + 1, H(t), zf], [x + 1, H(b), zf], [x, H(b), zf], U(0), V(t), U(32), V(b), 0.98);
        const top = t ? t : 10.4;
        quad(s, [X(l), H(top), zb], [X(l), H(top), zf], [X(l), H(b), zf], [X(l), H(b), zb], U(l + 0.3), V(top + 0.5), U(l + 1.2), V(b - 0.5), 0.62);
        quad(s, [X(r), H(top), zf], [X(r), H(top), zb], [X(r), H(b), zb], [X(r), H(b), zf], U(r - 2.2), V(top + 0.5), U(r - 1.3), V(b - 0.5), 0.74);
        if (!t) quad(s, [X(l), H(top), zb], [X(r), H(top), zb], [X(r), H(top), zf], [X(l), H(top), zf], U(l + 2), V(top + 0.2), U(r - 2), V(top + 1.4), 1.08);
      }
    };
    // A block seen from the south: its lid and the three sides that can face the camera.
    const block = (s, x0, z0, x1, z1, h0, h1, lid, side, sh = 1) => {
      quad(s, [x0, h1, z0], [x1, h1, z0], [x1, h1, z1], [x0, h1, z1], ...lid, sh);
      quad(s, [x0, h1, z1], [x1, h1, z1], [x1, h0, z1], [x0, h0, z1], ...side, sh * 0.78);
      quad(s, [x0, h1, z0], [x0, h1, z1], [x0, h0, z1], [x0, h0, z0], ...side, sh * 0.58);
      quad(s, [x1, h1, z1], [x1, h1, z0], [x1, h0, z0], [x1, h0, z1], ...side, sh * 0.66);
    };

    // The fixed sheet: upright rocks and mushrooms, then flat textures for building trees out of blocks.
    const FIXED = { k: 0, x: 1, m: 2 }, TEX = { leaf: 3, leafTop: 4, bark: 5, pine: 6, snow: 7 };
    fixed.g.setTransform(RES, 0, 0, RES, 0, 0);
    'kxm'.split('').forEach((ch) => drawUp(fixed.g, ch, FIXED[ch] * CELL_W, 8, 7, 0));
    [['leaf', '#2f7d3a'], ['leafTop', '#3f9148'], ['bark', '#6b4a2b'], ['pine', '#1f5a48'], ['snow', '#e8eef5']].forEach(([name, base]) => {
      const x0 = TEX[name] * CELL_W;
      fixed.g.fillStyle = base; fixed.g.fillRect(x0, 0, CELL_W, CELL_H);
      for (let i = 0; i < 150; i++) {
        const v = Math.imul(i * 7919 + TEX[name] * 131, 2654435761) >>> 0;
        fixed.g.fillStyle = shade(base, i % 3 ? 0.84 : 1.1);
        fixed.g.fillRect(x0 + (v % 93) / 3, ((v >>> 8) % 117) / 3, 1 + ((v >>> 20) & 1), 2 / 3);
      }
    });
    upload(fixed);
    // Keep texture lookups a little inside each cell so neighbours never bleed in.
    const tex = (name) => { const [u0, v0, u1, v1] = cellUV(fixed, TEX[name]); const du = (u1 - u0) * 0.08, dv = (v1 - v0) * 0.08; return [u0 + du, v0 + dv, u1 - du, v1 - dv]; };
    const T = { leaf: tex('leaf'), leafTop: tex('leafTop'), bark: tex('bark'), pine: tex('pine'), snow: tex('snow') };
    // A solid of revolution from rings of [height, radius], bottom to top, each face shaded by how it meets the sun.
    const SIDES = 7;
    const lathe = (s, cx, cz, rings, uvOf, tone, turn) => {
      for (let i = 0; i + 1 < rings.length; i++) {
        const [h0, r0] = rings[i], [h1, r1] = rings[i + 1], uv = uvOf(i);
        for (let k = 0; k < SIDES; k++) {
          const a0 = turn + k / SIDES * Math.PI * 2, a1 = turn + (k + 1) / SIDES * Math.PI * 2, am = (a0 + a1) / 2;
          // Outward normal of this facet: it tips up where the shape narrows.
          const slope = Math.atan2(r0 - r1, h1 - h0), n = [Math.cos(am) * Math.cos(slope), Math.sin(slope), Math.sin(am) * Math.cos(slope)];
          if (n[2] < -0.45 && n[1] < 0.5) continue;   // faces the far side
          const sh = tone * (0.5 + 0.58 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]));
          const P = (a, h, r) => [cx + Math.cos(a) * r, h, cz + Math.sin(a) * r];
          quad(s, P(a0, h1, r1), P(a1, h1, r1), P(a1, h0, r0), P(a0, h0, r0), ...uv, sh);
        }
      }
    };
    const tree = (x, y, hash, snowy) => {
      const j = ((hash >>> 4) % 9) / 100, tone = 0.92 + ((hash >>> 9) % 16) / 100, turn = (hash % 97) / 15, k = 1 + j * 2;
      const cx = x + 0.5 + (((hash >>> 13) % 9) - 4) / 60, cz = y + 0.55;
      block(fixed, cx - 0.11, cz - 0.11, cx + 0.11, cz + 0.11, 0, 0.6, T.bark, T.bark);
      if (snowy) {
        [[0.34, 0.54, 1.0, 0.2], [0.82, 0.42, 1.45, 0.14], [1.28, 0.3, 1.95, 0]].forEach(([h0, r0, h1, r1]) => {
          const hm = (h0 + h1) / 2, rm = (r0 + r1) / 2;
          lathe(fixed, cx, cz, [[h0 * k, r0], [hm * k, rm], [h1 * k, r1]], (i) => (i ? T.snow : T.pine), tone, turn);
        });
      } else {
        lathe(fixed, cx, cz, [[0.48, 0.26], [0.78 * k, 0.54], [1.2 * k, 0.52], [1.58 * k, 0.33], [1.78 * k, 0]], (i) => (i > 1 ? T.leafTop : T.leaf), tone, turn);
      }
      blob(cx + 0.34, cz + 0.16, 0.82, 0.5);
    };

    let groundKey = '', groundAt = -1e9;
    // scene: { id, P, S, cx, cy (camera target, in tiles), time, sprites: [{ x, y, draw(g, sx, sy) }] }
    // Returns project(x, height, y) -> [sx, sy] on the 480x352 view, for overlays.
    function render({ id, P, S, cx, cy, time, sprites }) {
      const gx0 = Math.floor(cx) - WEST, gy0 = Math.floor(cy) - NORTH;
      const at = (x, y) => CM.charAt(id, x, y);
      const house = (x, y) => { const ch = at(x, y); return id === 'world' && (ch === 'R' || ch === 'G' || ch === 'W' || (ch === 'D' && !!CM.TINT[`${x},${y}`])); };
      // The roofline over a building tile: [north edge, depth] of the building in this column.
      const span = (x, y) => { let n = y, s = y; while (house(x, n - 1)) n--; while (house(x, s + 1)) s++; return [n, s - n + 1]; };
      const roofH = (n, d, z) => EAVE + RIDGE * d * (1 - Math.abs(z - (n + d / 2)) / (d / 2));
      const height = (x, y) => (house(x, y) ? EAVE : HEIGHT[at(x, y)] || 0);

      // The picture on the ground is repainted often (water moves); the shapes standing on it only when the view shifts.
      const key = `${id}:${gx0},${gy0}:${Object.keys(S.smashed).length}`, reshape = key !== groundKey;
      if (reshape || time - groundAt > REFRESH || time < groundAt) {
        groundKey = key; groundAt = time;
        if (reshape) ground.verts.length = fixed.verts.length = shadow.verts.length = 0;
        ground.g.setTransform(RES, 0, 0, RES, 0, 0);
        const e = 0.5 / TS;
        const tileUV = (x, y) => [(x - gx0 + e) / GW, (y - gy0 + e) / GH, (x - gx0 + 1 - e) / GW, (y - gy0 + 1 - e) / GH];
        if (reshape) quad(ground, [gx0, 0, gy0], [gx0 + GW, 0, gy0], [gx0 + GW, 0, gy0 + GH], [gx0, 0, gy0 + GH], 0, 0, 1, 1, 1);
        const open = (x, y) => height(x, y) === 0 && !'#T'.includes(at(x, y));
        for (let y = gy0; y < gy0 + GH; y++) {
          for (let x = gx0; x < gx0 + GW; x++) {
            drawTile(ground.g, id, x, y, (x - gx0) * 32, (y - gy0) * 32, time, P, S, true);
            if (!reshape) continue;
            const ch = at(x, y), uv = tileUV(x, y);
            // Anything tall throws a shadow over the open ground to its east and at its southern foot.
            const tall = height(x, y);
            if (tall) {
              const reach = Math.min(1, tall * 0.75);
              if (open(x + 1, y)) quad(shadow, [x + 1, LIFT, y], [x + 1 + reach, LIFT, y + 0.25], [x + 1 + reach, LIFT, y + 1.25], [x + 1, LIFT, y + 1], ...SHADE.across, 1);
              if (open(x, y + 1)) quad(shadow, [x, LIFT, y + 1], [x + 1, LIFT, y + 1], [x + 1 + reach * 0.3, LIFT, y + 1 + reach * 0.4], [x + reach * 0.3, LIFT, y + 1 + reach * 0.4], ...SHADE.down, 1);
            }
            if (house(x, y)) {
              const [n, d] = span(x, y), mid = n + d / 2;
              // Roof art comes from the nearest roof tile; the wall row borrows the one behind it.
              const roof = 'RG'.includes(ch) ? uv : tileUV(x, y - 1);
              const slope = (za, zb) => {
                const va = roof[1] + (roof[3] - roof[1]) * (za - y), vb = roof[1] + (roof[3] - roof[1]) * (zb - y);
                quad(ground, [x, roofH(n, d, za), za], [x + 1, roofH(n, d, za), za], [x + 1, roofH(n, d, zb), zb], [x, roofH(n, d, zb), zb],
                  roof[0], va, roof[2], vb, zb <= mid ? 0.74 : 1);
              };
              if (mid > y && mid < y + 1) { slope(y, mid); slope(mid, y + 1); } else slope(y, y + 1);
              if (!house(x, y + 1)) quad(ground, [x, EAVE, y + 1], [x + 1, EAVE, y + 1], [x + 1, 0, y + 1], [x, 0, y + 1], ...uv, 1);
              // Gable ends: plain wall from the bottom strip of the wall tile, rising to the roofline.
              const w = tileUV(x, n + d - 1), plain = [w[0], w[1] + (w[3] - w[1]) * 0.78, w[2], w[1] + (w[3] - w[1]) * 0.9];
              const gable = (gx, sh, za, zb) => quad(ground, [gx, roofH(n, d, za), za], [gx, roofH(n, d, zb), zb], [gx, 0, zb], [gx, 0, za], ...plain, sh);
              for (const [gx, open, sh] of [[x, !house(x - 1, y), 0.6], [x + 1, !house(x + 1, y), 0.7]]) {
                if (!open) continue;
                if (mid > y && mid < y + 1) { gable(gx, sh, y, mid); gable(gx, sh, mid, y + 1); } else gable(gx, sh, y, y + 1);
              }
            } else if (HEIGHT[ch]) {
              const h = HEIGHT[ch];
              quad(ground, [x, h, y], [x + 1, h, y], [x + 1, h, y + 1], [x, h, y + 1], ...uv, ch === 'I' ? 0.55 : 1);
              if (height(x, y + 1) < h) quad(ground, [x, h, y + 1], [x + 1, h, y + 1], [x + 1, 0, y + 1], [x, 0, y + 1], ...uv, ch === 'M' ? 1 : 0.8);
              if (height(x - 1, y) < h) quad(ground, [x, h, y], [x, h, y + 1], [x, 0, y + 1], [x, 0, y], ...uv, 0.6);
              if (height(x + 1, y) < h) quad(ground, [x + 1, h, y + 1], [x + 1, h, y], [x + 1, 0, y], [x + 1, 0, y + 1], ...uv, 0.7);
            } else if (ch === '#' || ch === 'T') {
              tree(x, y, tileHash(x, y), ch === 'T');
            } else if (FIXED[ch] !== undefined && !(ch === 'x' && S.smashed[`${id}:${x},${y}`])) {
              stand(fixed, FIXED[ch], x, y);
              blob(x + 0.6, y + 0.85, 0.5, 0.26);
            }
          }
        }
        upload(ground);
      }

      // Lit braziers flicker, so they are redrawn with the people and props.
      const live = sprites.slice();
      CM.MAPS[id].fires.forEach((k, i) => {
        const [x, y] = k.split(',').map(Number);
        live.push({ x, y, draw: (g, sx, sy) => drawUp(g, 'B', sx, sy, tileHash(x, y), time, P.fire[i]) });
      });
      // Drawn into cells north to south, so nearer ones blend over farther ones.
      live.sort((a, b) => a.y - b.y);
      moving.verts.length = 0;
      moving.g.setTransform(1, 0, 0, 1, 0, 0);
      moving.g.clearRect(0, 0, moving.cv.width, moving.cv.height);
      moving.g.setTransform(RES, 0, 0, RES, 0, 0);
      const cast = shadow.verts.length;
      GFX.shadows(false);
      live.slice(0, COLS * ROWS).forEach((sp, i) => {
        sp.draw(moving.g, (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H + 8);
        if (sp.fig) figure(moving, i, sp.x, sp.y); else stand(moving, i, sp.x, sp.y);
        if (sp.fig) blob(sp.x + 0.62, sp.y + 0.72, 0.42, 0.24);
      });
      GFX.shadows(true);

      const eye = [cx, DIST * Math.sin(PITCH), cy + DIST * Math.cos(PITCH)];
      const m = mul(perspective(FOV, VIEW_W / VIEW_H, 1, 80), view(eye));
      // Outdoors the distance melts into a pale sky haze (blood-dark during the Blackest Night); rooms have none.
      const outdoors = id === 'world' || id === 'grove', night = S.f.night && !S.f.dawn;
      const haze = hex(!outdoors ? '#0d0d14' : night ? '#3a1028' : id === 'grove' ? '#dfe6ee' : '#cfe4f4');
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(...haze, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(loc.m, false, new Float32Array(m));
      gl.uniform3f(loc.haze, ...haze);
      gl.uniform2f(loc.fog, outdoors ? (id === 'grove' ? 16 : 22) : 900, outdoors ? (id === 'grove' ? 27 : 31) : 1000);
      upload(moving);
      gl.disable(gl.BLEND);
      flush(ground, -1);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      flush(shadow, 0.004);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      flush(fixed, 0.5);
      gl.enable(gl.BLEND);
      flush(moving, 0.35);
      shadow.verts.length = cast;   // the people's shadows are laid afresh each frame

      return (x, up, y) => {
        const w = m[3] * x + m[7] * up + m[11] * y + m[15];
        return [((m[0] * x + m[4] * up + m[8] * y + m[12]) / w + 1) / 2 * VIEW_W, (1 - (m[1] * x + m[5] * up + m[9] * y + m[13]) / w) / 2 * VIEW_H];
      };
    }
    return { render, FOOT };
  }

  return { create };
})();
