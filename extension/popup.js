/* Oli extension popup — pair with desktop on 127.0.0.1:7421 */
const BASE = 'http://127.0.0.1';

async function findPort() {
  for (let p = 7421; p <= 7426; p++) {
    try {
      const r = await fetch(`${BASE}:${p}/status`, { mode: 'cors' });
      if (r.ok) return p;
    } catch (_e) {
      /* try next */
    }
  }
  return null;
}

async function refresh() {
  const status = document.getElementById('status');
  const pair = document.getElementById('pair');
  const ready = document.getElementById('ready');
  const stored = await chrome.storage.local.get(['oliToken', 'oliPort']);

  const port = (await findPort()) ?? stored.oliPort ?? 7421;
  document.getElementById('port').textContent = String(port);

  if (stored.oliToken) {
    status.textContent = `Connected on 127.0.0.1:${port}.`;
    status.className = 'ok';
    pair.style.display = 'none';
    ready.style.display = 'block';
  } else {
    status.textContent = port
      ? `Desktop reachable on 127.0.0.1:${port}. Need pairing.`
      : 'Cannot reach Oli desktop. Make sure it is running.';
    status.className = port ? 'muted' : 'err';
    pair.style.display = 'block';
    ready.style.display = 'none';
  }
  return port;
}

document.getElementById('pairBtn').addEventListener('click', async () => {
  const port = await refresh();
  if (!port) return;
  const code = document.getElementById('code').value.trim().toUpperCase();
  if (!code) return;
  try {
    const r = await fetch(`${BASE}:${port}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'pair failed');
    await chrome.storage.local.set({ oliToken: j.token, oliPort: port });
    document.getElementById('readyMsg').textContent = 'Paired ✓';
    await refresh();
  } catch (err) {
    const status = document.getElementById('status');
    status.textContent = `Pairing failed: ${err.message}`;
    status.className = 'err';
  }
});

document.getElementById('forget').addEventListener('click', async () => {
  await chrome.storage.local.remove(['oliToken']);
  await refresh();
});

void refresh();
