// Discord Auto Quests - Popup Script (v2.3)

// i18n Translations Dictionary (Default: English)
const TRANSLATIONS = {
  en: {
    appTitle: 'Auto Quests',
    subtitle: 'PTK Tool • v2.3 by PTKhoa',
    autoRunTitle: 'Auto-run when opening discord.com',
    autoRun: 'Auto',
    notConnected: 'Not connected',
    orbsCount: '-- Orbs',
    tokenLabel: '🔑 Token:',
    noToken: 'No token set',
    extractTabBtn: '📥 From Tab',
    changeToken: 'Change',
    closeToken: 'Close',
    tokenPlaceholder: 'Paste Discord token (or open discord.com)',
    saveBtn: 'Save',
    startNow: 'Start Now',
    stop: 'Stop',
    stopping: 'Stopping...',
    starting: 'Starting...',
    refreshTitle: 'Refresh data from Discord',
    clearLogsTitle: 'Clear logs',
    questsTab: 'Quests',
    logsTab: 'Logs',
    emptyQuestsAllDoneStrong: 'Great job!',
    emptyQuestsAllDoneText: 'You have no active quests remaining.',
    emptyQuestsNoAuthText: 'Open a <strong>discord.com</strong> tab or click below to sync token automatically:',
    syncTokenTabBtn: '📥 Get Token from Discord Tab',
    ready: 'Ready',
    running: 'Running...',
    refreshing: 'Refreshing...',
    progress: 'Progress',
    remaining: 'remaining',
    done: 'Done',
    waiting: 'Waiting',
    claimed: 'Claimed',
    expired: 'Expired',
    failed: 'Failed',
    skipped: 'Skipped',
    runSingleQuest: 'Run',
    toastStartSingleSuccess: 'Quest started!',
    toastAlreadyRunning: 'A process is currently running!',
    footerAuthor: 'PTK Tool by PTKhoa',
    toastAutoEnabled: 'Auto-run enabled when opening Discord.',
    toastAutoDisabled: 'Auto-run disabled.',
    toastStopRequested: 'Requesting stop...',
    toastStartSuccess: 'Quest execution started!',
    toastWorkerError: 'Worker connection error:',
    toastRefreshSuccess: 'Refreshed data from Discord successfully!',
    toastRefreshFailed: 'Failed to refresh:',
    toastLogsCleared: 'All logs cleared.',
    toastTokenSaved: 'Discord account connected successfully!',
    toastTokenInvalid: 'Please enter a valid Discord token.',
    toastTokenExtracted: '✔ Successfully synced token from Discord tab!',
    toastNoDiscordTab: 'No Discord tab found. Please open discord.com first!',
    alertNoDiscordTab: 'Please open https://discord.com and log in before extracting token!',
    toastNoTokenFound: 'No token found in Discord tab. Please make sure you are logged in!',
    toastExtractFailed: 'Failed to extract token from Discord tab.',
    alertNoTokenToRun: 'Please connect a Discord account or open discord.com first!'
  },
  vi: {
    appTitle: 'Auto Quests',
    subtitle: 'PTK Tool • v2.3 by PTKhoa',
    autoRunTitle: 'Tự động chạy khi mở tab discord.com',
    autoRun: 'Tự động',
    notConnected: 'Chưa kết nối',
    orbsCount: '-- Orbs',
    tokenLabel: '🔑 Token:',
    noToken: 'Chưa có token',
    extractTabBtn: '📥 Lấy từ tab',
    changeToken: 'Đổi',
    closeToken: 'Đóng',
    tokenPlaceholder: 'Dán token Discord (hoặc mở tab discord.com)',
    saveBtn: 'Lưu',
    startNow: 'Chạy ngay',
    stop: 'Dừng lại',
    stopping: 'Đang dừng...',
    starting: 'Đang khởi động...',
    refreshTitle: 'Làm mới dữ liệu từ Discord',
    clearLogsTitle: 'Xóa nhật ký',
    questsTab: 'Nhiệm vụ',
    logsTab: 'Nhật ký (Logs)',
    emptyQuestsAllDoneStrong: 'Tuyệt vời!',
    emptyQuestsAllDoneText: 'Bạn không còn nhiệm vụ nào cần làm.',
    emptyQuestsNoAuthText: 'Mở tab <strong>discord.com</strong> hoặc bấm nút bên dưới để lấy token tự động:',
    syncTokenTabBtn: '📥 Lấy Token từ tab Discord',
    ready: 'Sẵn sàng',
    running: 'Đang chạy...',
    refreshing: 'Đang làm mới...',
    progress: 'Tiến độ',
    remaining: 'còn lại',
    done: 'Đã xong',
    waiting: 'Đang chờ',
    claimed: 'Đã nhận',
    expired: 'Hết hạn',
    failed: 'Thất bại',
    skipped: 'Bỏ qua',
    runSingleQuest: 'Làm',
    toastStartSingleSuccess: 'Đã bắt đầu làm nhiệm vụ!',
    toastAlreadyRunning: 'Tiến trình nhiệm vụ đang chạy, vui lòng chờ!',
    footerAuthor: 'PTK Tool by PTKhoa',
    toastAutoEnabled: 'Đã bật tự động làm nhiệm vụ khi mở Discord.',
    toastAutoDisabled: 'Đã tắt chế độ tự động.',
    toastStopRequested: 'Đang yêu cầu dừng tiến trình...',
    toastStartSuccess: 'Đã bắt đầu tiến trình thực thi nhiệm vụ!',
    toastWorkerError: 'Lỗi kết nối worker:',
    toastRefreshSuccess: 'Đã làm mới dữ liệu từ Discord thành công!',
    toastRefreshFailed: 'Không thể làm mới:',
    toastLogsCleared: 'Đã xóa toàn bộ nhật ký.',
    toastTokenSaved: 'Kết nối tài khoản Discord thành công!',
    toastTokenInvalid: 'Vui lòng dán token Discord hợp lệ.',
    toastTokenExtracted: '✔ Đã tự động kết nối tài khoản Discord từ tab!',
    toastNoDiscordTab: 'Chưa mở tab Discord. Hãy mở discord.com trước!',
    alertNoDiscordTab: 'Vui lòng mở tab https://discord.com và đăng nhập trước khi lấy token!',
    toastNoTokenFound: 'Chưa tìm thấy token trong tab Discord. Hãy đăng nhập tài khoản!',
    toastExtractFailed: 'Không thể trích xuất token từ tab Discord.',
    alertNoTokenToRun: 'Vui lòng kết nối tài khoản Discord hoặc mở tab discord.com trước!'
  }
};

