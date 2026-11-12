// Discord Auto Quests - Background Service Worker (Manifest V3)

const DISCORD_API = 'https://discord.com/api/v10';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36';

let isRunning = false;
let shouldStop = false;
let liveTicker = null;
let currentQuests = [];
let currentActiveQuestId = null;
let refreshPromise = null;
let connectedPorts = new Set();

// Task types supported by Discord Quests
const TaskType = {
  PLAY_ON_DESKTOP: 'PLAY_ON_DESKTOP',
  WATCH_VIDEO: 'WATCH_VIDEO',
  WATCH_VIDEO_ON_MOBILE: 'WATCH_VIDEO_ON_MOBILE',
  STREAM_ON_DESKTOP: 'STREAM_ON_DESKTOP',
  PLAY_ACTIVITY: 'PLAY_ACTIVITY',
  PLAY_ON_XBOX: 'PLAY_ON_XBOX',
  PLAY_ON_PLAYSTATION: 'PLAY_ON_PLAYSTATION'
};

// Cấu hình DeclarativeNetRequest để ghi đè User-Agent, Origin, Referer
async function registerNetRules() {
  const RULE_ID = 1001;
  const rules = [
    {
      id: RULE_ID,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'user-agent', operation: 'set', value: DEFAULT_USER_AGENT },
          { header: 'origin', operation: 'set', value: 'https://discord.com' },
          { header: 'referer', operation: 'set', value: 'https://discord.com/channels/@me' },
          { header: 'sec-ch-ua', operation: 'set', value: '"Not)A;Brand";v="8", "Chromium";v="138"' },
          { header: 'sec-ch-ua-mobile', operation: 'set', value: '?0' },
          { header: 'sec-ch-ua-platform', operation: 'set', value: '"Windows"' }
        ]
      },
      condition: {
        urlFilter: '||discord.com/api/*',
        resourceTypes: [
          'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
          'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
          'media', 'websocket', 'other'
        ]
      }
    }
  ];

  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existing.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules
    });
  } catch (err) {
    console.warn('DeclarativeNetRequest setup warning:', err);
  }
}

// Khởi chạy rules ngay khi worker khởi động
registerNetRules();

// State machine constants & in-memory cache
const DEFAULT_RUNNER_STATE = {
  status: 'IDLE',
  activeQuestId: null,
  activeTaskType: null,
  appId: null,
  progressSeconds: 0,
  targetSeconds: 900,
  enrolledAt: null,
  lastHeartbeatAt: null,
  questQueue: [],
  currentQueueIndex: 0,
  retryCount: 0,
  nextAllowedExecutionTime: 0,
  lastError: null
};

let cachedToken = null;
let isProcessingToken = false;

// Đồng bộ cachedToken từ storage khi Service Worker thức dậy
try {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['token']).then(res => {
      if (res && res.token) cachedToken = res.token.trim();
    }).catch(() => {});
  }
} catch {}

// Thiết lập Passive WebRequest Sniffer (Engine 1)
function setupPassiveTokenSniffer() {
  if (typeof chrome === 'undefined' || !chrome.webRequest || !chrome.webRequest.onBeforeSendHeaders) {
    return;
  }

  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        // Bỏ qua các request phát sinh từ chính Service Worker / Popup của extension
        if (details.tabId < 0) return;
        if (details.initiator && details.initiator.startsWith('chrome-extension://')) return;

        if (!details.requestHeaders || !Array.isArray(details.requestHeaders)) return;

        for (const header of details.requestHeaders) {
          if (header.name && header.name.toLowerCase() === 'authorization') {
            if (header.value) {
              handleCapturedToken(header.value, 'Passive Sniffer (webRequest)');
            }
            break;
          }
        }
      },
      {
        urls: [
          'https://discord.com/api/*',
          'https://*.discord.com/api/*'
        ]
      },
      ['requestHeaders', 'extraHeaders']
    );
  } catch (err) {
    console.error('[Sniffer] Error registering webRequest listener:', err);
  }
}

// Khởi chạy passive sniffer ngay khi worker khởi động
setupPassiveTokenSniffer();

function getHeaders(token) {
  const superProperties = {
    os: 'Windows',
    browser: 'Discord Client',
    release_channel: 'stable',
    client_version: '1.0.9215',
    os_version: '10.0.19045',
    os_arch: 'x64',
    app_arch: 'x64',
    system_locale: 'en-US',
    has_client_mods: false,
    client_launch_id: crypto.randomUUID(),
    browser_user_agent: DEFAULT_USER_AGENT,
    browser_version: '37.6.0',
    os_sdk_version: '19045',
    client_build_number: 471091,
    native_build_number: 72186,
    client_event_source: null,
    launch_signature: crypto.randomUUID(),
    client_heartbeat_session_id: crypto.randomUUID(),
    client_app_state: 'focused'
  };

  return {
    'Authorization': token.trim(),
    'Content-Type': 'application/json',
    'Accept-Language': 'vi,en-US;q=0.9',
    'x-discord-locale': 'en-US',
    'x-discord-timezone': 'Asia/Saigon',
    'x-super-properties': btoa(JSON.stringify(superProperties))
  };
}

let activeLang = 'en'; // Default language is English

async function getActiveLang() {
  try {
    const data = await chrome.storage.local.get(['appLang']);
    if (data && (data.appLang === 'vi' || data.appLang === 'en')) {
      activeLang = data.appLang;
    }
  } catch (e) {}
  return activeLang;
}

function msg(enText, viText) {
  return activeLang === 'vi' ? viText : enText;
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.appLang) {
      activeLang = changes.appLang.newValue || 'en';
    }
  });
}

