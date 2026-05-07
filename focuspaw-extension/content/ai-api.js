// ai-api.js
async function getCatMessage(scene, mood, character) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCatMessage', scene, mood, character }, (response) => {
      if (response && response.message) {
        resolve(response.message);
      } else {
        resolve('喵？');
      }
    });
  });
}
window.getCatMessage = getCatMessage;

// AI 对话：发送聊天历史，返回猫咪回复
async function chatWithCat(history, character) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'chatWithCat', history, character }, (response) => {
      resolve(response?.message || '喵？');
    });
  });
}
window.chatWithCat = chatWithCat;

// 网页分析：发送页面信息，返回猫咪评论
async function analyzePage(pageData, character) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'analyzePage', ...pageData, character }, (response) => {
      resolve(response?.message || '');
    });
  });
}
window.analyzePage = analyzePage;