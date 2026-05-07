# FocusPaw Extension -- Implementation Plan for Three Major Features

## Overview

This document describes the exact changes needed to add three features to the FocusPaw Chrome Extension:
1. Desktop Pet Free Walking
2. AI Chat in Control Panel
3. Auto Webpage Comment

All changes add code to **existing files only**. No new files are created.

---

## Feature 1: Desktop Pet Free Walking

### Design Summary

The cat periodically walks to random viewport positions using CSS transitions. The `walk` sprite is shown during movement and `idle` after arrival. Walking pauses during drag, petting, or active user interaction and resumes after inactivity.

### 1a. Changes to `modules/cat-ui.js`

#### Constructor additions (after existing fields)

```javascript
this.isWalking = false;
this.walkResolve = null;
```

#### New method: `walkTo(x, y, duration)`

```javascript
walkTo(x, y, duration) {
  // Cancel any in-progress walk
  if (this.isWalking) {
    this.catEl.style.transition = 'none';
    void this.catEl.offsetWidth; // force reflow
  }

  this.isWalking = true;
  this.setSprite('walk');

  // Set variable-speed transition, overriding the CSS default
  this.catEl.style.transition = `left ${duration}s ease-out, top ${duration}s ease-out`;
  this.catEl.style.left = x + 'px';
  this.catEl.style.top = y + 'px';
  this.catEl.style.right = 'auto';
  this.catEl.style.bottom = 'auto';

  return new Promise((resolve) => {
    this.walkResolve = resolve;
    // Listen for transition end
    const onEnd = (e) => {
      if (e.propertyName === 'left' || e.propertyName === 'top') {
        this.catEl.removeEventListener('transitionend', onEnd);
        this.isWalking = false;
        // Clear inline transition so CSS default takes back over
        this.catEl.style.transition = '';
        this.setSprite('idle');
        this.walkResolve = null;
        resolve();
      }
    };
    this.catEl.addEventListener('transitionend', onEnd);
    // Safety timeout in case transitionend doesn't fire
    setTimeout(() => {
      if (this.isWalking) {
        this.catEl.removeEventListener('transitionend', onEnd);
        this.catEl.style.transition = '';
        this.isWalking = false;
        this.setSprite('idle');
        resolve();
      }
    }, duration * 1000 + 100);
  });
}
```

Key design points:
- Uses `transitionend` event for precise arrival detection
- Safety `setTimeout` ensures we never get stuck in "walking" state
- `isWalking` flag allows other code to query whether a walk is in progress
- After walk completes, inline transition is cleared so CSS default (`0.25s`) applies again

#### New method: `stopWalkingImmediately()`

```javascript
stopWalkingImmediately() {
  if (this.isWalking) {
    this.catEl.style.transition = 'none';
    void this.catEl.offsetWidth;
    this.catEl.style.transition = '';
    this.isWalking = false;
    this.setSprite('idle');
    if (this.walkResolve) {
      this.walkResolve();
      this.walkResolve = null;
    }
  }
}
```

This is called during drag start to abort any walk in progress without animation.

### 1b. Changes to `content.js`

Add a **Free Walking Manager** inside the IIFE, after the drag logic and before the alarm sound section.

#### New state variables (after `isDragging` declarations, around line 18)

```javascript
var isDragging = false, dragDistance = 0, offsetX, offsetY, singleClickTimer;
// === Walking state ===
var walkingEnabled = true;
var walkTimer = null;
var WALK_INTERVAL_MIN = 8000;   // 8s between walks
var WALK_INTERVAL_MAX = 20000;  // 20s between walks
var WALK_SPEED = 180;           // pixels per second
var WALK_PADDING = 120;         // margin from viewport edges
var IDLE_BEFORE_WALK_RESUME = 5000; // ms of inactivity before walking resumes
```

#### New function: `scheduleNextWalk()`

```javascript
function scheduleNextWalk() {
  cancelNextWalk();
  const delay = WALK_INTERVAL_MIN + Math.random() * (WALK_INTERVAL_MAX - WALK_INTERVAL_MIN);
  walkTimer = setTimeout(performWalk, delay);
}
```