async function addLog(text, level = 'info') {
  const now = new Date();
  const time = String(now.getHours()).padStart(2, '0') + ':' +
               String(now.getMinutes()).padStart(2, '0') + ':' +
               String(now.getSeconds()).padStart(2, '0');
  const entry = { time, text, level };

  try {
    const data = await chrome.storage.local.get(['logs']);
    const logs = data.logs || [];
    logs.push(entry);
    if (logs.length > 300) logs.shift();

    await chrome.storage.local.set({ logs });
    broadcastMessage({ action: 'LOG_ADDED', entry });
  } catch (err) {
    console.warn('addLog error:', err);
  }
}

async function updateState(partial) {
  try {
    await chrome.storage.local.set(partial);
    broadcastMessage({ action: 'STATE_UPDATED', state: partial });
  } catch (err) {
    console.warn('updateState error:', err);
  }
}

function broadcastMessage(msg) {
  // Gửi tới all open popups/ports
  for (const port of connectedPorts) {
    try {
      port.postMessage(msg);
    } catch {}
  }
  // Gửi runtime broadcast fallback
  try {
    chrome.runtime.sendMessage(msg).catch(() => {});
  } catch {}
}

function setBadge(text, color = '#5865F2') {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  } catch {}
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: message
    });
  } catch {}
}

// Ngủ ngắt được ngay lập tức khi bấm nút Dừng lại (check mỗi 250ms)
async function interruptibleSleep(ms) {
  const step = 250;
  let elapsed = 0;
  while (elapsed < ms && !shouldStop) {
    await new Promise(r => setTimeout(r, Math.min(step, ms - elapsed)));
    elapsed += step;
  }
}

// Pipeline xử lý và lưu trữ token tập trung cho cả 2 engine
async function handleCapturedToken(rawToken, source = 'Unknown') {
  if (!rawToken || typeof rawToken !== 'string') return false;

  let token = rawToken.replace(/^"(.*)"$/, '$1').trim();
  if (token.startsWith('Bearer ')) {
    token = token.substring(7).trim();
  }

  // Token Discord hợp lệ (không phải Bot token và độ dài tối thiểu)
  if (token.startsWith('Bot ') || token.length < 5) {
    return false;
  }

  // Nếu token trùng với token đang hoạt động trong RAM, bỏ qua ngay
  if (token === cachedToken) {
    return true;
  }

  if (isProcessingToken) return false;
  isProcessingToken = true;

  try {
    const stored = await chrome.storage.local.get(['token', 'autoRunEnabled']);
    const isNew = (token !== stored.token);

    cachedToken = token;

    if (isNew) {
      await getActiveLang();
      await chrome.storage.local.set({ token });
      await addLog(msg(`✔ Automatically connected Discord account (${source})!`, `✔ Đã tự động kết nối tài khoản Discord (${source})!`), 'success');
      broadcastMessage({ action: 'STATE_UPDATED', state: { token } });
    }

    if (!isRunning) {
      try {
        await refreshDiscordData(token);
      } catch (err) {
        console.warn('[Sniffer] refreshDiscordData warning:', err);
      }

      const autoRun = stored.autoRunEnabled !== false;
      if (autoRun && !isRunning) {
        await getActiveLang();
        await addLog(msg('⚡ Triggering automatic Quest execution...', '⚡ Kích hoạt chế độ Auto Quests tự động...'), 'info');
        executeQuests(token).catch(err => {
          console.error('[Sniffer] executeQuests error:', err);
        });
      }
    }

    return true;
  } catch (err) {
    console.error('[Sniffer] handleCapturedToken error:', err);
    return false;
  } finally {
    isProcessingToken = false;
  }
}