// Log string translations between English and Vietnamese
const LOG_TRANSLATIONS = [
  { vi: 'Khởi động tiến trình Discord Auto Quests...', en: 'Starting Discord Auto Quests process...' },
  { vi: 'Khởi động tiến trình làm nhiệm vụ đơn lẻ', en: 'Starting single quest execution' },
  { vi: 'Bắt đầu thực hiện nhiệm vụ:', en: 'Starting execution for quest:' },
  { vi: 'Tìm thấy nhiệm vụ:', en: 'Found quest:' },
  { vi: 'không khả dụng hoặc đã hoàn thành.', en: 'is not available or already completed.' },
  { vi: 'Đã xử lý xong nhiệm vụ', en: 'Single quest' },
  { vi: 'Discord Auto Quests Extension đã sẵn sàng hoạt động!', en: 'Discord Auto Quests Extension is ready!' },
  { vi: 'Phát hiện tiến trình chưa hoàn tất sau khi khởi động lại trình duyệt. Đang tiếp tục...', en: 'Detected unfinished run after browser restart. Resuming...' },
  { vi: 'Kích hoạt chế độ Auto Quests tự động...', en: 'Triggering automatic Quest execution...' },
  { vi: 'Đã tự động kết nối tài khoản Discord', en: 'Automatically connected Discord account' },
  { vi: 'Đã tự động nhận diện tài khoản Discord từ tab đang mở!', en: 'Recognized Discord account from open tab!' },
  { vi: 'Đăng nhập thành công:', en: 'Logged in successfully:' },
  { vi: 'Số Orbs hiện tại:', en: 'Current Orbs balance:' },
  { vi: 'Tổng kết số Orbs hiện tại:', en: 'Final Orbs balance:' },
  { vi: 'Không có nhiệm vụ nào cần làm. Bạn đã hoàn tất hết!', en: 'No active quests remaining. All caught up!' },
  { vi: 'nhiệm vụ — chạy song song tất cả...', en: 'quests — running all in parallel...' },
  { vi: 'Tìm thấy', en: 'Found' },
  { vi: 'Đang xử lý:', en: 'Processing:' },
  { vi: 'Đang ghi danh (enroll) quest:', en: 'Enrolling quest:' },
  { vi: 'Đã ghi danh thành công!', en: 'Enrolled successfully!' },
  { vi: 'Ghi danh thất bại:', en: 'Enrollment failed:' },
  { vi: 'Bắt đầu xem video', en: 'Starting video watch' },
  { vi: 'Lỗi gửi tiến độ video:', en: 'Video progress error:' },
  { vi: 'Đang bị giới hạn tần suất (Rate limit 429). Tạm dừng', en: 'Rate limited (429). Pausing for' },
  { vi: 'Bắt đầu chạy nhiệm vụ chơi game', en: 'Starting game play quest' },
  { vi: 'heartbeat mỗi 60s', en: 'heartbeat every 60s' },
  { vi: 'Không tìm thấy Application ID cho quest', en: 'Application ID not found for quest' },
  { vi: 'Tiến độ:', en: 'Progress:' },
  { vi: 'còn lại', en: 'remaining' },
  { vi: 'Lỗi gửi heartbeat:', en: 'Heartbeat error:' },
  { vi: 'chưa hỗ trợ tự động trên trình duyệt. Bỏ qua.', en: 'is not supported for browser automation. Skipping.' },
  { vi: 'Đã hoàn thành nhiệm vụ:', en: 'Completed quest:' },
  { vi: 'Đang nhận thưởng...', en: 'Claiming reward...' },
  { vi: 'Nhận thưởng thành công:', en: 'Reward claimed successfully:' },
  { vi: 'Nhận thưởng thất bại:', en: 'Reward claim failed:' },
  { vi: 'Nhiệm vụ', en: 'Quest' },
  { vi: 'chưa thể hoàn thành.', en: 'could not be completed.' },
  { vi: 'Đã dừng thực thi theo yêu cầu của bạn.', en: 'Execution stopped as requested.' },
  { vi: 'Tất cả nhiệm vụ khả dụng đã được xử lý xong!', en: 'All available quests have been processed!' },
  { vi: 'Lỗi tiến trình:', en: 'Execution error:' },
  { vi: 'Đang yêu cầu dừng tiến trình...', en: 'Requesting stop...' },
  { vi: 'Đã làm mới dữ liệu từ Discord!', en: 'Refreshed data from Discord successfully!' },
  { vi: 'Lỗi làm mới:', en: 'Refresh error:' },
  { vi: 'Đã lưu và kết nối token thủ công thành công!', en: 'Saved and connected token manually!' },
  { vi: 'Token không hợp lệ hoặc lỗi Discord:', en: 'Invalid token or Discord error:' },
  { vi: 'Quá trình đang chạy, vui lòng chờ...', en: 'Process is currently running, please wait...' },
  { vi: 'Tự động nhận thưởng:', en: 'Auto-claimed reward:' }
];