#### New function: `cancelNextWalk()`

```javascript
function cancelNextWalk() {
  if (walkTimer) {
    clearTimeout(walkTimer);
    walkTimer = null;
  }
}
```

#### New function: `performWalk()`

```javascript
function performWalk() {
  // Don't walk if: dragging, petting, cat already walking, user actively typing
  if (isDragging ||
      catUI.currentSprite === 'pet' ||
      catUI.isWalking ||
      catUI.chatInput?.contains(document.activeElement)) {
    scheduleNextWalk();
    return;
  }

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const catW = 256; // cat width
  const catH = 256; // cat height

  // Pick random position, weighted toward bottom third of screen
  const weightedY = Math.random() < 0.6
    ? viewH - catH - WALK_PADDING - Math.random() * (viewH * 0.3)
    : WALK_PADDING + Math.random() * (viewH - catH - WALK_PADDING * 2);

  const targetX = WALK_PADDING + Math.random() * (viewW - catW - WALK_PADDING * 2);
  const targetY = Math.max(WALK_PADDING, Math.min(viewH - catH - WALK_PADDING, weightedY));

  // Get current position
  const rect = catUI.catEl.getBoundingClientRect();
  const dist = Math.sqrt((targetX - rect.left) ** 2 + (targetY - rect.top) ** 2);
  const duration = Math.max(0.3, dist / WALK_SPEED);

  catUI.walkTo(targetX, targetY, duration).then(() => {
    scheduleNextWalk();
  });
}
```

#### Wiring into existing drag logic

At the beginning of the `mousedown` handler (after `isDragging = true`), add:

```javascript
// Abort any walk when user starts dragging
catUI.stopWalkingImmediately();
cancelNextWalk();
```

At the end of the `mouseup` handler (after `isDragging = false`), add:

```javascript
// Resume walking after drag ends, with a delay
walkTimer = setTimeout(scheduleNextWalk, IDLE_BEFORE_WALK_RESUME);
```

#### Wiring into double-click (petting)

In the `dblclick` handler, add:

```javascript
catUI.stopWalkingImmediately();
cancelNextWalk();
// ... existing pet code ...
// Walking will resume after pet animation via the idle-action timeout
```

After the pet animation delay (~1200ms), the walk scheduler should start again. But since `walkStep()` in `startIdleActions` also uses the `walk` sprite briefly, we need to make sure the free walking doesn't conflict. The `startIdleActions` uses `setTimeout` chaining, so once the sprite returns to `idle`, the idle actions loop will continue to schedule new actions. The free walking is independent -- it runs on its own timer.

However, to prevent walking while idle animations are playing, in `performWalk()` we check `catUI.currentSprite === 'idle'` (or `'attentive'`). If the current sprite indicates an animation is in progress, we reschedule.

Update `performWalk()` guard:

```javascript
if (isDragging ||
    catUI.currentSprite === 'pet' ||
    catUI.isWalking ||
    catUI.chatInput?.contains(document.activeElement) ||
    (catUI.currentSprite !== 'idle' && catUI.currentSprite !== 'attentive')) {
  scheduleNextWalk();
  return;
}
```

### 1c. No CSS changes needed

The existing `transition: left 0.25s ... top 0.25s ...` in `#focuspaw-cat` is the **fallback** (used when `style.transition` is cleared). During walking, CatUI sets an inline `transition` with the computed duration, which takes priority. After walking stops, the inline style is cleared and the CSS default takes back over.

---

## Feature 2: AI Chat in Control Panel

### Design Summary

A chat section is added to the existing control panel. Users type messages in a text input, press send, and the cat responds via the DeepSeek API. Responses also appear in the cat's speech bubble. Conversation history (last 4-6 messages) is kept in memory for context.

### 2a. Changes to `modules/cat-ui.js`

#### Constructor additions

```javascript
this.chatHistory = [];
this.chatInput = null;
this.chatSendBtn = null;
this.chatMessagesEl = null;
```

#### In `createPanel()`, add a new `.panel-section` after the alarm section

Insert after the alarm-status div (after the existing `</div>` close of the alarm section):

