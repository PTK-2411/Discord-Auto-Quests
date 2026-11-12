const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createStandaloneSandbox,
  createBackgroundSandbox
} = require('./helpers/test-harness.js');

test('Tier 1 - F1: Standalone Token Extractor (extension-get-token)', async (t) => {
  await t.test('T1.F1.1: Clicking extract button queries active tab in current window', async () => {
    const harness = createStandaloneSandbox();
    harness.extractButton.dispatch('click');
    assert.equal(harness.queriedTabs.length, 1);
    assert.equal(harness.queriedTabs[0].active, true);
    assert.equal(harness.queriedTabs[0].currentWindow, true);
  });

  await t.test('T1.F1.2: Injects extractToken script when active tab is on discord.com', async () => {
    let scriptDetails = null;
    const harness = createStandaloneSandbox({
      tabs: [{ id: 42, url: 'https://discord.com/app' }]
    });

    harness.sandbox.chrome.scripting.executeScript = (details, callback) => {
      scriptDetails = details;
      callback([{ result: 'mock-token' }]);
    };

    harness.extractButton.dispatch('click');
    assert.ok(scriptDetails, 'executeScript must be called');
    assert.equal(scriptDetails.target.tabId, 42);
    assert.equal(typeof scriptDetails.function, 'function');
    assert.equal(scriptDetails.function.name, 'extractToken');
  });

  await t.test('T1.F1.3: extractToken function returns localStorage.token directly', async () => {
    const harness = createStandaloneSandbox({
      localStorage: { token: 'raw-secret-token-123' }
    });
    const token = harness.sandbox.extractToken();
    assert.equal(token, 'raw-secret-token-123');
  });

  await t.test('T1.F1.4: Enclosing double quotes are stripped from extracted token', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
      localStorage: { token: '"quoted-auth-token-456"' }
    });

    harness.extractButton.dispatch('click');
    await new Promise(r => setTimeout(r, 10));

    assert.equal(harness.clipboardWrites.length, 1);
    assert.equal(harness.clipboardWrites[0], 'quoted-auth-token-456', 'Token must not contain quotes');
  });

  await t.test('T1.F1.5: Copies token to clipboard and displays success alert', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
      localStorage: { token: '"clean-token-789"' }
    });

    harness.extractButton.dispatch('click');
    await new Promise(r => setTimeout(r, 10));

    assert.equal(harness.clipboardWrites[0], 'clean-token-789');
    assert.ok(harness.alerts.some(a => a.includes('Token extracted and copied to clipboard!')));
  });
});

test('Tier 1 - F2: Automatic Token Extraction (extension-auto-quests)', async (t) => {
  await t.test('T1.F2.1: chrome.tabs.onUpdated detects completed navigation to discord.com', async () => {
    const bg = createBackgroundSandbox({
      tokenToExtract: 'auto-captured-token-111'
    });

    let scriptExecuted = false;
    bg.sandbox.chrome.scripting.executeScript = async ({ target }) => {
      scriptExecuted = true;
      return [{ result: 'auto-captured-token-111' }];
    };

    await bg.triggerTabUpdated(99, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    assert.ok(scriptExecuted, 'Script injection must occur on completed discord.com navigation');
  });

  await t.test('T1.F2.2: Respects autoRunEnabled configuration from storage', async () => {
    const bg = createBackgroundSandbox({
      initialStorage: { autoRunEnabled: true },
      tokenToExtract: 'test-token-222'
    });

    let scriptInjected = false;
    bg.sandbox.chrome.scripting.executeScript = async () => {
      scriptInjected = true;
      return [{ result: 'test-token-222' }];
    };

    await bg.triggerTabUpdated(10, { status: 'complete' }, { url: 'https://discord.com/app' });
    assert.ok(scriptInjected, 'Script injection should proceed when tab is updated');
  });

  await t.test('T1.F2.3: Injects script extracting token from window.localStorage.getItem', async () => {
    const bg = createBackgroundSandbox();
    let injectedFunc = null;

    bg.sandbox.chrome.scripting.executeScript = async ({ func }) => {
      injectedFunc = func;
      return [{ result: 'extracted-token-333' }];
    };

    await bg.triggerTabUpdated(1, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    assert.ok(injectedFunc, 'Must provide injection function');
    assert.equal(typeof injectedFunc, 'function');
  });

  await t.test('T1.F2.4: Persists extracted token into chrome.storage.local', async () => {
    const bg = createBackgroundSandbox({
      tokenToExtract: 'persisted-token-444'
    });

    await bg.triggerTabUpdated(5, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    const stored = await bg.storage.local.get('token');
    assert.equal(stored.token, 'persisted-token-444');
  });

  await t.test('T1.F2.5: Triggers quest execution loop after token extraction', async () => {
    const bg = createBackgroundSandbox({
      tokenToExtract: 'exec-trigger-token-555'
    });

    await bg.triggerTabUpdated(7, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    const userCall = bg.discordMock.calls.find(c => c.pathname === '/users/@me');
    assert.ok(userCall, 'executeQuests must invoke /users/@me upon capturing token');
    assert.equal(userCall.headers['Authorization'], 'exec-trigger-token-555');
  });
});

test('Tier 2 - F1: Standalone Token Extraction Boundary & Corner Cases', async (t) => {
  await t.test('T2.F1.1: Navigation on non-Discord page alerts warning and stops', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://google.com/search?q=discord' }]
    });

    harness.extractButton.dispatch('click');
    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Please navigate to a valid Discord page')));
  });

  await t.test('T2.F1.2: Empty or null token in tab alerts failure and avoids clipboard write', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/login' }],
      localStorage: { token: null }
    });

    harness.extractButton.dispatch('click');
    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token')));
  });

  await t.test('T2.F1.3: Script execution failure via chrome.runtime.lastError handled gracefully', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
      lastError: { message: 'Cannot access contents of url' }
    });

    harness.extractButton.dispatch('click');
    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token')));
  });

  await t.test('T2.F1.4: Script returning null or empty result array handled gracefully', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
      scriptFail: true
    });

    harness.extractButton.dispatch('click');
    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token')));
  });

  await t.test('T2.F1.5: Non-string token in localStorage is handled without crash', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
      localStorage: { token: '' }
    });

    harness.extractButton.dispatch('click');
    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token')));
  });
});