function localizeLogText(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  if (currentLang === 'en') {
    for (const item of LOG_TRANSLATIONS) {
      if (result.includes(item.vi)) {
        result = result.split(item.vi).join(item.en);
      }
    }
  } else if (currentLang === 'vi') {
    for (const item of LOG_TRANSLATIONS) {
      if (result.includes(item.en)) {
        result = result.split(item.en).join(item.vi);
      }
    }
  }
  return result;
}

let currentLang = 'en'; // Default language is English

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS.en[key] || key;
}

// Elements
const autoRunToggle = document.getElementById('autoRunToggle');
const autoRunLabel = document.getElementById('autoRunLabel');
const autoRunText = document.getElementById('autoRunText');
const langBtnEn = document.getElementById('langBtnEn');
const langBtnVi = document.getElementById('langBtnVi');

const userAvatar = document.getElementById('userAvatar');
const userStatusDot = document.getElementById('userStatusDot');
const userName = document.getElementById('userName');
const userId = document.getElementById('userId');
const userOrbs = document.getElementById('userOrbs');

const runBtn = document.getElementById('runBtn');
const runBtnIcon = document.getElementById('runBtnIcon');
const runBtnText = document.getElementById('runBtnText');
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon') || (refreshBtn ? refreshBtn.querySelector('.btn-icon') : null);
const clearLogsBtn = document.getElementById('clearLogsBtn');
const questCount = document.getElementById('questCount');
const questList = document.getElementById('questList');
const logConsole = document.getElementById('logConsole');
const statusIndicator = document.getElementById('statusIndicator');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const questsTabBtn = document.getElementById('questsTabBtn');
const logsTabBtn = document.getElementById('logsTabBtn');
const toastEl = document.getElementById('toast');

const tokenBadgeLabel = document.getElementById('tokenBadgeLabel');
const tokenStatusText = document.getElementById('tokenStatusText');
const toggleTokenBtn = document.getElementById('toggleTokenBtn');
const extractTabTokenBtn = document.getElementById('extractTabTokenBtn');
const tokenInputRow = document.getElementById('tokenInputRow');
const tokenInput = document.getElementById('tokenInput');
const saveTokenBtn = document.getElementById('saveTokenBtn');
const footerAuthor = document.getElementById('footerAuthor');

let isCurrentlyRunning = false;
let isCurrentlyStopping = false;
let toastTimer = null;
let isRefreshing = false;
let lastCachedQuests = [];
let lastCachedUser = null;
let lastCachedOrbs = null;

// Connect persistent port to keep worker alive while popup is open
let backgroundPort = null;
if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.connect === 'function') {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'popup' });
    backgroundPort.onMessage.addListener(handleIncomingMessage);
  } catch (e) {
    console.warn('Could not establish persistent port to worker:', e);
  }
}

function showToast(message, type = 'info') {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = 'toast hidden';
  }, 3500);
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return t('noToken');
  const tStr = token.trim();
  if (tStr.length <= 10) return '••••••••';
  return tStr.slice(0, 6) + '...' + tStr.slice(-4);
}

function getTaskIcon(type) {
  switch (type) {
    case 'WATCH_VIDEO':
    case 'WATCH_VIDEO_ON_MOBILE':
      return '🎬';
    case 'PLAY_ON_DESKTOP':
      return '🎮';
    case 'STREAM_ON_DESKTOP':
      return '📡';
    case 'PLAY_ACTIVITY':
      return '🕹️';
    case 'PLAY_ON_XBOX':
    case 'PLAY_ON_PLAYSTATION':
      return '🎯';
    default:
      return '🎮';
  }
}

