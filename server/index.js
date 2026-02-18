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
let isPlaying = false;
const promptQueue = new PromptQueue(parseInt(process.env.MAX_QUEUE_SIZE) || 20);
const rateLimitMap = new Map(); // sessionId -> lastSubmitTime
const recentPrompts = []; // last N prompts for display
const codeRequests = new Map(); // requestId -> resolve

// ── Rate Limit Cleanup ──────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of rateLimitMap.entries()) {
    if (now - time > 3600000) { // Clear after 1 hour
      rateLimitMap.delete(key);
    }
  }
}, 3600000); // Run every hour

// ── WebSocket Setup ─────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Track client types
const masterScreen = { ws: null };
const viewerScreens = new Set();
const mobileClients = new Map(); // ws -> sessionId

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientType = url.searchParams.get('type') || 'mobile';
  const sessionId = url.searchParams.get('session') || crypto.randomUUID();
  const authKey = url.searchParams.get('key');

  if (clientType === 'screen') {
    if (authKey === 'geekpie') {
      // Master Screen
      if (masterScreen.ws) {
        console.log('⚠️  Master screen replaced');
        masterScreen.ws.close();
      }
      masterScreen.ws = ws;
      console.log('🖥️  MASTER Screen connected');
      
      // Send current state
      ws.send(JSON.stringify({
        type: 'init',
        role: 'master',
        code: currentCode,
        isPlaying,
        recentPrompts,
        queueSize: promptQueue.size(),
      }));
    } else {
      // Viewer Screen (Read-only)
      viewerScreens.add(ws);
      console.log('👀 Viewer Screen connected');
      
      // Request fresh code from Master before init
      // This ensures the new viewer gets the EXACT state of the master,
      // not just the last thing the server remembered.
      requestCodeFromScreen(1500).then((freshCode) => {
        ws.send(JSON.stringify({
          type: 'init',
          role: 'viewer',
          code: freshCode || currentCode,
          isPlaying,
          recentPrompts,
          queueSize: promptQueue.size(),
        }));
      });
    }
  } else {
    mobileClients.set(ws, sessionId);
    ws.send(JSON.stringify({
      type: 'init',
      queueSize: promptQueue.size(),
      position: null,
      sliders: activeSliders // Send current sliders on connect
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
    if (masterScreen.ws === ws) {
      masterScreen.ws = null;
      console.log('🖥️  MASTER Screen disconnected');
    }
    viewerScreens.delete(ws);
    // Clean up all forces for this session before removing
    const sid = mobileClients.get(ws);
    if (sid) {
      for (const forcesMap of sliderForces.values()) {
        forcesMap.delete(sid);
      }
    }
    mobileClients.delete(ws);
  });
});

// ── Pull-based code fetch ────────────────────────────
// Before AI generation, request the ACTUAL code from the screen client.
// This guarantees we never use stale code regardless of push-sync status.
function requestCodeFromScreen(timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (!masterScreen.ws || masterScreen.ws.readyState !== 1) {
      console.log('  ⚠️  No MASTER screen connected — using last known code');
      resolve(currentCode); // Use cached code if master is missing
      return;
    }
    
    const requestId = crypto.randomUUID();
    
    // Set up resolver (first response wins)
    codeRequests.set(requestId, resolve);

    // Ask ONLY the Master screen
    const msg = JSON.stringify({ type: 'request_code', requestId });
    masterScreen.ws.send(msg);
    
    // Timeout fallback
    setTimeout(() => {
      if (codeRequests.has(requestId)) {
        codeRequests.delete(requestId);
        console.log('  ⚠️  Master screen did not respond in time — using last known code');
        resolve(currentCode); // Fallback to cached code
      }
    }, timeoutMs);
  });
}

// ── Slider Control & Aggregation ────────────────────
let activeSliders = [];
const sliderForces = new Map(); // SliderID -> Map<SessionID, Force>

