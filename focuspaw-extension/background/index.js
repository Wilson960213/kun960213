// background/index.js — 消息路由 + 计时器/闹钟管理
importScripts('ai-provider.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getCatMessage':
      getCatMessage(request.scene, request.mood)
        .then(msg => sendResponse({ message: msg }))
        .catch(() => sendResponse({ message: '喵~（暂时无法说话）' }));
      return true;

    case 'chatWithCat':
      chatWithCat(request.history)
        .then(msg => sendResponse({ message: msg }))
        .catch(() => sendResponse({ message: '喵~（暂时无法说话）' }));
      return true;

    case 'analyzePage':
      analyzePage(request)
        .then(msg => sendResponse({ message: msg }))
        .catch(() => sendResponse({ message: '' }));
      return true;

    case 'updateApiKey':
      setApiKey(request.key);
      break;

    case 'startTimer':
      startTimer(request.minutes);
      sendResponse({ ok: true });
      break;

    case 'cancelTimer':
      cancelTimer();
      sendResponse({ ok: true });
      break;

    case 'getTimerStatus':
      getTimerStatus().then(status => sendResponse(status));
      return true;

    case 'setAlarm':
      setAlarm(request.hours, request.minutes);
      sendResponse({ ok: true });
      break;

    case 'cancelAlarm':
      cancelAlarm();
      sendResponse({ ok: true });
      break;
  }
});

// ===== 计时器管理 =====
async function startTimer(minutes) {
  const endTime = Date.now() + minutes * 60 * 1000;
  await chrome.storage.local.set({ timerEndTime: endTime, timerDuration: minutes * 60 });
  await chrome.alarms.create('focusTimer', { delayInMinutes: minutes });
  broadcastToTabs({ action: 'timerStarted', endTime, duration: minutes * 60 });
}

async function cancelTimer() {
  await chrome.storage.local.remove(['timerEndTime', 'timerDuration']);
  await chrome.alarms.clear('focusTimer');
  broadcastToTabs({ action: 'timerCancelled' });
}

async function getTimerStatus() {
  const { timerEndTime, timerDuration } = await chrome.storage.local.get(['timerEndTime', 'timerDuration']);
  if (!timerEndTime) return { running: false };
  const remaining = Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
  return { running: remaining > 0, remaining, endTime: timerEndTime, duration: timerDuration || 0 };
}

// ===== 闹钟管理 =====
async function setAlarm(hours, minutes) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delayMin = Math.ceil((target.getTime() - now.getTime()) / 60000);
  await chrome.storage.local.set({
    alarmTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    alarmTarget: target.getTime()
  });
  await chrome.alarms.create('focusAlarm', { delayInMinutes: delayMin });
  broadcastToTabs({
    action: 'alarmSet',
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  });
}

async function cancelAlarm() {
  await chrome.storage.local.remove(['alarmTime', 'alarmTarget']);
  await chrome.alarms.clear('focusAlarm');
  broadcastToTabs({ action: 'alarmCancelled' });
}

// ===== chrome.alarms 触发 =====
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusTimer') {
    chrome.storage.local.remove(['timerEndTime', 'timerDuration']);
    broadcastToTabs({ action: 'timerComplete' });
    showNotification('⏱ 倒计时结束！', '专注时间到啦，快看看猫咪吧～');
  } else if (alarm.name === 'focusAlarm') {
    chrome.storage.local.remove(['alarmTime', 'alarmTarget']);
    broadcastToTabs({ action: 'alarmFired' });
    showNotification('⏰ 闹钟响了！', '猫咪有重要的事情要告诉你～');
  }
});

// ===== 广播 & 通知 =====
function broadcastToTabs(msg) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/cat/idle.png'),
    title,
    message
  });
}
