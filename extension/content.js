/* Oli content script — inject "✦ Oli" button into Gmail / Outlook Web compose. */
(function () {
  const BASE = 'http://127.0.0.1';

  async function callRephrase(text, intent, tone) {
    const { oliToken, oliPort } = await chrome.storage.local.get(['oliToken', 'oliPort']);
    if (!oliToken) {
      alert('Pair the Oli extension first (click the toolbar icon).');
      return null;
    }
    const port = oliPort || 7421;
    const r = await fetch(`${BASE}:${port}/rephrase`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${oliToken}`
      },
      body: JSON.stringify({ text, intent, tone })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`Oli failed: ${e.error || r.statusText}`);
      return null;
    }
    return (await r.json()).text;
  }

  function findComposeFields() {
    // Gmail: editable div role=textbox aria-label contains "Message Body"
    // Outlook Web: role=textbox with data-editingmode or aria-label "Message body"
    return Array.from(document.querySelectorAll('[role="textbox"][aria-label*="ody" i]'));
  }

  function injectButton(textbox) {
    if (textbox.dataset.oliInjected === '1') return;
    textbox.dataset.oliInjected = '1';
    const btn = document.createElement('button');
    btn.textContent = '✦ Oli';
    btn.title = 'Rephrase with Oli';
    btn.type = 'button';
    btn.style.cssText =
      'position:absolute;z-index:99999;right:8px;top:-30px;padding:4px 10px;border-radius:6px;border:none;cursor:pointer;background:linear-gradient(135deg,#2563eb,#14b8a6);color:white;font:600 12px -apple-system,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.12)';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const original = textbox.innerText.trim();
      if (!original) return;
      btn.textContent = '… working';
      btn.disabled = true;
      const rewritten = await callRephrase(original, 'rephrase', 'professional');
      btn.textContent = '✦ Oli';
      btn.disabled = false;
      if (!rewritten) return;
      // Replace plain text by selecting all then inserting via execCommand.
      // Falls back to setting innerText if execCommand is unavailable.
      textbox.focus();
      try {
        document.execCommand('selectAll');
        document.execCommand('insertText', false, rewritten);
      } catch {
        textbox.innerText = rewritten;
      }
    });
    // Inject relative to textbox parent.
    const host = textbox.parentElement;
    if (!host) return;
    const cs = getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    host.appendChild(btn);
  }

  function scan() {
    for (const tb of findComposeFields()) injectButton(tb);
  }

  // Gmail/Outlook re-render frequently — observe and re-inject.
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(scan, 3000);
  scan();
})();