test('Tier 2 - F2: Auto Token Extraction Boundary & Corner Cases', async (t) => {
  await t.test('T2.F2.1: Navigation events with status loading are ignored', async () => {
    const bg = createBackgroundSandbox();
    let scriptInvoked = false;
    bg.sandbox.chrome.scripting.executeScript = async () => {
      scriptInvoked = true;
      return [{ result: 'tok' }];
    };

    await bg.triggerTabUpdated(1, { status: 'loading' }, { url: 'https://discord.com/channels/@me' });
    assert.equal(scriptInvoked, false, 'Must not execute script while page is still loading');
  });

  await t.test('T2.F2.2: Navigation events for non-Discord URLs are ignored', async () => {
    const bg = createBackgroundSandbox();
    let scriptInvoked = false;
    bg.sandbox.chrome.scripting.executeScript = async () => {
      scriptInvoked = true;
      return [{ result: 'tok' }];
    };

    await bg.triggerTabUpdated(2, { status: 'complete' }, { url: 'https://github.com/login' });
    assert.equal(scriptInvoked, false, 'Must not inject into non-discord domains');
  });

  await t.test('T2.F2.3: When autoRunEnabled is false, token is extracted but executeQuests is suppressed', async () => {
    const bg = createBackgroundSandbox({
      initialStorage: { autoRunEnabled: false },
      tokenToExtract: 'saved-but-not-run-token'
    });

    await bg.triggerTabUpdated(3, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    const stored = await bg.storage.local.get('token');
    assert.equal(stored.token, 'saved-but-not-run-token');

    // Auto run quest execution loop (enroll, progress, heartbeat) should NOT have run
    const executionCalls = bg.discordMock.calls.filter(c => 
      c.pathname.includes('/enroll') || 
      c.pathname.includes('/video-progress') || 
      c.pathname.includes('/heartbeat')
    );
    assert.equal(executionCalls.length, 0, 'Must not execute/enroll quests when autoRunEnabled is false');
    assert.notEqual(bg.storage._data.isRunning, true, 'isRunning must not be true');
  });

  await t.test('T2.F2.4: Empty token in Discord tab does not trigger quest execution', async () => {
    const bg = createBackgroundSandbox({
      tokenToExtract: null
    });

    await bg.triggerTabUpdated(4, { status: 'complete' }, { url: 'https://discord.com/login' });
    const stored = await bg.storage.local.get('token');
    assert.equal(stored.token, undefined, 'Null token should not be persisted');
    assert.equal(bg.discordMock.calls.length, 0, 'API runner should not be triggered');
  });

  await t.test('T2.F2.5: Script injection throwing exception is caught safely via try/catch', async () => {
    let warnLogged = false;
    const bg = createBackgroundSandbox({
      executeScriptOverride: async () => {
        throw new Error('Tab was closed or permission denied');
      }
    });

    bg.sandbox.console.warn = (...args) => {
      warnLogged = true;
    };

    await assert.doesNotReject(async () => {
      await bg.triggerTabUpdated(5, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    });

    assert.ok(warnLogged, 'Warning should be logged to console when script injection throws');
  });
});