function renderUser(user, orbs) {
  lastCachedUser = user;
  lastCachedOrbs = orbs;

  if (user && user.id) {
    if (userName) userName.textContent = user.global_name || user.username;
    if (userId) userId.textContent = `@${user.username}`;
    if (userStatusDot) userStatusDot.classList.add('online');

    if (userAvatar) {
      if (user.avatar) {
        userAvatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=80`;
      } else {
        userAvatar.src = 'icons/icon48.png';
      }
    }
  } else {
    if (userName) userName.textContent = t('notConnected');
    if (userId) userId.textContent = '#0000';
    if (userStatusDot) userStatusDot.classList.remove('online');
    if (userAvatar) userAvatar.src = 'icons/icon48.png';
  }

  if (userOrbs) {
    if (orbs !== undefined && orbs !== null) {
      userOrbs.textContent = `${orbs} Orbs`;
    } else {
      userOrbs.textContent = t('orbsCount');
    }
  }
}

function formatCountdown(countdown) {
  if (countdown <= 0) return t('done');
  const m = Math.floor(countdown / 60);
  const s = countdown % 60;
  return m > 0 ? `${m}m ${s}s ${t('remaining')}` : `${s}s ${t('remaining')}`;
}

function renderQuests(quests = []) {
  lastCachedQuests = quests;
  if (questCount) questCount.textContent = quests.length;
  if (!questList) return;

  if (quests.length === 0) {
    const isUserConnected = userName && userName.textContent !== t('notConnected') && userName.textContent !== 'Not connected' && userName.textContent !== 'Chưa kết nối';
    if (isUserConnected) {
      questList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">✨</span>
          <p><strong>${t('emptyQuestsAllDoneStrong')}</strong> ${t('emptyQuestsAllDoneText')}</p>
        </div>
      `;
    } else {
      questList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🎮</span>
          <p>${t('emptyQuestsNoAuthText')}</p>
          <button id="syncDiscordBtn" class="btn btn-primary" style="margin-top: 10px; width: auto; font-size: 12px; padding: 7px 16px;">${t('syncTokenTabBtn')}</button>
        </div>
      `;
      const syncBtn = document.getElementById('syncDiscordBtn');
      if (syncBtn) {
        syncBtn.addEventListener('click', () => extractTokenFromActiveTab(true));
      }
    }
    return;
  }

  // Update in-place to avoid UI flicker
  const existingCards = questList.querySelectorAll('.quest-card');
  const canUpdateInPlace = existingCards.length === quests.length;

  if (canUpdateInPlace) {
    let matchesAll = true;
    for (let i = 0; i < quests.length; i++) {
      if (existingCards[i].dataset.questId !== quests[i].id) {
        matchesAll = false;
        break;
      }
    }

    if (matchesAll) {
      quests.forEach((q, i) => {
        const card = existingCards[i];
        const isRunningThis = q.state === 'running';
        const percent = Math.min(100, Math.max(0, Math.round(((q.target - q.countdown) / (q.target || 1)) * 100))) || 0;
        const isDone = q.state === 'done' || q.state === 'claimed';

        if (isRunningThis) {
          card.classList.add('running');
        } else {
          card.classList.remove('running');
        }

        const fill = card.querySelector('.progress-fill');
        if (fill) {
          fill.style.width = `${percent}%`;
          if (isDone) fill.classList.add('done');
          else fill.classList.remove('done');
        }

        const footerSpan = card.querySelector('.quest-footer-info');
        if (footerSpan) {
          footerSpan.textContent = `${t('progress')}: ${percent}% (${formatCountdown(q.countdown)})`;
        }

        const badge = card.querySelector('.status-badge');
        if (badge) {
          badge.className = `status-badge ${q.state}`;
          badge.textContent = t(q.state) || q.state;
        }

        const actionBtn = card.querySelector('.btn-quest-action');
        if (actionBtn) {
          if (q.state === 'expired') {
            actionBtn.style.display = 'none';
          } else {
            actionBtn.style.display = '';
            const isActionDisabled = isDone || isCurrentlyRunning || isCurrentlyStopping;
            actionBtn.disabled = isActionDisabled;
            if (isDone) {
              actionBtn.className = 'btn-quest-action done';
              actionBtn.textContent = `✔ ${t('done')}`;
            } else if (isRunningThis) {
              actionBtn.className = 'btn-quest-action running';
              actionBtn.textContent = `⏳ ${t('running')}`;
            } else {
              actionBtn.className = 'btn-quest-action';
              actionBtn.textContent = `▶ ${t('runSingleQuest')}`;
            }
          }
        }
      });
      return;
    }
  }

  // Render cards
  questList.innerHTML = '';
  quests.forEach((q) => {
    const card = document.createElement('div');
    const isRunningThis = q.state === 'running';
    card.className = `quest-card ${isRunningThis ? 'running' : ''}`;
    card.dataset.questId = q.id;

    const isExpired = q.state === 'expired';
    const percent = Math.min(100, Math.max(0, Math.round(((q.target - q.countdown) / (q.target || 1)) * 100))) || 0;
    const isDone = q.state === 'done' || q.state === 'claimed';
    const isActionDisabled = isDone || isCurrentlyRunning || isCurrentlyStopping || isExpired;
    const actionText = isDone ? `✔ ${t('done')}` : (isRunningThis ? `⏳ ${t('running')}` : `▶ ${t('runSingleQuest')}`);
    const actionClass = isDone ? 'done' : (isRunningThis ? 'running' : '');
    const actionBtnHtml = isExpired ? '' : `<button type="button" class="btn-quest-action ${actionClass}" data-quest-id="${q.id}" ${isActionDisabled ? 'disabled' : ''} title="${isDone ? t('done') : t('runSingleQuest')}">${actionText}</button>`;

    card.innerHTML = `
      <div class="quest-header">
        <div class="quest-title-wrap">
          <span class="quest-icon">${getTaskIcon(q.taskType)}</span>
          <span class="quest-name" title="${q.name}">${q.name}</span>
        </div>
        <span class="quest-reward">${q.reward}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${isDone ? 'done' : ''}" style="width: ${percent}%;"></div>
      </div>
      <div class="quest-footer">
        <span class="quest-footer-info">${t('progress')}: ${percent}% (${formatCountdown(q.countdown)})</span>
        <div class="quest-card-actions">
          ${actionBtnHtml}
          <span class="status-badge ${q.state}">${t(q.state) || q.state}</span>
        </div>
      </div>
    `;

    const singleBtn = card.querySelector ? card.querySelector('.btn-quest-action') : null;
    if (singleBtn && singleBtn.addEventListener) {
      singleBtn.dataset.questId = q.id;
      singleBtn.addEventListener('click', (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        startSingleQuest(q.id);
      });
    }

    questList.appendChild(card);
  });
}

let lastCachedLogs = [];

function renderLogs(logs = []) {
  lastCachedLogs = logs || [];
  if (!logConsole) return;
  logConsole.innerHTML = '';
  lastCachedLogs.forEach(log => {
    appendLogEntry(log, false);
  });
  logConsole.scrollTop = logConsole.scrollHeight;
}

function appendLogEntry(log, scroll = true) {
  if (!logConsole || !log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${log.level || 'info'}`;
  const localized = localizeLogText(log.text);
  entry.innerHTML = `
    <span class="log-time">[${log.time || ''}]</span>
    <span class="log-text">${localized}</span>
  `;
  logConsole.appendChild(entry);
  if (scroll) {
    logConsole.scrollTop = logConsole.scrollHeight;
  }
}

function updateRunningUI(running, isStopping = false) {
  isCurrentlyRunning = running;
  isCurrentlyStopping = isStopping;
  if (!runBtn) return;
  runBtn.disabled = false;

  if (questList && questList.querySelectorAll) {
    const actionBtns = questList.querySelectorAll('.btn-quest-action');
    if (actionBtns && actionBtns.length > 0) {
      actionBtns.forEach(btn => {
        if (!btn.classList.contains('done')) {
          btn.disabled = running || isStopping;
        }
      });
    }
  }

  if (isStopping) {
    runBtn.classList.add('running');
    runBtn.disabled = true;
    if (runBtnIcon) runBtnIcon.textContent = '⏳';
    if (runBtnText) runBtnText.textContent = t('stopping');
    if (statusIndicator) {
      statusIndicator.textContent = t('stopping');
      statusIndicator.className = 'ready-badge';
      statusIndicator.style.color = 'var(--warning)';
    }
  } else if (running) {
    runBtn.classList.add('running');
    if (runBtnIcon) runBtnIcon.textContent = '⏹';
    if (runBtnText) runBtnText.textContent = t('stop');
    if (statusIndicator) {
      statusIndicator.textContent = t('running');
      statusIndicator.className = 'ready-badge';
      statusIndicator.style.color = 'var(--info)';
    }
  } else {
    runBtn.classList.remove('running');
    if (runBtnIcon) runBtnIcon.textContent = '⚡';
    if (runBtnText) runBtnText.textContent = t('startNow');
    if (statusIndicator) {
      statusIndicator.textContent = t('ready');
      statusIndicator.className = 'ready-badge';
      statusIndicator.style.color = 'var(--success)';
    }
  }
}

function applyTranslations() {
  // Update toggle buttons active class
  if (langBtnEn) {
    if (currentLang === 'en') langBtnEn.classList.add('active');
    else langBtnEn.classList.remove('active');
  }
  if (langBtnVi) {
    if (currentLang === 'vi') langBtnVi.classList.add('active');
    else langBtnVi.classList.remove('active');
  }

  // Header & Controls
  const appTitleEl = document.getElementById('appTitle');
  if (appTitleEl) appTitleEl.textContent = t('appTitle');
  const appSubtitleEl = document.getElementById('appSubtitle');
  if (appSubtitleEl) appSubtitleEl.textContent = t('subtitle');
  if (autoRunLabel) autoRunLabel.title = t('autoRunTitle');
  if (autoRunText) autoRunText.textContent = t('autoRun');

  // Token Bar
  if (tokenBadgeLabel) tokenBadgeLabel.textContent = t('tokenLabel');
  if (extractTabTokenBtn) extractTabTokenBtn.textContent = t('extractTabBtn');
  if (toggleTokenBtn && tokenInputRow) {
    toggleTokenBtn.textContent = tokenInputRow.classList.contains('hidden') ? t('changeToken') : t('closeToken');
  }
  if (tokenInput) tokenInput.placeholder = t('tokenPlaceholder');
  if (saveTokenBtn) saveTokenBtn.textContent = t('saveBtn');

  // Action Bar titles
  if (refreshBtn) refreshBtn.title = t('refreshTitle');
  if (clearLogsBtn) clearLogsBtn.title = t('clearLogsTitle');

  // Tabs
  if (questsTabBtn) {
    questsTabBtn.innerHTML = `${t('questsTab')} (<span id="questCount">${lastCachedQuests.length}</span>)`;
  }
  if (logsTabBtn) logsTabBtn.textContent = t('logsTab');

  // User & Status
  if (!lastCachedUser) {
    if (userName) userName.textContent = t('notConnected');
    if (userOrbs) userOrbs.textContent = t('orbsCount');
  }
  if (footerAuthor) footerAuthor.textContent = t('footerAuthor');

  // Update token masked text if empty
  if (tokenStatusText) {
    chrome.storage.local.get(['token']).then(d => {
      if (!d.token) tokenStatusText.textContent = t('noToken');
    });
  }

  // Update buttons
  updateRunningUI(isCurrentlyRunning, isCurrentlyStopping);

  // Re-render quests with new language
  renderQuests(lastCachedQuests);

  // Re-render logs with new language
  if (lastCachedLogs && lastCachedLogs.length > 0) {
    renderLogs(lastCachedLogs);
  }
}

function setLanguage(lang) {
  currentLang = (lang === 'vi') ? 'vi' : 'en';
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ appLang: currentLang });
  }
  applyTranslations();
}

