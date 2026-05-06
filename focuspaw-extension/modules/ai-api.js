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