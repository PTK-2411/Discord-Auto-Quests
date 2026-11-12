/**
 * Test Harness for Discord-Auto-Quests E2E Test Suite
 * Provides transparent, high-fidelity mock environments for Chrome Extension MV3 APIs,
 * Discord REST API routing, DOM emulation, and headless execution.
 */

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fixtures = require('./fixtures.js');

const EXT_GET_TOKEN_DIR = path.resolve(__dirname, '../../extension-get-token');
const EXT_AUTO_QUESTS_DIR = path.resolve(__dirname, '../../extension-auto-quests');

/**
 * Creates a lightweight DOM Element mock
 */
function createMockElement(id = '', tag = 'div') {
  const listeners = {};
  const classes = new Set();
  const children = [];

  let innerHtmlVal = '';

  const elem = {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    src: '',
    checked: false,
    dataset: {},
    scrollTop: 0,
    scrollHeight: 100,
    style: {},
    get className() {
      return Array.from(classes).join(' ');
    },
    set className(val) {
      classes.clear();
      if (val) {
        val.trim().split(/\s+/).forEach(t => classes.add(t));
      }
    },
    get innerHTML() {
      if (children.length > 0) {
        return children.map(c => c.innerHTML || c.textContent || '').join('');
      }
      return innerHtmlVal;
    },
    set innerHTML(val) {
      innerHtmlVal = val;
      if (val === '') {
        children.length = 0;
      }
    },
    classList: {
      add: (...tokens) => tokens.forEach(t => classes.add(t)),
      remove: (...tokens) => tokens.forEach(t => classes.delete(t)),
      contains: (token) => classes.has(token),
      toggle: (token) => {
        if (classes.has(token)) {
          classes.delete(token);
          return false;
        } else {
          classes.add(token);
          return true;
        }
      },
      toString: () => Array.from(classes).join(' ')
    },
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    },
    dispatch: (event, data = {}) => {
      if (listeners[event]) {
        listeners[event].forEach(h => h(data));
      }
    },
    appendChild: (child) => {
      children.push(child);
      return child;
    },
    querySelector: (sel) => createMockElement('', 'span'),
    querySelectorAll: (sel) => [],
    get children() {
      return children;
    }
  };

  return elem;
}

/**
 * Creates a mock document tree populated with elements matching popup.html
 */
function createMockDocument() {
  const elements = {
    autoRunToggle: createMockElement('autoRunToggle', 'input'),
    userAvatar: createMockElement('userAvatar', 'img'),
    userStatusDot: createMockElement('userStatusDot', 'span'),
    userName: createMockElement('userName', 'span'),
    userId: createMockElement('userId', 'span'),
    userOrbs: createMockElement('userOrbs', 'span'),
    runBtn: createMockElement('runBtn', 'button'),
    runBtnText: createMockElement('runBtnText', 'span'),
    refreshBtn: createMockElement('refreshBtn', 'button'),
    clearLogsBtn: createMockElement('clearLogsBtn', 'button'),
    questCount: createMockElement('questCount', 'span'),
    questList: createMockElement('questList', 'div'),
    logConsole: createMockElement('logConsole', 'div'),
    statusIndicator: createMockElement('statusIndicator', 'span'),
    questsTab: createMockElement('questsTab', 'main'),
    logsTab: createMockElement('logsTab', 'main'),
    updateBanner: createMockElement('updateBanner', 'div'),
    updateBannerTitle: createMockElement('updateBannerTitle', 'div'),
    updateBannerVersion: createMockElement('updateBannerVersion', 'div'),
    updateBannerDesc: createMockElement('updateBannerDesc', 'div'),
    btnAcceptUpdate: createMockElement('btnAcceptUpdate', 'button'),
    btnDismissUpdate: createMockElement('btnDismissUpdate', 'button'),
    btnReloadExtension: createMockElement('btnReloadExtension', 'button')
  };

  elements.userAvatar.src = 'icons/icon48.png';
  elements.autoRunToggle.checked = true;
  elements.updateBanner.classList.add('hidden');

  const tabBtn1 = createMockElement('', 'button');
  tabBtn1.classList.add('tab-btn', 'active');
  tabBtn1.dataset.tab = 'questsTab';

  const tabBtn2 = createMockElement('', 'button');
  tabBtn2.classList.add('tab-btn');
  tabBtn2.dataset.tab = 'logsTab';

  elements.questsTab.classList.add('tab-content', 'active');
  elements.logsTab.classList.add('tab-content');

  const doc = {
    elements,
    tabButtons: [tabBtn1, tabBtn2],
    tabContents: [elements.questsTab, elements.logsTab],
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (selector) => {
      if (selector === '.tab-btn') return [tabBtn1, tabBtn2];
      if (selector === '.tab-content') return [elements.questsTab, elements.logsTab];
      return [];
    },
    createElement: (tag) => createMockElement('', tag)
  };

  return doc;
}

