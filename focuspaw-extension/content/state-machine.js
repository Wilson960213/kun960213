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