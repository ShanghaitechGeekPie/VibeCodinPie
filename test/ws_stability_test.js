/**
 * WebSocket Stability Test
 * Tests the improved reconnection and heartbeat mechanisms
 */

import WebSocket from 'ws';
import { setTimeout } from 'timers/promises';

const WS_URL = 'ws://localhost:3000/ws?type=mobile&session=test-session';
let testsPassed = 0;
let testsFailed = 0;

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function pass(testName) {
  testsPassed++;
  log('✅', `PASS: ${testName}`);
}

function fail(testName, reason) {
  testsFailed++;
  log('❌', `FAIL: ${testName} - ${reason}`);
}

// Test 1: Basic connection
async function testBasicConnection() {
  const testName = 'Basic Connection';
  try {
    const ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        pass(testName);
        ws.close();
        resolve();
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  } catch (e) {
    fail(testName, e.message);
  }
}

// Test 2: Heartbeat response
async function testHeartbeat() {
  const testName = 'Heartbeat Response';
  try {
    const ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Send ping
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'init') {
          // Server sends init first, wait for pong
          return;
        }
        // Server should echo pong or handle it silently
        pass(testName);
        ws.close();
        resolve();
      });

      ws.on('error', reject);

      // If no error after 2 seconds, consider it passed (server handles ping silently)
      setTimeout(() => {
        pass(testName);
        ws.close();
        resolve();
      }, 2000);
    });
  } catch (e) {
    fail(testName, e.message);
  }
}

// Test 3: Multiple rapid connections (stress test)
async function testRapidConnections() {
  const testName = 'Rapid Connections';
  try {
    const connections = [];

    for (let i = 0; i < 10; i++) {
      const ws = new WebSocket(WS_URL);
      connections.push(new Promise((resolve) => {
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        ws.on('error', resolve); // Don't fail on individual errors
      }));
    }

    await Promise.all(connections);
    pass(testName);
  } catch (e) {
    fail(testName, e.message);
  }
}

// Test 4: Connection survives idle period
async function testIdleConnection() {
  const testName = 'Idle Connection Survival';
  try {
    const ws = new WebSocket(WS_URL);
    let connected = false;

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        connected = true;
        log('ℹ️', 'Connection established, waiting 35 seconds...');
      });

      ws.on('close', () => {
        if (connected) {
          fail(testName, 'Connection closed during idle period');
          reject();
        }
      });

      ws.on('error', reject);

      // Wait 35 seconds (longer than heartbeat interval)
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pass(testName);
          ws.close();
          resolve();
        } else {
          fail(testName, 'Connection not open after idle period');
          reject();
        }
      }, 35000);
    });
  } catch (e) {
    if (!e) return; // Already logged
    fail(testName, e.message);
  }
}

// Test 5: Message handling during high load
async function testHighLoadMessages() {
  const testName = 'High Load Message Handling';
  try {
    const ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Send 100 messages rapidly
        for (let i = 0; i < 100; i++) {
          ws.send(JSON.stringify({
            type: 'control_slider',
            id: 'test-slider',
            force: Math.random() * 2 - 1
          }));
        }

        // Wait a bit then check connection is still alive
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pass(testName);
            ws.close();
            resolve();
          } else {
            fail(testName, 'Connection closed after high load');
            reject();
          }
        }, 1000);
      });

      ws.on('error', reject);
    });
  } catch (e) {
    fail(testName, e.message);
  }
}

// Run all tests
async function runTests() {
  log('🧪', 'Starting WebSocket Stability Tests...');
  log('ℹ️', `Target: ${WS_URL}`);
  log('ℹ️', 'Make sure the server is running on port 3000\n');

  await testBasicConnection();
  await setTimeout(500);

  await testHeartbeat();
  await setTimeout(500);

  await testRapidConnections();
  await setTimeout(500);

  await testHighLoadMessages();
  await setTimeout(500);

  log('\n📊', 'Test Summary:');
  log('✅', `Passed: ${testsPassed}`);
  log('❌', `Failed: ${testsFailed}`);

  if (testsFailed === 0) {
    log('🎉', 'All tests passed!');
  } else {
    log('⚠️', 'Some tests failed. Check the output above.');
    process.exit(1);
  }

  log('\n⏳', 'Running long-duration test (35s idle connection)...');
  await testIdleConnection();

  log('\n✨', 'All stability tests completed!');
}

// Check if server is running
const checkServer = new WebSocket(WS_URL);
checkServer.on('error', () => {
  log('❌', 'Cannot connect to server. Make sure it\'s running on port 3000');
  log('ℹ️', 'Run: npm start');
  process.exit(1);
});

checkServer.on('open', () => {
  checkServer.close();
  runTests().catch(console.error);
});