// Hàm trích xuất token tiêm vào trang Discord (Chạy trong MAIN world của Discord tab - Engine 2)
function extractTokenFromPage() {
  // Strategy 1: localStorage check (legacy & DOM fallback)
  try {
    if (typeof localStorage !== 'undefined') {
      const t1 = localStorage.token;
      if (t1 && typeof t1 === 'string') {
        const clean = t1.replace(/"/g, '').trim();
        if (clean.length > 5 && !clean.startsWith('Bot ')) return clean;
      }
      const t2 = localStorage.getItem('token');
      if (t2 && typeof t2 === 'string') {
        const clean = t2.replace(/"/g, '').trim();
        if (clean.length > 5 && !clean.startsWith('Bot ')) return clean;
      }
    }
  } catch (e) {}

  // Strategy 2: Iframe fallback
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const iframeStorage = iframe.contentWindow?.localStorage;
    const raw = iframeStorage?.token || iframeStorage?.getItem('token');
    document.body.removeChild(iframe);
    if (raw && typeof raw === 'string') {
      const clean = String(raw).replace(/"/g, '').trim();
      if (clean.length > 5 && !clean.startsWith('Bot ')) return clean;
    }
  } catch (e) {}

  // Strategy 3: Webpack 5 Module Cache Hook via webpackChunkdiscord_app
  try {
    let extractedToken = null;
    const chunkId = '__discord_token_extractor_' + Date.now();

    window.webpackChunkdiscord_app?.push([
      [chunkId],
      {},
      (webpackRequire) => {
        if (!webpackRequire || !webpackRequire.c) return;
        const modules = Object.values(webpackRequire.c);

        for (const mod of modules) {
          try {
            const exp = mod?.exports;
            if (!exp || exp === window) continue;

            if (typeof exp.getToken === 'function') {
              const candidate = exp.getToken();
              if (candidate && typeof candidate === 'string' && candidate.length > 40) {
                extractedToken = candidate;
                break;
              }
            }

            if (typeof exp.default?.getToken === 'function') {
              const candidate = exp.default.getToken();
              if (candidate && typeof candidate === 'string' && candidate.length > 40) {
                extractedToken = candidate;
                break;
              }
            }

            for (const key in exp) {
              try {
                const sub = exp[key];
                if (!sub || (typeof sub !== 'object' && typeof sub !== 'function')) continue;
                if (sub[Symbol.toStringTag] === 'IntlMessagesProxy') continue;

                if (typeof sub.getToken === 'function') {
                  const candidate = sub.getToken();
                  if (candidate && typeof candidate === 'string' && candidate.length > 40) {
                    extractedToken = candidate;
                    break;
                  }
                }

                if (typeof sub.getState === 'function') {
                  const stateObj = sub.getState();
                  if (stateObj && typeof stateObj.token === 'string' && stateObj.token.length > 40) {
                    extractedToken = stateObj.token;
                    break;
                  }
                }
              } catch {}
            }

            if (extractedToken) break;
          } catch {}
        }
      }
    ]);

    try {
      window.webpackChunkdiscord_app?.pop();
    } catch {}

    if (extractedToken && typeof extractedToken === 'string') {
      return extractedToken.replace(/"/g, '').trim();
    }
  } catch (e) {}

  return null;
}

// Tự động tìm token từ memory, storage hoặc inject trực tiếp vào tab Discord đang mở
async function getOrExtractToken() {
  if (cachedToken) {
    return cachedToken;
  }

  const data = await chrome.storage.local.get(['token']);
  if (data.token && typeof data.token === 'string' && data.token.trim()) {
    cachedToken = data.token.trim();
    return cachedToken;
  }

  try {
    const tabs = await chrome.tabs.query({});
    const discordTabs = tabs.filter(t => t.id && t.url && (t.url.startsWith('https://discord.com/') || t.url.includes('discord.com')));
    discordTabs.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));

    for (const tab of discordTabs) {
      // 1. Thử gửi message tới content script trước
      try {
        const tokenFromContent = await new Promise(resolve => {
          chrome.tabs.sendMessage(tab.id, { action: 'GET_TOKEN_FROM_PAGE' }, res => {
            if (chrome.runtime.lastError || !res) resolve(null);
            else resolve(res.token);
          });
          setTimeout(() => resolve(null), 300);
        });

        if (tokenFromContent && typeof tokenFromContent === 'string' && tokenFromContent.trim()) {
          const cleanToken = tokenFromContent.trim().replace(/"/g, '');
          await handleCapturedToken(cleanToken, 'Content Script Message');
          return cleanToken;
        }
      } catch {}

      // 2. Thử inject script chạy trong world: 'MAIN' (Webpack + localStorage)
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: extractTokenFromPage
        });
        const token = results?.[0]?.result;
        if (token && typeof token === 'string' && token.trim()) {
          const cleanToken = token.trim().replace(/"/g, '');
          await handleCapturedToken(cleanToken, 'Active Tab Injection (world: MAIN)');
          return cleanToken;
        }
      } catch (e) {
        console.warn('Script injection failed on tab:', tab.id, e);
      }
    }
  } catch (err) {
    console.warn('Could not extract token from tabs:', err);
  }

  return null;
}

// Discord API calls có parse body an toàn và trích xuất Retry-After khi 429
async function apiGet(endpoint, token) {
  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    method: 'GET',
    headers: getHeaders(token)
  });
  if (!res.ok) {
    const errorText = await res.text();
    let retryAfter = null;
    const retryHeader = res.headers?.get?.('retry-after') || res.headers?.get?.('x-ratelimit-reset-after');
    if (retryHeader) {
      retryAfter = parseFloat(retryHeader);
    }
    if (!retryAfter) {
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.retry_after !== undefined) {
          retryAfter = parseFloat(parsed.retry_after);
        }
      } catch {}
    }
    const err = new Error(`GET ${endpoint} failed (${res.status}): ${errorText}`);
    err.status = res.status;
    err.retryAfter = retryAfter;
    throw err;
  }
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

async function apiPost(endpoint, body, token) {
  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errorText = await res.text();
    let retryAfter = null;
    const retryHeader = res.headers?.get?.('retry-after') || res.headers?.get?.('x-ratelimit-reset-after');
    if (retryHeader) {
      retryAfter = parseFloat(retryHeader);
    }
    if (!retryAfter) {
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.retry_after !== undefined) {
          retryAfter = parseFloat(parsed.retry_after);
        }
      } catch {}
    }
    const err = new Error(`POST ${endpoint} failed (${res.status}): ${errorText}`);
    err.status = res.status;
    err.retryAfter = retryAfter;
    throw err;
  }
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

function getQuestTasks(quest) {
  return quest.config?.task_config_v2?.tasks
    || quest.config?.task_config?.tasks
    || quest.config?.taskConfigV2?.tasks
    || {};
}

function detectTaskType(tasks) {
  const priority = [
    TaskType.PLAY_ON_DESKTOP,
    TaskType.WATCH_VIDEO,
    TaskType.WATCH_VIDEO_ON_MOBILE,
    TaskType.STREAM_ON_DESKTOP,
    TaskType.PLAY_ACTIVITY,
    TaskType.PLAY_ON_XBOX,
    TaskType.PLAY_ON_PLAYSTATION
  ];
  return priority.find(t => tasks[t] != null) || Object.keys(tasks)[0] || null;
}