/**
 * Shared in-memory Chrome storage mock
 */
function createStorage(initial = {}) {
  const store = { ...initial };
  const listeners = [];

  return {
    _data: store,
    local: {
      get: async (keys) => {
        if (!keys) return { ...store };
        if (typeof keys === 'string') return { [keys]: store[keys] };
        if (Array.isArray(keys)) {
          const res = {};
          keys.forEach(k => { res[k] = store[k]; });
          return res;
        }
        if (typeof keys === 'object') {
          const res = {};
          for (const k in keys) {
            res[k] = store[k] !== undefined ? store[k] : keys[k];
          }
          return res;
        }
        return { ...store };
      },
      set: async (items) => {
        Object.assign(store, items);
        listeners.forEach(fn => fn(items));
      },
      clear: async () => {
        for (const k in store) delete store[k];
      }
    },
    onChanged: {
      addListener: (fn) => listeners.push(fn)
    }
  };
}

/**
 * Configurable mock Discord REST API fetch handler
 */
function createDiscordApiMock(options = {}) {
  const calls = [];
  let user = options.user !== undefined ? options.user : fixtures.mockUser;
  let initialBalance = options.initialBalance !== undefined ? options.initialBalance : fixtures.mockInitialBalance;
  let finalBalance = options.finalBalance !== undefined ? options.finalBalance : fixtures.mockFinalBalance;
  let quests = options.quests
    ? JSON.parse(JSON.stringify(options.quests))
    : [JSON.parse(JSON.stringify(fixtures.mockVideoQuest))];
  let customHandlers = options.customHandlers || {};

  const fetchHandler = async (url, opts = {}) => {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.replace(/^\/api\/v10/, '');
    const method = (opts.method || 'GET').toUpperCase();
    let body = null;
    if (opts.body) {
      try { body = JSON.parse(opts.body); } catch { body = opts.body; }
    }

    const callRecord = {
      url,
      pathname,
      method,
      headers: opts.headers || {},
      body,
      timestamp: Date.now()
    };
    calls.push(callRecord);

    if (customHandlers[pathname]) {
      return customHandlers[pathname](callRecord);
    }

    // GitHub routes for update checks
    if (parsedUrl.hostname === 'raw.githubusercontent.com') {
      const packageData = options.githubPackageData || { version: options.githubLatestVersion || '2.4.0' };
      return {
        ok: options.githubRawOk !== false,
        status: options.githubRawOk !== false ? 200 : 404,
        json: async () => packageData,
        text: async () => JSON.stringify(packageData)
      };
    }

    if (parsedUrl.hostname === 'api.github.com' && parsedUrl.pathname.includes('/releases/latest')) {
      const releaseData = options.githubReleaseData || { tag_name: `v${options.githubLatestVersion || '2.4.0'}` };
      return {
        ok: options.githubReleaseOk !== false,
        status: options.githubReleaseOk !== false ? 200 : 404,
        json: async () => releaseData,
        text: async () => JSON.stringify(releaseData)
      };
    }

    // Default API routes
    if (pathname === '/users/@me' && method === 'GET') {
      if (options.unauthorized) {
        return { ok: false, status: 401, json: async () => ({ message: '401: Unauthorized', code: 0 }), text: async () => '401 Unauthorized' };
      }
      return { ok: true, status: 200, json: async () => user, text: async () => JSON.stringify(user) };
    }

    if (pathname === '/users/@me/virtual-currency/balance' && method === 'GET') {
      const balanceToReturn = calls.some(c => c.pathname.includes('/claim-reward')) ? finalBalance : initialBalance;
      return { ok: true, status: 200, json: async () => balanceToReturn, text: async () => JSON.stringify(balanceToReturn) };
    }

    if (pathname === '/quests/@me' && method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ quests }), text: async () => JSON.stringify({ quests }) };
    }

    if (pathname.match(/^\/quests\/([^/]+)\/enroll$/) && method === 'POST') {
      const questId = pathname.split('/')[2];
      const targetQuest = quests.find(q => q.id === questId);
      const enrolledStatus = {
        enrolled_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: null,
        claimed_at: null,
        progress: {}
      };
      if (targetQuest) targetQuest.user_status = enrolledStatus;
      return { ok: true, status: 200, json: async () => enrolledStatus, text: async () => JSON.stringify(enrolledStatus) };
    }

    if (pathname.match(/^\/quests\/([^/]+)\/video-progress$/) && method === 'POST') {
      const questId = pathname.split('/')[2];
      const targetQuest = quests.find(q => q.id === questId);
      const isComplete = (options.videoAutoCompletes !== false) && body && body.timestamp >= 15;
      const res = {
        completed_at: isComplete ? new Date().toISOString() : null,
        progress: body ? body.timestamp : 0
      };
      if (targetQuest && isComplete) {
        targetQuest.user_status = targetQuest.user_status || {};
        targetQuest.user_status.completed_at = res.completed_at;
      }
      return { ok: true, status: 200, json: async () => res, text: async () => JSON.stringify(res) };
    }

    if (pathname.match(/^\/quests\/([^/]+)\/heartbeat$/) && method === 'POST') {
      const questId = pathname.split('/')[2];
      const targetQuest = quests.find(q => q.id === questId);
      const isTerminal = body && body.terminal === true;
      const isComplete = isTerminal || (options.heartbeatAutoCompletes !== false);
      const res = {
        completed_at: isComplete ? new Date().toISOString() : null
      };
      if (targetQuest && isComplete) {
        targetQuest.user_status = targetQuest.user_status || {};
        targetQuest.user_status.completed_at = res.completed_at;
      }
      return { ok: true, status: 200, json: async () => res, text: async () => JSON.stringify(res) };
    }

    if (pathname.match(/^\/quests\/([^/]+)\/claim-reward$/) && method === 'POST') {
      const questId = pathname.split('/')[2];
      const targetQuest = quests.find(q => q.id === questId);
      if (targetQuest) {
        targetQuest.user_status = targetQuest.user_status || {};
        targetQuest.user_status.claimed_at = new Date().toISOString();
      }
      return { ok: true, status: 200, json: async () => ({ claimed: true }), text: async () => JSON.stringify({ claimed: true }) };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}'
    };
  };

  return {
    fetch: fetchHandler,
    calls,
    setQuests: (newQuests) => { quests = [...newQuests]; },
    setUser: (newUser) => { user = newUser; }
  };
}

