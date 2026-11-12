const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createBackgroundSandbox,
  createDiscordApiMock
} = require('./helpers/test-harness.js');
const fixtures = require('./helpers/fixtures.js');

test('Tier 1 - F3: Discord REST Quest Engine & Type Coverage', async (t) => {
  await t.test('T1.F3.1: getHeaders builds superProperties, User-Agent, and Authorization header', () => {
    const bg = createBackgroundSandbox();
    const token = 'test-auth-token-xyz789';
    const headers = bg.sandbox.getHeaders(token);

    assert.equal(headers['Authorization'], token);
    assert.equal(headers['Content-Type'], 'application/json');
    assert.ok(headers['x-super-properties'], 'x-super-properties must be set');

    const superPropsJson = Buffer.from(headers['x-super-properties'], 'base64').toString('utf8');
    const superProps = JSON.parse(superPropsJson);
    assert.equal(superProps.os, 'Windows');
    assert.equal(superProps.browser, 'Discord Client');
    assert.ok(superProps.client_launch_id, 'must include client_launch_id');
  });

  await t.test('T1.F3.2: refreshDiscordData queries user profile and records to storage', async () => {
    const bg = createBackgroundSandbox({
      user: fixtures.mockUser
    });

    await bg.sandbox.refreshDiscordData('valid-token-123');
    const userCall = bg.discordMock.calls.find(c => c.pathname === '/users/@me');
    assert.ok(userCall, 'Must call GET /users/@me');

    const stored = await bg.storage.local.get('user');
    assert.equal(stored.user.username, fixtures.mockUser.username);
    assert.equal(stored.user.id, fixtures.mockUser.id);
  });

  await t.test('T1.F3.3: Discovers quests via GET /quests/@me and parses details', async () => {
    const bg = createBackgroundSandbox({
      quests: [fixtures.mockVideoQuest]
    });

    await bg.sandbox.refreshDiscordData('valid-token-123');
    const questCall = bg.discordMock.calls.find(c => c.pathname === '/quests/@me');
    assert.ok(questCall, 'Must call GET /quests/@me');

    const stored = await bg.storage.local.get('quests');
    assert.ok(Array.isArray(stored.quests), 'quests in storage must be an array');
    assert.equal(stored.quests.length, 1);
    assert.equal(stored.quests[0].id, fixtures.mockVideoQuest.id);
    assert.equal(stored.quests[0].taskType, 'WATCH_VIDEO');
  });

  await t.test('T1.F3.4: getQuestDetails prioritizes task types and calculates target seconds', () => {
    const bg = createBackgroundSandbox();
    const multiTaskQuest = {
      id: 'multi_task_001',
      config: {
        messages: { quest_name: 'Multi-Task Quest' },
        task_config_v2: {
          tasks: {
            STREAM_ON_DESKTOP: { target: 600 },
            PLAY_ON_DESKTOP: { target: 900, applications: [{ id: 'app_1' }] },
            WATCH_VIDEO: { target: 30 }
          }
        },
        rewards_config: {
          rewards: [{ orb_quantity: 40 }]
        }
      }
    };

    const details = bg.sandbox.getQuestDetails(multiTaskQuest);
    // Priority order in background.js: PLAY_ON_DESKTOP before WATCH_VIDEO before STREAM_ON_DESKTOP
    assert.equal(details.taskType, 'PLAY_ON_DESKTOP');
    assert.equal(details.target, 900);
    assert.equal(details.rewardLabel, '40 Orbs');
  });

  await t.test('T1.F3.5: Enrolls pending un-enrolled quests via POST /quests/:id/enroll', async () => {
    const unenrolledQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    unenrolledQuest.user_status = null;

    const bg = createBackgroundSandbox({
      quests: [unenrolledQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const enrollCall = bg.discordMock.calls.find(c => c.pathname === `/quests/${unenrolledQuest.id}/enroll`);
    assert.ok(enrollCall, 'Must issue POST /quests/:id/enroll for unenrolled quest');
    assert.equal(enrollCall.body.location, 11);
    assert.equal(enrollCall.body.is_targeted, false);
  });

  await t.test('T1.F3.6: Executes video quest via POST /quests/:id/video-progress', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const progressCalls = bg.discordMock.calls.filter(c => c.pathname === `/quests/${videoQuest.id}/video-progress`);
    assert.ok(progressCalls.length > 0, 'Must issue POST /quests/:id/video-progress');
    const lastProgress = progressCalls[progressCalls.length - 1];
    assert.ok(lastProgress.body.timestamp >= 15, 'Final progress timestamp must reach or exceed target');
  });

  await t.test('T1.F3.7: Executes desktop play quest via heartbeats and sends terminal heartbeat', async () => {
    const desktopQuest = JSON.parse(JSON.stringify(fixtures.mockDesktopPlayQuest));
    const bg = createBackgroundSandbox({
      quests: [desktopQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const heartbeatCalls = bg.discordMock.calls.filter(c => c.pathname === `/quests/${desktopQuest.id}/heartbeat`);
    assert.ok(heartbeatCalls.length > 0, 'Must send heartbeats for desktop play quest');
    assert.equal(heartbeatCalls[0].body.application_id, 'app_genshin_888');
    const terminalCall = heartbeatCalls.find(c => c.body.terminal === true);
    assert.ok(terminalCall, 'Must send terminal heartbeat upon completion');
  });
});

test('Tier 1 - F4: Auto Reward Claiming & Balance Sync', async (t) => {
  await t.test('T1.F4.1: Automatically claims pre-completed quests on initial sync', async () => {
    const preCompletedQuest = JSON.parse(JSON.stringify(fixtures.mockCompletedUnclaimedQuest));
    const bg = createBackgroundSandbox({
      quests: [preCompletedQuest]
    });

    await bg.sandbox.refreshDiscordData('valid-token-123');
    const claimCall = bg.discordMock.calls.find(c => c.pathname === `/quests/${preCompletedQuest.id}/claim-reward`);
    assert.ok(claimCall, 'Must claim already-completed quest on data refresh');
  });

  await t.test('T1.F4.2: Automatically issues claim-reward immediately when quest is completed', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const claimCall = bg.discordMock.calls.find(c => c.pathname === `/quests/${videoQuest.id}/claim-reward`);
    assert.ok(claimCall, 'Must call POST /claim-reward upon completing quest');
  });

  await t.test('T1.F4.3: Transitions quest state to claimed in storage post-claim', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const stored = await bg.storage.local.get('quests');
    const item = stored.quests.find(q => q.id === videoQuest.id);
    assert.ok(item, 'Quest item must exist in storage');
    assert.equal(item.state, 'claimed', 'State must be claimed');
  });

  await t.test('T1.F4.4: Refreshes virtual currency balance after completing quests', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest],
      initialBalance: fixtures.mockInitialBalance,
      finalBalance: fixtures.mockFinalBalance
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const balanceCalls = bg.discordMock.calls.filter(c => c.pathname === '/users/@me/virtual-currency/balance');
    assert.ok(balanceCalls.length >= 2, 'Must query balance at start and after claiming rewards');

    const stored = await bg.storage.local.get('orbs');
    assert.equal(stored.orbs, fixtures.mockFinalBalance.balance);
  });

  await t.test('T1.F4.5: Updates badge to DONE and logs celebratory message upon finishing', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const doneBadge = bg.badges.find(b => b.text === 'DONE');
    assert.ok(doneBadge, 'Badge must be updated to DONE');

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('All available quests') || l.text.includes('Tất cả nhiệm vụ khả dụng')));
  });
});

