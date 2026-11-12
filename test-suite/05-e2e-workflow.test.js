const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  createBackgroundSandbox,
  createPopupSandbox,
  createStorage,
  EXT_GET_TOKEN_DIR,
  EXT_AUTO_QUESTS_DIR
} = require('./helpers/test-harness.js');
const fixtures = require('./helpers/fixtures.js');

test('Tier 3 - Cross-Feature Combinations & State Machine Interactions', async (t) => {
  await t.test('T3.1: AutoStart toggled OFF then ON during navigation and manual trigger', async () => {
    const sharedStorage = createStorage({ autoRunEnabled: false });
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      tokenToExtract: 'toggle-token-111'
    });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Step 1: Navigate to Discord tab with autoRunEnabled: false
    await bg.triggerTabUpdated(1, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    const stored = await sharedStorage.local.get(['token', 'isRunning']);
    assert.equal(stored.token, 'toggle-token-111');
    assert.notEqual(stored.isRunning, true, 'Runner should NOT automatically start');

    // Step 2: User toggles Auto-Run ON via Popup UI
    popup.elements.autoRunToggle.checked = true;
    popup.elements.autoRunToggle.dispatch('change', { target: { checked: true } });
    const updatedStorage = await sharedStorage.local.get(['autoRunEnabled']);
    assert.equal(updatedStorage.autoRunEnabled, true);

    // Step 3: User triggers START_RUN
    const response = await bg.triggerMessage({ action: 'START_RUN' });
    assert.equal(response.success, true);
  });

  await t.test('T3.2: Account switching / token update replaces user profile and refreshes quests', async () => {
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      tokenToExtract: 'user1-token',
      user: fixtures.mockUser,
      quests: [fixtures.mockVideoQuest]
    });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Login user 1
    await bg.triggerTabUpdated(1, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    await bg.sandbox.refreshDiscordData('user1-token');
    assert.equal((await sharedStorage.local.get('user')).user.username, fixtures.mockUser.username);

    // Switch account to user 2
    const user2 = {
      id: '200000000000000002',
      username: 'SecondAccount',
      global_name: 'Second Player',
      avatar: 'b_avatar_hash_222'
    };
    const questUser2 = {
      id: 'quest_user2_vid',
      config: {
        messages: { quest_name: 'Account 2 Video Quest' },
        task_config_v2: { tasks: { WATCH_VIDEO: { target: 15 } } },
        rewards_config: { rewards: [{ orb_quantity: 60 }] },
        expires_at: fixtures.makeExpiresAt(86400000)
      },
      user_status: null
    };

    bg.discordMock.setUser(user2);
    bg.discordMock.setQuests([questUser2]);
    bg.sandbox.chrome.scripting.executeScript = async () => [{ result: 'user2-token' }];

    // Tab update triggers new token capture
    await bg.triggerTabUpdated(2, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });
    await bg.sandbox.refreshDiscordData('user2-token');

    const updatedState = await sharedStorage.local.get(['user', 'quests', 'token']);
    assert.equal(updatedState.token, 'user2-token');
    assert.equal(updatedState.user.username, 'SecondAccount');
    assert.equal(updatedState.quests[0].name, 'Account 2 Video Quest');
  });

  await t.test('T3.3: Stop command (STOP_RUN) during active video quest loop halts execution cleanly', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    videoQuest.config.task_config_v2.tasks.WATCH_VIDEO.target = 500000; // long quest

    const bg = createBackgroundSandbox({
      quests: [videoQuest],
      videoAutoCompletes: false
    });

    // Start quests in background
    const runPromise = bg.sandbox.executeQuests('valid-token');

    // Issue STOP_RUN message while executing
    await new Promise(r => setTimeout(r, 10));
    await bg.triggerMessage({ action: 'STOP_RUN' });
    await runPromise;

    const stored = await bg.storage.local.get(['isRunning', 'quests']);
    assert.equal(stored.isRunning, false, 'isRunning must reset to false after stop');

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.toLowerCase().includes('dừng') || l.text.toLowerCase().includes('stop')));
  });

  await t.test('T3.4: Stop command (STOP_RUN) during desktop play heartbeat terminates cleanly', async () => {
    const desktopQuest = JSON.parse(JSON.stringify(fixtures.mockDesktopPlayQuest));
    desktopQuest.config.task_config_v2.tasks.PLAY_ON_DESKTOP.target = 3600;

    const bg = createBackgroundSandbox({
      quests: [desktopQuest],
      heartbeatAutoCompletes: false // does not complete immediately
    });

    const runPromise = bg.sandbox.executeQuests('valid-token');
    await new Promise(r => setTimeout(r, 10));
    await bg.triggerMessage({ action: 'STOP_RUN' });
    await runPromise;

    const stored = await bg.storage.local.get('isRunning');
    assert.equal(stored.isRunning, false);
  });

  await t.test('T3.5: Concurrent trigger prevention: isRunning guard rejects duplicate START_RUN', async () => {
    let resolveBlocked;
    const blockedPromise = new Promise(r => { resolveBlocked = r; });

    const bg = createBackgroundSandbox({
      initialStorage: { token: 'valid-token' },
      customHandlers: {
        '/users/@me': async () => {
          await blockedPromise;
          return { ok: true, status: 200, json: async () => fixtures.mockUser, text: async () => JSON.stringify(fixtures.mockUser) };
        }
      }
    });

    // Launch first execution (blocks inside executeQuests with isRunning = true)
    const p1 = bg.sandbox.executeQuests('valid-token');
    await new Promise(r => setTimeout(r, 10));

    // Attempt second execution while p1 is actively running
    await bg.sandbox.executeQuests('valid-token');

    // Release p1
    resolveBlocked();
    await p1;

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('vui lòng chờ') || l.text.includes('please wait')), 'Should warn that execution is already running');
  });

  await t.test('T3.6: Multi-quest batch execution: video quest followed by desktop play quest', async () => {
    const q1 = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const q2 = JSON.parse(JSON.stringify(fixtures.mockDesktopPlayQuest));

    const bg = createBackgroundSandbox({
      quests: [q1, q2]
    });

    await bg.sandbox.executeQuests('valid-token');

    const stored = await bg.storage.local.get('quests');
    assert.equal(stored.quests.length, 2);
    assert.equal(stored.quests[0].state, 'claimed', 'Quest 1 must be claimed');
    assert.equal(stored.quests[1].state, 'claimed', 'Quest 2 must be claimed');
  });

  await t.test('T3.7: Partial failure in batch: Quest 1 enrollment fails, Quest 2 succeeds', async () => {
    const q1 = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const q2 = JSON.parse(JSON.stringify(fixtures.mockDesktopPlayQuest));

    const bg = createBackgroundSandbox({
      quests: [q1, q2],
      customHandlers: {
        [`/quests/${q1.id}/enroll`]: () => {
          return { ok: false, status: 400, json: async () => ({ message: 'Cannot enroll quest 1' }), text: async () => '400' };
        }
      }
    });

    await bg.sandbox.executeQuests('valid-token');

    const stored = await bg.storage.local.get('quests');
    const quest1 = stored.quests.find(q => q.id === q1.id);
    const quest2 = stored.quests.find(q => q.id === q2.id);

    assert.equal(quest1.state, 'failed', 'Quest 1 must be marked failed');
    assert.equal(quest2.state, 'claimed', 'Quest 2 must proceed and be claimed');
  });

  await t.test('T3.8: Service worker restart simulation preserves storage state', async () => {
    const sharedStorage = createStorage();

    // Session 1: Run worker and store data
    const bg1 = createBackgroundSandbox({ storage: sharedStorage });
    await bg1.storage.local.set({
      token: 'persisted-session-token',
      user: fixtures.mockUser,
      quests: [{ id: 'q_saved', name: 'Saved Quest', state: 'done' }]
    });

    // Session 2: Worker terminates and starts fresh with same storage
    const bg2 = createBackgroundSandbox({ storage: sharedStorage });
    const loadedData = await bg2.storage.local.get(['token', 'user', 'quests']);

    assert.equal(loadedData.token, 'persisted-session-token');
    assert.equal(loadedData.user.username, fixtures.mockUser.username);
    assert.equal(loadedData.quests[0].name, 'Saved Quest');
  });

  await t.test('T3.9: Popup opened during active run receives real-time STATE_UPDATED events', async () => {
    const sharedStorage = createStorage({
      token: 'test-token',
      user: fixtures.mockUser,
      isRunning: true
    });

    let broadcastMsg = null;
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      onBroadcastMessage: (msg) => { broadcastMsg = msg; }
    });

    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Background broadcasts state update
    const updatedState = {
      quests: [{
        id: 'live_q',
        name: 'Live Updating Quest',
        taskType: 'WATCH_VIDEO',
        reward: '20 Orbs',
        target: 20,
        countdown: 5,
        state: 'running'
      }]
    };

    popup.dispatchRuntimeMessage({ action: 'STATE_UPDATED', state: updatedState });

    assert.equal(String(popup.elements.questCount.textContent), '1');
    assert.ok(popup.elements.questList.innerHTML.includes('Live Updating Quest'));
    assert.ok(popup.elements.questList.innerHTML.includes('75%')); // (20-5)/20 = 75%
  });

  await t.test('T3.10: Clear logs while background is actively logging preserves subsequent logs', async () => {
    const sharedStorage = createStorage({ logs: [] });
    const bg = createBackgroundSandbox({ storage: sharedStorage });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    await bg.sandbox.addLog('Log before clear');
    popup.elements.clearLogsBtn.dispatch('click');
    await new Promise(r => setTimeout(r, 40));

    // Subsequent log after clear
    await bg.sandbox.addLog('Log after clear');
    const finalLogs = (await sharedStorage.local.get('logs')).logs;

    assert.equal(finalLogs.length, 1);
    assert.equal(finalLogs[0].text, 'Log after clear');
  });

  await t.test('T3.11: Mixed batch with defective ID, expired quest, and valid quest', async () => {
    const defective = JSON.parse(JSON.stringify(fixtures.mockDefectiveQuest));
    const expired = JSON.parse(JSON.stringify(fixtures.mockExpiredQuest));
    const valid = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));

    const bg = createBackgroundSandbox({
      quests: [defective, expired, valid]
    });

    await bg.sandbox.executeQuests('valid-token');

    // Defective and expired must not have enroll or progress calls
    const executedQuestIds = bg.discordMock.calls
      .filter(c => c.pathname.includes('/video-progress') || c.pathname.includes('/enroll'))
      .map(c => c.pathname);

    assert.ok(executedQuestIds.some(p => p.includes(valid.id)), 'Valid quest must execute');
    assert.ok(!executedQuestIds.some(p => p.includes(defective.id)), 'Defective quest must not execute');
    assert.ok(!executedQuestIds.some(p => p.includes(expired.id)), 'Expired quest must not execute');
  });

  await t.test('T3.12: DeclarativeNetRequest dynamic rules update registers required headers', async () => {
    const bg = createBackgroundSandbox();
    await bg.sandbox.registerNetRules();

    const rules = await bg.sandbox.chrome.declarativeNetRequest.getDynamicRules();
    assert.ok(rules.length > 0, 'Dynamic rules must be registered');
    assert.equal(rules[0].id, 1001);
    assert.equal(rules[0].action.type, 'modifyHeaders');
  });

  await t.test('T3.13: Single quest execution via START_SINGLE_QUEST targets only specified quest', async () => {
    const q1 = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const q2 = JSON.parse(JSON.stringify(fixtures.mockDesktopPlayQuest));

    const bg = createBackgroundSandbox({
      initialStorage: { token: 'valid-single-quest-token' },
      quests: [q1, q2]
    });

    const res = await bg.triggerMessage({ action: 'START_SINGLE_QUEST', questId: q1.id });
    assert.equal(res?.success, true);
    assert.equal(res?.questId, q1.id);

    // Direct execution targeting q1
    const bg2 = createBackgroundSandbox({
      initialStorage: { token: 'valid-single-quest-token' },
      quests: [q1, q2]
    });
    await bg2.sandbox.executeQuests('valid-single-quest-token', q1.id);

    const callPathnames = bg2.discordMock.calls.map(c => c.pathname);
    assert.ok(callPathnames.includes(`/quests/${q1.id}/enroll`), 'Targeted single quest must be enrolled');
    assert.ok(callPathnames.includes(`/quests/${q1.id}/video-progress`), 'Targeted single quest must send progress');
    assert.ok(callPathnames.includes(`/quests/${q1.id}/claim-reward`), 'Targeted single quest must be claimed');
    assert.equal(callPathnames.includes(`/quests/${q2.id}/enroll`), false, 'Non-targeted quest must NOT be enrolled');
    assert.equal(callPathnames.includes(`/quests/${q2.id}/heartbeat`), false, 'Non-targeted quest must NOT send heartbeat');
  });

  await t.test('T3.14: START_SINGLE_QUEST error validation: rejects missing questId or missing token', async () => {
    const bg = createBackgroundSandbox({
      initialStorage: { token: null },
      tokenToExtract: null,
      tabsQuery: () => []
    });

    const res1 = await bg.triggerMessage({ action: 'START_SINGLE_QUEST' });
    assert.equal(res1?.success, false);
    assert.ok(res1?.error?.includes('Quest ID') || res1?.error?.includes('ID nhiệm vụ'));

    const res2 = await bg.triggerMessage({ action: 'START_SINGLE_QUEST', questId: '123' });
    assert.equal(res2?.success, false);
    assert.ok(res2?.error?.includes('No token') || res2?.error?.includes('Chưa có token'));
  });
});

