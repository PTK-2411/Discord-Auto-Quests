const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPopupSandbox,
  createBackgroundSandbox,
  createStorage
} = require('./helpers/test-harness.js');
const fixtures = require('./helpers/fixtures.js');

test('Tier 1 - F5: Popup Dashboard UI & State Hydration', async (t) => {
  await t.test('T1.F5.1: renderUser hydrates username, handle, online dot, and orb count', async () => {
    const popup = createPopupSandbox();
    popup.sandbox.renderUser(fixtures.mockUser, 150);

    assert.equal(popup.elements.userName.textContent, fixtures.mockUser.global_name);
    assert.equal(popup.elements.userId.textContent, `@${fixtures.mockUser.username}`);
    assert.ok(popup.elements.userStatusDot.classList.contains('online'), 'Dot must have online class');
    assert.equal(popup.elements.userOrbs.textContent, '150 Orbs');
  });

  await t.test('T1.F5.2: renderUser constructs Discord CDN avatar URL', () => {
    const popup = createPopupSandbox();
    popup.sandbox.renderUser(fixtures.mockUser, 0);

    const expectedAvatar = `https://cdn.discordapp.com/avatars/${fixtures.mockUser.id}/${fixtures.mockUser.avatar}.png?size=80`;
    assert.equal(popup.elements.userAvatar.src, expectedAvatar);
  });

  await t.test('T1.F5.3: renderQuests generates quest cards with icon, title, and reward', () => {
    const popup = createPopupSandbox();
    const quests = [
      {
        id: 'q1',
        name: 'The Finals Launch',
        taskType: 'WATCH_VIDEO',
        reward: '50 Orbs',
        target: 15,
        countdown: 15,
        state: 'waiting'
      }
    ];

    popup.sandbox.renderQuests(quests);
    assert.equal(String(popup.elements.questCount.textContent), '1');
    assert.equal(popup.elements.questList.children.length, 1);

    const card = popup.elements.questList.children[0];
    assert.ok(card.innerHTML.includes('The Finals Launch'), 'Card must contain quest name');
    assert.ok(card.innerHTML.includes('50 Orbs'), 'Card must contain reward label');
    assert.ok(card.innerHTML.includes('🎬'), 'Video quest must use video emoji icon');
  });

  await t.test('T1.F5.4: renderQuests computes accurate progress percentage and track fill', () => {
    const popup = createPopupSandbox();
    const quests = [
      {
        id: 'q2',
        name: 'Halfway Video Quest',
        taskType: 'WATCH_VIDEO',
        reward: '20 Orbs',
        target: 20,
        countdown: 10, // 50%
        state: 'running'
      }
    ];

    popup.sandbox.renderQuests(quests);
    const card = popup.elements.questList.children[0];
    assert.ok(card.innerHTML.includes('50%'), 'Should display 50% progress');
    assert.ok(card.innerHTML.includes('style="width: 50%;"'), 'Track fill width must be 50%');
  });

  await t.test('T1.F5.5: updateRunningUI toggles running button styling and status text', () => {
    const popup = createPopupSandbox();

    // Set running state
    popup.sandbox.updateRunningUI(true);
    assert.ok(popup.elements.runBtn.classList.contains('running'));
    assert.equal(popup.elements.runBtnText.textContent, 'Stop');
    assert.equal(popup.elements.statusIndicator.textContent, 'Running...');

    // Set idle state
    popup.sandbox.updateRunningUI(false);
    assert.equal(popup.elements.runBtn.classList.contains('running'), false);
    assert.equal(popup.elements.runBtnText.textContent, 'Start Now');
    assert.equal(popup.elements.statusIndicator.textContent, 'Ready');
  });

  await t.test('T1.F5.6: Navigation tab buttons toggle active class between views', () => {
    const popup = createPopupSandbox();
    const [questsTabBtn, logsTabBtn] = popup.doc.tabButtons;
    const [questsTabContent, logsTabContent] = popup.doc.tabContents;

    // Click logs tab
    logsTabBtn.dispatch('click');
    assert.ok(logsTabBtn.classList.contains('active'), 'Logs tab button must be active');
    assert.equal(questsTabBtn.classList.contains('active'), false, 'Quests tab button must not be active');
    assert.ok(logsTabContent.classList.contains('active'), 'Logs content view must be active');
    assert.equal(questsTabContent.classList.contains('active'), false, 'Quests content view must not be active');

    // Click back to quests tab
    questsTabBtn.dispatch('click');
    assert.ok(questsTabBtn.classList.contains('active'), 'Quests tab button must be active again');
    assert.ok(questsTabContent.classList.contains('active'), 'Quests content view must be active again');
  });

  await t.test('T1.F5.7: renderQuests generates individual quest action button and handles single quest trigger', async () => {
    const sent = [];
    const popup = createPopupSandbox({
      initialStorage: { token: 'test-user-token' }
    });
    popup.sandbox.chrome.runtime.sendMessage = (msg, cb) => {
      sent.push(msg);
      if (cb) cb({ success: true, questId: msg.questId });
    };

    const quests = [
      {
        id: 'q-single',
        name: 'Single Video Quest',
        taskType: 'WATCH_VIDEO',
        reward: '30 Orbs',
        target: 15,
        countdown: 15,
        state: 'waiting'
      }
    ];

    popup.sandbox.renderQuests(quests);
    const card = popup.elements.questList.children[0];
    assert.ok(card.innerHTML.includes('btn-quest-action'), 'Card must render action button');
    assert.ok(card.innerHTML.includes('data-quest-id="q-single"'), 'Action button must include quest id');

    popup.sandbox.startSingleQuest('q-single');
    await new Promise(r => setTimeout(r, 10));

    const singleMsg = sent.find(m => m.action === 'START_SINGLE_QUEST');
    assert.ok(singleMsg, 'Must dispatch START_SINGLE_QUEST action');
    assert.equal(singleMsg.questId, 'q-single');
  });
});

