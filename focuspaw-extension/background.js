// background.js
let apiKey = '';

// 从 storage 加载 apiKey
chrome.storage.local.get(['apiKey'], (result) => {
  if (result.apiKey) apiKey = result.apiKey;
});

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getCatMessage':
      getCatMessage(request.scene, request.mood)
        .then(msg => sendResponse({ message: msg }))
        .catch(err => sendResponse({ message: '喵~（暂时无法说话）' }));
      return true;

    case 'updateApiKey':
      apiKey = request.key;
      chrome.storage.local.set({ apiKey: request.key });
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

// 计时器管理
async function startTimer(minutes) {
  const endTime = Date.now() + minutes * 60 * 1000;
  await chrome.storage.local.set({
    timerEndTime: endTime,
    timerDuration: minutes * 60 // 秒
  });
  await chrome.alarms.create('focusTimer', { delayInMinutes: minutes });
  // 通知所有 tab 计时器已启动
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
  return {
    running: remaining > 0,
    remaining,
    endTime: timerEndTime,
    duration: timerDuration || 0
  };
}

// 闹钟管理
async function setAlarm(hours, minutes) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // 如果今天已过，设为明天
  const delayMs = target.getTime() - now.getTime();
  const delayMin = Math.ceil(delayMs / 60000);
  await chrome.storage.local.set({
    alarmTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    alarmTarget: target.getTime()
  });
  await chrome.alarms.create('focusAlarm', { delayInMinutes: delayMin });
  broadcastToTabs({ action: 'alarmSet', time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` });
}

async function cancelAlarm() {
  await chrome.storage.local.remove(['alarmTime', 'alarmTarget']);
  await chrome.alarms.clear('focusAlarm');
  broadcastToTabs({ action: 'alarmCancelled' });
}

// chrome.alarms 触发
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

// 广播消息到所有 tab
function broadcastToTabs(msg) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  });
}

// 系统通知
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/cat/idle.png'),
    title,
    message
  });
}

// DeepSeek AI
async function getCatMessage(scene, mood) {
  if (!apiKey) return '我没有联网喵...(请先在扩展设置里填写DeepSeek API Key)';
  const systemPrompt = `你是一只名叫FocusPaw的虚拟猫咪,陪伴主人学习。你的语气是${mood}的。每句话不超过30个字,带一个动作描述。`;
  const userPrompt = scene === 'distracted'
    ? '主人刚刚分心了,请温和提醒Ta'
    : '主人专注达标了,请卖萌鼓励Ta';

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 60,
      temperature: 1.0
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}
