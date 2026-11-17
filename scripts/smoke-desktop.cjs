const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const desktopRoot = path.join(root, 'desktop');
const port = 9333;
const packagedExecutable = process.env.NIGHTFALL_DESKTOP_EXECUTABLE
  ? path.resolve(root, process.env.NIGHTFALL_DESKTOP_EXECUTABLE)
  : undefined;
const electronBinary = packagedExecutable || (process.platform === 'win32'
  ? path.join(desktopRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(desktopRoot, 'node_modules', '.bin', 'electron'));

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function pageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(target =>
          target.type === 'page'
          && target.webSocketDebuggerUrl
          && String(target.url).startsWith('nightfall://app/'));
        if (page) return page;
      }
    } catch {
      // Electron is still starting.
    }
    await sleep(500);
  }
  throw new Error('Electron page did not expose a debugging target');
}

async function evaluate(page, expression) {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP evaluation timed out')), 10_000);
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timer);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result.result.value);
    });
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true },
    }));
  });
  socket.close();
  return result;
}

async function main() {
  const args = packagedExecutable ? [
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
  ] : [
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '.',
  ];
  const child = spawn(electronBinary, args, {
    cwd: packagedExecutable ? path.dirname(packagedExecutable) : desktopRoot,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      NIGHTFALL_DESKTOP_SMOKE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });

  try {
    const page = await pageTarget();
    const result = await evaluate(page, `(async () => {
      let snapshot = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        snapshot = {
          title: document.title,
          protocol: location.protocol,
          readyState: document.readyState,
          crossOriginIsolated,
          sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
          hasNightfallText: document.body.innerText.includes('夜幕')
        };
        if (snapshot.protocol === 'nightfall:'
          && snapshot.readyState === 'complete'
          && snapshot.hasNightfallText) return snapshot;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return snapshot;
    })()`);
    if (result.protocol !== 'nightfall:') throw new Error(`Unexpected protocol: ${result.protocol}`);
    if (!result.crossOriginIsolated) throw new Error('Electron page is not cross-origin isolated');
    if (!result.sharedArrayBuffer) throw new Error('SharedArrayBuffer is unavailable');
    if (!result.hasNightfallText) throw new Error('Nightfall UI did not render');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }

  if (stderr.trim()) process.stderr.write(stderr);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
