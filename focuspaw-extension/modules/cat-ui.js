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
  }

  init() {
    this.catEl = document.createElement('div');
    this.catEl.id = 'focuspaw-cat';
    this.catEl.style.backgroundImage = `url(${CAT_SPRITES.idle})`;
    document.body.appendChild(this.catEl);

    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'cat-bubble';
    document.body.appendChild(this.bubbleEl);

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
}

window.CatUI = CatUI;