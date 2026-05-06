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