function getQuestDetails(quest) {
  const tasks = getQuestTasks(quest);
  const taskType = detectTaskType(tasks);

  const target = taskType && tasks[taskType]?.target ? tasks[taskType].target : 900;
  const currentProgress = taskType && quest.user_status?.progress?.[taskType]?.value
    ? quest.user_status.progress[taskType].value
    : 0;

  let rewardLabel = 'Phần thưởng';
  const rewards = quest.config?.rewards_config?.rewards;
  if (rewards && rewards.length > 0) {
    if (rewards[0].orb_quantity) {
      rewardLabel = `${rewards[0].orb_quantity} Orbs`;
    } else if (rewards[0].messages?.name) {
      rewardLabel = rewards[0].messages.name;
    }
  }

  const name = quest.config?.messages?.quest_name?.trim() || quest.id;

  let appId = tasks[taskType]?.applications?.[0]?.id || quest.config?.application?.id;
  if (!appId && tasks) {
    for (const t of Object.values(tasks)) {
      if (t?.applications?.[0]?.id) {
        appId = t.applications[0].id;
        break;
      }
    }
  }

  return { taskType, target, currentProgress, rewardLabel, name, tasks, appId };
}

// Đồng bộ và làm mới dữ liệu người dùng & nhiệm vụ từ Discord API (có debounce / lock)
async function refreshDiscordData(token) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      if (!token) {
        token = await getOrExtractToken();
      }
      if (!token) {
        throw new Error('Chưa tìm thấy token Discord. Hãy mở tab discord.com hoặc nhập token thủ công!');
      }

      await registerNetRules();

      const user = await apiGet('/users/@me', token);
      let orbs = null;
      try {
        const bal = await apiGet('/users/@me/virtual-currency/balance', token);
        orbs = bal.balance;
      } catch (e) {
        console.warn('Could not fetch balance:', e);
      }

      const questRes = await apiGet('/quests/@me', token);
      const rawQuests = questRes.quests || [];

      // Tự động nhận thưởng cho những nhiệm vụ đã hoàn thành nhưng chưa claim (bỏ qua quest lỗi 1412491570820812933)
      const claimable = rawQuests.filter(q => q.id !== '1412491570820812933' && q.user_status?.completed_at && !q.user_status?.claimed_at);
      for (const q of claimable) {
        try {
          await apiPost(`/quests/${q.id}/claim-reward`, {}, token);
          q.user_status.claimed_at = new Date().toISOString();
          await addLog(msg(`★ Auto-claimed reward: ${q.config?.messages?.quest_name || q.id}`, `★ Tự động nhận thưởng: ${q.config?.messages?.quest_name || q.id}`), 'success');
        } catch (e) {
          console.warn('Auto-claim error:', e);
        }
      }

      const nowTime = Date.now();
      const questItems = rawQuests.map(q => {
        const details = getQuestDetails(q);
        const isCompleted = Boolean(q.user_status?.completed_at);
        const isClaimed = Boolean(q.user_status?.claimed_at);
        const isExp = new Date(q.config.expires_at).getTime() <= nowTime;

        let state = 'waiting';
        if (isClaimed) state = 'claimed';
        else if (isCompleted) state = 'done';
        else if (isExp) state = 'expired';

        let progress = details.currentProgress;
        let countdown = Math.max(0, details.target - progress);

        // Giữ trạng thái đang chạy và tiến độ live nếu process đang chạy quest này
        if (isRunning && currentQuests.length > 0) {
          const live = currentQuests.find(c => c.id === q.id);
          if (live && live.state === 'running') {
            state = 'running';
            if (live.progress > progress) {
              progress = live.progress;
              countdown = live.countdown;
            }
          }
        }

        return {
          id: q.id,
          name: details.name,
          taskType: details.taskType,
          reward: details.rewardLabel,
          target: details.target,
          progress,
          countdown,
          state,
          raw: q
        };
      });

      // Ưu tiên hiển thị quest active lên trước
      questItems.sort((a, b) => {
        const score = (s) => (s === 'running' ? 0 : s === 'waiting' ? 1 : s === 'done' ? 2 : s === 'claimed' ? 3 : 4);
        return score(a.state) - score(b.state);
      });

      currentQuests = questItems;
      const stateData = {
        user,
        orbs,
        quests: questItems,
        lastSync: Date.now()
      };

      await updateState(stateData);
      return stateData;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Bắt đầu / dừng Ticker đếm ngược 1s thời gian thực
function startLiveTicker() {
  if (liveTicker) clearInterval(liveTicker);
  liveTicker = setInterval(() => {
    if (!isRunning) {
      clearInterval(liveTicker);
      liveTicker = null;
      return;
    }
    let hasRunning = false;
    for (const q of currentQuests) {
      if (q.state === 'running' && q.countdown > 0) {
        hasRunning = true;
        q.countdown = Math.max(0, q.countdown - 1);
        q.progress = Math.min(q.target, q.target - q.countdown);
      }
    }
    if (hasRunning) {
      broadcastMessage({
        action: 'STATE_UPDATED',
        state: { quests: currentQuests, isRunning: true, isStopping: shouldStop }
      });
    }
  }, 1000);
}

function stopLiveTicker() {
  if (liveTicker) {
    clearInterval(liveTicker);
    liveTicker = null;
  }
}

