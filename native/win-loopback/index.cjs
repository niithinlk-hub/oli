const fs = require('node:fs');
const path = require('node:path');

const candidates = [
  'oli-win-loopback.win32-x64-msvc.node',
  'oli_win_loopback.win32-x64-msvc.node',
  'oli-win-loopback.node',
  'oli_win_loopback.node'
];

for (const fileName of candidates) {
  const filePath = path.join(__dirname, fileName);
  if (fs.existsSync(filePath)) {
    module.exports = require(filePath);
    return;
  }
}

const found = fs.readdirSync(__dirname).find((fileName) => fileName.endsWith('.node'));
if (found) {
  module.exports = require(path.join(__dirname, found));
  return;
}

throw new Error(`No native loopback addon found in ${__dirname}`);
