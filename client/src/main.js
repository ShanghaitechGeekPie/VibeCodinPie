/**
 * 🥧 Vibe Cod'in Pie — Big Screen Frontend
 * Strudel live coding display + Hydra background + QR overlay
 */

import './style.css';

// ── State ───────────────────────────────────────────
let ws = null;
let currentCode = '';
let recentPrompts = [];
let queueSize = 0;
let isPlaying = false;
let strudelRepl = null;

// ── DOM Setup ───────────────────────────────────────
const app = document.getElementById('app');
app.innerHTML = `
  <div id="hydra-canvas-container">
    <canvas id="hydra-canvas"></canvas>
  </div>

  <div id="overlay">
    <div id="header">
      <div id="title">🥧 Vibe Cod'in Pie</div>
      <div id="status">
        <span id="status-dot"></span>
        <span id="status-text">连接中...</span>
      </div>
    </div>

    <div id="main-content">
      <div id="code-container">
        <div id="code-display"></div>
      </div>
      <div id="sidebar">
        <div id="qr-container">
          <div id="qr-code"></div>
          <div id="qr-label">扫码参与 🎵</div>
        </div>
        <div id="queue-info">
          <div id="queue-count">队列: <span id="queue-num">0</span></div>
        </div>
      </div>
    </div>

    <div id="prompt-ticker">
      <div id="prompt-ticker-inner"></div>
    </div>

    <div id="start-overlay">
      <button id="start-btn">🎵 点击开始 🥧</button>
      <p>Vibe Cod'in Pie — GeekPie Pi Day 2026</p>
    </div>
  </div>
`;

// ── Elements ────────────────────────────────────────
const codeDisplay = document.getElementById('code-display');
const qrContainer = document.getElementById('qr-code');
const queueNum = document.getElementById('queue-num');
const promptTicker = document.getElementById('prompt-ticker-inner');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');

// ── Start Button (required for Web Audio) ───────────
startBtn.addEventListener('click', async () => {
  startOverlay.style.display = 'none';
  await initStrudel();
  connectWebSocket();
});

// ── Strudel Integration ─────────────────────────────
async function initStrudel() {
  try {
    // Dynamic import Strudel from CDN
    const { controls, repl } = await import(
      'https://unpkg.com/@strudel/repl@1.1.0/dist/index.mjs'
    );

    strudelRepl = repl({
      defaultOutput: 'speakers',
      editPattern: (pat) => pat,
    });

    isPlaying = true;
    setStatus('connected', '已连接');
    console.log('🎵 Strudel initialized');
  } catch (e) {
    console.error('Failed to init Strudel:', e);
    // Fallback: just display code visually
    setStatus('error', 'Strudel 加载失败');
  }
}

async function evalCode(code) {
  if (!code) return;
  currentCode = code;
  renderCode(code);

  if (strudelRepl) {
    try {
      await strudelRepl.evaluate(code);
      console.log('✅ Code evaluated');
      flashCodeContainer();
    } catch (e) {
      console.warn('⚠️ Eval error (keeping current):', e.message);
    }
  }
}

// ── Code Display ────────────────────────────────────
function renderCode(code) {
  // Simple syntax highlighting
  const highlighted = code
    .split('\n')
    .map(line => {
      let html = escapeHtml(line);
      // Comments
      html = html.replace(/(\/\/.*)$/, '<span class="comment">$1</span>');
      // Strings
      html = html.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>');
      // Numbers
      html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');
      // Keywords / Strudel functions
      html = html.replace(
        /\b(setcps|note|sound|s|n|freq|stack|cat|gain|speed|pan|room|delay|lpf|hpf|vowel|crush|distort|orbit|cut|fast|slow|rev|jux|every|sometimes|often|rarely|degrade|chop|scale|bank)\b/g,
        '<span class="keyword">$1</span>'
      );
      // $: labels
      html = html.replace(/^(\$:)/, '<span class="label">$1</span>');
      // Viz functions
      html = html.replace(
        /(\._(?:pianoroll|scope|spectrum|spiral)\([^)]*\))/g,
        '<span class="viz">$1</span>'
      );
      return html;
    })
    .join('\n');

  codeDisplay.innerHTML = `<pre><code>${highlighted}</code></pre>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function flashCodeContainer() {
  const container = document.getElementById('code-container');
  container.classList.add('flash');
  setTimeout(() => container.classList.remove('flash'), 600);
}

// ── QR Code ─────────────────────────────────────────
function generateQR() {
  // Determine the submit URL
  const host = window.location.hostname;
  const port = 3000;
  const url = `http://${host}:${port}/submit`;

  // Use a simple QR code approach — inline SVG via API
  // In production, generate server-side. For now, use placeholder.
  qrContainer.innerHTML = `
    <img
      src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}&bgcolor=1a1a2e&color=ffffff&format=svg"
      alt="Scan to submit"
      width="120"
      height="120"
    />
  `;
  console.log(`📱 QR points to: ${url}`);
}

// ── Prompt Ticker ───────────────────────────────────
function updateTicker(prompts) {
  recentPrompts = prompts;
  promptTicker.innerHTML = prompts
    .map(p => `<span class="ticker-item">💬 ${escapeHtml(p)}</span>`)
    .join('');
}

// ── Status ──────────────────────────────────────────
function setStatus(state, text) {
  statusDot.className = `status-${state}`;
  statusText.textContent = text;
}

// ── WebSocket with exponential backoff ─────────────
let reconnectAttempts = 0;
let reconnectTimer = null;
let heartbeatTimer = null;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?type=screen`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setStatus('connected', '已连接');
    generateQR();
    reconnectAttempts = 0; // Reset backoff on successful connection
    console.log('🔌 WebSocket connected');

    // Start client-side heartbeat
    startHeartbeat();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      // Handle ping from server
      if (msg.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      handleWsMessage(msg);
    } catch (e) {
      console.error('WS message parse error:', e);
    }
  };

  ws.onclose = (event) => {
    setStatus('disconnected', '断开连接');
    stopHeartbeat();

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWebSocket, delay);
  };

  ws.onerror = (err) => {
    setStatus('error', '连接错误');
    console.error('WS error:', err);
  };
}

function startHeartbeat() {
  stopHeartbeat();
  // Send ping every 25 seconds (before server's 30s timeout)
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'init':
      if (msg.code) evalCode(msg.code);
      if (msg.recentPrompts) updateTicker(msg.recentPrompts);
      queueNum.textContent = msg.queueSize || 0;
      break;

    case 'code_update':
      evalCode(msg.code);
      if (msg.recentPrompts) updateTicker(msg.recentPrompts);
      // Show prompt notification
      if (msg.prompt) showPromptNotification(msg.prompt);
      break;

    case 'queue_update':
      queueNum.textContent = msg.queueSize || 0;
      break;
  }
}

// ── Prompt Notification ─────────────────────────────
function showPromptNotification(prompt) {
  const notif = document.createElement('div');
  notif.className = 'prompt-notification';
  notif.textContent = `💬 "${prompt}"`;
  document.getElementById('overlay').appendChild(notif);

  // Animate in
  requestAnimationFrame(() => notif.classList.add('show'));

  // Remove after 4 seconds
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 500);
  }, 4000);
}

// ── Initialize ──────────────────────────────────────
console.log('🥧 Vibe Cod\'in Pie — Screen loaded');