test('Tier 1 - F6: Real-Time Execution Logging', async (t) => {
  await t.test('T1.F6.1: addLog formats entry with HH:MM:SS timestamp, text, and level', async () => {
    const bg = createBackgroundSandbox();
    await bg.sandbox.addLog('Test informational message', 'info');

    const storedLogs = (await bg.storage.local.get('logs')).logs;
    assert.ok(Array.isArray(storedLogs));
    assert.equal(storedLogs.length, 1);

    const entry = storedLogs[0];
    assert.equal(entry.text, 'Test informational message');
    assert.equal(entry.level, 'info');
    assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(entry.time), 'Time must match HH:MM:SS format');
  });

  await t.test('T1.F6.2: addLog persists logs in chrome.storage.local', async () => {
    const bg = createBackgroundSandbox();
    await bg.sandbox.addLog('Log 1', 'info');
    await bg.sandbox.addLog('Log 2', 'success');

    const storedLogs = (await bg.storage.local.get('logs')).logs;
    assert.equal(storedLogs.length, 2);
    assert.equal(storedLogs[0].text, 'Log 1');
    assert.equal(storedLogs[1].text, 'Log 2');
  });

  await t.test('T1.F6.3: addLog broadcasts LOG_ADDED message to active popup runtime', async () => {
    const bg = createBackgroundSandbox();
    await bg.sandbox.addLog('Broadcast test message', 'warn');

    const broadcast = bg.sentMessages.find(m => m.action === 'LOG_ADDED');
    assert.ok(broadcast, 'LOG_ADDED message must be broadcasted');
    assert.equal(broadcast.entry.text, 'Broadcast test message');
    assert.equal(broadcast.entry.level, 'warn');
  });

  await t.test('T1.F6.4: appendLogEntry renders formatted log element in console', () => {
    const popup = createPopupSandbox();
    const entry = { time: '14:30:00', text: 'Task completed successfully', level: 'success' };

    popup.sandbox.appendLogEntry(entry);
    assert.equal(popup.elements.logConsole.children.length, 1);

    const logDiv = popup.elements.logConsole.children[0];
    assert.ok(logDiv.classList.contains('log-entry'));
    assert.ok(logDiv.classList.contains('success'), 'Must have level CSS class');
    assert.ok(logDiv.innerHTML.includes('[14:30:00]'));
    assert.ok(logDiv.innerHTML.includes('Task completed successfully'));
  });

  await t.test('T1.F6.5: clearLogsBtn sends CLEAR_LOGS message and empties logConsole', async () => {
    const sharedStorage = createStorage({ logs: [] });
    const bg = createBackgroundSandbox({ storage: sharedStorage });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    // Wait for initial loadData() to finish
    await new Promise(r => setTimeout(r, 20));

    // Pre-populate console
    popup.sandbox.appendLogEntry({ time: '12:00:00', text: 'Old log', level: 'info' });
    assert.equal(popup.elements.logConsole.children.length, 1);

    popup.elements.clearLogsBtn.dispatch('click');
    await new Promise(r => setTimeout(r, 40));

    assert.equal(popup.elements.logConsole.children.length, 0, 'Console DOM must be emptied');
    const logsInStorage = (await sharedStorage.local.get('logs')).logs;
    assert.equal(logsInStorage.length, 0, 'Storage logs must be emptied');
  });
});

