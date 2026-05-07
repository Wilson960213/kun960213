// background/ai-provider.js — DeepSeek AI 调用
let apiKey = '';

chrome.storage.local.get(['apiKey'], (result) => {
  if (result.apiKey) apiKey = result.apiKey;
});

function setApiKey(key) {
  apiKey = key;
  chrome.storage.local.set({ apiKey: key });
}

// 场景消息 (里程碑/分心提醒)
async function getCatMessage(scene, mood) {
  if (!apiKey) return '我没有联网喵...(请先在扩展设置里填写DeepSeek API Key)';
  const systemPrompt = `你是一只名叫FocusPaw的虚拟猫咪,陪伴主人学习。你的语气是${mood}的。每句话不超过30个字,带一个动作描述。`;
  const userPrompt = scene === 'distracted'
    ? '主人刚刚分心了,请温和提醒Ta'
    : '主人专注达标了,请卖萌鼓励Ta';

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

// AI 对话
async function chatWithCat(history) {
  if (!apiKey) return '我没有联网喵...(请先在扩展设置里填写DeepSeek API Key)';
  const systemPrompt = '你是一只名叫FocusPaw的虚拟猫咪，陪伴主人学习工作。你很友善、有点调皮，偶尔傲娇。每句话不超过50个字，可以带动作描述。';

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const msg of history) {
    messages.push({ role: msg.role === 'cat' ? 'assistant' : 'user', content: msg.text });
  }

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 150,
        temperature: 0.9
      })
    });
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (_) {
    return '喵~（暂时无法回答）';
  }
}

// 网页自动评论
async function analyzePage(pageData) {
  if (!apiKey) return '';
  const systemPrompt = '你是一只名叫FocusPaw的虚拟猫咪，主人正在浏览一个网页。请用猫咪的语气简短评论这个页面（不超过30字），要有猫的特色，可以用"喵"作为开头。';
  const userPrompt = `页面标题：${pageData.title}\n页面描述：${pageData.description || '无'}\n页面内容摘要：${pageData.content || '无'}`;

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 60,
        temperature: 0.8
      })
    });
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (_) {
    return '';
  }
}