test('Tier 2 - F3: Quest Engine Boundary Cases & Error Handling', async (t) => {
  await t.test('T2.F3.1: Defective quest ID 1412491570820812933 is filtered out and never executed', async () => {
    const defectiveQuest = JSON.parse(JSON.stringify(fixtures.mockDefectiveQuest));
    const validQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));

    const bg = createBackgroundSandbox({
      quests: [defectiveQuest, validQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');

    // Defective quest must NEVER have enroll, progress, or claim calls
    const defectiveCalls = bg.discordMock.calls.filter(c => c.pathname.includes(defectiveQuest.id));
    assert.equal(defectiveCalls.length, 0, 'Defective quest must have zero API interactions');

    // Valid quest must have executed
    const validCalls = bg.discordMock.calls.filter(c => c.pathname.includes(validQuest.id));
    assert.ok(validCalls.length > 0, 'Valid quest should still execute normally');
  });

  await t.test('T2.F3.2: Expired quests (expires_at in the past) are filtered out', async () => {
    const expiredQuest = JSON.parse(JSON.stringify(fixtures.mockExpiredQuest));
    const bg = createBackgroundSandbox({
      quests: [expiredQuest]
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const expiredCalls = bg.discordMock.calls.filter(c => c.pathname.includes(expiredQuest.id));
    assert.equal(expiredCalls.length, 0, 'Expired quest must be excluded');

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('No active quests') || l.text.includes('Không có nhiệm vụ nào cần làm')));
  });

  await t.test('T2.F3.3: Unsupported quest task types are marked as skipped without crashing', async () => {
    const unsupportedQuest = JSON.parse(JSON.stringify(fixtures.mockUnsupportedTaskQuest));
    const bg = createBackgroundSandbox({
      quests: [unsupportedQuest]
    });

    await assert.doesNotReject(async () => {
      await bg.sandbox.executeQuests('valid-token-123');
    });

    const stored = await bg.storage.local.get('quests');
    const item = stored.quests.find(q => q.id === unsupportedQuest.id);
    assert.ok(item);
    assert.equal(item.state, 'skipped');

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('not supported') || l.text.includes('chưa hỗ trợ')));
  });

  await t.test('T2.F3.4: 401 Unauthorized terminates runner gracefully with ERR badge', async () => {
    const bg = createBackgroundSandbox({
      unauthorized: true
    });

    await bg.sandbox.executeQuests('invalid-expired-token');
    const errBadge = bg.badges.find(b => b.text === 'ERR');
    assert.ok(errBadge, 'Badge must be set to ERR on 401 Unauthorized');

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.level === 'error' && l.text.includes('401')));
  });

  await t.test('T2.F3.5: 429 Rate Limit error on video progress does not crash runner', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    let progressCallCount = 0;

    const bg = createBackgroundSandbox({
      quests: [videoQuest],
      customHandlers: {
        [`/quests/${videoQuest.id}/video-progress`]: (call) => {
          progressCallCount++;
          if (progressCallCount === 1) {
            return { ok: false, status: 429, json: async () => ({ retry_after: 0.1 }), text: async () => 'Rate limited' };
          }
          return { ok: true, status: 200, json: async () => ({ completed_at: new Date().toISOString() }), text: async () => '{}' };
        }
      }
    });

    await assert.doesNotReject(async () => {
      await bg.sandbox.executeQuests('valid-token-123');
    });

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('Video progress error') || l.text.includes('Lỗi gửi tiến độ video')));
  });

  await t.test('T2.F3.6: Empty quest list completes immediately with DONE badge', async () => {
    const bg = createBackgroundSandbox({
      quests: []
    });

    await bg.sandbox.executeQuests('valid-token-123');
    const doneBadge = bg.badges.find(b => b.text === 'DONE');
    assert.ok(doneBadge, 'Badge must be set to DONE for empty quest list');

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('No active quests') || l.text.includes('Không có nhiệm vụ nào cần làm')));
  });
});