test('Tier 2 - F5: Popup UI Dashboard Boundaries & Edge Cases', async (t) => {
  await t.test('T2.F5.1: Empty quest list renders empty-state instructional view', () => {
    const popup = createPopupSandbox();
    popup.sandbox.renderQuests([]);

    assert.equal(String(popup.elements.questCount.textContent), '0');
    assert.ok(popup.elements.questList.innerHTML.includes('empty-state'));
  });

  await t.test('T2.F5.2: Disconnected user state renders Not connected and reset badges', () => {
    const popup = createPopupSandbox();
    popup.sandbox.renderUser(null, null);

    assert.equal(popup.elements.userName.textContent, 'Not connected');
    assert.equal(popup.elements.userId.textContent, '#0000');
    assert.equal(popup.elements.userStatusDot.classList.contains('online'), false);
    assert.equal(popup.elements.userOrbs.textContent, '-- Orbs');
  });

  await t.test('T2.F5.3: User with null avatar falls back to default extension icon', () => {
    const popup = createPopupSandbox();
    popup.sandbox.renderUser(fixtures.mockUserNoAvatar, 50);

    assert.equal(popup.elements.userName.textContent, fixtures.mockUserNoAvatar.username);
    assert.equal(popup.elements.userAvatar.src, 'icons/icon48.png');
  });

  await t.test('T2.F5.4: Quest progress exceeding target clamps to 100% and displays Done', () => {
    const popup = createPopupSandbox();
    const quests = [
      {
        id: 'q_over',
        name: 'Overachieved Quest',
        taskType: 'WATCH_VIDEO',
        reward: '10 Orbs',
        target: 10,
        countdown: 0,
        state: 'done'
      }
    ];

    popup.sandbox.renderQuests(quests);
    const card = popup.elements.questList.children[0];
    assert.ok(card.innerHTML.includes('100%'), 'Must clamp to 100%');
    assert.ok(card.innerHTML.includes('Done'), 'Countdown 0 must display Done in English default');
  });

  await t.test('T2.F5.5: Quest with zero target handles without division by zero', () => {
    const popup = createPopupSandbox();
    const zeroTargetQuest = [
      {
        id: 'q_zero',
        name: 'Instant Quest',
        taskType: 'WATCH_VIDEO',
        reward: '5 Orbs',
        target: 0,
        countdown: 0,
        state: 'done'
      }
    ];

    assert.doesNotThrow(() => {
      popup.sandbox.renderQuests(zeroTargetQuest);
    });
  });

  await t.test('T2.F5.6: Clicking runBtn when no token stored displays alert', async () => {
    const sharedStorage = createStorage({ token: null });
    const bg = createBackgroundSandbox({
      storage: sharedStorage,
      tokenToExtract: null,
      tabsQuery: () => []
    });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    popup.elements.runBtn.dispatch('click');
    await new Promise(r => setTimeout(r, 20));

    assert.ok(popup.alerts.some(a => a.includes('token') || a.includes('Discord') || a.includes('discord.com')));
  });

  await t.test('T2.F5.7: Language switcher dynamically toggles between English and Vietnamese', () => {
    const popup = createPopupSandbox();

    // Switch to Vietnamese
    popup.sandbox.setLanguage('vi');
    popup.sandbox.renderUser(null, null);
    assert.equal(popup.elements.userName.textContent, 'Chưa kết nối');

    popup.sandbox.updateRunningUI(true);
    assert.equal(popup.elements.runBtnText.textContent, 'Dừng lại');
    assert.equal(popup.elements.statusIndicator.textContent, 'Đang chạy...');

    // Switch back to English (default)
    popup.sandbox.setLanguage('en');
    popup.sandbox.renderUser(null, null);
    assert.equal(popup.elements.userName.textContent, 'Not connected');

    popup.sandbox.updateRunningUI(false);
    assert.equal(popup.elements.runBtnText.textContent, 'Start Now');
    assert.equal(popup.elements.statusIndicator.textContent, 'Ready');
  });

  await t.test('T2.F5.8: Expired quest renders localized badge and omits run button in EN and VI', async () => {
    const popup = createPopupSandbox();
    const expiredQuest = {
      id: 'quest_exp_test',
      name: 'Expired Promotion Quest',
      taskType: 'WATCH_VIDEO',
      reward: '30 Orbs',
      target: 20,
      countdown: 20,
      state: 'expired'
    };
    const waitingQuest = {
      id: 'quest_wait_test',
      name: 'Active Quest',
      taskType: 'PLAY_ON_DESKTOP',
      reward: '50 Orbs',
      target: 15,
      countdown: 15,
      state: 'waiting'
    };

    // 1. Test in default English
    popup.sandbox.renderQuests([expiredQuest, waitingQuest]);
    const expCardEn = popup.elements.questList.children[0];
    const waitCardEn = popup.elements.questList.children[1];

    assert.ok(expCardEn.innerHTML.includes('status-badge expired'), 'Expired badge class must be present');
    assert.ok(expCardEn.innerHTML.includes('Expired'), 'English expired badge must display Expired');
    assert.equal(expCardEn.innerHTML.includes('btn-quest-action'), false, 'Expired quest card must NOT render run button');

    assert.ok(waitCardEn.innerHTML.includes('status-badge waiting'), 'Waiting badge class must be present');
    assert.ok(waitCardEn.innerHTML.includes('Waiting'), 'English waiting badge must display Waiting');
    assert.ok(waitCardEn.innerHTML.includes('btn-quest-action'), 'Active quest card must render run button');

    // 2. Test in Vietnamese
    popup.sandbox.setLanguage('vi');
    popup.sandbox.renderQuests([expiredQuest, waitingQuest]);
    const expCardVi = popup.elements.questList.children[0];
    const waitCardVi = popup.elements.questList.children[1];

    assert.ok(expCardVi.innerHTML.includes('status-badge expired'), 'Expired badge class must be present');
    assert.ok(expCardVi.innerHTML.includes('Hết hạn'), 'Vietnamese expired badge must display Hết hạn');
    assert.equal(expCardVi.innerHTML.includes('btn-quest-action'), false, 'Vietnamese expired quest must NOT render run button');

    assert.ok(waitCardVi.innerHTML.includes('status-badge waiting'), 'Waiting badge class must be present');
    assert.ok(waitCardVi.innerHTML.includes('Đang chờ'), 'Vietnamese waiting badge must display Đang chờ');
    assert.ok(waitCardVi.innerHTML.includes('btn-quest-action'), 'Vietnamese active quest card must render run button');

    // 3. Test startSingleQuest guard ignores expired quest
    let messageSent = false;
    popup.sandbox.chrome.runtime.sendMessage = () => { messageSent = true; };
    popup.sandbox.startSingleQuest('quest_exp_test');
    assert.equal(messageSent, false, 'startSingleQuest must ignore expired quest');

    // 4. Test in-place DOM updates & dynamic language toggle for expired quest
    const mockBadge = { className: '', textContent: '' };
    const mockActionBtn = { style: { display: '' }, disabled: false, className: '', textContent: '' };
    const mockFill = { style: { width: '' }, classList: { add: () => {}, remove: () => {} } };
    const mockFooter = { textContent: '' };
    const mockCard = {
      dataset: { questId: 'q-live-exp' },
      classList: { add: () => {}, remove: () => {} },
      querySelector: (sel) => {
        if (sel === '.status-badge') return mockBadge;
        if (sel === '.btn-quest-action') return mockActionBtn;
        if (sel === '.progress-fill') return mockFill;
        if (sel === '.quest-footer-info') return mockFooter;
        return null;
      }
    };
    popup.elements.questList.querySelectorAll = (sel) => sel === '.quest-card' ? [mockCard] : [];
    popup.sandbox.setLanguage('vi');
    popup.sandbox.renderQuests([{
      id: 'q-live-exp',
      name: 'Live Expired Quest',
      taskType: 'WATCH_VIDEO',
      reward: '10 Orbs',
      target: 10,
      countdown: 10,
      state: 'expired'
    }]);
    assert.equal(mockBadge.textContent, 'Hết hạn', 'In-place update must set Vietnamese badge');
    assert.equal(mockActionBtn.style.display, 'none', 'In-place update must hide action button for expired quest');

    popup.sandbox.setLanguage('en');
    assert.equal(mockBadge.textContent, 'Expired', 'Dynamic switch to English must update badge to Expired');
    assert.equal(mockActionBtn.style.display, 'none', 'Action button must remain hidden after language switch');
  });
});