async function loadData() {
  const data = await chrome.storage.local.get([
    'user',
    'orbs',
    'quests',
    'logs',
    'isRunning',
    'isStopping',
    'autoRunEnabled',
    'token',
    'appLang'
  ]);

  // Load language (default to en)
  currentLang = (data.appLang === 'vi') ? 'vi' : 'en';
  applyTranslations();

  renderUser(data.user, data.orbs);
  renderQuests(data.quests);
  renderLogs(data.logs);
  updateRunningUI(Boolean(data.isRunning), Boolean(data.isStopping));

  if (tokenStatusText) {
    tokenStatusText.textContent = maskToken(data.token);
  }

  if (data.autoRunEnabled !== undefined && autoRunToggle) {
    autoRunToggle.checked = data.autoRunEnabled;
  }
}

function handleIncomingMessage(message) {
  if (!message) return;

  if (message.action === 'LOG_ADDED') {
    if (message.entry) {
      lastCachedLogs.push(message.entry);
      if (lastCachedLogs.length > 300) lastCachedLogs.shift();
      appendLogEntry(message.entry);
    }
  } else if (message.action === 'LOGS_CLEARED') {
    lastCachedLogs = [];
    if (logConsole) logConsole.innerHTML = '';
  } else if (message.action === 'STATE_UPDATED') {
    if (message.state.user || message.state.orbs !== undefined) {
      renderUser(message.state.user, message.state.orbs);
    }
    if (message.state.quests) {
      renderQuests(message.state.quests);
    }
    if (message.state.isRunning !== undefined) {
      updateRunningUI(message.state.isRunning, message.state.isStopping);
    }
    if (message.state.token && tokenStatusText) {
      tokenStatusText.textContent = maskToken(message.state.token);
    }
  }
}