// Thực thi một nhiệm vụ đơn lẻ (được gọi đồng thời trong Promise.allSettled để chạy song song)
async function executeSingleQuest(item, index, total, token) {
  if (shouldStop) {
    item.state = 'waiting';
    await updateState({ quests: currentQuests });
    return;
  }

  const quest = item.raw;
  const details = getQuestDetails(quest);

  item.state = 'running';
  await updateState({ quests: currentQuests });
  await addLog(msg(`[${index + 1}/${total}] Processing: ${item.name} (${item.reward})`, `[${index + 1}/${total}] Đang xử lý: ${item.name} (${item.reward})`));

  // Bước 1: Enroll nếu chưa tham gia
  if (!quest.user_status?.enrolled_at) {
    try {
      await addLog(msg(`Enrolling quest: ${item.name}...`, `Đang ghi danh (enroll) quest: ${item.name}...`));
      const enrollRes = await apiPost(`/quests/${item.id}/enroll`, {
        location: 11,
        is_targeted: false,
        metadata_raw: null
      }, token);
      quest.user_status = enrollRes;
      await addLog(msg('✔ Enrolled successfully!', '✔ Đã ghi danh thành công!'), 'success');
    } catch (e) {
      await addLog(msg(`✖ Enrollment failed: ${e.message}`, `✖ Ghi danh thất bại: ${e.message}`), 'error');
      item.state = 'failed';
      await updateState({ quests: currentQuests });
      return;
    }
  }

  const taskType = details.taskType;
  const target = details.target;
  let done = details.currentProgress;
  item.progress = done;
  item.countdown = Math.max(0, target - done);
  await updateState({ quests: currentQuests });

  let success = false;

  if (taskType === TaskType.WATCH_VIDEO || taskType === TaskType.WATCH_VIDEO_ON_MOBILE) {
    await addLog(msg(`🎬 Starting video watch (${target}s)...`, `🎬 Bắt đầu xem video (${target}s)...`));
    const enrolledAt = new Date(quest.user_status?.enrolled_at || Date.now()).getTime();

    while (done < target && !shouldStop) {
      const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + 10;
      const diff = maxAllowed - done;
      const next = Math.min(target, done + 7);

      if (diff >= 7) {
        try {
          const res = await apiPost(`/quests/${item.id}/video-progress`, {
            timestamp: Math.min(target, next + Math.random())
          }, token);
          quest.user_status = res;
          done = next;
          item.progress = done;
          item.countdown = Math.max(0, target - done);
          await updateState({ quests: currentQuests });

          if (res?.completed_at || done >= target) {
            success = true;
            break;
          }
        } catch (e) {
          await addLog(msg(`Video progress error: ${e.message}`, `Lỗi gửi tiến độ video: ${e.message}`), 'warn');
          if (e.status === 429 || (e.message && e.message.includes('429'))) {
            let waitSec = 5;
            if (e.retryAfter) waitSec = Math.ceil(e.retryAfter);
            await addLog(msg(`⏳ Rate limited (429). Pausing for ${waitSec}s...`, `⏳ Đang bị giới hạn tần suất (Rate limit 429). Tạm dừng ${waitSec}s...`), 'warn');
            await interruptibleSleep(waitSec * 1000);
            continue;
          }
          break;
        }
      }
      await interruptibleSleep(1000);
    }

    if (!success && !shouldStop && done >= target) {
      try {
        await apiPost(`/quests/${item.id}/video-progress`, { timestamp: target }, token);
        success = true;
      } catch {}
    }
  } else if (taskType === TaskType.PLAY_ON_DESKTOP) {
    await addLog(msg(`🎮 Starting game play quest (${target}s, heartbeat every 60s)...`, `🎮 Bắt đầu chạy nhiệm vụ chơi game (${target}s, heartbeat mỗi 60s)...`));
    const appId = details.appId;
    if (!appId) {
      await addLog(msg(`✖ Application ID not found for quest ${item.name}`, `✖ Không tìm thấy Application ID cho quest ${item.name}`), 'error');
      item.state = 'failed';
      await updateState({ quests: currentQuests });
      return;
    }

    // Vòng lặp gửi heartbeat cho đến khi hoàn thành
    while (!quest.user_status?.completed_at && !shouldStop && item.countdown > 0) {
      try {
        const res = await apiPost(`/quests/${item.id}/heartbeat`, {
          application_id: appId,
          terminal: false
        }, token);
        quest.user_status = res;

        const discordVal = res?.progress?.[taskType]?.value;
        if (typeof discordVal === 'number') {
          done = discordVal;
        } else {
          done = Math.min(target, done + 60);
        }
        item.progress = done;
        item.countdown = Math.max(0, target - done);
        await updateState({ quests: currentQuests });
        await addLog(msg(`[${item.name}] Heartbeat OK. Progress: ${done}/${target}s (${Math.round((done / target) * 100)}%)`, `[${item.name}] Heartbeat OK. Tiến độ: ${done}/${target}s (${Math.round((done / target) * 100)}%)`));

        if (res?.completed_at || done >= target) {
          success = true;
          break;
        }
      } catch (e) {
        if (e.status === 429 || (e.message && e.message.includes('429'))) {
          let waitSec = 5;
          if (e.retryAfter) waitSec = Math.ceil(e.retryAfter);
          await addLog(msg(`⏳ Rate limited (429). Pausing for ${waitSec}s...`, `⏳ Đang bị giới hạn tần suất (Rate limit 429). Tạm dừng ${waitSec}s...`), 'warn');
          await interruptibleSleep(waitSec * 1000);
          continue;
        }
        await addLog(msg(`Heartbeat error: ${e.message}`, `Lỗi gửi heartbeat: ${e.message}`), 'warn');
      }

      // Đợi ~60s cho heartbeat kế tiếp (check ngắt mỗi 250ms khi bấm nút dừng)
      let waitSec = 60;
      while (waitSec > 0 && !shouldStop && item.countdown > 0) {
        if (waitSec % 20 === 0) {
          try { if (chrome.runtime.getPlatformInfo) chrome.runtime.getPlatformInfo(); } catch {}
        }
        await interruptibleSleep(1000);
        waitSec--;
      }
    }

    // Heartbeat kết thúc (terminal: true)
    if ((success || item.countdown <= 0) && !shouldStop) {
      try {
        const termRes = await apiPost(`/quests/${item.id}/heartbeat`, {
          application_id: appId,
          terminal: true
        }, token);
        quest.user_status = termRes;
        success = true;
      } catch (err) {
        console.warn('Terminal heartbeat error:', err);
      }
    }
  } else {
    await addLog(msg(`Quest type [${taskType}] is not supported for browser automation. Skipping.`, `Loại nhiệm vụ [${taskType}] chưa hỗ trợ tự động trên trình duyệt. Bỏ qua.`), 'warn');
    item.state = 'skipped';
    await updateState({ quests: currentQuests });
    return;
  }

  // Bước 3: Claim thưởng nếu thành công
  if (success && !shouldStop) {
    item.state = 'done';
    item.countdown = 0;
    item.progress = target;
    await updateState({ quests: currentQuests });
    await addLog(msg(`✔ Completed quest: ${item.name}! Claiming reward...`, `✔ Đã hoàn thành nhiệm vụ: ${item.name}! Đang nhận thưởng...`), 'success');

    try {
      await apiPost(`/quests/${item.id}/claim-reward`, {}, token);
      item.state = 'claimed';
      await updateState({ quests: currentQuests });
      await addLog(msg(`★ Reward claimed successfully: ${item.reward}!`, `★ Nhận thưởng thành công: ${item.reward}!`), 'success');
    } catch (e) {
      await addLog(msg(`✖ Reward claiming failed: ${e.message}`, `✖ Nhận thưởng thất bại: ${e.message}`), 'warn');
    }
  } else if (shouldStop) {
    item.state = 'waiting';
    await updateState({ quests: currentQuests });
  } else {
    item.state = 'failed';
    await updateState({ quests: currentQuests });
    await addLog(msg(`✖ Quest ${item.name} could not be completed.`, `✖ Nhiệm vụ ${item.name} chưa thể hoàn thành.`), 'error');
  }
}

