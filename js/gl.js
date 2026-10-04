// Creatamon 3D: draws the overworld as a WebGL scene, seen from the south at a tilt.
// The ground is the 2D tile art laid flat. Cliffs, walls and buildings are blocks raised out of it,
// and trees, people and chests are upright cards standing on it. No libraries.
const GL3D = (() => {
  const { drawTile, drawUp, tileHash, UPRIGHT } = GFX;
  const TS = 64;                    // texture pixels per tile (tiles are 32 units, drawn at double resolution)
  const GW = 25, GH = 19;           // tiles of ground redrawn around the camera each frame
  const NORTH = 11, WEST = 12;      // how far that window reaches north and west of the camera target
  const CELL_W = 32, CELL_H = 40;   // one upright sprite, in units; the tile's own 32x32 sits at the bottom
  const COLS = 16, ROWS = 6;        // sprite cells per sheet
  const PITCH = 52 * Math.PI / 180, DIST = 20.5, FOV = 30 * Math.PI / 180;
  // Upright things face the camera, standing FOOT of the way down their tile.
  const TALL = CELL_H / 32, FOOT = 0.9;
  // Block heights in tiles. Indoor walls stay low so they do not hide the floor behind them.
  const HEIGHT = { '^': 0.6, I: 0.4, R: 1.3, G: 1.3, W: 1.3, M: 1.3 };
  const VIEW_W = 480, VIEW_H = 352;

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
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false }) || canvas.getContext('experimental-webgl');
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
    const fixed = sheet(COLS * CELL_W * 2, CELL_H * 2);        // trees and rocks, drawn once
    const moving = sheet(COLS * CELL_W * 2, ROWS * CELL_H * 2); // people and props, redrawn each frame
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
      return [(col * CELL_W * 2 + e) / w, (row * CELL_H * 2 + e) / h, ((col + 1) * CELL_W * 2 - e) / w, ((row + 1) * CELL_H * 2 - e) / h];
    };
    const UP_Y = TALL * Math.cos(PITCH), UP_Z = -TALL * Math.sin(PITCH);
    const stand = (s, i, x, y) => {
      const z = y + FOOT;
      quad(s, [x, UP_Y, z + UP_Z], [x + 1, UP_Y, z + UP_Z], [x + 1, 0, z], [x, 0, z], ...cellUV(s, i), 1, [x + 0.5, 0, z]);
    };

    // The fixed sheet: four trees, then one each of the other upright tiles.
    const FIXED = { '#': 0, T: 4, k: 5, x: 6, m: 7 };
    fixed.g.setTransform(2, 0, 0, 2, 0, 0);
    for (let i = 0; i < 4; i++) drawUp(fixed.g, '#', i * CELL_W, 8, 977 * (i + 1), 0);
    'Tkxm'.split('').forEach((ch) => drawUp(fixed.g, ch, FIXED[ch] * CELL_W, 8, 7, 0));
    upload(fixed);

    // scene: { id, P, S, cx, cy (camera target, in tiles), time, sprites: [{ x, y, draw(g, sx, sy) }] }
    // Returns project(x, height, y) -> [sx, sy] on the 480x352 view, for overlays.
    function render({ id, P, S, cx, cy, time, sprites }) {
      const gx0 = Math.floor(cx) - WEST, gy0 = Math.floor(cy) - NORTH;
      const height = (x, y) => {
        const ch = CM.charAt(id, x, y);
        return HEIGHT[ch] || (ch === 'D' && CM.TINT[`${x},${y}`] && id === 'world' ? HEIGHT.W : 0);
      };
      ground.verts.length = fixed.verts.length = moving.verts.length = 0;
      const live = sprites.slice();

      ground.g.setTransform(TS / 32, 0, 0, TS / 32, 0, 0);
      const e = 0.5 / TS;
      const tileUV = (x, y) => [(x - gx0 + e) / GW, (y - gy0 + e) / GH, (x - gx0 + 1 - e) / GW, (y - gy0 + 1 - e) / GH];
      quad(ground, [gx0, 0, gy0], [gx0 + GW, 0, gy0], [gx0 + GW, 0, gy0 + GH], [gx0, 0, gy0 + GH], 0, 0, 1, 1, 1);
      for (let y = gy0; y < gy0 + GH; y++) {
        for (let x = gx0; x < gx0 + GW; x++) {
          drawTile(ground.g, id, x, y, (x - gx0) * 32, (y - gy0) * 32, time, P, S, true);
          const ch = CM.charAt(id, x, y), h = height(x, y);
          if (h) {
            const uv = tileUV(x, y);
            // Walls are a face, not a lid: their top borrows the roof behind them.
            const lid = 'WDM'.includes(ch) && 'RG'.includes(CM.charAt(id, x, y - 1)) ? tileUV(x, y - 1) : uv;
            quad(ground, [x, h, y], [x + 1, h, y], [x + 1, h, y + 1], [x, h, y + 1], ...lid, ch === 'I' ? 0.55 : 1);
            if (height(x, y + 1) < h) quad(ground, [x, h, y + 1], [x + 1, h, y + 1], [x + 1, 0, y + 1], [x, 0, y + 1], ...uv, 'WDM'.includes(ch) ? 1 : 0.8);
            if (height(x - 1, y) < h) quad(ground, [x, h, y], [x, h, y + 1], [x, 0, y + 1], [x, 0, y], ...uv, 0.6);
            if (height(x + 1, y) < h) quad(ground, [x + 1, h, y + 1], [x + 1, h, y], [x + 1, 0, y], [x + 1, 0, y + 1], ...uv, 0.7);
          } else if (UPRIGHT.includes(ch) && !(ch === 'x' && S.smashed[`${id}:${x},${y}`])) {
            const hash = tileHash(x, y);
            if (ch === 'B') live.push({ x, y, draw: (g, sx, sy) => drawUp(g, 'B', sx, sy, hash, time, P.fire[CM.MAPS[id].fires.indexOf(`${x},${y}`)]) });
            else stand(fixed, FIXED[ch] + (ch === '#' ? hash & 3 : 0), x, y);
          }
        }
      }

      // People and props: drawn into cells north to south, so nearer ones blend over farther ones.
      live.sort((a, b) => a.y - b.y);
      moving.g.setTransform(1, 0, 0, 1, 0, 0);
      moving.g.clearRect(0, 0, moving.cv.width, moving.cv.height);
      moving.g.setTransform(2, 0, 0, 2, 0, 0);
      live.slice(0, COLS * ROWS).forEach((sp, i) => {
        sp.draw(moving.g, (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H + 8);
        stand(moving, i, sp.x, sp.y);
      });

      const eye = [cx, DIST * Math.sin(PITCH), cy + DIST * Math.cos(PITCH)];
      const m = mul(perspective(FOV, VIEW_W / VIEW_H, 1, 80), view(eye));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(loc.m, false, new Float32Array(m));
      upload(ground); upload(moving);
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
