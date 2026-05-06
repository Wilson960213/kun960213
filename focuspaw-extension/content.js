// content.js - 完整文件内容（合并所有模块）

// ======= cat-ui.js =======
// cat-ui.js
const CAT_SPRITES = {
  idle: chrome.runtime.getURL('assets/cat/idle.png'),
  attentive: chrome.runtime.getURL('assets/cat/attentive.png'),
  remind: chrome.runtime.getURL('assets/cat/remind.png'),
  reward: chrome.runtime.getURL('assets/cat/reward.png'),
  // 新增动画贴图
  pet: chrome.runtime.getURL('assets/cat/pet.png'),
  sleep: chrome.runtime.getURL('assets/cat/sleep.png'),
  blink: chrome.runtime.getURL('assets/cat/blink.png'),
  walk: chrome.runtime.getURL('assets/cat/walk.png')
};

class CatUI {
  constructor() {
    this.catEl = null;
    this.bubbleEl = null;
    this.currentSprite = null;
    this.actionTimer = null;
    this.bubbleTimer = null;
    this.panelEl = null;
    this.panelVisible = false;
    this.timerInterval = null;
  }

  init() {
    this.catEl = document.createElement('div');
    this.catEl.id = 'focuspaw-cat';
    this.catEl.style.backgroundImage = `url(${CAT_SPRITES.idle})`;
    document.body.appendChild(this.catEl);

    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'cat-bubble';
    this.catEl.appendChild(this.bubbleEl);

    this.startIdleActions();
  }

  setSprite(state) {
    if (this.catEl && CAT_SPRITES[state]) {
      this.catEl.style.backgroundImage = `url(${CAT_SPRITES[state]})`;
      this.currentSprite = state;
    }
  }