// Runtime message listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(handleIncomingMessage);
}

// Event Listeners

// 0. Language Switcher Buttons
if (langBtnEn) {
  langBtnEn.addEventListener('click', () => setLanguage('en'));
}
if (langBtnVi) {
  langBtnVi.addEventListener('click', () => setLanguage('vi'));
}

// 1. Auto Run Toggle
if (autoRunToggle) {
  autoRunToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ autoRunEnabled: enabled });
    showToast(enabled ? t('toastAutoEnabled') : t('toastAutoDisabled'), 'info');
  });
}

// 2. Run / Stop Button
if (runBtn) {
  runBtn.addEventListener('click', () => {
    if (isCurrentlyRunning) {
      updateRunningUI(true, true);
      chrome.runtime.sendMessage({ action: 'STOP_RUN' }, () => {
        showToast(t('toastStopRequested'), 'info');
      });

      setTimeout(() => {
        chrome.storage.local.get(['isRunning', 'isStopping']).then(d => {
          updateRunningUI(Boolean(d.isRunning), Boolean(d.isStopping));
        });
      }, 3000);
    } else {
      runBtn.disabled = true;
      if (runBtnIcon) runBtnIcon.textContent = '⏳';
      if (runBtnText) runBtnText.textContent = t('starting');
      if (statusIndicator) {
        statusIndicator.textContent = t('starting');
        statusIndicator.style.color = 'var(--info)';
      }

      chrome.runtime.sendMessage({ action: 'START_RUN' }, (response) => {
        if (chrome.runtime.lastError) {
          updateRunningUI(false);
          showToast(`${t('toastWorkerError')} ${chrome.runtime.lastError.message}`, 'error');
          return;
        }

        if (response && response.success) {
          updateRunningUI(true, false);
          showToast(t('toastStartSuccess'), 'success');
        } else if (response && response.error) {
          updateRunningUI(false);
          showToast(response.error, 'error');
          try { alert(response.error); } catch {}
        } else {
          updateRunningUI(false);
        }
      });
    }
  });
}

