import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// The version shown in the corner of the game: "v." and the first 4 characters of the commit being built,
// plus "+" when the working tree has uncommitted changes (untracked files included). Cloudflare's git builds
// pass the commit in WORKERS_CI_COMMIT_SHA; without git or a commit it is "v.dev".
function version() {
  const git = (args) => execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  let sha = process.env.WORKERS_CI_COMMIT_SHA, dirty = false;
  try {
    sha = sha || git('rev-parse HEAD');
    dirty = git('status --porcelain') !== '';
  } catch { /* not a git checkout */ }
  return sha ? `v.${sha.slice(0, 4)}${dirty ? '+' : ''}` : 'v.dev';
}
const VERSION = version();

export default defineConfig({
  build: {
    // Ship the code's own syntax untranspiled, so it runs on exactly the browsers it always has.
    target: 'esnext',
    // One bundle, nothing to preload: leave out Vite's preload polyfill.
    modulePreload: false,
  },
  plugins: [{
    name: 'creatamon-version',
    transformIndexHtml: { order: 'pre', handler: (html) => html.replace('%APP_VERSION%', VERSION) },
  }],
});
