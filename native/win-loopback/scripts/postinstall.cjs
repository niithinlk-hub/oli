const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
const npm = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  const finalArgs = npmCli ? [npmCli, ...args] : args;
  return spawnSync(npm, finalArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: !npmCli && process.platform === 'win32'
  });
}

let result = run(['install', '--no-audit', '--no-fund']);
if (result.status === 0) {
  result = run(['run', 'build']);
}

if (result.status !== 0) {
  if (result.error) {
    console.warn(`[oli] Native addon build command failed to start: ${result.error.message}`);
  }
  console.warn(
    '[oli] Native WASAPI loopback addon was not built. ' +
      'Install Rust + the Windows SDK and run `npm --prefix native/win-loopback run build`; ' +
      'the app will use getDisplayMedia until the addon is present.'
  );
}