// 3. Refresh Data Button
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    if (isRefreshing) return;
    isRefreshing = true;

    if (refreshIcon) refreshIcon.classList.add('spinning');
    refreshBtn.disabled = true;
    if (statusIndicator) {
      statusIndicator.textContent = t('refreshing');
      statusIndicator.style.color = 'var(--info)';
    }

    chrome.runtime.sendMessage({ action: 'REFRESH_DATA' }, (response) => {
      isRefreshing = false;
      if (refreshIcon) refreshIcon.classList.remove('spinning');
      refreshBtn.disabled = false;

      if (chrome.runtime.lastError) {
        updateRunningUI(isCurrentlyRunning);
        showToast(`${t('toastRefreshFailed')} ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success && response.state) {
        renderUser(response.state.user, response.state.orbs);
        renderQuests(response.state.quests);
        updateRunningUI(isCurrentlyRunning);
        showToast(t('toastRefreshSuccess'), 'success');
      } else if (response && response.error) {
        updateRunningUI(isCurrentlyRunning);
        showToast(response.error, 'error');
        try { alert(response.error); } catch {}
      } else {
        loadData();
      }
    });
  });
}

// 4. Clear Logs Button
if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' }, () => {
      if (logConsole) logConsole.innerHTML = '';
      showToast(t('toastLogsCleared'), 'info');
    });
  });
}

// 5. Token Configuration & Manual Input
if (toggleTokenBtn && tokenInputRow) {
  toggleTokenBtn.addEventListener('click', () => {
    const isHidden = tokenInputRow.classList.contains('hidden');
    if (isHidden) {
      tokenInputRow.classList.remove('hidden');
      toggleTokenBtn.textContent = t('closeToken');
      chrome.storage.local.get(['token']).then(d => {
        if (d.token && tokenInput) tokenInput.value = d.token;
      });
      if (tokenInput) tokenInput.focus();
    } else {
      tokenInputRow.classList.add('hidden');
      toggleTokenBtn.textContent = t('changeToken');
    }
  });
}

if (saveTokenBtn && tokenInput) {
  saveTokenBtn.addEventListener('click', () => {
    const val = tokenInput.value.trim();
    if (!val) {
      showToast(t('toastTokenInvalid'), 'error');
      return;
    }

    saveTokenBtn.disabled = true;
    saveTokenBtn.textContent = '...';

    chrome.runtime.sendMessage({ action: 'SET_TOKEN', token: val }, (res) => {
      saveTokenBtn.disabled = false;
      saveTokenBtn.textContent = t('saveBtn');

      if (chrome.runtime.lastError) {
        showToast(`Error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (res && res.success) {
        if (tokenStatusText) tokenStatusText.textContent = maskToken(val);
        tokenInputRow.classList.add('hidden');
        if (toggleTokenBtn) toggleTokenBtn.textContent = t('changeToken');
        if (res.state) {
          renderUser(res.state.user, res.state.orbs);
          renderQuests(res.state.quests);
        }
        showToast(t('toastTokenSaved'), 'success');
      } else {
        showToast(res?.error || 'Could not save token.', 'error');
      }
    });
  });
}

// 6. Navigation Tabs
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) {
      target.classList.add('active');
    }
  });
});