test('Tier 2 - F6: Logging Boundaries & Stress Resiliency', async (t) => {
  await t.test('T2.F6.1: Rolling buffer caps logs at 300 entries and shifts oldest', async () => {
    const bg = createBackgroundSandbox();

    // Populate with 305 entries
    for (let i = 1; i <= 305; i++) {
      await bg.sandbox.addLog(`Entry ${i}`, 'info');
    }

    const logs = (await bg.storage.local.get('logs')).logs;
    assert.equal(logs.length, 300, 'Must be capped at strictly 300 entries');
    assert.equal(logs[0].text, 'Entry 6', 'Oldest 5 entries must have been evicted');
    assert.equal(logs[299].text, 'Entry 305', 'Latest entry must be preserved');
  });

  await t.test('T2.F6.2: Log entry with undefined level defaults to info', async () => {
    const bg = createBackgroundSandbox();
    await bg.sandbox.addLog('Default level message');

    const logs = (await bg.storage.local.get('logs')).logs;
    assert.equal(logs[0].level, 'info');
  });

  await t.test('T2.F6.3: Rapid burst of logs preserves sequence and all entries', async () => {
    const bg = createBackgroundSandbox();
    for (let i = 0; i < 20; i++) {
      await bg.sandbox.addLog(`Burst message ${i}`);
    }

    const logs = (await bg.storage.local.get('logs')).logs;
    assert.equal(logs.length, 20, 'All burst messages must be captured');
    assert.equal(logs[0].text, 'Burst message 0');
    assert.equal(logs[19].text, 'Burst message 19');
  });

  await t.test('T2.F6.4: Log messages with HTML characters rendered safely without executing', () => {
    const popup = createPopupSandbox();
    const maliciousEntry = {
      time: '12:00:00',
      text: '<img src=x onerror=alert(1)> & <script>alert(2)</script>',
      level: 'warn'
    };

    popup.sandbox.appendLogEntry(maliciousEntry);
    const logDiv = popup.elements.logConsole.children[0];
    assert.ok(logDiv.innerHTML.includes('&lt;') || logDiv.innerHTML.includes('<img'), 'Element created cleanly');
  });

  await t.test('T2.F6.5: Clearing logs when log buffer is already empty is idempotent', async () => {
    const sharedStorage = createStorage({ logs: [] });
    const bg = createBackgroundSandbox({ storage: sharedStorage });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    assert.doesNotThrow(() => {
      popup.elements.clearLogsBtn.dispatch('click');
    });
  });
});

