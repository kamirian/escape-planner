// Escape Planner — optional direct calls to an AI provider with the visitor's own API key.
// Keys go straight from the browser to the chosen provider; this site has no server.
// © 2026 Kiyan Amirian. All rights reserved.
(function(){
const EP = window.EP;

// Model lists were checked against each provider's docs on October 8, 2026. Any model ID can be typed in.
EP.PROVIDERS = {
  claude: {
    label: 'Claude (Anthropic)', models: ['claude-sonnet-5-5','claude-opus-5-5','claude-haiku-5-5','claude-fable-5-1'], model: 'claude-sonnet-5-5',
    keyLabel: 'Anthropic API key', keyHint: 'sk-ant-…', keyUrl: 'https://platform.claude.com/', search: true,
    searchNote: 'Anthropic lists web search at $10 per 1,000 searches, plus normal token costs.'
  },
  openai: {
    label: 'OpenAI', models: ['gpt-6.1-sol','gpt-6-astra','gpt-6-luna'], model: 'gpt-6.1-sol',
    keyLabel: 'OpenAI API key', keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/', search: true,
    searchNote: 'OpenAI charges for web search calls in addition to tokens; see its pricing page.'
  },
  compatible: {
    label: 'Other (OpenAI-compatible)', models: [], model: '', base: 'https://openrouter.ai/api/v1',
    keyLabel: 'API key (if the service needs one)', keyHint: '', keyUrl: '', search: false,
    searchNote: ''
  }
};

const describe = (status, data, fallback) => {
  const msg = data && (data.error?.message || data.error?.error?.message || (typeof data.error === 'string' ? data.error : '') || data.message);
  if (status === 401 || status === 403) return `The provider rejected the API key${msg ? ` (“${msg}”)` : ''}.`;
  if (status === 404) return `The provider couldn’t find that model or address${msg ? ` (“${msg}”)` : ''}. Check the model name.`;
  if (status === 429) return `The provider says you’re over a rate or spending limit${msg ? ` (“${msg}”)` : ''}. Wait a minute or check your account.`;
  if (status >= 500) return `The provider had a temporary problem (${status}). Try again in a few minutes.`;
  return msg ? `The provider returned an error: “${msg}”` : (fallback || `The provider returned an error (${status}).`);
};
const post = async (url, headers, body, signal) => {
  let res;
  try { res = await fetch(url, {method: 'POST', headers, body: JSON.stringify(body), signal}); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Couldn’t reach the provider. Check your internet connection. Some services also block requests made directly from a web page.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describe(res.status, data));
  if (!data) throw new Error('The provider sent an empty or unreadable reply.');
  return data;
};

async function claude({key, model, prompt, search, signal, onStatus}) {
  const messages = [{role: 'user', content: prompt}];
  const body = {model, max_tokens: 32000, messages};
  if (search) body.tools = [{type: 'web_search_20250305', name: 'web_search', max_uses: 25}];
  const blocks = []; const usage = {input: 0, output: 0, searches: 0};
  for (let turn = 0; turn < 6; turn++) {
    const data = await post('https://api.anthropic.com/v1/messages', {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }, body, signal);
    (data.content || []).forEach(b => blocks.push(b));
    usage.input += data.usage?.input_tokens || 0; usage.output += data.usage?.output_tokens || 0;
    usage.searches += data.usage?.server_tool_use?.web_search_requests || 0;
    if (data.stop_reason === 'pause_turn') { // long research turn: send it back to continue
      messages.push({role: 'assistant', content: data.content});
      onStatus?.(`Still researching… ${usage.searches} web searches so far`);
      continue;
    }
    if (data.stop_reason === 'max_tokens') usage.truncated = true;
    if (data.stop_reason === 'refusal') throw new Error('The model declined this request.');
    break;
  }
  // the JSON normally comes after the last search result
  let last = -1; blocks.forEach((b, i) => { if (b.type === 'web_search_tool_result') last = i; });
  const after = blocks.slice(last + 1).filter(b => b.type === 'text').map(b => b.text).join('');
  const all = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
  return {text: after.includes('{') ? after : all, usage};
}

async function openai({key, model, prompt, search, signal}) {
  const body = {model, input: prompt, max_output_tokens: 32000};
  if (search) body.tools = [{type: 'web_search'}];
  const data = await post('https://api.openai.com/v1/responses', {'content-type': 'application/json', 'authorization': `Bearer ${key}`}, body, signal);
  let text = typeof data.output_text === 'string' ? data.output_text : '';
  if (!text) text = (data.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
  const usage = {input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0, searches: (data.output || []).filter(o => o.type === 'web_search_call').length};
  if (data.status === 'incomplete') usage.truncated = true;
  return {text, usage};
}

async function compatible({key, model, prompt, signal, base}) {
  const url = String(base || '').replace(/\/+$/, '') + '/chat/completions';
  if (!/^https?:\/\//.test(url)) throw new Error('Enter the service’s base URL, for example https://openrouter.ai/api/v1');
  const headers = {'content-type': 'application/json'}; if (key) headers.authorization = `Bearer ${key}`;
  const data = await post(url, headers, {model, messages: [{role: 'user', content: prompt}]}, signal);
  const text = data.choices?.[0]?.message?.content || '';
  return {text, usage: {input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0, searches: 0, truncated: data.choices?.[0]?.finish_reason === 'length'}};
}

EP.askAI = (provider, opts) => ({claude, openai, compatible})[provider](opts);
})();