```javascript
this.panelEl.innerHTML = `
  <div class="panel-section">
    <div class="panel-title">⏱ 倒计时</div>
    ...
  </div>
  <div class="panel-section">
    <div class="panel-title">⏰ 闹钟</div>
    ...
  </div>
  <!-- NEW: AI Chat section -->
  <div class="panel-section">
    <div class="panel-title">💬 和猫咪聊天</div>
    <div class="chat-messages" id="focus-chat-messages"></div>
    <div class="chat-input-row">
      <input type="text" id="focus-chat-input" placeholder="输入你想说的话..." maxlength="200">
      <button id="focus-chat-send">发送</button>
    </div>
  </div>
`;
```

Then after the event bindings for timer/alarm, add:

```javascript
// Chat event bindings
this.chatInput = this.panelEl.querySelector('#focus-chat-input');
this.chatSendBtn = this.panelEl.querySelector('#focus-chat-send');
this.chatMessagesEl = this.panelEl.querySelector('#focus-chat-messages');

this.chatSendBtn.addEventListener('click', () => this.handleChatSend());
this.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') this.handleChatSend();
});
```

#### New method: `handleChatSend()`

```javascript
async handleChatSend() {
  const text = this.chatInput.value.trim();
  if (!text) return;

  this.chatInput.value = '';
  this.addChatMessage('user', text);

  // Show typing indicator
  this.showBubble('🐱 让我想想...', 10000);

  try {
    const response = await chatWithCat(this.chatHistory);
    this.addChatMessage('cat', response);
    // Also show in speech bubble
    this.showBubble('💬 ' + response, 8000);
  } catch (e) {
    this.addChatMessage('cat', '喵？信号不好...（请检查 API Key）');
    this.showBubble('喵？信号不好...', 4000);
  }
}
```

Note: depends on `chatWithCat()` being a global function (registered in ai-api.js).

#### New method: `addChatMessage(role, text)`

```javascript
addChatMessage(role, text) {
  // Add to history
  this.chatHistory.push({ role, content: text });

  // Trim to last 6 messages (3 exchanges)
  if (this.chatHistory.length > 6) {
    // Keep the first system message if any, then trim oldest
    this.chatHistory = this.chatHistory.slice(-6);
  }

  // Render in UI
  const msgEl = document.createElement('div');
  msgEl.className = `chat-message chat-message-${role}`;
  msgEl.innerHTML = role === 'cat'
    ? `<span class="chat-avatar">🐱</span><span class="chat-text">${this.escapeHtml(text)}</span>`
    : `<span class="chat-text">${this.escapeHtml(text)}</span><span class="chat-avatar">👤</span>`;

  this.chatMessagesEl.appendChild(msgEl);
  this.scrollChatToBottom();
}
```

#### New helper: `escapeHtml(str)`

```javascript
escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

#### New helper: `scrollChatToBottom()`

```javascript
scrollChatToBottom() {
  this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
}
```

### 2b. Changes to `modules/ai-api.js`

Add a new function alongside the existing `getCatMessage`:

```javascript
async function chatWithCat(history) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'chatWithCat', history }, (response) => {
      if (response && response.message) {
        resolve(response.message);
      } else {
        resolve('喵？...（没有收到回复）');
      }
    });
  });
}
window.chatWithCat = chatWithCat;
```

### 2c. Changes to `background.js`

Add a new message handler case in the `switch` statement, before `case 'updateApiKey'`:

```javascript
case 'chatWithCat':
  chatWithCat(request.history)
    .then(msg => sendResponse({ message: msg }))
    .catch(err => sendResponse({ message: '喵~（暂时无法说话）' }));
  return true;