// Runner chính thực thi quests (hỗ trợ cả chạy toàn bộ lẫn chạy nhiệm vụ đơn lẻ)
async function executeQuests(token, targetQuestId = null) {
  await getActiveLang();
  if (isRunning) {
    await addLog(msg('Process is running, please wait...', 'Quá trình đang chạy, vui lòng chờ...'), 'warn');
    return;
  }

  isRunning = true;
  shouldStop = false;
  currentActiveQuestId = targetQuestId || null;
  setBadge('RUN', '#0984E3');
  await updateState({
    isRunning: true,
    isStopping: false,
    activeQuestId: currentActiveQuestId,
    runnerState: {
      ...DEFAULT_RUNNER_STATE,
      status: 'RUNNING',
      activeQuestId: currentActiveQuestId
    }
  });

  await registerNetRules();

  // Thiết lập alarm định kỳ 1 phút để giữ service worker luôn thức trong suốt quá trình chạy
  try {
    chrome.alarms.create('quest_keep_alive', { periodInMinutes: 1 });
  } catch {}

  startLiveTicker();

  try {
    if (targetQuestId) {
      await addLog(msg(`⚡ Starting single quest execution (ID: ${targetQuestId})...`, `⚡ Khởi động tiến trình làm nhiệm vụ đơn lẻ (ID: ${targetQuestId})...`));
    } else {
      await addLog(msg('⚡ Starting Discord Auto Quests process...', '⚡ Khởi động tiến trình Discord Auto Quests...'));
    }
    const data = await refreshDiscordData(token);
    const user = data.user;
    await addLog(msg(`Logged in successfully: ${user.username} (ID: ${user.id})`, `Đăng nhập thành công: ${user.username} (ID: ${user.id})`));

    if (data.orbs !== null && data.orbs !== undefined) {
      await addLog(msg(`Current Orbs balance: 🔮 ${data.orbs}`, `Số Orbs hiện tại: 🔮 ${data.orbs}`));
    }

    const nowTime = Date.now();
    // Lọc các quest chưa hoàn thành và còn hạn (loại trừ quest lỗi 1412491570820812933)
    let pending = currentQuests.filter(q =>
      q.id !== '1412491570820812933' &&
      (targetQuestId ? q.id === targetQuestId : true) &&
      (q.state === 'waiting' || q.state === 'running' || (targetQuestId && q.id === targetQuestId && q.state !== 'done' && q.state !== 'claimed')) &&
      new Date(q.raw?.config?.expires_at || 0).getTime() > nowTime
    );

    if (pending.length === 0) {
      if (targetQuestId) {
        await addLog(msg(`✨ Quest ${targetQuestId} is not available or already completed.`, `✨ Nhiệm vụ ${targetQuestId} không khả dụng hoặc đã hoàn thành.`), 'info');
        notify('Discord Auto Quests', msg(`Quest ${targetQuestId} already completed or unavailable.`, `Nhiệm vụ ${targetQuestId} đã hoàn thành hoặc không khả dụng.`));
      } else {
        await addLog(msg('✨ No active quests remaining. All caught up!', '✨ Không có nhiệm vụ nào cần làm. Bạn đã hoàn tất hết!'), 'success');
        setBadge('DONE', '#00B894');
        notify('Discord Auto Quests', msg('No active quests pending. All done!', 'Không có nhiệm vụ nào đang chờ. Tất cả đã hoàn tất!'));
      }
      return;
    }

    if (targetQuestId) {
      await addLog(msg(`Starting execution for quest: ${pending[0].name}...`, `Bắt đầu thực hiện nhiệm vụ: ${pending[0].name}...`));
    } else {
      await addLog(msg(`Found ${pending.length} quests — running all in parallel...`, `Tìm thấy ${pending.length} nhiệm vụ — chạy song song tất cả...`));
    }

    await updateState({
      quests: currentQuests,
      runnerState: {
        ...DEFAULT_RUNNER_STATE,
        status: 'RUNNING',
        activeQuestId: targetQuestId || null,
        currentQueueIndex: 0
      }
    });

    await Promise.allSettled(
      pending.map((item, i) => executeSingleQuest(item, i, pending.length, token))
    );

    if (shouldStop) {
      await addLog(msg('⏹ Execution stopped as requested.', '⏹ Đã dừng thực thi theo yêu cầu của bạn.'), 'warn');
      setBadge('', '#5865F2');
    } else {
      // Cập nhật lại số Orbs tổng kết
      try {
        const finalBal = await apiGet('/users/@me/virtual-currency/balance', token);
        await updateState({ orbs: finalBal.balance });
        await addLog(msg(`Final Orbs balance: 🔮 ${finalBal.balance}`, `Tổng kết số Orbs hiện tại: 🔮 ${finalBal.balance}`), 'success');
        notify('Discord Auto Quests', msg(`All quests processed! Current Orbs: ${finalBal.balance}`, `Đã xử lý xong các nhiệm vụ! Orbs hiện tại: ${finalBal.balance}`));
      } catch {}

      setBadge('DONE', '#00B894');
      if (targetQuestId) {
        await addLog(msg(`🎉 Single quest ${pending[0]?.name || targetQuestId} processed!`, `🎉 Đã xử lý xong nhiệm vụ ${pending[0]?.name || targetQuestId}!`), 'success');
      } else {
        await addLog(msg('🎉 All available quests have been processed!', '🎉 Tất cả nhiệm vụ khả dụng đã được xử lý xong!'), 'success');
      }
    }
  } catch (err) {
    await addLog(msg(`Execution error: ${err.message}`, `Lỗi tiến trình: ${err.message}`), 'error');
    setBadge('ERR', '#D63031');
  } finally {
    stopLiveTicker();
    try {
      chrome.alarms.clear('quest_keep_alive');
    } catch {}

    // Dọn dẹp trạng thái quest: bất kỳ quest nào còn 'running' đều trả về 'waiting'
    for (const q of currentQuests) {
      if (q.state === 'running') {
        q.state = 'waiting';
      }
    }

    currentActiveQuestId = null;
    isRunning = false;
    shouldStop = false;
    await updateState({
      isRunning: false,
      isStopping: false,
      activeQuestId: null,
      quests: currentQuests,
      lastRunTime: Date.now(),
      runnerState: {
        ...DEFAULT_RUNNER_STATE,
        status: 'IDLE'
      }
    });
  }
}

