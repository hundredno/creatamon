// Records the page while the bot plays: every frame Chrome draws (CDP screencast) and everything the game's Web Audio
// sends to the speakers, joined into one constant-60fps master.mkv.
//
// Video: each screencast frame carries the time it was drawn. Frames are repeated as needed to fill a steady 60 fps
// and piped into ffmpeg as they arrive (NVENC when there is an NVIDIA card, so encoding stays off the game's GPU).
// Audio: a script added to the page sends whatever the game connects to its AudioContext's output to a MediaRecorder
// as well. The game's sound itself is untouched. Both sides note the wall-clock time they start, which lines them up.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { claps } from './claps.mjs';

const FPS = 60;

function encoder() {
  try {
    execSync('ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=black:s=256x256:d=0.1 -c:v h264_nvenc -f null -', { stdio: 'ignore' });
    return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', '18', '-b:v', '0'];
  } catch (e) {
    return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17'];
  }
}

export class Recorder {
  constructor(page, dir, log) {
    Object.assign(this, { page, dir, log, frames: 0, written: 0, last: null, t0: null, audioStart: null, chunks: 0 });
    this.audio = fs.createWriteStream(path.join(dir, 'audio.webm'));
  }

  // Before the page loads: the audio tap and the channel its chunks come back on.
  async prepare() {
    await this.page.exposeFunction('__recAudio', (b64) => { this.audio.write(Buffer.from(b64, 'base64')); this.chunks++; });
    await this.page.exposeFunction('__recAudioStart', (t) => { this.audioStart = t; this.log.event('audio_start', { epoch: t }); });
    await this.page.addInitScript(() => {
      const taps = new WeakMap();
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest, ...rest) {
        const out = connect.call(this, dest, ...rest);
        if (dest instanceof AudioDestinationNode) {
          const ctx = dest.context;
          if (!taps.has(ctx)) {
            const tap = ctx.createMediaStreamDestination();
            const rec = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
            rec.ondataavailable = async (e) => {
              const buf = new Uint8Array(await e.data.arrayBuffer());
              let s = '';
              for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
              window.__recAudio(btoa(s));
            };
            rec.onstart = () => window.__recAudioStart(performance.timeOrigin + performance.now());
            rec.start(1000);
            window.__recStop = () => new Promise((r) => { rec.onstop = () => setTimeout(r, 300); rec.stop(); });
            // A clapperboard: a white square in the page's top left corner (outside the game, cropped from every video)
            // and, at the same moment, a short beep that goes only into the recording, never to the speakers.
            window.__recClap = () => {
              const o = ctx.createOscillator(), g = ctx.createGain();
              o.frequency.value = 3000; g.gain.value = 0.3;
              o.connect(g); g.connect(tap);
              o.start(); o.stop(ctx.currentTime + 0.1);
              const d = document.createElement('div');
              d.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:120px;background:#fff;z-index:99999;pointer-events:none';
              document.body.appendChild(d);
              setTimeout(() => d.remove(), 100);
            };
            taps.set(ctx, tap);
          }
          connect.call(this, taps.get(ctx));
        }
        return out;
      };
    });
  }

  async start() {
    const segs = path.join(this.dir, 'video');
    fs.mkdirSync(segs, { recursive: true });
    this.ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
      ...encoder(), '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-f', 'segment', '-segment_time', '600', '-reset_timestamps', '1',
      path.join(segs, 'part%03d.mkv')], { stdio: ['pipe', 'ignore', 'inherit'] });
    this.ffmpeg.stdin.on('error', () => {});
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (e) => {
      this.cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
      this.frame(Buffer.from(e.data, 'base64'), e.metadata.timestamp * 1000);
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    this.log.event('record_start', {});
  }

  // Claps the board once the game's sound has started. Returns whether it did.
  async clap() {
    const ok = await this.page.evaluate(() => { if (!window.__recClap) return false; window.__recClap(); return true; }).catch(() => false);
    if (ok) { (this.clapAt = this.clapAt || []).push(Date.now()); this.log.event('clap', { n: this.clapAt.length }); }
    return ok;
  }
  // A new picture at wall-clock time t (ms): the previous one is repeated up to t, so the output keeps a steady 60 fps.
  frame(jpeg, t) {
    if (this.t0 == null) { this.t0 = t; this.log.event('video_start', { epoch: t }); }
    this.frames++;
    if (this.last) this.fill(t);
    this.last = jpeg;
  }
  fill(t) {
    const due = Math.floor((t - this.t0) * FPS / 1000);
    for (; this.written < due; this.written++) this.ffmpeg.stdin.write(this.last);
  }

  async stop() {
    await this.clap();
    await new Promise((r) => setTimeout(r, 1500));
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    if (this.last) this.fill(Date.now());
    await new Promise((r) => { this.ffmpeg.on('close', r); this.ffmpeg.stdin.end(); });
    await this.page.evaluate(() => window.__recStop && window.__recStop()).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => this.audio.end(r));
    this.log.event('record_stop', { frames: this.frames, written: this.written, audioChunks: this.chunks });
    return this.mux();
  }

  // Joins the video parts and lays the audio in at the right moment, then checks it against the claps and corrects
  // the timing if they disagree.
  mux() {
    const start = this.audioStart != null && this.t0 != null ? (this.audioStart - this.t0) / 1000 : 0;
    let master = this.join(start);
    if (!this.chunks || !this.clapAt) return master;
    const seen = claps(master, this.clapAt.map((t) => (t - this.t0) / 1000)).map((p) => p.audio - p.video);
    // The median of the claps that agree with it (the very first second of sound can be off).
    const mid = [...seen].sort((a, b) => a - b)[Math.floor(seen.length / 2)];
    const good = seen.filter((d) => Math.abs(d - mid) < 0.2), off = good.length ? good.reduce((a, b) => a + b, 0) / good.length : 0;
    this.log.event('sync', { claps: seen.map((d) => Math.round(d * 1000)), correction: Math.round(off * 1000) });
    if (Math.abs(off) > 0.02) master = this.join(start - off);
    return master;
  }
  join(offset) {
    const segs = path.join(this.dir, 'video'), parts = fs.readdirSync(segs).filter((f) => f.endsWith('.mkv')).sort();
    fs.writeFileSync(path.join(segs, 'list.txt'), parts.map((f) => `file '${f}'`).join('\n'));
    const master = path.join(this.dir, 'master.mkv');
    const audio = this.chunks ? ['-itsoffset', offset.toFixed(3), '-i', path.join(this.dir, 'audio.webm')] : [];
    execSync(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(segs, 'list.txt'), ...audio,
      '-map', '0:v', ...(this.chunks ? ['-map', '1:a', '-c:a', 'copy'] : []), '-c:v', 'copy', master].map((a) => `'${a}'`).join(' '), { stdio: 'inherit' });
    this.log.event('master', { file: master, audioOffset: offset });
    return master;
  }
}