  showBubble(text, duration = 4000) {
    if (!this.bubbleEl) return;
    this.bubbleEl.textContent = text;
    this.bubbleEl.style.display = 'block';
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.bubbleEl.style.display = 'none';
    }, duration);
  }

  // 抚摸小猫专属动画
  playPetAnimation() {
    this.setSprite('pet');
    this.showEffect('❤️');
    setTimeout(() => {
      this.setSprite('idle');
    }, 1200);
  }

  // 眨眼小动作
  blink() {
    this.setSprite('blink');
    setTimeout(() => this.setSprite('idle'), 150);
  }

  // 身体轻微晃动
  slightMove() {
    this.catEl.style.transform = "translateY(-3px) rotate(1deg)";
    setTimeout(() => this.catEl.style.transform = "", 400);
  }

  // 小碎步走动
  walkStep() {
    this.setSprite('walk');
    setTimeout(() => this.setSprite('idle'), 300);
  }

  // 流畅待机动作循环
  startIdleActions() {
    const loop = () => {
      // 非待机状态不触发小动作
      if (this.currentSprite !== 'idle' && this.currentSprite !== 'attentive') {
        setTimeout(loop, 2000);
        return;
      }

      const r = Math.random();
      if (r < 0.4) {
        this.blink();
      } else if (r < 0.7) {
        this.slightMove();
      } else if (r < 0.85) {
        this.walkStep();
      }

      setTimeout(loop, 3000 + Math.random() * 5000);
    };
    loop();
  }

  showEffect(emoji) {
    const el = document.createElement('div');
    el.className = 'cat-effect';
    const rect = this.catEl.getBoundingClientRect();
    el.style.left = (rect.left - 10) + 'px';
    el.style.top = (rect.top - 20) + 'px';
    el.textContent = emoji;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // === 控制面板 ===
  createPanel() {
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'cat-control-panel';
    this.panelEl.innerHTML = `
      <div class="panel-section">
        <div class="panel-title">⏱ 倒计时</div>
        <div class="timer-display" id="focus-timer-display">--:--</div>
        <div class="timer-presets">
          <button data-minutes="5">5分</button>
          <button data-minutes="15">15分</button>
          <button data-minutes="25">25分</button>
          <button data-minutes="30">30分</button>
        </div>
        <button class="btn-cancel" id="focus-timer-cancel">取消计时</button>
      </div>
      <div class="panel-section">
        <div class="panel-title">⏰ 闹钟</div>
        <div class="alarm-row">
          <input type="time" id="focus-alarm-input">
          <button id="focus-alarm-set">设置</button>
        </div>
        <button class="btn-cancel-alarm" id="focus-alarm-cancel">取消闹钟</button>
        <div class="alarm-status" id="focus-alarm-status"></div>
      </div>
    `;
    // 点击面板内部不冒泡到 catEl
    this.panelEl.addEventListener('click', (e) => e.stopPropagation());

    // 直接绑定按钮事件
    this.panelEl.querySelectorAll('[data-minutes]').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'startTimer', minutes: parseInt(btn.dataset.minutes) });
      });
    });
    this.panelEl.querySelector('#focus-timer-cancel').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'cancelTimer' });
      this.updateTimerDisplay(null);
    });
    this.panelEl.querySelector('#focus-alarm-set').addEventListener('click', () => {
      const input = this.panelEl.querySelector('#focus-alarm-input');
      if (input && input.value) {
        const [h, m] = input.value.split(':').map(Number);
        chrome.runtime.sendMessage({ action: 'setAlarm', hours: h, minutes: m });
      }
    });
    this.panelEl.querySelector('#focus-alarm-cancel').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'cancelAlarm' });
      this.updateAlarmStatus('');
    });

    this.catEl.appendChild(this.panelEl);
  }

  togglePanel() {
    if (this.panelVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  showPanel() {
    if (!this.panelEl) this.createPanel();
    this.panelEl.style.display = 'block';
    this.panelVisible = true;
  }

  hidePanel() {
    if (this.panelEl) {
      this.panelEl.style.display = 'none';
      this.panelVisible = false;
    }
  }

  updateTimerDisplay(remaining) {
    const display = this.panelEl?.querySelector('#focus-timer-display');
    if (display) {
      if (remaining == null) {
        display.textContent = '--:--';
      } else {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }
  }

  updateAlarmStatus(text) {
    const el = this.panelEl?.querySelector('#focus-alarm-status');
    if (el) el.textContent = text;
  }
}

window.CatUI = CatUI;

// ======= state-machine.js =======
// state-machine.js
const CatState = {
  IDLE: 'idle',
  ATTENTIVE: 'attentive',
  REMIND: 'remind',
  REWARD: 'reward'
};

class StateMachine {
  constructor(catUI) {
    this.state = CatState.IDLE;
    this.catUI = catUI;
  }

  transition(newState, reason = '') {
    console.log(`State: ${this.state} -> ${newState} (${reason})`);
    this.state = newState;
    this.catUI.setSprite(newState);
  }

  onUserActive() {
    if (this.state === CatState.IDLE || this.state === CatState.ATTENTIVE) {
      this.transition(CatState.ATTENTIVE, 'user active');
    }
  }

  // 用户长时间离开，切睡觉贴图
  onUserIdle() {
    this.transition(CatState.IDLE, 'user idle');
    this.catUI.setSprite('sleep');
  }

  onDistracted() {
    this.transition(CatState.REMIND, 'distracted');
  }

  onFocusMilestone() {
    this.transition(CatState.REWARD, 'focus milestone');
  }

  onRecoverFromDistraction() {
    this.transition(CatState.IDLE, 'recovered');
  }
}

window.StateMachine = StateMachine;
window.CatState = CatState;

// ======= emotion-manager.js =======
// emotion-manager.js
class EmotionManager {
  constructor() {
    this.affection = 50; // 0-100 亲密值
    this.moodDescriptors = {
      high: '撒娇、开心、话多',
      medium: '平静、偶尔傲娇',
      low: '担心、小声嘀咕、催促'
    };
  }

  addEvent(type) {
    switch(type) {
      case 'milestone': this.affection = Math.min(100, this.affection + 5); break;
      case 'distracted': this.affection = Math.max(0, this.affection - 3); break;
      case 'recovered': this.affection = Math.min(100, this.affection + 3); break;
      case 'pet': this.affection = Math.min(100, this.affection + 10); break;
      default: break;
    }
    console.log('Affection:', this.affection);
  }

  getMood() {
    if (this.affection >= 70) return this.moodDescriptors.high;
    if (this.affection >= 30) return this.moodDescriptors.medium;
    return this.moodDescriptors.low;
  }
}

window.EmotionManager = EmotionManager;

// ======= ai-api.js =======
// ai-api.js
async function getCatMessage(scene, mood) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCatMessage', scene, mood }, (response) => {
      if (response && response.message) {
        resolve(response.message);
      } else {
        resolve('喵？');
      }
    });
  });
}
window.getCatMessage = getCatMessage;
// ======= focus-timer.js =======
// focus-timer.js
class FocusTimer {
  constructor(stateMachine, emotionManager, catUI) {
    this.sm = stateMachine;
    this.em = emotionManager;
    this.catUI = catUI;
    this.focusSeconds = 0;
    this.interval = null;
    this.milestones = [15*60, 30*60, 45*60]; // 秒
    this.reachedMilestones = new Set();
  }

  startOrContinue() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.focusSeconds++;
      this.checkMilestones();
    }, 1000);
  }

  pause() {
    clearInterval(this.interval);
    this.interval = null;
  }

  reset() {
    this.pause();
    this.focusSeconds = 0;
    this.reachedMilestones.clear();
  }

  checkMilestones() {
    for (let threshold of this.milestones) {
      if (this.focusSeconds >= threshold && !this.reachedMilestones.has(threshold)) {
        this.reachedMilestones.add(threshold);
        this.sm.onFocusMilestone();
        this.em.addEvent('milestone');
        // 发送奖励消息
        this.sendRewardMessage(threshold);
      }
    }
  }

  async sendRewardMessage(seconds) {
    const mins = Math.floor(seconds / 60);
    const mood = this.em.getMood(); // 从情绪管理器获取当前语气
    const message = await getCatMessage('reward', mood);
    this.catUI.showBubble(`🎉 ${message}`, 5000);
    this.catUI.showEffect('🐟');
  }
}