// Bắt sự kiện tabs.onUpdated trên discord.com
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('https://discord.com/') || tab.url.includes('discord.com'))) {
    const config = await chrome.storage.local.get(['autoRunEnabled', 'token']);
    const autoRun = config.autoRunEnabled !== false;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: extractTokenFromPage
      });

      const extractedToken = results?.[0]?.result;
      if (extractedToken && typeof extractedToken === 'string' && extractedToken.trim()) {
        const cleanToken = extractedToken.trim().replace(/"/g, '');
        const prevToken = config.token;

        if (cleanToken !== prevToken) {
          await getActiveLang();
          await chrome.storage.local.set({ token: cleanToken });
          cachedToken = cleanToken;
          await addLog(msg('✔ Recognized Discord account from open tab!', '✔ Đã tự động nhận diện tài khoản Discord từ tab đang mở!'));
        }

        // Chỉ refresh ngầm và kích hoạt auto-run nếu runner KHÔNG ĐANG CHẠY
        if (!isRunning) {
          try {
            await refreshDiscordData(cleanToken);
          } catch {}

          if (autoRun && !isRunning) {
            await getActiveLang();
            await addLog(msg('⚡ Triggering automatic Quest execution...', '⚡ Kích hoạt chế độ Auto Quests tự động...'));
            executeQuests(cleanToken);
          }
        }
      }
    } catch (err) {
      console.warn('Could not inject token extraction script:', err);
    }
  }
});

// Giữ Service Worker tỉnh táo khi có kết nối từ Popup UI
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    connectedPorts.add(port);
    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port);
    });
  }
});

// Chrome alarms listener: giữ Service Worker và phục hồi tiến trình nếu bị gián đoạn
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'quest_keep_alive' || alarm.name === 'quest_heartbeat_tick') {
    try {
      if (chrome.runtime.getPlatformInfo) {
        await chrome.runtime.getPlatformInfo();
      }
    } catch {}

    const token = await getOrExtractToken();
    if (!token) return;

    const stored = await chrome.storage.local.get(['isRunning', 'runnerState']);
    if (!stored.isRunning && stored.runnerState?.status !== 'RUNNING') {
      return;
    }

    if (!isRunning) {
      executeQuests(token).catch(err => {
        console.error('[Alarm] Resume executeQuests error:', err);
      });
    }
  }
});

