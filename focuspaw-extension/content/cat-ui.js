// cat-ui.js
const CHARACTERS = {
  cat: {
    name: '猫咪',
    avatar: '🐱',
    sprites: {
      idle: chrome.runtime.getURL('assets/cat/idle.png'),
      attentive: chrome.runtime.getURL('assets/cat/attentive.png'),
      remind: chrome.runtime.getURL('assets/cat/remind.png'),
      reward: chrome.runtime.getURL('assets/cat/reward.png'),
      pet: chrome.runtime.getURL('assets/cat/pet.png'),
      sleep: chrome.runtime.getURL('assets/cat/sleep.png'),
      blink: chrome.runtime.getURL('assets/cat/blink.png'),
      walk: chrome.runtime.getURL('assets/cat/walk.png')
    }
  },
  nalong: {
    name: '奶龙',
    avatar: '🐉',
    sprites: {
      idle: chrome.runtime.getURL('assets/nalong/idle1.png'),
      attentive: chrome.runtime.getURL('assets/nalong/attentive1.png'),
      remind: chrome.runtime.getURL('assets/nalong/remind1.png'),
      reward: chrome.runtime.getURL('assets/nalong/reward1.png'),
      sleep: chrome.runtime.getURL('assets/nalong/sleep1.png'),
      pet: chrome.runtime.getURL('assets/nalong/idle1.png'),
      blink: chrome.runtime.getURL('assets/nalong/idle1.png'),
      walk: chrome.runtime.getURL('assets/nalong/idle1.png')
    }
  }
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
    // 角色
    this.currentChar = 'cat';
    // 视频
    this.videoEl = null;
    this.isLaughing = false;
    // 聊天
    this.chatHistory = [];
    this.isNearMouse = false;
  }

  init() {
    this.catEl = document.createElement('div');
    this.catEl.id = 'focuspaw-cat';
    this.applySprite('idle');
    document.body.appendChild(this.catEl);

    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'cat-bubble';
    this.catEl.appendChild(this.bubbleEl);

    // 视频层
    this.videoEl = document.createElement('video');
    this.videoEl.className = 'cat-video-player';
    this.videoEl.preload = 'auto';
    this.videoEl.muted = false;
    this.videoEl.style.display = 'none';
    this.videoEl.src = chrome.runtime.getURL('assets/cat/laugh.mp4');
    this.catEl.appendChild(this.videoEl);
    this.videoEl.onended = () => {
      this.videoEl.style.display = 'none';
      this.isLaughing = false;
    };

    this.startIdleActions();
    this.loadCharacterPref();
  }

  get sprites() {
    return CHARACTERS[this.currentChar].sprites;
  }

  get charName() {
    return CHARACTERS[this.currentChar].name;
  }

  get charAvatar() {
    return CHARACTERS[this.currentChar].avatar;
  }

  applySprite(state) {
    if (this.catEl && this.sprites[state]) {
      this.catEl.style.backgroundImage = `url(${this.sprites[state]})`;
      this.currentSprite = state;
      if (state === 'sleep') {
        this.catEl.classList.add('cat-sleep-breathe');
      } else {
        this.catEl.classList.remove('cat-sleep-breathe');
      }
    }
  }

  setSprite(state) {
    this.applySprite(state);
  }

  loadCharacterPref() {
    chrome.storage.local.get(['focuspawCharacter'], (result) => {
      if (result.focuspawCharacter && CHARACTERS[result.focuspawCharacter]) {
        this.switchCharacter(result.focuspawCharacter, true);
      }
    });
  }

  switchCharacter(name, silent = false) {
    if (!CHARACTERS[name] || name === this.currentChar) return;
    this.currentChar = name;
    this.applySprite('idle');
    chrome.storage.local.set({ focuspawCharacter: name });
    // 更新气泡中的头像
    document.querySelectorAll('.chat-avatar').forEach(el => {
      el.textContent = this.charAvatar;
    });
    // 更新面板标题
    const title = this.panelEl?.querySelector('#chat-section-title');
    if (title) title.textContent = `💬 和${this.charName}聊天`;
    // 更新角色切换按钮状态
    const btns = this.panelEl?.querySelectorAll('.char-btn');
    if (btns) btns.forEach(b => b.classList.toggle('active', b.dataset.char === name));
    // 更新视频源
    if (this.videoEl) this.videoEl.src = chrome.runtime.getURL(`assets/${name}/laugh.mp4`);
    if (!silent) this.showBubble(`切换成${this.charName}啦～`, 2500);
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

  playPetAnimation() {
    this.setSprite('pet');
    this.showEffect('❤️');
    setTimeout(() => {
      this.setSprite('idle');
    }, 1200);
  }

  playLaughVideo() {
    this.isLaughing = true;
    const src = chrome.runtime.getURL(`assets/${this.currentChar}/laugh.mp4`);
    if (this.videoEl.src !== src) this.videoEl.src = src;
    this.videoEl.style.display = 'block';
    this.videoEl.currentTime = 0;
    const promise = this.videoEl.play();
    if (promise !== undefined) {
      promise.catch(() => {
        this.isLaughing = false;
        this.videoEl.style.display = 'none';
      });
    }
  }

  // === 待机小动作 ===
  blink() {
    this.setSprite('blink');
    setTimeout(() => this.setSprite('idle'), 150);
  }

  hop() {
    this.catEl.classList.remove('cat-hop');
    void this.catEl.offsetWidth;
    this.catEl.classList.add('cat-hop');
    setTimeout(() => this.catEl.classList.remove('cat-hop'), 800);
  }

  lookAround() {
    this.catEl.classList.remove('cat-look-around');
    void this.catEl.offsetWidth;
    this.catEl.classList.add('cat-look-around');
    setTimeout(() => this.catEl.classList.remove('cat-look-around'), 700);
  }

  stretch() {
    this.catEl.classList.remove('cat-stretch');
    void this.catEl.offsetWidth;
    this.catEl.classList.add('cat-stretch');
    setTimeout(() => this.catEl.classList.remove('cat-stretch'), 1300);
  }

  sway() {
    this.catEl.classList.remove('cat-sway');
    void this.catEl.offsetWidth;
    this.catEl.classList.add('cat-sway');
    setTimeout(() => this.catEl.classList.remove('cat-sway'), 800);
  }

  walkStep() {
    this.setSprite('walk');
    setTimeout(() => this.setSprite('idle'), 300);
  }

  startIdleActions() {
    const loop = () => {
      if (this.isLaughing || (this.currentSprite !== 'idle' && this.currentSprite !== 'attentive')) {
        setTimeout(loop, 2000);
        return;
      }

      if (this.currentSprite === 'attentive') {
        // 工作中 → 活泼动画
        const r = Math.random();
        if (r < 0.20) {
          this.blink();
        } else if (r < 0.40) {
          this.sway();
        } else if (r < 0.57) {
          this.hop();
        } else if (r < 0.73) {
          this.lookAround();
        } else {
          this.stretch();
        }
        setTimeout(loop, 3000 + Math.random() * 5000);
      } else {
        // 空闲中 → 偶尔眨眼，保持安静
        if (Math.random() < 0.35) this.blink();
        setTimeout(loop, 4000 + Math.random() * 6000);
      }
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
      <div class="panel-section">
        <div class="panel-title">🎭 角色</div>
        <div class="char-selector">
          <button class="char-btn active" data-char="cat">🐱 猫咪</button>
          <button class="char-btn" data-char="nalong">🐉 奶龙</button>
        </div>
      </div>
      <div class="panel-section">
        <div class="panel-title" id="chat-section-title">💬 和${this.charName}聊天</div>
        <div class="chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="和猫咪说说话...">
          <button id="chat-send">发送</button>
        </div>
      </div>
    `;
    this.panelEl.addEventListener('click', (e) => e.stopPropagation());

    // 按钮事件
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

    // 角色切换
    this.panelEl.querySelectorAll('.char-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchCharacter(btn.dataset.char));
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
    if (!this.panelEl) {
      this.createPanel();
      this.initChat();
    }
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

  // === 聊天 ===
  initChat() {
    const input = this.panelEl?.querySelector('#chat-input');
    const sendBtn = this.panelEl?.querySelector('#chat-send');
    if (!input || !sendBtn) return;

    const onSend = () => this.handleChatSend(input);
    sendBtn.addEventListener('click', onSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSend(); });
  }

  handleChatSend(input) {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.addChatMessage('user', text);
    this.chatHistory.push({ role: 'user', text });

    this.showBubble('(思索中...)', 3000);
    chatWithCat(this.chatHistory, this.currentChar).then((reply) => {
      const replyText = reply || '喵？';
      this.addChatMessage('cat', replyText);
      this.chatHistory.push({ role: 'cat', text: replyText });
      this.showBubble(replyText, 5000);
      // 保持最近 6 条
      if (this.chatHistory.length > 6) {
        this.chatHistory = this.chatHistory.slice(-6);
      }
    });
  }

  addChatMessage(role, text) {
    const container = this.panelEl?.querySelector('.chat-messages');
    if (!container) return;

    const row = document.createElement('div');
    row.className = `chat-message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;

    if (role === 'cat') {
      const avatar = document.createElement('span');
      avatar.className = 'chat-avatar';
      avatar.textContent = this.charAvatar;
      row.appendChild(avatar);
    }
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.CatUI = CatUI;