window.FocusTimer = FocusTimer;
// ======= activity-detector.js =======
// activity-detector.js
const DISTRACTION_SITES = ['youtube.com', 'bilibili.com', 'twitter.com', 'reddit.com', 'tiktok.com', 'zhihu.com'];

class ActivityDetector {
  constructor(stateMachine, focusTimer, emotionManager) {
    this.sm = stateMachine;
    this.ft = focusTimer;
    this.em = emotionManager;
    this.lastActivity = Date.now();
    this.idleThreshold = 5000; // 5秒无操作视为分心前奏
    this.distractionTimer = null;
    this.isActive = true;
  }

  init() {
    document.addEventListener('mousemove', () => this.handleActivity());
    document.addEventListener('keydown', () => this.handleActivity());
    document.addEventListener('click', () => this.handleActivity());
    window.addEventListener('focus', () => this.handleActivity());
    
    // 监听页面URL变化（实际通过 background 监听tab更新更好，这里用MutationObserver简单检测标题变化模拟）
    this.checkUrl();
    setInterval(() => this.checkUrl(), 3000);
  }

  handleActivity() {
    this.lastActivity = Date.now();
    if (!this.isActive) {
      this.isActive = true;
      this.sm.onUserActive();
      this.ft.startOrContinue();
    }
    clearTimeout(this.distractionTimer);
    this.distractionTimer = setTimeout(() => this.checkDistraction(), this.idleThreshold);
  }

  checkDistraction() {
    const now = Date.now();
    if (now - this.lastActivity >= this.idleThreshold) {
      // 用户可能离开
      if (this.isActive) {
        this.isActive = false;
        this.sm.onUserIdle();
        this.ft.pause();
        // 检测当前是否在娱乐网站
        if (this.isDistractingSite()) {
          this.sm.onDistracted();
          this.em.addEvent('distracted');
        }
      }
    }
  }

  isDistractingSite() {
    const host = window.location.hostname;
    return DISTRACTION_SITES.some(s => host.includes(s));
  }

  checkUrl() {
    if (this.isDistractingSite() && this.isActive) {
      // 若用户主动在娱乐网站操作，算作轻度分心
      this.sm.onDistracted();
      this.em.addEvent('distracted');
      setTimeout(() => {
        if (!this.isDistractingSite()) {
          this.sm.onRecoverFromDistraction();
          this.em.addEvent('recovered');
        }
      }, 10000);
    }
  }
}

window.ActivityDetector = ActivityDetector;

// ======= 初始化 =======
(function initFocusPaw() {
  if (document.getElementById('focuspaw-cat')) return; // 防止重复注入

  // 实例化各个模块
  const catUI = new CatUI();
  catUI.init();

  const stateMachine = new StateMachine(catUI);
  const emotionManager = new EmotionManager();
  const focusTimer = new FocusTimer(stateMachine, emotionManager, catUI);
  const activityDetector = new ActivityDetector(stateMachine, focusTimer, emotionManager);

  activityDetector.init();
  focusTimer.startOrContinue(); // 假设页面加载即开始计时

  // 拖拽 + 面板控制变量（必须先声明，供后面的事件处理器使用）
  var isDragging = false, dragDistance = 0, offsetX, offsetY, singleClickTimer;

// 双击抚摸
catUI.catEl.addEventListener('dblclick', () => {
  clearTimeout(singleClickTimer);
  emotionManager.addEvent('pet');
  catUI.playPetAnimation();
  const mood = emotionManager.getMood();
  getCatMessage('reward', mood).then(msg => catUI.showBubble(msg, 3000));
});
  // 自由拖拽 + 单击面板
  catUI.catEl.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragDistance = 0;
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
    catUI.catEl.style.left = (e.clientX - offsetX) + 'px';
    catUI.catEl.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      isDragging = false;
      catUI.catEl.style.transition = 'all 0.5s ease';
      if (dragDistance < 5 && !catUI.panelEl?.contains(e.target)) {
        // 延迟以区分单击和双击（双击时 dblclick 会 clear 此定时器）
        clearTimeout(singleClickTimer);
        singleClickTimer = setTimeout(() => catUI.togglePanel(), 280);
      }
    }
  });

  // === 控制面板按钮事件在 CatUI.createPanel 中直接绑定 ===

  // === 监听 background 消息 ===
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
      case 'timerStarted':
        catUI.showPanel();
        catUI.updateTimerDisplay(msg.duration);
        startTimerTick();
        break;
      case 'timerCancelled':
        catUI.updateTimerDisplay(null);
        stopTimerTick();
        break;
      case 'timerComplete':
        catUI.updateTimerDisplay(0);
        stopTimerTick();
        catUI.showBubble('⏱ 时间到！休息一下吧～ 🎉', 6000);
        catUI.showEffect('🎉');
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
        break;
    }
  });

  // === 计时器本地刷新（显示剩余时间） ===
  let timerTickInterval = null;

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

  // === 初始化时查询是否有计时器在运行（跨 tab 同步） ===
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (status) => {
    if (status && status.running) {
      catUI.updateTimerDisplay(status.remaining);
      startTimerTick();
    }
  });

  console.log('FocusPaw initialized!');
})();