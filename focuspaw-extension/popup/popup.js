document.getElementById('saveKey').addEventListener('click', () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    chrome.storage.local.set({ apiKey: key }, () => {
      chrome.runtime.sendMessage({ action: 'updateApiKey', key });
      document.getElementById('status').textContent = 'API Key 已保存！';
    });
  }
});

// 加载已存储的 key
chrome.storage.local.get(['apiKey'], (result) => {
  if (result.apiKey) {
    document.getElementById('apiKeyInput').value = result.apiKey;
  }
});