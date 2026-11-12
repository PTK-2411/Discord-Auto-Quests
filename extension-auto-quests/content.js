// Discord Auto Quests - Content Script (runs inside discord.com tabs)

(function () {
  function extractToken() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Direct access to localStorage.token (exact method from extension-get-token)
        const t1 = localStorage.token;
        if (t1) {
          const clean = String(t1).replace(/"/g, '').trim();
          if (clean) return clean;
        }

        const t2 = localStorage.getItem('token');
        if (t2) {
          const clean = String(t2).replace(/"/g, '').trim();
          if (clean) return clean;
        }
      }
    } catch (e) {
      console.warn('[AutoQuests Content] Storage read error:', e);
    }

    // Secondary fallback: hidden iframe access
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const iframeStorage = iframe.contentWindow?.localStorage;
      const raw = iframeStorage?.token || iframeStorage?.getItem('token');
      document.body.removeChild(iframe);
      if (raw) {
        const clean = String(raw).replace(/"/g, '').trim();
        if (clean) return clean;
      }
    } catch (e) {}

    return null;
  }

  function syncToken() {
    const token = extractToken();
    if (token) {
      try {
        chrome.storage.local.get(['token'], (d) => {
          if (d && d.token !== token) {
            chrome.storage.local.set({ token });
          }
        });
        chrome.runtime.sendMessage({ action: 'TOKEN_EXTRACTED', token });
      } catch (err) {
        // Extension context might be invalidated if reloaded
      }
      return true;
    }
    return false;
  }

  // 1. Synchronize immediately when content script loads
  if (!syncToken()) {
    // 2. Poll every 500ms for up to 12 seconds while Discord SPA loads
    let count = 0;
    const timer = setInterval(() => {
      count++;
      if (syncToken() || count >= 24) {
        clearInterval(timer);
      }
    }, 500);
  }

  // 3. Listen to storage changes (user login / account switch)
  try {
    window.addEventListener('storage', (event) => {
      if (event.key === 'token') {
        syncToken();
      }
    });
  } catch (e) {}

  // 4. Respond to direct queries from popup or background
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === 'GET_TOKEN_FROM_PAGE') {
        const token = extractToken();
        sendResponse({ token });
        return false;
      }
    });
  } catch (e) {}
})();
