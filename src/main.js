const DEFAULT_ENDPOINT = 'http://localhost:11434';
const STORAGE_KEY = 'qynl-ai-state-v1';
const SYSTEM_PROMPT = 'You are Qynl AI, a fast, practical local assistant. Be accurate, friendly, proactive, and use Markdown for structured answers.';

const icons = {
  bot: '🤖', user: '👤', spark: '✨', plug: '⚡', brain: '🧠', send: '➤', copy: '⧉', stop: '■'
};

const initial = loadState() ?? {
  endpoint: DEFAULT_ENDPOINT,
  model: '',
  temperature: 0.7,
  theme: 'dark',
  messages: [{ id: crypto.randomUUID(), role: 'assistant', content: 'Hi — I’m Qynl AI. Connect me to Ollama, pick a model, and I’ll help with writing, coding, planning, and more.', createdAt: Date.now() }]
};

let state = initial;
let models = [];
let status = { kind: 'checking', text: 'Checking Ollama…' };
let isThinking = false;
let showSettings = false;
let abortController = null;

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.documentElement.dataset.theme = state.theme;
}

function html(strings, ...values) {
  return strings.map((string, index) => string + (values[index] ?? '')).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function markdownish(text) {
  const escaped = escapeHtml(text || 'Thinking…');
  return escaped
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-*] (.*$)/gim, '<li>$1</li>')
    .replace(/\n/g, '<br />');
}

function render() {
  saveState();
  const selectedModel = state.model || models[0]?.name || '';
  const userTurns = state.messages.filter(m => m.role === 'user').length;
  const assistantTurns = state.messages.filter(m => m.role === 'assistant').length;
  document.querySelector('#root').innerHTML = html`
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">${icons.brain}</div><div><strong>Qynl AI</strong><span>Local Ollama Assistant</span></div></div>
        <button class="primary-action" data-action="new">＋ New chat</button>
        <section class="panel glow"><div class="status-row"><span class="status-dot ${status.kind}"></span>${escapeHtml(status.text)}</div><button class="ghost" data-action="refresh">${icons.plug} Reconnect</button></section>
        <section class="panel">
          <label>Model</label>
          <select id="model">${models.length ? models.map(model => `<option ${model.name === selectedModel ? 'selected' : ''}>${escapeHtml(model.name)}</option>`).join('') : '<option>No models found</option>'}</select>
          <label>Creativity: <span id="tempLabel">${state.temperature}</span></label>
          <input id="temperature" type="range" min="0" max="1.5" step="0.1" value="${state.temperature}" />
        </section>
        <section class="panel mini-grid"><div><strong>${userTurns}</strong><span>Your prompts</span></div><div><strong>${assistantTurns}</strong><span>AI replies</span></div></section>
        <div class="sidebar-footer">
          <button class="icon-button" data-action="settings">⚙</button><button class="icon-button" data-action="export">⇩</button><button class="icon-button" data-action="clear">🗑</button><button class="icon-button" data-action="theme">${state.theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>
      <section class="chat-area">
        <header class="hero"><div><div class="eyebrow">${icons.spark} Private, local, beautiful</div><h1>Ask better. Think faster. Keep it on your machine.</h1><p>Qynl streams responses from Ollama, remembers the chat locally, and gives you a polished workspace for everyday AI help.</p></div><div class="hero-card">✅ Streaming chat<br /><span>Markdown-style answers, copy actions, export, themes, and robust error guidance.</span></div></header>
        ${showSettings ? `<section class="settings-card"><label>Ollama endpoint</label><input id="endpoint" value="${escapeHtml(state.endpoint)}" /><p>If the browser blocks requests, start Ollama with <code>OLLAMA_ORIGINS=*</code> for local development.</p></section>` : ''}
        <div class="messages">${state.messages.length ? state.messages.map(messageTemplate).join('') : '<div class="empty-state"><h2>Fresh chat ready</h2><p>Try: “Plan my week”, “Review this code”, or “Write a launch announcement”.</p></div>'}<div id="bottom"></div></div>
        <form class="composer"><textarea id="prompt" placeholder="${selectedModel ? 'Message Qynl AI…' : 'Install a model first, e.g. ollama pull llama3.1'}"></textarea>${isThinking ? `<button type="button" data-action="stop">${icons.stop} Stop</button>` : `<button type="submit" ${selectedModel ? '' : 'disabled'}>${icons.send} Send</button>`}</form>
      </section>
    </main>`;
  wireEvents();
  document.querySelector('#bottom')?.scrollIntoView({ behavior: 'smooth' });
}