test('Tier 2 - F4: Reward Claiming Boundaries & Defensive Fallbacks', async (t) => {
  await t.test('T2.F4.1: Claim reward API failure is logged and does not crash remaining flow', async () => {
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest],
      customHandlers: {
        [`/quests/${videoQuest.id}/claim-reward`]: () => {
          return { ok: false, status: 400, json: async () => ({ code: 50001, message: 'Already claimed elsewhere' }), text: async () => 'Error' };
        }
      }
    });

    await assert.doesNotReject(async () => {
      await bg.sandbox.executeQuests('valid-token-123');
    });

    const logs = (await bg.storage.local.get('logs')).logs || [];
    assert.ok(logs.some(l => l.text.includes('Reward claim') || l.text.includes('Nhận thưởng thất bại')));
  });

  await t.test('T2.F4.2: Already claimed quest (claimed_at present) is not re-claimed', async () => {
    const alreadyClaimedQuest = JSON.parse(JSON.stringify(fixtures.mockCompletedUnclaimedQuest));
    alreadyClaimedQuest.user_status.claimed_at = new Date(Date.now() - 60000).toISOString();

    const bg = createBackgroundSandbox({
      quests: [alreadyClaimedQuest]
    });

    await bg.sandbox.refreshDiscordData('valid-token-123');
    const claimCalls = bg.discordMock.calls.filter(c => c.pathname === `/quests/${alreadyClaimedQuest.id}/claim-reward`);
    assert.equal(claimCalls.length, 0, 'Must not claim quest if claimed_at is already present');
  });

  await t.test('T2.F4.3: Virtual currency endpoint 404 handled gracefully', async () => {
    let warnLogged = false;
    const videoQuest = JSON.parse(JSON.stringify(fixtures.mockVideoQuest));
    const bg = createBackgroundSandbox({
      quests: [videoQuest],
      customHandlers: {
        '/users/@me/virtual-currency/balance': () => {
          return { ok: false, status: 404, json: async () => ({ code: 10008, message: 'Unknown User' }), text: async () => '404' };
        }
      }
    });

    bg.sandbox.console.warn = (...args) => {
      warnLogged = true;
    };

    await assert.doesNotReject(async () => {
      await bg.sandbox.executeQuests('valid-token-123');
    });

    assert.ok(warnLogged, 'Warning should be emitted when balance endpoint fails');
  });

  await t.test('T2.F4.4: Parses custom reward name when orb_quantity is not present', () => {
    const bg = createBackgroundSandbox();
    const cosmeticQuest = {
      id: 'cosmetic_001',
      config: {
        messages: { quest_name: 'Cosmetic Quest' },
        task_config_v2: { tasks: { WATCH_VIDEO: { target: 15 } } },
        rewards_config: {
          rewards: [
            { messages: { name: 'Exclusive Discord Banner' } }
          ]
        }
      }
    };

    const details = bg.sandbox.getQuestDetails(cosmeticQuest);
    assert.equal(details.rewardLabel, 'Exclusive Discord Banner');
  });

  await t.test('T2.F4.5: Malformed quest JSON falls back safely to default target and default reward', () => {
    const bg = createBackgroundSandbox();
    const malformedQuest = {
      id: 'malformed_quest_999'
      // missing config, missing task_config, missing rewards_config
    };

    const details = bg.sandbox.getQuestDetails(malformedQuest);
    assert.equal(details.target, 900);
    assert.ok(details.rewardLabel.length > 0, 'Must have a fallback reward label');
    assert.equal(details.name, 'malformed_quest_999');
  });
});
