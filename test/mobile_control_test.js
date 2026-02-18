/**
 * Mobile Control Feature Tests
 * Tests: force clamping, disconnect cleanup, stop_control all, slider_value_update, force_info
 *
 * Usage: Start the server first, then run: node test/mobile_control_test.js
 */

import { WebSocket } from 'ws';
import assert from 'assert';

const WS_URL = 'ws://localhost:3000/ws';
const TIMEOUT_MS = 3000;

let testsPassed = 0;
let testsFailed = 0;

function log(msg, type = 'INFO') {
  const time = new Date().toISOString().split('T')[1].slice(0, -1);
  console.log(`[${time}] [${type}] ${msg}`);
}

function pass(msg) {
  log(msg, 'PASS');
  testsPassed++;
}

function fail(msg) {
  log(msg, 'FAIL');
  testsFailed++;
}

function connect(type, extra = '') {
  return new Promise((resolve, reject) => {
    const url = `${WS_URL}?type=${type}${extra}`;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error(`Connect timeout: ${url}`)), TIMEOUT_MS);
    ws.on('open', () => { clearTimeout(timer); resolve(ws); });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function waitForMessage(ws, typeName, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${typeName}`)), timeoutMs);
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.type === typeName) {
        clearTimeout(timer);
        ws.removeListener('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

function collectMessages(ws, typeName, durationMs) {
  return new Promise((resolve) => {
    const msgs = [];
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.type === typeName) msgs.push(msg);
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(msgs);
    }, durationMs);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  log('Starting Mobile Control Tests...');

  // We need a master screen to register sliders
  let master = null;
  let mobile1 = null;
  let mobile2 = null;
  let mobile3 = null;

  try {
    // ── Setup: Connect master and register sliders ──
    master = await connect('screen', '&key=geekpie');
    await waitForMessage(master, 'init');
    log('Master connected');

    // Register test sliders
    master.send(JSON.stringify({
      type: 'register_sliders',
      sliders: [
        { id: 'test:0:100', name: 'TestSlider', value: 50, min: 0, max: 100 }
      ]
    }));
    await sleep(200);

    // ══════════════════════════════════════════════
    // Test 1: Mobile connects and receives init with sliders
    // ══════════════════════════════════════════════
    log('Test 1: Mobile init with sliders');
    mobile1 = await connect('mobile', '&session=test-session-1');
    const initMsg = await waitForMessage(mobile1, 'init');
    assert.ok(initMsg.sliders, 'init should contain sliders');
    assert.strictEqual(initMsg.sliders.length, 1);
    assert.strictEqual(initMsg.sliders[0].id, 'test:0:100');
    pass('Mobile receives init with sliders');

    // ══════════════════════════════════════════════
    // Test 2: control_slider sends apply_force to master
    // ══════════════════════════════════════════════
    log('Test 2: control_slider -> apply_force');
    const forcePromise = waitForMessage(master, 'apply_force');
    mobile1.send(JSON.stringify({
      type: 'control_slider',
      id: 'test:0:100',
      force: 0.5
    }));
    const forceMsg = await forcePromise;
    assert.strictEqual(forceMsg.id, 'test:0:100');
    assert.ok(Math.abs(forceMsg.force - 0.5) < 0.01, `Expected ~0.5, got ${forceMsg.force}`);
    pass('control_slider produces apply_force on master');

    // Clear force
    mobile1.send(JSON.stringify({ type: 'stop_control', id: 'test:0:100' }));
    await sleep(200);

    // ══════════════════════════════════════════════
    // Test 3: Opposing forces cancel out
    // ══════════════════════════════════════════════
    log('Test 3: Opposing forces cancel out');
    mobile2 = await connect('mobile', '&session=test-session-2');
    await waitForMessage(mobile2, 'init');

    // mobile1 pushes +0.8, mobile2 pushes -0.8
    mobile1.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: 0.8 }));
    mobile2.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: -0.8 }));

    // Wait for aggregation cycles, collect apply_force messages
    // With opposing forces, net should be ~0, so no apply_force should be sent (< 0.01 threshold)
    const cancelMsgs = await collectMessages(master, 'apply_force', 350);
    // All collected forces should be near zero or no messages at all
    const allNearZero = cancelMsgs.every(m => Math.abs(m.force) < 0.05);
    assert.ok(cancelMsgs.length === 0 || allNearZero,
      `Opposing forces should cancel: got ${cancelMsgs.map(m => m.force)}`);
    pass('Opposing forces cancel each other out');

    // Clear
    mobile1.send(JSON.stringify({ type: 'stop_control', id: 'test:0:100' }));
    mobile2.send(JSON.stringify({ type: 'stop_control', id: 'test:0:100' }));
    await sleep(200);

    // ══════════════════════════════════════════════
    // Test 4: Net force is clamped to [-1, 1]
    // ══════════════════════════════════════════════
    log('Test 4: Force clamping');
    mobile3 = await connect('mobile', '&session=test-session-3');
    await waitForMessage(mobile3, 'init');

    // 3 users all push +1.0 => raw sum = 3.0, should be clamped to 1.0
    mobile1.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: 1.0 }));
    mobile2.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: 1.0 }));
    mobile3.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: 1.0 }));

    const clampMsgs = await collectMessages(master, 'apply_force', 350);
    assert.ok(clampMsgs.length > 0, 'Should receive apply_force messages');
    for (const m of clampMsgs) {
      assert.ok(m.force <= 1.0 && m.force >= -1.0,
        `Force should be clamped to [-1,1], got ${m.force}`);
    }
    pass('Net force clamped to [-1, 1]');

    // ══════════════════════════════════════════════
    // Test 5: force_info broadcast to mobile
    // ══════════════════════════════════════════════
    log('Test 5: force_info broadcast');
    // Forces are still active from test 4
    const infoMsgs = await collectMessages(mobile1, 'force_info', 350);
    assert.ok(infoMsgs.length > 0, 'Mobile should receive force_info');
    const info = infoMsgs[0];
    assert.ok(info.sliders && info.sliders.length > 0, 'force_info should have sliders');
    const sliderInfo = info.sliders.find(s => s.id === 'test:0:100');
    assert.ok(sliderInfo, 'Should have info for test slider');
    assert.ok(sliderInfo.participants >= 1, `Should have participants, got ${sliderInfo.participants}`);
    assert.ok(sliderInfo.netForce <= 1.0 && sliderInfo.netForce >= -1.0, 'netForce should be clamped');
    pass('force_info broadcast to mobile with participants and clamped netForce');

    // Clear all
    mobile1.send(JSON.stringify({ type: 'stop_control', id: 'test:0:100' }));
    mobile2.send(JSON.stringify({ type: 'stop_control', id: 'test:0:100' }));
    mobile3.send(JSON.stringify({ type: 'stop_control', id: 'test:0:100' }));
    await sleep(200);

    // ══════════════════════════════════════════════
    // Test 6: Disconnect cleans up forces
    // ══════════════════════════════════════════════
    log('Test 6: Disconnect cleanup');
    // mobile3 applies force then disconnects
    mobile3.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: 0.9 }));
    await sleep(150);
    mobile3.close();
    await sleep(300);

    // Now only mobile1 and mobile2 have no active forces (cleared above)
    // So no apply_force should be sent
    const postDisconnect = await collectMessages(master, 'apply_force', 350);
    const allSmall = postDisconnect.every(m => Math.abs(m.force) < 0.05);
    assert.ok(postDisconnect.length === 0 || allSmall,
      `After disconnect, force should be gone: got ${postDisconnect.map(m => m.force)}`);
    pass('Forces cleaned up on disconnect');

    // ══════════════════════════════════════════════
    // Test 7: stop_control with all:true clears all sliders
    // ══════════════════════════════════════════════
    log('Test 7: stop_control all:true');
    // Apply force from mobile1
    mobile1.send(JSON.stringify({ type: 'control_slider', id: 'test:0:100', force: 0.7 }));
    await sleep(150);

    // Send stop_control with all:true
    mobile1.send(JSON.stringify({ type: 'stop_control', all: true }));
    await sleep(300);

    // Should get no more forces
    const postStopAll = await collectMessages(master, 'apply_force', 350);
    const allCleared = postStopAll.every(m => Math.abs(m.force) < 0.05);
    assert.ok(postStopAll.length === 0 || allCleared,
      `After stop_control all, no forces: got ${postStopAll.map(m => m.force)}`);
    pass('stop_control all:true clears all forces');

    // ══════════════════════════════════════════════
    // Test 8: slider_value_update broadcast
    // ══════════════════════════════════════════════
    log('Test 8: slider_value_update broadcast');
    const valuePromise = waitForMessage(mobile1, 'slider_value_update');
    // Master syncs a slider value
    master.send(JSON.stringify({
      type: 'sync_slider',
      id: 'test:0:100',
      value: 75.5
    }));
    const valueMsg = await valuePromise;
    assert.strictEqual(valueMsg.id, 'test:0:100');
    assert.strictEqual(valueMsg.value, 75.5);
    pass('slider_value_update broadcast to mobile');

    // ── Results ──
    console.log('');
    log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
    if (testsFailed > 0) {
      process.exit(1);
    } else {
      log('All tests passed!');
      process.exit(0);
    }

  } catch (e) {
    fail(`Test error: ${e.message}`);
    console.error(e);
    process.exit(1);
  } finally {
    if (master) master.close();
    if (mobile1) mobile1.close();
    if (mobile2) mobile2.close();
    if (mobile3 && mobile3.readyState !== WebSocket.CLOSED) mobile3.close();
  }
}

runTests();