// 7. Token Extraction from Active Discord Tab
async function extractTokenFromActiveTab(showAlert = true) {
  try {
    if (extractTabTokenBtn) {
      extractTabTokenBtn.disabled = true;
      extractTabTokenBtn.textContent = '...';
    }

    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      if (extractTabTokenBtn) {
        extractTabTokenBtn.disabled = false;
        extractTabTokenBtn.textContent = t('extractTabBtn');
      }
      return;
    }

    chrome.runtime.sendMessage({ action: 'EXTRACT_TOKEN_NOW' }, async (response) => {
      if (response && response.success && response.token) {
        if (extractTabTokenBtn) {
          extractTabTokenBtn.disabled = false;
          extractTabTokenBtn.textContent = t('extractTabBtn');
        }
        if (tokenStatusText) tokenStatusText.textContent = maskToken(response.token);
        if (response.state) {
          renderUser(response.state.user, response.state.orbs);
          renderQuests(response.state.quests);
        } else {
          loadData();
        }
        showToast(t('toastTokenExtracted'), 'success');
        return;
      }

      if (typeof chrome === 'undefined' || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
        if (extractTabTokenBtn) {
          extractTabTokenBtn.disabled = false;
          extractTabTokenBtn.textContent = t('extractTabBtn');
        }
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let tab = tabs && tabs[0];
        const isDiscordTab = tab && tab.url && (tab.url.startsWith('https://discord.com/') || tab.url.includes('discord.com'));

        if (!isDiscordTab) {
          chrome.tabs.query({}, function (allTabs) {
            const foundTab = allTabs && allTabs.find(tTab => tTab.url && tTab.url.includes('discord.com'));
            if (!foundTab) {
              if (extractTabTokenBtn) {
                extractTabTokenBtn.disabled = false;
                extractTabTokenBtn.textContent = t('extractTabBtn');
              }
              if (showAlert) {
                showToast(t('toastNoDiscordTab'), 'warn');
                try { alert(t('alertNoDiscordTab')); } catch {}
              }
              return;
            }
            executeDirectExtraction(foundTab, showAlert);
          });
        } else {
          executeDirectExtraction(tab, showAlert);
        }
      });
    });
  } catch (err) {
    if (extractTabTokenBtn) {
      extractTabTokenBtn.disabled = false;
      extractTabTokenBtn.textContent = t('extractTabBtn');
    }
    if (showAlert) showToast(`Error: ${err.message}`, 'error');
  }
}

function executeDirectExtraction(tab, showAlert) {
  if (typeof chrome === 'undefined' || !chrome.scripting || typeof chrome.scripting.executeScript !== 'function') {
    if (extractTabTokenBtn) {
      extractTabTokenBtn.disabled = false;
      extractTabTokenBtn.textContent = t('extractTabBtn');
    }
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: function () {
        try {
          if (typeof localStorage !== 'undefined') {
            const tVal = localStorage.token || localStorage.getItem('token');
            if (tVal) return String(tVal).replace(/"/g, '').trim();
          }
        } catch (e) {}
        return null;
      }
    },
    function (results) {
      if (extractTabTokenBtn) {
        extractTabTokenBtn.disabled = false;
        extractTabTokenBtn.textContent = t('extractTabBtn');
      }

      if (chrome.runtime.lastError || !results || results.length === 0) {
        if (showAlert) {
          showToast(t('toastExtractFailed'), 'error');
        }
        return;
      }

      const token = results[0]?.result;
      if (token && typeof token === 'string' && token.length > 0) {
        const cleanToken = token.replace(/"/g, '').trim();
        chrome.storage.local.set({ token: cleanToken });
        if (tokenStatusText) tokenStatusText.textContent = maskToken(cleanToken);
        showToast(t('toastTokenExtracted'), 'success');

        chrome.runtime.sendMessage({ action: 'TOKEN_EXTRACTED', token: cleanToken }, () => {
          chrome.runtime.sendMessage({ action: 'REFRESH_DATA' }, (res) => {
            if (res && res.success && res.state) {
              renderUser(res.state.user, res.state.orbs);
              renderQuests(res.state.quests);
            }
          });
        });
      } else {
        if (showAlert) {
          showToast(t('toastNoTokenFound'), 'warn');
        }
      }
    }
  );
}

function startSingleQuest(questId) {
  if (!questId) return;
  const targetQuest = lastCachedQuests.find(q => q.id === questId);
  if (targetQuest && targetQuest.state === 'expired') {
    return;
  }
  if (isCurrentlyRunning) {
    showToast(t('toastAlreadyRunning'), 'warn');
    return;
  }

  chrome.storage.local.get(['token']).then(data => {
    if (!data.token) {
      showToast(t('alertNoTokenToRun'), 'error');
      try { alert(t('alertNoTokenToRun')); } catch {}
      return;
    }

    updateRunningUI(true, false);
    if (statusIndicator) {
      statusIndicator.textContent = t('starting');
      statusIndicator.style.color = 'var(--info)';
    }

    chrome.runtime.sendMessage({ action: 'START_SINGLE_QUEST', questId }, (response) => {
      if (chrome.runtime.lastError) {
        updateRunningUI(false);
        showToast(`${t('toastWorkerError')} ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success) {
        updateRunningUI(true, false);
        showToast(t('toastStartSingleSuccess'), 'success');
      } else if (response && response.error) {
        updateRunningUI(false);
        showToast(response.error, 'error');
        try { alert(response.error); } catch {}
      } else {
        updateRunningUI(false);
      }
    });
  });
}

if (questList) {
  questList.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const btn = (target.closest && target.closest('.btn-quest-action')) || (target.classList?.contains('btn-quest-action') ? target : null);
    if (btn && btn.dataset && btn.dataset.questId && !btn.disabled) {
      startSingleQuest(btn.dataset.questId);
    }
  });
}

// Initial Data & Language Load
loadData();
