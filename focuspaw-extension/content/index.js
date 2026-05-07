// content.js — 初始化逻辑（模块在 manifest 中按顺序加载）

(function initFocusPaw() {
  if (document.getElementById('focuspaw-cat')) return;

  const catUI = new CatUI();
  catUI.init();

  const stateMachine = new StateMachine(catUI);
  const emotionManager = new EmotionManager();
  const focusTimer = new FocusTimer(stateMachine, emotionManager, catUI);
  const activityDetector = new ActivityDetector(stateMachine, focusTimer, emotionManager);

  activityDetector.init();
  focusTimer.startOrContinue();

  // === 页面内容提取 + 自动评论 ===
  let pageCommented = false;

  function extractPageContent() {
    const title = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const description = meta ? meta.content : '';
    const text = document.body?.innerText?.slice(0, 500) || '';
    return { title, description, content: text };
  }

  async function commentOnPage() {
    if (pageCommented) return;
    pageCommented = true;
    const pageData = extractPageContent();
    const comment = await analyzePage(pageData, catUI.currentChar);
    if (comment) catUI.showBubble(comment, 8000);
  }

  // SPA 导航检测
  function patchHistoryAPI() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    const onUrlChange = () => { pageCommented = false; setTimeout(commentOnPage, 1500); };

    history.pushState = function (...args) {
      origPush.apply(this, args);
      onUrlChange();
    };
    history.replaceState = function (...args) {
      origReplace.apply(this, args);
      onUrlChange();
    };
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
  }

  // === 鼠标靠近检测 ===
  document.addEventListener('mousemove', (e) => {
    if (!catUI.catEl) return;
    const rect = catUI.catEl.getBoundingClientRect();
    const cx = rect.left + 128;
    const cy = rect.top + 128;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    catUI.isNearMouse = dist < 150;
  });

  // 拖拽 + 面板控制变量
  var isDragging = false, dragDistance = 0, offsetX, offsetY, singleClickTimer, longPressTimer;

  // 双击抚摸
  catUI.catEl.addEventListener('dblclick', () => {
    if (catUI.isLaughing) return;
    clearTimeout(singleClickTimer);
    emotionManager.addEvent('pet');
    catUI.playPetAnimation();
    const mood = emotionManager.getMood();
    getCatMessage('reward', mood, catUI.currentChar).then(msg => catUI.showBubble(msg, 3000));
  });

  // 自由拖拽 + 单击面板 + 长按视频
  catUI.catEl.addEventListener('mousedown', (e) => {
    if (catUI.isLaughing) return;
    isDragging = true;
    dragDistance = 0;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (dragDistance < 5) {
        catUI.playLaughVideo();
      }
    }, 2000);
    const rect = catUI.catEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    catUI.catEl.style.left = rect.left + 'px';
    catUI.catEl.style.top = rect.top + 'px';
    catUI.catEl.style.right = 'auto';
    catUI.catEl.style.bottom = 'auto';
    catUI.catEl.style.transition = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    dragDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
    if (dragDistance > 5) clearTimeout(longPressTimer);
    catUI.catEl.style.left = (e.clientX - offsetX) + 'px';
    catUI.catEl.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      isDragging = false;
      clearTimeout(longPressTimer);
      catUI.catEl.style.transition = 'all 0.5s ease';
      if (dragDistance < 5 && !catUI.panelEl?.contains(e.target)) {
        clearTimeout(singleClickTimer);
        singleClickTimer = setTimeout(() => catUI.togglePanel(), 280);
      }
    }
  });

  // === 闹铃音效（Web Audio API） ===
  let lastRingTime = 0;

  function playAlarmSound() {
    if (Date.now() - lastRingTime < 2000) return;
    lastRingTime = Date.now();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
      const now = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        playTone(ctx, 800, now + i * 0.25, 0.1);
        playTone(ctx, 1000, now + i * 0.25 + 0.12, 0.1);
      }
      setTimeout(() => ctx.close(), 3000);
    } catch (_) { /* 静默失败 */ }
  }
  function playTone(ctx, freq, start, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  // === 监听 background 消息 ===
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
      case 'timerStarted':
        catUI.showPanel();
        catUI.updateTimerDisplay(msg.duration);
        timerEnd = msg.endTime;
        startTimerTick();
        scheduleLocalRing(timerEnd);
        break;
      case 'timerCancelled':
        catUI.updateTimerDisplay(null);
        stopTimerTick();
        cancelLocalRing();
        timerEnd = 0;
        break;
      case 'timerComplete':
        catUI.updateTimerDisplay(0);
        stopTimerTick();
        cancelLocalRing();
        timerEnd = 0;
        catUI.showBubble('⏱ 时间到！休息一下吧～ 🎉', 6000);
        catUI.showEffect('🎉');
        playAlarmSound();
        break;
      case 'timerUpdate':
        catUI.updateTimerDisplay(msg.remaining);
        break;
      case 'alarmSet':
        catUI.showPanel();
        catUI.updateAlarmStatus(`⏰ 闹钟已设置: ${msg.time}`);
        break;
      case 'alarmCancelled':
        catUI.updateAlarmStatus('');
        break;
      case 'alarmFired':
        catUI.showBubble('⏰ 叮叮叮～闹钟响啦！', 6000);
        catUI.showEffect('🔔');
        catUI.updateAlarmStatus('');
        playAlarmSound();
        break;
    }
  });

  // === 本地精准响铃（setTimeout） ===
  let timerTickInterval = null;
  let timerEnd = 0;
  let localRingTimer = null;

  function scheduleLocalRing(endTime) {
    cancelLocalRing();
    const delay = Math.max(0, endTime - Date.now());
    localRingTimer = setTimeout(() => {
      timerEnd = 0;
      stopTimerTick();
      catUI.updateTimerDisplay(0);
      catUI.showBubble('⏱ 时间到！休息一下吧～ 🎉', 6000);
      catUI.showEffect('🎉');
      playAlarmSound();
    }, delay);
  }

  function cancelLocalRing() {
    if (localRingTimer) {
      clearTimeout(localRingTimer);
      localRingTimer = null;
    }
  }

  function startTimerTick() {
    stopTimerTick();
    timerTickInterval = setInterval(() => {
      chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (status) => {
        if (status && status.running) {
          catUI.updateTimerDisplay(status.remaining);
        } else {
          catUI.updateTimerDisplay(null);
          stopTimerTick();
        }
      });
    }, 1000);
  }

  function stopTimerTick() {
    if (timerTickInterval) {
      clearInterval(timerTickInterval);
      timerTickInterval = null;
    }
  }

  // === visibilitychange：切回标签页时重新同步 ===
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (status) => {
      if (status && status.running) {
        timerEnd = status.endTime;
        catUI.updateTimerDisplay(status.remaining);
        startTimerTick();
        scheduleLocalRing(timerEnd);
      } else if (timerEnd > 0) {
        timerEnd = 0;
        stopTimerTick();
        cancelLocalRing();
        catUI.updateTimerDisplay(0);
        catUI.showBubble('⏱ 时间到！休息一下吧～ 🎉', 6000);
        catUI.showEffect('🎉');
        playAlarmSound();
      }
    });
  });

  // === 初始化时查询是否有计时器在运行 ===
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (status) => {
    if (status && status.running) {
      catUI.updateTimerDisplay(status.remaining);
      timerEnd = status.endTime;
      startTimerTick();
      scheduleLocalRing(timerEnd);
    }
  });

  console.log('FocusPaw initialized!');

  // 自动评论当前页面
  setTimeout(commentOnPage, 2000);

  // SPA 导航检测
  patchHistoryAPI();
})();