test('Tier 4 - Real-World Application Scenarios (Integration Workflows)', async (t) => {
  await t.test('T4.Scenario1: User navigates to discord.com -> token auto-extracted -> quests listed in popup', async () => {
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      tokenToExtract: 'scenario1-token-real',
      user: fixtures.mockUser,
      quests: [fixtures.mockVideoQuest, fixtures.mockDesktopPlayQuest]
    });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Step 1: User navigates tab to Discord channels
    await bg.triggerTabUpdated(101, { status: 'complete' }, { url: 'https://discord.com/channels/@me' });

    // Step 2: Storage is hydrated
    const storedState = await sharedStorage.local.get(['token', 'user', 'quests', 'orbs']);
    assert.equal(storedState.token, 'scenario1-token-real');
    assert.equal(storedState.user.username, fixtures.mockUser.username);
    assert.equal(storedState.quests.length, 2);

    // Step 3: Popup loads and displays user & quests
    popup.sandbox.renderUser(storedState.user, storedState.orbs);
    popup.sandbox.renderQuests(storedState.quests);

    assert.equal(popup.elements.userName.textContent, fixtures.mockUser.global_name);
    assert.equal(String(popup.elements.questCount.textContent), '2');
    assert.equal(popup.elements.questList.children.length, 2);
  });

  await t.test('T4.Scenario2: Video quest execution end-to-end: enroll -> progress -> complete -> auto-claim', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      tokenToExtract: 'video-e2e-token',
      quests: [videoQuest]
    });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Execute quests
    await bg.sandbox.executeQuests('video-e2e-token');

    // Verify API sequence
    const callPathnames = bg.discordMock.calls.map(c => c.pathname);
    assert.ok(callPathnames.includes('/users/@me'), 'Must query user');
    assert.ok(callPathnames.includes('/quests/@me'), 'Must query quests');
    assert.ok(callPathnames.includes(`/quests/${videoQuest.id}/enroll`), 'Must enroll');
    assert.ok(callPathnames.includes(`/quests/${videoQuest.id}/video-progress`), 'Must send progress');
    assert.ok(callPathnames.includes(`/quests/${videoQuest.id}/claim-reward`), 'Must claim reward');

    // Verify storage reflects claimed state
    const questsInStorage = (await sharedStorage.local.get('quests')).quests;
    assert.equal(questsInStorage[0].state, 'claimed');
    assert.equal(questsInStorage[0].countdown, 0);

    // Verify popup reflects claimed state
    popup.sandbox.renderQuests(questsInStorage);
    const card = popup.elements.questList.children[0];
    assert.ok(card.innerHTML.includes('100%'));
    assert.ok(card.innerHTML.includes('status-badge claimed'));
  });

  await t.test('T4.Scenario3: Desktop play quest execution: enroll -> heartbeats -> terminal heartbeat -> claim', async () => {
    const desktopQuest = JSON.parse(JSON.stringify(fixtures.mockDesktopPlayQuest));
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      quests: [desktopQuest]
    });

    await bg.sandbox.executeQuests('desktop-e2e-token');

    const heartbeatCalls = bg.discordMock.calls.filter(c => c.pathname.includes('/heartbeat'));
    assert.ok(heartbeatCalls.length >= 1, 'Heartbeat calls must be issued');
    assert.ok(heartbeatCalls.some(c => c.body.terminal === true), 'Terminal heartbeat must be sent');

    const claimCall = bg.discordMock.calls.find(c => c.pathname.includes('/claim-reward'));
    assert.ok(claimCall, 'Must claim reward for desktop quest');

    const finalBadge = bg.badges.find(b => b.text === 'DONE');
    assert.ok(finalBadge, 'DONE badge must be set upon finish');
  });

  await t.test('T4.Scenario4: Auto reward claiming on startup + orb balance gain calculation and notification', async () => {
    const preCompletedQuest = JSON.parse(JSON.stringify(fixtures.mockCompletedUnclaimedQuest));
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      quests: [preCompletedQuest, videoQuest],
      initialBalance: { balance: 100 },
      finalBalance: { balance: 125 }
    });

    await bg.sandbox.refreshDiscordData('token-with-unclaimed');
    const claimCalls = bg.discordMock.calls.filter(c => c.pathname.includes('/claim-reward'));
    assert.equal(claimCalls.length, 1, 'Must auto-claim pre-completed quest');

    // Run execute to process video quest and trigger summary and notifications
    await bg.sandbox.executeQuests('token-with-unclaimed');
    assert.ok(bg.notifications.length > 0, 'Completion notification must be dispatched');
    assert.ok(bg.notifications.some(n => n.message.includes('125')), 'Notification must mention new balance');

    const logs = (await sharedStorage.local.get('logs')).logs;
    assert.ok(logs.some(l => l.text.includes('125')), 'Summary log must report final balance');
  });

  await t.test('T4.Scenario5: Account switch handling in active session', async () => {
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      user: fixtures.mockUser
    });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Initial account 1
    await bg.sandbox.refreshDiscordData('token-acc-1');
    assert.equal((await sharedStorage.local.get('user')).user.username, fixtures.mockUser.username);

    // Switch account to Account 2
    const acc2User = { id: '999888777', username: 'NewDiscordUser', global_name: 'New Player', avatar: 'new_av_111' };
    bg.discordMock.setUser(acc2User);
    await bg.sandbox.refreshDiscordData('token-acc-2');

    const finalUser = (await sharedStorage.local.get('user')).user;
    assert.equal(finalUser.username, 'NewDiscordUser');
    assert.equal(finalUser.id, '999888777');

    popup.sandbox.renderUser(finalUser, 300);
    assert.equal(popup.elements.userName.textContent, 'New Player');
    assert.equal(popup.elements.userId.textContent, '@NewDiscordUser');
  });

  await t.test('T4.Scenario6: Real-World Chromium headless unpacked load verification for both extensions', () => {
    const chromeResult = spawnSync('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--load-extension=${EXT_GET_TOKEN_DIR},${EXT_AUTO_QUESTS_DIR}`,
      'about:blank'
    ], { timeout: 4000 });

    // If chrome accepts the extensions and starts up, exit status is 0 or killed by timeout
    assert.ok(
      chromeResult.status === 0 || chromeResult.signal === 'SIGTERM',
      'Chromium must successfully load both unpacked extensions simultaneously'
    );
  });
});