function messageTemplate(message) {
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt);
  return `<article class="message ${message.role}"><div class="avatar">${message.role === 'user' ? icons.user : icons.bot}</div><div class="bubble"><div class="message-meta"><strong>${message.role === 'user' ? 'You' : 'Qynl'}</strong><span>${time}</span>${message.streaming ? '<span class="spin">◌</span>' : ''}</div><div class="message-content">${markdownish(message.content)}</div>${message.content ? `<button class="copy" data-copy="${message.id}">${icons.copy} Copy</button>` : ''}</div></article>`;
}

function wireEvents() {
  document.querySelector('[data-action="new"]')?.addEventListener('click', () => { state.messages = []; render(); });
  document.querySelector('[data-action="clear"]')?.addEventListener('click', () => { state.messages = []; render(); });
  document.querySelector('[data-action="refresh"]')?.addEventListener('click', refreshModels);
  document.querySelector('[data-action="settings"]')?.addEventListener('click', () => { showSettings = !showSettings; render(); });
  document.querySelector('[data-action="theme"]')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; render(); });
  document.querySelector('[data-action="export"]')?.addEventListener('click', exportChat);
  document.querySelector('[data-action="stop"]')?.addEventListener('click', () => abortController?.abort());
  document.querySelector('#model')?.addEventListener('change', event => { state.model = event.target.value; render(); });
  document.querySelector('#temperature')?.addEventListener('input', event => { state.temperature = event.target.value; render(); });
  document.querySelector('#endpoint')?.addEventListener('change', event => { state.endpoint = event.target.value || DEFAULT_ENDPOINT; refreshModels(); });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => navigator.clipboard.writeText(state.messages.find(m => m.id === button.dataset.copy)?.content ?? '')));
  document.querySelector('.composer')?.addEventListener('submit', sendMessage);
  document.querySelector('#prompt')?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) sendMessage(event); });
}

async function refreshModels() {
  status = { kind: 'checking', text: 'Checking Ollama…' }; render();
  try {
    const response = await fetch(`${state.endpoint.replace(/\/$/, '')}/api/tags`);
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    models = data.models ?? [];
    state.model ||= models[0]?.name || '';
    status = models.length ? { kind: 'online', text: `${models.length} model${models.length === 1 ? '' : 's'} ready` } : { kind: 'warning', text: 'Ollama is running, but no models are installed' };
  } catch {
    models = [];
    status = { kind: 'offline', text: 'Ollama is not reachable. Start it with `ollama serve`.' };
  }
  render();
}

async function sendMessage(event) {
  event.preventDefault();
  const promptBox = document.querySelector('#prompt');
  const prompt = promptBox.value.trim();
  const selectedModel = state.model || models[0]?.name || '';
  if (!prompt || !selectedModel || isThinking) return;
  const userMessage = { id: crypto.randomUUID(), role: 'user', content: prompt, createdAt: Date.now() };
  const assistantMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: Date.now(), streaming: true };
  const conversation = [...state.messages, userMessage];
  state.messages = [...state.messages, userMessage, assistantMessage];
  isThinking = true; render();
  abortController = new AbortController();
  try {
    const response = await fetch(`${state.endpoint.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abortController.signal,
      body: JSON.stringify({ model: selectedModel, stream: true, options: { temperature: Number(state.temperature) }, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...conversation.map(({ role, content }) => ({ role, content }))] })
    });
    if (!response.ok || !response.body) throw new Error(`Ollama returned ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);
        assistantMessage.content += chunk.message?.content ?? '';
        state.messages = state.messages.map(m => m.id === assistantMessage.id ? { ...assistantMessage } : m);
        render();
      }
    }
  } catch (error) {
    assistantMessage.content = error.name === 'AbortError' ? 'Stopped generating.' : `I could not reach Ollama. Make sure Ollama is running, CORS is allowed for this app, and the selected model is installed.\n\nDetails: ${error.message}`;
  } finally {
    assistantMessage.streaming = false;
    state.messages = state.messages.map(m => m.id === assistantMessage.id ? { ...assistantMessage } : m);
    isThinking = false; abortController = null; render();
  }
}

function exportChat() {
  const blob = new Blob([JSON.stringify(state.messages, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `qynl-chat-${new Date().toISOString().slice(0, 10)}.json` });
  link.click(); URL.revokeObjectURL(url);
}

render();
refreshModels();
