// Creatamon 3D: draws the overworld as a WebGL scene, seen from the south at a tilt.
// The ground is the 2D tile art laid flat. Cliffs and walls are blocks raised out of it, buildings have
// pitched roofs, trees are stacked blocks of foliage, and people and props are upright cards. No libraries.
const GL3D = (() => {
  const { drawTile, drawUp, tileHash, shade } = GFX;
  const RES = 3;                    // texture pixels per unit: a third of a unit is the finest detail
  const TS = 32 * RES;              // texture pixels per tile
  const GW = 25, GH = 19;           // tiles of ground kept drawn around the camera
  const NORTH = 11, WEST = 12;      // how far that window reaches north and west of the camera target
  const CELL_W = 32, CELL_H = 40;   // one upright sprite, in units; the tile's own 32x32 sits at the bottom
  const COLS = 16, ROWS = 6;        // sprite cells per sheet
  const PITCH = 52 * Math.PI / 180, DIST = 20.5, FOV = 30 * Math.PI / 180;
  // Upright things face the camera, standing FOOT of the way down their tile.
  const TALL = CELL_H / 32, FOOT = 0.9;
  // Block heights in tiles. Indoor walls stay low so they do not hide the floor behind them.
  const HEIGHT = { '^': 0.6, I: 0.4, M: 1.3 };
  const HOUSE = 'RGWD', EAVE = 1, RIDGE = 0.3;   // walls rise to EAVE; the ridge adds RIDGE per tile of depth
  const VIEW_W = 480, VIEW_H = 352;
  // The ground texture is redrawn this often (ms). Water and lava move slowly enough not to need more.
  const REFRESH = 100;

  // b is where the vertex's object touches the ground: a sprite leans back to face the camera,
  // but is hidden or shown by the depth of its feet, so it never cuts into what stands behind it.
  const VS = `attribute vec3 p; attribute vec3 b; attribute vec2 uv; attribute float sh; uniform mat4 m; varying vec2 vuv; varying float vsh;
    void main() { vec4 q = m * vec4(b, 1.0); gl_Position = m * vec4(p, 1.0); gl_Position.z = q.z / q.w * gl_Position.w; vuv = uv; vsh = sh; }`;
  const FS = `precision mediump float; uniform sampler2D t; uniform float cut; varying vec2 vuv; varying float vsh;
    void main() { vec4 c = texture2D(t, vuv); if (c.a <= cut) discard; gl_FragColor = vec4(c.rgb * vsh, c.a); }`;

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
      m: gl.getUniformLocation(prog, 'm'), cut: gl.getUniformLocation(prog, 'cut') };
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return { cv, g, tex, verts: [] };
    };
    const ground = sheet(GW * TS, GH * TS);
    const fixed = sheet(COLS * CELL_W * RES, CELL_H * RES);          // rocks and tree textures, drawn once
    const moving = sheet(COLS * CELL_W * RES, ROWS * CELL_H * RES);  // people and props, redrawn each frame
    const upload = (s) => { gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.cv); };
    const flush = (s, cut) => {
      if (!s.verts.length) return;
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform1f(loc.cut, cut);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(s.verts), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, s.verts.length / 9);
    };
    // Corners go top-left, top-right, bottom-right, bottom-left. foot: the shared ground point of a sprite.
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
    const tree = (x, y, hash, snowy) => {
      const j = ((hash >>> 4) % 9) / 100, tone = 0.9 + ((hash >>> 9) % 16) / 100;
      const cx = x + 0.5, cz = y + 0.55;
      block(fixed, cx - 0.13, cz - 0.13, cx + 0.13, cz + 0.13, 0, 0.5, T.bark, T.bark);
      if (snowy) {
        [[0.42, 0.3, 0.75], [0.31, 0.7, 1.15], [0.18, 1.1, 1.6]].forEach(([r, a, b]) => block(fixed, cx - r, cz - r, cx + r, cz + r, a, b + j, T.snow, T.pine, tone));
      } else {
        block(fixed, cx - 0.46, cz - 0.44, cx + 0.46, cz + 0.44, 0.38, 1.0 + j, T.leafTop, T.leaf, tone);
        block(fixed, cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, 1.0 + j, 1.42 + j * 2, T.leafTop, T.leaf, tone * 1.06);
      }
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

      const key = `${id}:${gx0},${gy0}`;
      if (key !== groundKey || time - groundAt > REFRESH || time < groundAt) {
        groundKey = key; groundAt = time;
        ground.verts.length = fixed.verts.length = 0;
        ground.g.setTransform(RES, 0, 0, RES, 0, 0);
        const e = 0.5 / TS;
        const tileUV = (x, y) => [(x - gx0 + e) / GW, (y - gy0 + e) / GH, (x - gx0 + 1 - e) / GW, (y - gy0 + 1 - e) / GH];
        quad(ground, [gx0, 0, gy0], [gx0 + GW, 0, gy0], [gx0 + GW, 0, gy0 + GH], [gx0, 0, gy0 + GH], 0, 0, 1, 1, 1);
        for (let y = gy0; y < gy0 + GH; y++) {
          for (let x = gx0; x < gx0 + GW; x++) {
            drawTile(ground.g, id, x, y, (x - gx0) * 32, (y - gy0) * 32, time, P, S, true);
            const ch = at(x, y), uv = tileUV(x, y);
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
      live.slice(0, COLS * ROWS).forEach((sp, i) => {
        sp.draw(moving.g, (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H + 8);
        stand(moving, i, sp.x, sp.y);
      });

      const eye = [cx, DIST * Math.sin(PITCH), cy + DIST * Math.cos(PITCH)];
      const m = mul(perspective(FOV, VIEW_W / VIEW_H, 1, 80), view(eye));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(loc.m, false, new Float32Array(m));
      upload(moving);
      gl.disable(gl.BLEND);
      flush(ground, -1);
      flush(fixed, 0.5);
      gl.enable(gl.BLEND);
      flush(moving, 0.02);

      return (x, up, y) => {
        const w = m[3] * x + m[7] * up + m[11] * y + m[15];
        return [((m[0] * x + m[4] * up + m[8] * y + m[12]) / w + 1) / 2 * VIEW_W, (1 - (m[1] * x + m[5] * up + m[9] * y + m[13]) / w) / 2 * VIEW_H];
      };
    }
    return { render, FOOT };
  }

  return { create };
})();
