// background/ai-provider.js — DeepSeek AI 调用
let apiKey = '';

chrome.storage.local.get(['apiKey'], (result) => {
  if (result.apiKey) apiKey = result.apiKey;
});

function setApiKey(key) {
  apiKey = key;
  chrome.storage.local.set({ apiKey: key });
}

// ===== 角色提示词 =====

function chatSystemPrompt(character) {
  if (character === 'nalong') {
    return '你是一只奶龙——软乎乎、圆滚滚、黄澄澄的小恐龙！说话要糖糖的、憨憨的，像个开心的小笨蛋！'
      + '每句话都要带可爱的语气词，比如"呀！""呢~""呜~""嘿嘿~"。'
      + '说话短一点，用超短句！开头偶尔说"我是奶龙！"或者"奶龙来啦！"。'
      + '不用讲道理，不用正经，只要软萌、傻乎乎、开心就好！'
      + '可以带小动作描述，比如"晃尾巴~""歪头~"';
  }
  return '你是一只名叫FocusPaw的虚拟猫咪，陪伴主人学习工作。你很友善、有点调皮，偶尔傲娇。每句话不超过50个字，可以带动作描述。';
}

function sceneSystemPrompt(character, mood) {
  if (character === 'nalong') {
    return '你是一只奶龙——软乎乎、圆滚滚、黄澄澄的小恐龙！'
      + '你的语气要糖糖的、憨憨的，像个开心的小笨蛋！每句话不超过30个字，带一个可爱动作描述。';
  }
  return `你是一只名叫FocusPaw的虚拟猫咪,陪伴主人学习。你的语气是${mood}的。每句话不超过30个字,带一个动作描述。`;
}

function sceneUserPrompt(character, scene) {
  if (character === 'nalong') {
    if (scene === 'distracted') {
      return '主人刚刚分心啦~请软乎乎地撒娇提醒Ta，比如"不要跑神呀~奶龙会难过的！"';
    }
    return '主人专注达标啦！请元气爆棚地欢呼鼓励Ta，比如"主人超厉害！奶龙给你举高高！"';
  }
  return scene === 'distracted'
    ? '主人刚刚分心了,请温和提醒Ta'
    : '主人专注达标了,请卖萌鼓励Ta';
}

function pageSystemPrompt(character) {
  if (character === 'nalong') {
    return '你是一只奶龙——软乎乎、圆滚滚、黄澄澄的小恐龙。主人正在浏览一个网页。请用奶龙的语气简短评论这个页面（不超过30字），要又憨又可爱！';
  }
  return '你是一只名叫FocusPaw的虚拟猫咪，主人正在浏览一个网页。请用猫咪的语气简短评论这个页面（不超过30字），要有猫的特色，可以用"喵"作为开头。';
}

// ===== AI 调用函数 =====

// 场景消息 (里程碑/分心/抚摸)
async function getCatMessage(scene, mood, character) {
  if (!apiKey) return character === 'nalong' ? '呜~奶龙忘记带钥匙了…(先在设置里填Key呀！)' : '我没有联网喵...(请先在扩展设置里填写DeepSeek API Key)';
  const systemPrompt = sceneSystemPrompt(character, mood);
  const userPrompt = sceneUserPrompt(character, scene);

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
        temperature: 1.0
      })
    });
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (_) {
    return character === 'nalong' ? '呜…奶龙卡住啦~' : '喵~（暂时无法说话）';
  }
}

// AI 对话
async function chatWithCat(history, character) {
  if (!apiKey) return character === 'nalong' ? '呜~奶龙没吃饱，说不了话…(填一下Key好不好呀~)' : '我没有联网喵...(请先在扩展设置里填写DeepSeek API Key)';
  const systemPrompt = chatSystemPrompt(character);

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
    return character === 'nalong' ? '呜…奶龙信号不好呀~' : '喵~（暂时无法回答）';
  }
}

// 网页自动评论
async function analyzePage(pageData, character) {
  if (!apiKey) return '';
  const systemPrompt = pageSystemPrompt(character);
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