/**
 * Creates the Background Service Worker VM execution environment
 */
function createBackgroundSandbox(options = {}) {
  const storage = options.storage || createStorage(options.initialStorage || {});
  const messageListeners = [];
  const tabUpdateListeners = [];
  const installListeners = [];
  const startupListeners = [];
  const alarmListeners = [];
  const sentMessages = [];
  const badges = [];
  const notifications = [];
  const dynamicRules = [];

  const downloadsCalls = [];
  const reloadCalls = [];

  const discordMock = options.discordMock || createDiscordApiMock(options);

  const chromeMock = {
    storage: storage,
    runtime: {
      getManifest: () => ({
        manifest_version: 3,
        name: 'Discord Auto Quests',
        version: options.manifestVersion || '2.4.0'
      }),
      reload: () => {
        reloadCalls.push(Date.now());
      },
      onMessage: {
        addListener: (fn) => messageListeners.push(fn)
      },
      onInstalled: {
        addListener: (fn) => installListeners.push(fn)
      },
      onStartup: {
        addListener: (fn) => startupListeners.push(fn)
      },
      onConnect: {
        addListener: (fn) => {}
      },
      connect: (opts) => ({
        name: opts?.name || 'popup',
        onDisconnect: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        postMessage: () => {}
      }),
      sendMessage: async (msg) => {
        sentMessages.push(msg);
        if (options.onBroadcastMessage) options.onBroadcastMessage(msg);
      }
    },
    downloads: {
      download: options.downloadsDownloadOverride || ((downloadOpts, callback) => {
        downloadsCalls.push(downloadOpts);
        const downloadId = 42;
        if (callback) callback(downloadId);
        return Promise.resolve(downloadId);
      })
    },
    tabs: {
      onUpdated: {
        addListener: (fn) => tabUpdateListeners.push(fn)
      },
      query: async (queryInfo) => {
        if (options.tabsQuery) return options.tabsQuery(queryInfo);
        return [{ id: 1, url: 'https://discord.com/channels/@me' }];
      }
    },
    alarms: {
      create: (name, alarmInfo) => {},
      clear: (name, cb) => { if (cb) cb(true); },
      onAlarm: {
        addListener: (fn) => alarmListeners.push(fn)
      }
    },
    action: {
      setBadgeText: (arg) => badges.push({ text: arg.text, type: 'text' }),
      setBadgeBackgroundColor: (arg) => badges.push({ color: arg.color, type: 'color' })
    },
    notifications: {
      create: (arg) => notifications.push(arg)
    },
    declarativeNetRequest: {
      getDynamicRules: async () => [...dynamicRules],
      updateDynamicRules: async ({ removeRuleIds = [], addRules = [] }) => {
        for (const id of removeRuleIds) {
          const idx = dynamicRules.findIndex(r => r.id === id);
          if (idx !== -1) dynamicRules.splice(idx, 1);
        }
        dynamicRules.push(...addRules);
      }
    },
    scripting: {
      executeScript: options.executeScriptOverride || (async ({ target, func }) => {
        if (options.tokenToExtract !== undefined) {
          return [{ result: options.tokenToExtract }];
        }
        return [{ result: 'sample-discord-token-abc123xyz' }];
      })
    }
  };

  const sandbox = {
    console,
    crypto,
    btoa: (str) => Buffer.from(str).toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString(),
    Date,
    Math,
    URL,
    // Instant sleep timer to prevent delays
    setTimeout: (fn, ms) => {
      return setImmediate(fn);
    },
    clearTimeout: () => {},
    setInterval: (fn, ms) => {},
    clearInterval: () => {},
    chrome: chromeMock,
    fetch: discordMock.fetch
  };

  vm.createContext(sandbox);

  const backgroundCode = fs.readFileSync(path.join(EXT_AUTO_QUESTS_DIR, 'background.js'), 'utf8');
  vm.runInContext(backgroundCode, sandbox);

  return {
    sandbox,
    storage,
    discordMock,
    messageListeners,
    tabUpdateListeners,
    installListeners,
    startupListeners,
    alarmListeners,
    sentMessages,
    badges,
    notifications,
    dynamicRules,
    downloadsCalls,
    reloadCalls,
    triggerTabUpdated: async (tabId, changeInfo, tab) => {
      for (const listener of tabUpdateListeners) {
        await listener(tabId, changeInfo, tab);
      }
    },
    triggerMessage: (message, sender = {}) => {
      return new Promise((resolve) => {
        let responded = false;
        const sendResponse = (res) => {
          responded = true;
          resolve(res);
        };
        for (const listener of messageListeners) {
          const ret = listener(message, sender, sendResponse);
          if (ret === true) {
            // async response expected
          }
        }
        if (!responded) {
          setTimeout(() => resolve(null), 10);
        }
      });
    },
    triggerInstall: async () => {
      for (const listener of installListeners) {
        await listener();
      }
    },
    triggerStartup: async () => {
      for (const listener of startupListeners) {
        await listener();
      }
    }
  };
}