```

Add the new async function:

```javascript
async function chatWithCat(history) {
  if (!apiKey) return '请先在扩展设置里填写 DeepSeek API Key 喵...';
  const systemPrompt = '你是FocusPaw，一只爱卖萌的虚拟猫咪桌面宠物。你现在正在和主人聊天。请用可爱的语气回复，每句话不超过40个字，可以适当使用拟声词和颜文字。';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      max_tokens: 150,
      temperature: 0.9
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}
```

Note: `max_tokens` is 150 (versus 60 for the existing `getCatMessage`) because chat responses need more room.

### 2d. CSS additions to `css/cat.css`

Add after the `.alarm-status` block (around line 167):

```css
/* === Chat Panel === */
.cat-control-panel .chat-messages {
  max-height: 160px;
  overflow-y: auto;
  margin-bottom: 6px;
  border: 1px solid #ffe0e8;
  border-radius: 10px;
  padding: 6px 8px;
  background: #fef9fa;
  font-size: 12px;
  scroll-behavior: smooth;
}
.cat-control-panel .chat-message {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 4px;
  line-height: 1.4;
}
.cat-control-panel .chat-message:last-child {
  margin-bottom: 0;
}
.cat-control-panel .chat-message-cat {
  justify-content: flex-start;
}
.cat-control-panel .chat-message-user {
  justify-content: flex-end;
}
.cat-control-panel .chat-avatar {
  font-size: 14px;
  flex-shrink: 0;
}
.cat-control-panel .chat-text {
  background: white;
  padding: 3px 8px;
  border-radius: 10px;
  max-width: 160px;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.cat-control-panel .chat-message-cat .chat-text {
  background: #fff0f3;
  border: 1px solid #ffd6de;
  color: #a3515e;
}
.cat-control-panel .chat-message-user .chat-text {
  background: #f0f4ff;
  border: 1px solid #d0d9ff;
  color: #3d4f8a;
}
.cat-control-panel .chat-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.cat-control-panel .chat-input-row input[type="text"] {
  flex: 1;
  padding: 5px 8px;
  border: 1.5px solid #ffb6c1;
  border-radius: 10px;
  font-size: 12px;
  color: #333;
  outline: none;
}
.cat-control-panel .chat-input-row input[type="text"]:focus {
  border-color: #e88a9a;
}
.cat-control-panel .chat-input-row button {
  padding: 5px 12px;
  border: 1.5px solid #ffb6c1;
  border-radius: 10px;
  background: #ffb6c1;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.cat-control-panel .chat-input-row button:hover {
  background: #e88a9a;
}
```

---

## Feature 3: Auto Webpage Comment

### Design Summary

When the cat first appears on a page, it extracts the page title, meta description, and first ~500 chars of body text, sends them to the DeepSeek API with a cat-personality prompt, and shows the response in the speech bubble. This happens once per page load, respecting SPA navigation.

### 3a. Changes to `content.js`

#### Add page comment function

After the `stopTimerTick` function (around line 177), add:

```javascript
// === Auto Webpage Comment ===
var pageCommented = false;
var currentPageUrl = location.href;

function extractPageContent() {
  const title = document.title || '';
  const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
  // Get first ~500 chars of body text, cleaned up
  const bodyText = document.body?.innerText || '';
  const content = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500);
  return { title, metaDesc, content };
}

async function commentOnPage() {
  if (pageCommented) return;
  // Don't comment if page hasn't loaded or is hidden
  if (document.hidden || document.readyState !== 'complete') return;
  // Don't comment on blank/about pages
  if (!document.body || !document.body.innerText?.trim()) return;

  const pageData = extractPageContent();
  if (!pageData.title && !pageData.content) return;

  pageCommented = true;

  try {
    const comment = await analyzePage(pageData);
    catUI.showBubble('💭 ' + comment, 8000);
  } catch (e) {
    // Silently fail -- not critical
  }
}

