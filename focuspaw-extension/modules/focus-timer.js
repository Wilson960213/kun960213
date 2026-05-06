// focus-timer.js
class FocusTimer {
  constructor(stateMachine, emotionManager, catUI) {
    this.sm = stateMachine;
    this.em = emotionManager;
    this.catUI = catUI;
    this.focusSeconds = 0;
    this.interval = null;
    this.milestones = [10]; // 10秒触发一个里程碑，方便测试 // 秒
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