// Broadcast slider definitions to all mobile clients
function broadcastSlidersToMobile() {
  const msg = JSON.stringify({
    type: 'available_sliders',
    sliders: activeSliders
  });
  for (const [ws, _] of mobileClients.entries()) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Periodic aggregation loop (every 100ms)
setInterval(() => {
  if (!activeSliders.length) return;
  if (!masterScreen.ws || masterScreen.ws.readyState !== 1) return;

  const updates = [];
  const forceInfos = [];

  for (const slider of activeSliders) {
    const forcesMap = sliderForces.get(slider.id);
    if (!forcesMap || forcesMap.size === 0) continue;

    // Calculate net force
    let netForce = 0;
    for (const force of forcesMap.values()) {
      netForce += force;
    }

    // Clamp net force to [-1, 1] to prevent explosion with many users
    netForce = Math.max(-1, Math.min(1, netForce));

    forceInfos.push({ id: slider.id, netForce, participants: forcesMap.size });

    if (Math.abs(netForce) > 0.01) {
      updates.push({ id: slider.id, force: netForce });
    }
  }

  if (updates.length > 0) {
    updates.forEach(u => {
      masterScreen.ws.send(JSON.stringify({
        type: 'apply_force',
        id: u.id,
        force: u.force
      }));
    });
  }

  // Broadcast force info to mobile clients for visual feedback
  if (forceInfos.length > 0) {
    const infoMsg = JSON.stringify({ type: 'force_info', sliders: forceInfos });
    for (const [ws] of mobileClients.entries()) {
      if (ws.readyState === 1) ws.send(infoMsg);
    }
  }
}, 100);

// ── Message Handler ─────────────────────────────────
async function handleMessage(ws, msg, sessionId) {
  // Mobile: Control Slider Force
  if (msg.type === 'control_slider') {
    if (msg.id && typeof msg.force === 'number') {
      if (!sliderForces.has(msg.id)) {
        sliderForces.set(msg.id, new Map());
      }
      sliderForces.get(msg.id).set(sessionId, msg.force);
    }
    return;
  }
  
  // Mobile: Stop Control (when finger lifted or tab switched)
  if (msg.type === 'stop_control') {
    if (msg.all) {
      // Clear all forces for this session across all sliders
      for (const forcesMap of sliderForces.values()) {
        forcesMap.delete(sessionId);
      }
    } else if (msg.id && sliderForces.has(msg.id)) {
      sliderForces.get(msg.id).delete(sessionId);
    }
    return;
  }

  // Master: Register Sliders
  if (msg.type === 'register_sliders') {
    if (masterScreen.ws === ws && Array.isArray(msg.sliders)) {
      activeSliders = msg.sliders;
      console.log(`🎚️  Registered ${activeSliders.length} sliders from Master`);
      broadcastSlidersToMobile();
      
      // Cleanup stale forces for removed sliders
      const newIds = new Set(activeSliders.map(s => s.id));
      for (const id of sliderForces.keys()) {
        if (!newIds.has(id)) {
          sliderForces.delete(id);
        }
      }
    }
    return;
  }

  // Screen client syncs its current code
  if (msg.type === 'sync_code') {
    // Only accept sync from Master
    if (masterScreen.ws === ws && typeof msg.code === 'string' && msg.code.trim()) {
      currentCode = msg.code;
      if (typeof msg.playing === 'boolean') {
        isPlaying = msg.playing;
      }
      
      // Resolve any pending code request
      if (msg.requestId && codeRequests.has(msg.requestId)) {
        const resolve = codeRequests.get(msg.requestId);
        codeRequests.delete(msg.requestId);
        resolve(msg.code);
      }
      
      // Broadcast update to Viewers (so they see what Master is doing)
      const updateMsg = JSON.stringify({
        type: 'code_update',
        code: currentCode,
        prompt: null, // Silent sync
        sessionId: null,
      });
      for (const viewer of viewerScreens) {
        if (viewer.readyState === 1) viewer.send(updateMsg);
      }
    }
    return;
  }

  // Sync play/stop state
  if (msg.type === 'sync_state') {
    if (masterScreen.ws === ws) {
      isPlaying = !!msg.playing;
      
      // Broadcast to viewers
      const updateMsg = JSON.stringify({
        type: 'play_state',
        playing: isPlaying,
      });
      for (const viewer of viewerScreens) {
        if (viewer.readyState === 1) viewer.send(updateMsg);
      }
    }
    return;
  }

  // Real-time slider sync
  if (msg.type === 'sync_slider') {
    if (masterScreen.ws === ws) {
        // Broadcast slider update to all viewers immediately
        const updateMsg = JSON.stringify({
            type: 'slider_update',
            id: msg.id,
            value: msg.value
        });
        for (const viewer of viewerScreens) {
            if (viewer.readyState === 1) viewer.send(updateMsg);
        }
        // Also broadcast to mobile clients so they see current value
        const mobileMsg = JSON.stringify({
            type: 'slider_value_update',
            id: msg.id,
            value: msg.value
        });
        for (const [mws] of mobileClients.entries()) {
            if (mws.readyState === 1) mws.send(mobileMsg);
        }
    }
    return;
  }

  // Screen reports runtime error
  if (msg.type === 'execution_error') {
    const targetSession = msg.sessionId;
    if (targetSession) {
      // Find the mobile client with this session
      for (const [clientWs, session] of mobileClients) {
        if (session === targetSession && clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({
             type: 'error',
             message: `代码执行出错: ${msg.message}`
          }));
          break;
        }
      }
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
    // Backoff on error to prevent rapid loops
    await new Promise(r => setTimeout(r, 1000));
  } finally {
    processing = false;
    broadcastQueueUpdate();

    // If more items in queue, continue processing
    if (promptQueue.size() > 0) {
      setImmediate(processNextInQueue);
    }
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

  // Generate with retry loop (handles both empty response and validation errors)
  let newCode = null;
  let validationError = null;
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const currentPrompt = (attempt === 1) 
      ? item.prompt 
      : `${item.prompt}\n(IMPORTANT: Previous code was invalid: ${validationError}. Please fix syntax errors.)`;

    if (attempt > 1) {
      console.log(`  🔄 Retry attempt ${attempt}/${MAX_ATTEMPTS} due to: ${validationError}`);
    }

    try {
      newCode = await generateCode(codeForAI, currentPrompt);
    } catch (e) {
      console.warn(`  ⚠️  AI generation error (attempt ${attempt}):`, e.message);
      validationError = e.message;
      continue;
    }

    if (!newCode) {
      validationError = "Empty response from AI";
      continue;
    }

    // Validate the generated code
    const validation = validateCode(newCode);
    if (validation.valid) {
      validationError = null;
      break; // Success!
    } else {
      validationError = validation.reason;
      console.warn(`  ⚠️  Validation failed (attempt ${attempt}): ${validationError}`);
    }
  }

  if (validationError) {
    throw new Error(`Code generation failed after ${MAX_ATTEMPTS} attempts: ${validationError}`);
  }

  // Update state
  currentCode = newCode;
  addRecentPrompt(item.prompt);

  // Broadcast to screens
  broadcastToScreens({
    type: 'code_update',
    code: newCode,
    prompt: item.prompt,
    sessionId: item.sessionId, // Pass session ID for error tracking
    recentPrompts,
  });

  // Notify the submitter
  if (item.ws?.readyState === 1) {
    item.ws.send(JSON.stringify({
      type: 'prompt_applied',
      message: '你的修改已生效！🎵',
    }));
  }

  console.log(`✅ Code updated for prompt: "${item.prompt}"`);
}

// ── Broadcast helpers ───────────────────────────────
function broadcastToScreens(msg) {
  const json = JSON.stringify(msg);
  if (masterScreen.ws && masterScreen.ws.readyState === 1) {
    masterScreen.ws.send(json);
  }
  for (const ws of viewerScreens) {
    if (ws.readyState === 1) ws.send(json);
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
  if (masterScreen.ws && masterScreen.ws.readyState === 1) {
    masterScreen.ws.send(update);
  }
  for (const ws of viewerScreens) {
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