function resetPageComment() {
  if (location.href !== currentPageUrl) {
    currentPageUrl = location.href;
    pageCommented = false;
    // Re-comment on SPA navigation, with short delay for content to render
    setTimeout(commentOnPage, 1500);
  }
}
```

#### Call on initialization

At the end of `initFocusPaw()`, before the `chrome.runtime.sendMessage({ action: 'getTimerStatus' })` call, add:

```javascript
// Auto page comment
if (document.readyState === 'complete') {
  commentOnPage();
} else {
  document.addEventListener('DOMContentLoaded', commentOnPage);
}
```

Wait - `DOMContentLoaded` might fire before `complete`. Let me reconsider. The content script is already injected after DOMContentLoaded (default behaviour for <all_urls>). Actually, Chrome content scripts run after DOMContentLoaded by default for document_end injection. But actually for <all_urls> with no `run_at` specified, Chrome defaults to `document_idle` which is after DOMContentLoaded.

So we can just call `commentOnPage()` directly. But let me add a check for `document.readyState` just to be safe.

```javascript
// Auto page comment
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', commentOnPage);
} else {
  commentOnPage();
}
```

#### SPA navigation detection

Add after the `commentOnPage` declaration:

```javascript
// SPA navigation detection
function patchHistoryMethod(methodName) {
  const orig = history[methodName];
  history[methodName] = function(...args) {
    orig.apply(this, args);
    resetPageComment();
  };
}
patchHistoryMethod('pushState');
patchHistoryMethod('replaceState');