// Lắng nghe messages từ Popup UI hoặc Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_STATE') {
    chrome.storage.local.get(['token', 'user', 'orbs', 'quests', 'logs', 'autoRunEnabled', 'runnerState']).then(data => {
      sendResponse({
        token: data.token || null,
        user: data.user || null,
        quests: data.quests || [],
        logs: data.logs || [],
        settings: {
          autoStart: data.autoRunEnabled !== false,
          autoClaim: true,
          excludedQuestIds: ['1412491570820812933']
        },
        runningState: {
          isRunning,
          activeQuestId: currentActiveQuestId,
          currentProgressSeconds: 0,
          targetSeconds: 900
        }
      });
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.action === 'START_QUESTS') {
    getOrExtractToken().then(token => {
      if (token) {
        executeQuests(token);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: msg('No token found. Please open discord.com or enter token manually!', 'Chưa có token. Hãy mở tab discord.com hoặc nhập token thủ công!') });
      }
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'STOP_QUESTS') {
    shouldStop = true;
    updateState({ isStopping: true });
    addLog(msg('⏹ Requesting stop...', '⏹ Đang yêu cầu dừng tiến trình...'), 'warn');
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'CLEAR_DATA') {
    cachedToken = null;
    chrome.storage.local.set({
      token: null,
      user: null,
      orbs: null,
      quests: [],
      logs: [],
      runnerState: { ...DEFAULT_RUNNER_STATE }
    }).then(() => {
      broadcastMessage({ action: 'STATE_UPDATED', state: { token: null, user: null, quests: [], logs: [] } });
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'TOGGLE_AUTO') {
    const enabled = Boolean(message.enabled);
    chrome.storage.local.set({ autoRunEnabled: enabled }).then(() => {
      sendResponse({ success: true, autoRunEnabled: enabled });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'TOKEN_EXTRACTED') {
    const rawToken = message.token?.trim().replace(/"/g, '');
    if (rawToken && rawToken.length > 5) {
      handleCapturedToken(rawToken, 'Content Script Message');
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'EXTRACT_TOKEN_NOW') {
    getOrExtractToken().then(async (token) => {
      if (token) {
        try {
          const stateData = await refreshDiscordData(token);
          sendResponse({ success: true, token, state: stateData });
        } catch (err) {
          sendResponse({ success: true, token, error: err.message });
        }
      } else {
        sendResponse({ success: false, error: msg('No token found in Discord tab. Please make sure you are logged into discord.com!', 'Chưa tìm thấy token trong tab Discord. Hãy đảm bảo bạn đã đăng nhập discord.com!') });
      }
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'GET_RUN_STATE') {
    sendResponse({
      isRunning,
      isStopping: shouldStop,
      activeQuestId: currentActiveQuestId
    });
    return false;
  }

  if (message.action === 'START_RUN') {
    getOrExtractToken().then(token => {
      if (token) {
        executeQuests(token);
        sendResponse({ success: true });
      } else {
        sendResponse({
          success: false,
          error: msg('No token found. Please open discord.com or enter token manually!', 'Chưa có token. Hãy mở tab discord.com hoặc nhập token thủ công!')
        });
      }
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'START_SINGLE_QUEST') {
    const questId = message.questId;
    if (!questId) {
      sendResponse({
        success: false,
        error: msg('Quest ID is required.', 'Cần có ID nhiệm vụ.')
      });
      return true;
    }
    getOrExtractToken().then(token => {
      if (token) {
        executeQuests(token, questId);
        sendResponse({ success: true, questId });
      } else {
        sendResponse({
          success: false,
          error: msg('No token found. Please open discord.com or enter token manually!', 'Chưa có token. Hãy mở tab discord.com hoặc nhập token thủ công!')
        });
      }
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'STOP_RUN') {
    shouldStop = true;
    updateState({ isStopping: true });
    addLog(msg('⏹ Requesting stop...', '⏹ Đang yêu cầu dừng tiến trình...'), 'warn');
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'REFRESH_DATA') {
    getOrExtractToken().then(token => {
      if (!token) {
        sendResponse({
          success: false,
          error: msg('No token found. Please open discord.com or enter token manually!', 'Chưa có token. Hãy mở tab discord.com hoặc nhập token thủ công!')
        });
        return;
      }
      refreshDiscordData(token).then(stateData => {
        addLog(msg('🔄 Refreshed data from Discord!', '🔄 Đã làm mới dữ liệu từ Discord!'));
        sendResponse({ success: true, state: stateData });
      }).catch(err => {
        addLog(msg(`Refresh error: ${err.message}`, `Lỗi làm mới: ${err.message}`), 'error');
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'SET_TOKEN') {
    const rawToken = message.token?.trim();
    if (!rawToken) {
      sendResponse({ success: false, error: msg('Token cannot be empty.', 'Token không được để trống.') });
      return true;
    }

    cachedToken = rawToken;
    chrome.storage.local.set({ token: rawToken }).then(() => {
      refreshDiscordData(rawToken).then(stateData => {
        addLog(msg('✔ Saved and connected token manually!', '✔ Đã lưu và kết nối token thủ công thành công!'), 'success');
        sendResponse({ success: true, state: stateData });
      }).catch(err => {
        addLog(msg(`Invalid token or Discord error: ${err.message}`, `Token không hợp lệ hoặc lỗi Discord: ${err.message}`), 'error');
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'CLEAR_LOGS') {
    chrome.storage.local.set({ logs: [] }).then(() => {
      broadcastMessage({ action: 'LOGS_CLEARED' });
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

// Khởi tạo thiết lập ban đầu
chrome.runtime.onInstalled.addListener(async () => {
  await registerNetRules();
  setupPassiveTokenSniffer();
  const current = await chrome.storage.local.get(['autoRunEnabled', 'logs', 'runnerState']);
  if (current.autoRunEnabled === undefined) {
    await chrome.storage.local.set({
      autoRunEnabled: true,
      logs: [],
      runnerState: { ...DEFAULT_RUNNER_STATE }
    });
  }
  await addLog(msg('Discord Auto Quests Extension is ready!', 'Discord Auto Quests Extension đã sẵn sàng hoạt động!'));
  getOrExtractToken().then(t => {
    if (t) refreshDiscordData(t).catch(() => {});
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await registerNetRules();
  setupPassiveTokenSniffer();
  const stored = await chrome.storage.local.get(['isRunning', 'runnerState', 'token']);
  if (stored.isRunning || stored.runnerState?.status === 'RUNNING') {
    await addLog(msg('🔄 Detected unfinished run after browser restart. Resuming...', '🔄 Phát hiện tiến trình chưa hoàn tất sau khi khởi động lại trình duyệt. Đang tiếp tục...'));
    if (stored.token) {
      executeQuests(stored.token).catch(() => {});
    }
  } else {
    getOrExtractToken().then(t => {
      if (t) refreshDiscordData(t).catch(() => {});
    });
  }
});