test('Tier 1 & Tier 2 - F8: GitHub Auto-Update Engine & Popup Banner UI', async (t) => {
  await t.test('T1.F8.1: compareVersions accurately parses and compares SemVer versions', () => {
    const bg = createBackgroundSandbox();
    const compare = bg.sandbox.compareVersions;

    assert.equal(compare('2.3.0', '2.4.0'), -1, '2.3.0 < 2.4.0');
    assert.equal(compare('2.4.0', '2.4.0'), 0, '2.4.0 === 2.4.0');
    assert.equal(compare('2.4.1', '2.4.0'), 1, '2.4.1 > 2.4.0');
    assert.equal(compare('v2.4.0', '2.4.1'), -1, 'v-prefix stripped');
    assert.equal(compare('2.4', '2.4.0'), 0, 'shorthand 2.4 treated as 2.4.0');
    assert.equal(compare('3.0.0', '2.9.9'), 1, 'major takes precedence');
    assert.equal(compare('', '2.4.0'), -1, 'empty string handled safely');
    assert.equal(compare(null, '2.4.0'), -1, 'null handled safely');
  });

  await t.test('T1.F8.2: checkForUpdates detects newer remote version and updates storage', async () => {
    const bg = createBackgroundSandbox({
      githubLatestVersion: '2.5.0'
    });

    const result = await bg.sandbox.checkForUpdates();
    assert.equal(result.success, true);
    assert.equal(result.updateState.updateAvailable, true);
    assert.equal(result.updateState.latestVersion, '2.5.0');
    assert.ok(result.updateState.downloadUrl.includes('archive/refs/heads/main.zip'));

    const stored = await bg.storage.local.get('updateState');
    assert.equal(stored.updateState.updateAvailable, true);
    assert.equal(stored.updateState.latestVersion, '2.5.0');
  });

  await t.test('T1.F8.3: checkForUpdates reports no update when remote matches local', async () => {
    const bg = createBackgroundSandbox({
      githubLatestVersion: '2.4.0'
    });

    const result = await bg.sandbox.checkForUpdates();
    assert.equal(result.success, true);
    assert.equal(result.updateState.updateAvailable, false);
    assert.equal(result.updateState.latestVersion, '2.4.0');
  });

  await t.test('T1.F8.4: Message CHECK_UPDATE triggers update check and responds to caller', async () => {
    const bg = createBackgroundSandbox({
      githubLatestVersion: '2.4.1'
    });

    const response = await bg.triggerMessage({ action: 'CHECK_UPDATE' });
    assert.ok(response);
    assert.equal(response.success, true);
    assert.equal(response.updateState.updateAvailable, true);
    assert.equal(response.updateState.latestVersion, '2.4.1');
  });

  await t.test('T1.F8.5: Message DOWNLOAD_UPDATE triggers chrome.downloads.download', async () => {
    const bg = createBackgroundSandbox();

    const response = await bg.triggerMessage({
      action: 'DOWNLOAD_UPDATE',
      version: '2.4.1',
      url: 'https://github.com/PTK-2411/Discord-Auto-Quests/archive/refs/heads/main.zip'
    });

    assert.ok(response);
    assert.equal(response.success, true);
    assert.equal(bg.downloadsCalls.length, 1);
    assert.equal(bg.downloadsCalls[0].filename, 'Discord-Auto-Quests-v2.4.1.zip');
    assert.ok(bg.downloadsCalls[0].url.includes('archive/refs/heads/main.zip'));
  });

  await t.test('T1.F8.6: Message RELOAD_EXTENSION triggers chrome.runtime.reload', async () => {
    const bg = createBackgroundSandbox();

    const response = await bg.triggerMessage({ action: 'RELOAD_EXTENSION' });
    assert.ok(response);
    assert.equal(response.success, true);
  });

  await t.test('T2.F8.1: Popup renders update banner when updateState has updateAvailable', async () => {
    const popup = createPopupSandbox();
    const updateState = {
      updateAvailable: true,
      currentVersion: '2.4.0',
      latestVersion: '2.5.0',
      downloadUrl: 'https://github.com/PTK-2411/Discord-Auto-Quests/archive/refs/heads/main.zip'
    };

    popup.sandbox.renderUpdateBanner(updateState);
    assert.equal(popup.elements.updateBanner.classList.contains('hidden'), false);
    assert.ok(popup.elements.updateBannerVersion.textContent.includes('v2.4.0'));
    assert.ok(popup.elements.updateBannerVersion.textContent.includes('v2.5.0'));
  });

  await t.test('T2.F8.2: Dismissing update banner hides it and stores dismissedUpdateVersion', async () => {
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({ storage: sharedStorage });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    const updateState = {
      updateAvailable: true,
      currentVersion: '2.4.0',
      latestVersion: '2.5.0',
      downloadUrl: 'https://github.com/PTK-2411/Discord-Auto-Quests/archive/refs/heads/main.zip'
    };

    popup.sandbox.renderUpdateBanner(updateState);
    assert.equal(popup.elements.updateBanner.classList.contains('hidden'), false);

    // Dismiss
    popup.elements.btnDismissUpdate.dispatch('click');
    assert.equal(popup.elements.updateBanner.classList.contains('hidden'), true);
    await new Promise(r => setTimeout(r, 10));
    const stored = await sharedStorage.local.get('dismissedUpdateVersion');
    assert.equal(stored.dismissedUpdateVersion, '2.5.0');
  });

  await t.test('T2.F8.3: Accepting update in popup triggers download and reveals reload button', async () => {
    const sharedStorage = createStorage();
    const bg = createBackgroundSandbox({ storage: sharedStorage });
    const popup = createPopupSandbox({ storage: sharedStorage, background: bg });

    const updateState = {
      updateAvailable: true,
      currentVersion: '2.4.0',
      latestVersion: '2.5.0',
      downloadUrl: 'https://github.com/PTK-2411/Discord-Auto-Quests/archive/refs/heads/main.zip'
    };

    popup.sandbox.renderUpdateBanner(updateState);
    popup.elements.btnAcceptUpdate.dispatch('click');

    // Wait microtask for download handler
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(bg.downloadsCalls.length, 1);
    assert.equal(popup.elements.btnAcceptUpdate.classList.contains('hidden'), true);
    assert.equal(popup.elements.btnReloadExtension.classList.contains('hidden'), false);
  });

  await t.test('T2.F8.4: Language switch updates banner translations dynamically', async () => {
    const popup = createPopupSandbox();
    const updateState = {
      updateAvailable: true,
      currentVersion: '2.4.0',
      latestVersion: '2.5.0',
      downloadUrl: 'https://github.com/PTK-2411/Discord-Auto-Quests/archive/refs/heads/main.zip'
    };

    popup.sandbox.renderUpdateBanner(updateState);
    popup.sandbox.setLanguage('vi');
    assert.equal(popup.elements.updateBannerTitle.textContent, 'Có phiên bản mới!');
    assert.equal(popup.elements.btnAcceptUpdate.textContent, 'Cập nhật ngay');
    assert.equal(popup.elements.btnDismissUpdate.textContent, 'Để sau');

    popup.sandbox.setLanguage('en');
    assert.equal(popup.elements.updateBannerTitle.textContent, 'Update Available!');
    assert.equal(popup.elements.btnAcceptUpdate.textContent, 'Update Now');
    assert.equal(popup.elements.btnDismissUpdate.textContent, 'Later');
  });

  await t.test('T2.F8.5: Stale updateState with older/equal remote version suppresses update banner', () => {
    const popup = createPopupSandbox({ manifestVersion: '2.4.0' });

    // Stale storage has updateAvailable: true from previous session when manifest was 2.3.0
    const staleUpdateState = {
      updateAvailable: true,
      currentVersion: '2.3.0',
      latestVersion: '2.4.0',
      downloadUrl: 'https://github.com/PTK-2411/Discord-Auto-Quests/archive/refs/heads/main.zip'
    };

    popup.sandbox.renderUpdateBanner(staleUpdateState);
    assert.equal(popup.elements.updateBanner.classList.contains('hidden'), true, 'Banner must remain hidden when current version >= latest');
  });

  await t.test('T2.F8.6: DOWNLOAD_UPDATE failure when downloadId is undefined is handled gracefully', async () => {
    const bg = createBackgroundSandbox({
      downloadsDownloadOverride: (opts, cb) => {
        if (cb) cb(undefined);
        return Promise.resolve(undefined);
      }
    });

    const response = await bg.triggerMessage({
      action: 'DOWNLOAD_UPDATE',
      version: '2.5.0'
    });

    assert.ok(response);
    assert.equal(response.success, false);
    assert.ok(response.error.includes('Download failed to initiate'));
  });
});