window.addEventListener('popstate', resetPageComment);
window.addEventListener('hashchange', resetPageComment);
```

#### Visibility change handling

Add to the existing `visibilitychange` listener (around line 180):

```javascript
document.addEventListener('visibilitychange', () => {
  // Existing timer code...
  if (document.hidden) return;
  
  // Auto page comment on return (if hasn't commented yet)
  commentOnPage();
  
  // ... rest of existing timer code ...
```

But wait, the existing `visibilitychange` handler already has a guard `if (document.hidden) return;`. So we just need to add `commentOnPage()` after that guard.

Actually, the existing `visibilitychange` handler has its own logic. Let me add the comment call before the existing code, or integrate it:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  
  // Auto page comment on return
  commentOnPage();
  
  // Existing timer sync code...
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (status) => {
    // ...
  });
});
```

### 3b. Changes to `modules/ai-api.js`

Add a new function:

```javascript
async function analyzePage(pageData) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'analyzePage', pageData }, (response) => {
      if (response && response.message) {
        resolve(response.message);
      } else {
        resolve('这个页面看起来不错喵~');
      }
    });
  });
}
window.analyzePage = analyzePage;
```

### 3c. Changes to `background.js`

Add a new message handler case:

```javascript
case 'analyzePage':
  analyzePage(request.pageData)
    .then(msg => sendResponse({ message: msg }))
    .catch(err => sendResponse({ message: '喵~（这个页面看起来不错）' }));
  return true;
```

Add the new async function:

```javascript
async function analyzePage(pageData) {
  if (!apiKey) return '喵（没有API Key，无法评论页面）';
  const systemPrompt = '你是一只名叫FocusPaw的虚拟猫咪，正在浏览网页。用可爱简短的语言（不超过30字）评论这个页面的内容，语气像猫咪一样好奇又带点傲娇。可以吐槽也可以夸赞，但要简短。';
  const userPrompt = `我正在看这个页面：\n标题：${pageData.title}\n描述：${pageData.metaDesc}\n内容摘要：${pageData.content}\n\n请用猫咪的口吻简短评论一下这个页面。`;

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
```

---

## New Message Types Summary

| Action | Source | Destination | Payload | Response | max_tokens |
|---|---|---|---|---|---|
| `chatWithCat` | content (cat-ui.js) | background | `{ history: [{role, content}, ...] }` | `{ message: string }` | 150 |
| `analyzePage` | content (ai-api.js) | background | `{ pageData: { title, metaDesc, content } }` | `{ message: string }` | 60 |

No changes to existing message types.

---

## Summary of All Changes per File

### `modules/cat-ui.js`
- Constructor: add `this.isWalking = false`, `this.walkResolve = null`, `this.chatHistory = []`, `this.chatInput = null`, `this.chatSendBtn = null`, `this.chatMessagesEl = null`
- New method: `walkTo(x, y, duration)` -- walks cat to position using CSS transition
- New method: `stopWalkingImmediately()` -- aborts walk without animation
- In `createPanel()`: add chat section HTML after alarm section
- New method: `handleChatSend()` -- sends chat message via API
- New method: `addChatMessage(role, text)` -- renders message + manages history
- New helper: `escapeHtml(str)` -- XSS safety
- New helper: `scrollChatToBottom()` -- keeps chat scrolled

### `modules/ai-api.js`
- New function: `chatWithCat(history)` -- sends chat conversation to background
- New function: `analyzePage(pageData)` -- sends page data to background for commenting
- Both registered as `window.*` globals

### `background.js`
- New case in message switch: `'chatWithCat'`
- New case in message switch: `'analyzePage'`
- New async function: `chatWithCat(history)` -- DeepSeek fetch with max_tokens=150
- New async function: `analyzePage(pageData)` -- DeepSeek fetch with max_tokens=60

### `content.js`
- New state variables: `walkingEnabled`, `walkTimer`, constants for walk intervals/speed/padding
- New functions: `scheduleNextWalk()`, `cancelNextWalk()`, `performWalk()`
- Modified `mousedown`: add `catUI.stopWalkingImmediately()`, `cancelNextWalk()`
- Modified `mouseup`: add `walkTimer = setTimeout(scheduleNextWalk, 5000)`
- Modified `dblclick`: add `catUI.stopWalkingImmediately()`, `cancelNextWalk()`
- New variables: `pageCommented`, `currentPageUrl`
- New functions: `extractPageContent()`, `commentOnPage()`, `resetPageComment()`
- New SPA navigation: `patchHistoryMethod('pushState')`, `patchHistoryMethod('replaceState')`, `popstate`, `hashchange` listeners
- Call `commentOnPage()` on initialization
- Add `commentOnPage()` to `visibilitychange` handler

### `css/cat.css`
- Add `.chat-messages`, `.chat-message`, `.chat-message-cat`, `.chat-message-user`, `.chat-avatar`, `.chat-text`, `.chat-input-row`, `.chat-input-row input`, `.chat-input-row button` styles

---

## Potential Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Transition conflict**: walking sets inline transition; drag sets `transition: none` | `stopWalkingImmediately()` clears walking state when drag starts; drag's `transition: none` takes priority inline |
| **`transitionend` not firing** (e.g., tab hidden) | Safety `setTimeout` in `walkTo()` resolves the promise after `duration + 100ms` |
| **walk sprite persists** if walk interrupted | `stopWalkingImmediately()` always resets sprite to `idle` |
| **Chat history grows unbounded** | Trimmed to last 6 messages in `addChatMessage()` |
| **SPA comment fires on every tiny URL change** | `resetPageComment()` only resets when `location.href` actually changes; `setTimeout(1500ms)` waits for SPA content to render |
| **Page content sent to API contains sensitive data** | Only first 500 chars of body text are sent; title and meta description are already public |
| **Walking during idle animation** | `performWalk()` checks `currentSprite !== 'idle' && currentSprite !== 'attentive'` and reschedules |
| **Walking during chat typing** | `performWalk()` checks `chatInput?.contains(document.activeElement)` |

---

## Verification Steps

### Feature 1: Free Walking
1. Load extension on any page
2. Wait 8-20 seconds -- cat should walk to a random position
3. Observe `walk` sprite during movement, `idle` after arrival
4. Start dragging the cat -- walk should immediately stop
5. Release drag -- walking should resume after ~5 seconds
6. Double-click the cat to pet -- walking should pause during pet animation
7. Move mouse near cat (optional proximity behavior)

### Feature 2: AI Chat
1. Click cat to open control panel
2. Type a message in the chat input and press Enter or click Send
3. Verify message appears in chat history with user avatar
4. Verify cat avatar displays cat response
5. Verify response also appears in speech bubble
6. Close panel, reopen -- chat history persists
7. Send 4+ messages -- verify only last 6 messages are kept (trim oldest)
8. Verify API Key requirement (shows error message if no key configured)

### Feature 3: Auto Webpage Comment
1. Navigate to any normal web page (e.g., example.com)
2. On first load, cat should show a comment in the speech bubble within ~2 seconds
3. Comment should be relevant to the page content
4. Refresh the page -- comment should appear again
5. Navigate to a new page (same tab) -- comment should appear on the new page
6. Test SPA: navigate within a SPA (e.g., GitHub issues tab) -- cat should comment on the new "page"
7. Verify cat does NOT comment again if URL hasn't changed