/**
 * Creates the Popup VM execution environment for extension-auto-quests
 */
function createPopupSandbox(options = {}) {
  const doc = createMockDocument();
  const storage = options.storage || createStorage(options.initialStorage || {});
  const alerts = [];
  const background = options.background;

  const runtimeListeners = [];
  const downloadsCalls = [];
  const reloadCalls = [];

  const chromeMock = {
    storage: storage,
    runtime: {
      getManifest: () => ({
        manifest_version: 3,
        name: 'Discord Auto Quests',
        version: options.manifestVersion || '2.4.0'
      }),
      reload: () => {
        reloadCalls.push(Date.now());
        if (background && background.reloadCalls) {
          background.reloadCalls.push(Date.now());
        }
      },
      sendMessage: (msg, callback) => {
        if (background) {
          background.triggerMessage(msg).then(res => {
            if (callback) callback(res);
          });
        } else if (callback) {
          callback({ success: true });
        }
      },
      connect: (opts) => ({
        name: opts?.name || 'popup',
        onDisconnect: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        postMessage: () => {}
      }),
      onMessage: {
        addListener: (fn) => runtimeListeners.push(fn)
      }
    },
    downloads: {
      download: options.downloadsDownloadOverride || ((downloadOpts, callback) => {
        downloadsCalls.push(downloadOpts);
        if (background && background.downloadsCalls) {
          background.downloadsCalls.push(downloadOpts);
        }
        const downloadId = 42;
        if (callback) callback(downloadId);
        return Promise.resolve(downloadId);
      })
    }
  };

  const sandbox = {
    document: doc,
    console,
    alert: (msg) => alerts.push(msg),
    chrome: chromeMock,
    setTimeout,
    clearTimeout
  };

  vm.createContext(sandbox);

  const popupCode = fs.readFileSync(path.join(EXT_AUTO_QUESTS_DIR, 'popup.js'), 'utf8');
  vm.runInContext(popupCode, sandbox);

  return {
    sandbox,
    doc,
    elements: doc.elements,
    alerts,
    downloadsCalls,
    reloadCalls,
    runtimeListeners,
    dispatchRuntimeMessage: (msg) => {
      runtimeListeners.forEach(l => l(msg));
    }
  };
}

