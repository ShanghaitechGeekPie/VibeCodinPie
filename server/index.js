/**
 * 🥧 Vibe Cod'in Pie — Main Server
 * Express + WebSocket server for the AI-driven live coding music system
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (one level up from server/)
const __dirname_early = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname_early, '..', '.env') });

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { PromptQueue } from './queue.js';
import { generateCode } from './ai.js';
import { validateCode } from './validator.js';
import { moderatePrompt } from './moderator.js';
import { INITIAL_PATTERNS } from './patterns.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// ── Config ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const RATE_LIMIT_SECONDS = parseInt(process.env.RATE_LIMIT_SECONDS) || 30;

// ── State ───────────────────────────────────────────
let currentCode = INITIAL_PATTERNS[0].code;
let currentPatternIndex = 0;
const promptQueue = new PromptQueue(parseInt(process.env.MAX_QUEUE_SIZE) || 20);
const rateLimitMap = new Map(); // sessionId -> lastSubmitTime
const recentPrompts = []; // last N prompts for display
let _codeRequestResolve = null; // resolver for pull-based code fetch

// ── WebSocket Setup ─────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Track client types
const screenClients = new Set();
const mobileClients = new Map(); // ws -> sessionId

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientType = url.searchParams.get('type') || 'mobile';
  const sessionId = url.searchParams.get('session') || crypto.randomUUID();

  if (clientType === 'screen') {
    screenClients.add(ws);
    // Send current state to newly connected screen
    ws.send(JSON.stringify({
      type: 'init',
      code: currentCode,
      recentPrompts,
      queueSize: promptQueue.size(),
    }));
    console.log('🖥️  Screen client connected');
  } else {
    mobileClients.set(ws, sessionId);
    ws.send(JSON.stringify({
      type: 'init',
      queueSize: promptQueue.size(),
      position: null,
    }));
    console.log('📱 Mobile client connected');
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, msg, sessionId);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: '无效的消息格式' }));
    }
  });

  ws.on('close', () => {
    screenClients.delete(ws);
    mobileClients.delete(ws);
  });
});

// ── Pull-based code fetch ────────────────────────────
// Before AI generation, request the ACTUAL code from the screen client.
// This guarantees we never use stale code regardless of push-sync status.
function requestCodeFromScreen(timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (screenClients.size === 0) {
      console.log('  ⚠️  No screen clients connected — using last known code');
      resolve(null);
      return;
    }
    // Set up resolver (first response wins)
    _codeRequestResolve = (code) => {
      _codeRequestResolve = null;
      resolve(code);
    };
    // Ask all screens for their current code
    const msg = JSON.stringify({ type: 'request_code' });
    for (const ws of screenClients) {
      if (ws.readyState === 1) ws.send(msg);
    }
    // Timeout fallback
    setTimeout(() => {
      if (_codeRequestResolve) {
        _codeRequestResolve = null;
        console.log('  ⚠️  Screen did not respond in time — using last known code');
        resolve(null);
      }
    }, timeoutMs);
  });
}

// ── Message Handler ─────────────────────────────────
async function handleMessage(ws, msg, sessionId) {
  // Screen client syncs its current code
  if (msg.type === 'sync_code') {
    if (screenClients.has(ws) && typeof msg.code === 'string' && msg.code.trim()) {
      currentCode = msg.code;
      // Resolve any pending code request
      if (_codeRequestResolve) _codeRequestResolve(msg.code);
    }
    return;
  }

  if (msg.type === 'submit_prompt') {
    const prompt = (msg.prompt || '').trim();
    if (!prompt) {
      ws.send(JSON.stringify({ type: 'error', message: '请输入内容' }));
      return;
    }
    if (prompt.length > 200) {
      ws.send(JSON.stringify({ type: 'error', message: '内容过长，请控制在200字以内' }));
      return;
    }

    // Rate limiting
    const now = Date.now();
    const lastSubmit = rateLimitMap.get(sessionId) || 0;
    if (now - lastSubmit < RATE_LIMIT_SECONDS * 1000) {
      const waitSec = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (now - lastSubmit)) / 1000);
      ws.send(JSON.stringify({ type: 'rate_limited', waitSeconds: waitSec }));
      return;
    }

    // Content moderation
    if (!moderatePrompt(prompt)) {
      ws.send(JSON.stringify({ type: 'error', message: '内容不合适，请换个说法' }));
      return;
    }

    // Add to queue
    const position = promptQueue.add({ prompt, sessionId, ws });
    if (position === -1) {
      ws.send(JSON.stringify({ type: 'error', message: '队列已满，请稍后再试' }));
      return;
    }

    rateLimitMap.set(sessionId, now);
    ws.send(JSON.stringify({ type: 'queued', position }));
    broadcastQueueUpdate();

    console.log(`📝 Prompt queued (#${position}): "${prompt}"`);

    // Trigger immediate processing (don't wait for next polling interval)
    setImmediate(processNextInQueue);
  }
}

// ── Queue Processing ─────────────────────────────────
let processing = false;

async function processNextInQueue() {
  if (processing) return;
  const item = promptQueue.next();
  if (!item) return;

  processing = true;
  try {
    await processPrompt(item);
  } catch (e) {
    console.error('❌ Error processing prompt:', e.message);
    if (item.ws?.readyState === 1) {
      item.ws.send(JSON.stringify({
        type: 'generation_failed',
        message: '代码生成出了点问题，请换个说法试试',
      }));
    }
  }
  processing = false;
  broadcastQueueUpdate();

  // If more items in queue, continue processing
  if (promptQueue.size() > 0) {
    setImmediate(processNextInQueue);
  }
}

// Backup polling (safety net — main trigger is setImmediate in handleMessage)
setInterval(() => processNextInQueue(), 5000);

// ── Process a single prompt ─────────────────────────
async function processPrompt(item) {
  console.log(`🤖 Generating code for: "${item.prompt}"`);

  // Notify the submitter that processing has started
  if (item.ws?.readyState === 1) {
    item.ws.send(JSON.stringify({ type: 'processing', message: '🤖 AI 正在创作…' }));
  }

  // Pull fresh code from screen (guarantees we have what's actually playing)
  const freshCode = await requestCodeFromScreen(2000);
  const codeForAI = freshCode || currentCode;
  if (freshCode) {
    currentCode = freshCode; // also update our state
    console.log(`  📥 Got fresh code from screen (${codeForAI.length} chars)`);
  } else {
    console.log(`  📦 Using last known code (${codeForAI.length} chars)`);
  }
  console.log(`  📝 Code preview: ${codeForAI.substring(0, 60).replace(/\n/g, ' | ')}...`);

  // Generate with retry
  let newCode = await generateCode(codeForAI, item.prompt);
  if (!newCode) {
    console.log('  ⚠️  First attempt failed, retrying...');
    newCode = await generateCode(codeForAI, item.prompt);
  }
  if (!newCode) {
    throw new Error('AI returned empty code after retry');
  }

  // Validate the generated code
  const validation = validateCode(newCode);
  if (!validation.valid) {
    console.warn(`⚠️  Code validation failed: ${validation.reason}`);
    throw new Error(validation.reason);
  }

  // Update state
  currentCode = newCode;
  addRecentPrompt(item.prompt);

  // Broadcast to screens
  broadcastToScreens({
    type: 'code_update',
    code: newCode,
    prompt: item.prompt,
    recentPrompts,
  });

  // Notify the submitter
  if (item.ws?.readyState === 1) {
    item.ws.send(JSON.stringify({
      type: 'prompt_applied',
      message: '你的修改已生效！🎵',
    }));
  }

  console.log(`✅ Code updated successfully`);
}

// ── Broadcast helpers ───────────────────────────────
function broadcastToScreens(msg) {
  const data = JSON.stringify(msg);
  for (const ws of screenClients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function broadcastQueueUpdate() {
  const update = JSON.stringify({
    type: 'queue_update',
    queueSize: promptQueue.size(),
  });
  // Notify all mobile clients
  for (const [ws] of mobileClients) {
    if (ws.readyState === 1) ws.send(update);
  }
  // Notify screens too
  for (const ws of screenClients) {
    if (ws.readyState === 1) ws.send(update);
  }
}

function addRecentPrompt(prompt) {
  recentPrompts.push(prompt);
  if (recentPrompts.length > 10) recentPrompts.shift();
}

// ── Express Routes ──────────────────────────────────
app.use(express.json());

// Serve mobile audience page (no cache to ensure latest)
app.use('/submit', express.static(path.join(__dirname, '../client/mobile'), {
  etag: false, maxAge: 0,
  setHeaders: (res) => res.set('Cache-Control', 'no-store'),
}));

// Serve favicon directly if present in client/ (keeps root simple)
app.get('/favicon.ico', (req, res) => {
  const ico = path.join(__dirname, '../client/favicon.ico');
  res.setHeader('Content-Type', 'image/x-icon');
  res.sendFile(ico, (err) => {
    if (err) {
      res.status(404).end();
    }
  });
});

// Serve big screen page directly (no cache to ensure sync code is always present)
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, '../client/screen.html'));
});

// API: Get current state
app.get('/api/state', (req, res) => {
  res.json({
    currentCode,
    recentPrompts,
    queueSize: promptQueue.size(),
    patterns: INITIAL_PATTERNS.map((p, i) => ({ 
      name: p.name, 
      description: p.description,
      code: p.code,
      index: i 
    })),
  });
});

// API: Switch to a preset pattern (for emergency)
app.post('/api/pattern/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  if (idx >= 0 && idx < INITIAL_PATTERNS.length) {
    currentCode = INITIAL_PATTERNS[idx].code;
    currentPatternIndex = idx;
    broadcastToScreens({
      type: 'code_update',
      code: currentCode,
      prompt: `🎼 切换预设: ${INITIAL_PATTERNS[idx].name}`,
      recentPrompts,
    });
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid pattern index' });
  }
});

// ── Start Server ────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  🥧 ═══════════════════════════════════════');
  console.log(`  🥧  Vibe Cod'in Pie is running!`);
  console.log('  🥧 ═══════════════════════════════════════');
  console.log(`  🖥️  Screen:  http://localhost:${PORT}/`);
  console.log(`  📱 Submit:  http://localhost:${PORT}/submit`);
  console.log(`  🔌 WS:      ws://localhost:${PORT}/ws`);
  console.log(`  📊 API:     http://localhost:${PORT}/api/state`);
  console.log('  🥧 ═══════════════════════════════════════');
  console.log('');
});