/**
 * Creates the Standalone Extractor VM environment for extension-get-token
 */
function createStandaloneSandbox(options = {}) {
  const listeners = {};
  const alerts = [];
  const clipboardWrites = [];
  let queriedTabs = [];
  let currentTabs = options.tabs || [{ id: 1, url: 'https://discord.com/channels/@me' }];
  let localStorageData = options.localStorage || { token: '"my-standalone-token-xyz"' };
  let lastError = options.lastError || null;

  const extractButton = createMockElement('extractButton', 'button');

  const doc = {
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    getElementById: (id) => {
      if (id === 'extractButton') return extractButton;
      return null;
    }
  };

  const chromeMock = {
    tabs: {
      query: (queryInfo, callback) => {
        queriedTabs.push(queryInfo);
        callback(currentTabs);
      }
    },
    scripting: {
      executeScript: (details, callback) => {
        if (options.scriptFail) {
          callback(null);
          return;
        }
        const tokenVal = localStorageData.token;
        callback([{ result: tokenVal }]);
      }
    },
    runtime: {
      get lastError() {
        return lastError;
      }
    }
  };

  const navigatorMock = {
    clipboard: {
      writeText: async (text) => {
        if (options.clipboardError) {
          throw new Error('Clipboard write failed');
        }
        clipboardWrites.push(text);
      }
    }
  };

  const sandbox = {
    document: doc,
    console,
    alert: (msg) => alerts.push(msg),
    chrome: chromeMock,
    navigator: navigatorMock,
    localStorage: localStorageData
  };

  vm.createContext(sandbox);

  const standaloneCode = fs.readFileSync(path.join(EXT_GET_TOKEN_DIR, 'popup.js'), 'utf8');
  vm.runInContext(standaloneCode, sandbox);

  // Trigger DOMContentLoaded
  if (listeners['DOMContentLoaded']) {
    listeners['DOMContentLoaded'].forEach(fn => fn());
  }

  return {
    sandbox,
    extractButton,
    alerts,
    clipboardWrites,
    queriedTabs,
    setTabs: (tabs) => { currentTabs = tabs; },
    setLocalStorage: (data) => {
      Object.assign(localStorageData, data);
      sandbox.localStorage = localStorageData;
    },
    setLastError: (err) => { lastError = err; }
  };
}

module.exports = {
  createMockElement,
  createMockDocument,
  createStorage,
  createDiscordApiMock,
  createBackgroundSandbox,
  createPopupSandbox,
  createStandaloneSandbox,
  EXT_GET_TOKEN_DIR,
  EXT_AUTO_QUESTS_DIR
};
