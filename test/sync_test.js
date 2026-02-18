
import { WebSocket } from 'ws';
import assert from 'assert';

// Test Configuration
const WS_URL = 'ws://localhost:3000/ws';
const TIMEOUT_MS = 2000;
const SYNC_LATENCY_LIMIT_MS = 100;

// Test State
let masterWs = null;
let viewerWs = null;
let testsPassed = 0;
let testsFailed = 0;

function log(msg, type = 'INFO') {
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`[${time}] [${type}] ${msg}`);
}

function fail(msg) {
    log(msg, 'FAIL');
    testsFailed++;
    process.exit(1);
}

function pass(msg) {
    log(msg, 'PASS');
    testsPassed++;
}

function connect(role) {
    return new Promise((resolve, reject) => {
        const url = role === 'master' 
            ? `${WS_URL}?type=screen&key=geekpie` 
            : `${WS_URL}?type=screen`;
        
        const ws = new WebSocket(url);
        
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

async function runTests() {
    log('🚀 Starting Sync Tests...');

    try {
        // 1. Setup Connections
        log('Connecting Master...');
        masterWs = await connect('master');
        log('Master Connected');

        log('Connecting Viewer...');
        viewerWs = await connect('viewer');
        log('Viewer Connected');

        // Wait for init messages
        await new Promise(r => setTimeout(r, 500));

        // 2. Test Slider Sync (Master -> Viewer)
        log('🧪 Test 1: Real-time Slider Sync');
        const testId = 'slider:1:100';
        const testValue = 42.5;
        
        const syncPromise = new Promise((resolve) => {
            const start = Date.now();
            viewerWs.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'slider_update' && msg.id === testId) {
                    const latency = Date.now() - start;
                    if (msg.value === testValue) {
                        if (latency <= SYNC_LATENCY_LIMIT_MS) {
                            pass(`Slider update received in ${latency}ms`);
                            resolve();
                        } else {
                            fail(`Latency too high: ${latency}ms > ${SYNC_LATENCY_LIMIT_MS}ms`);
                        }
                    } else {
                        fail(`Value mismatch: expected ${testValue}, got ${msg.value}`);
                    }
                }
            });
        });

        // Send from Master
        masterWs.send(JSON.stringify({
            type: 'sync_slider',
            id: testId,
            value: testValue
        }));

        await Promise.race([
            syncPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
        ]);

        // 3. Test Connection Resilience
        log('🧪 Test 2: Reconnection & State Sync');
        // Close viewer and reconnect
        viewerWs.close();
        await new Promise(r => setTimeout(r, 500));
        
        viewerWs = await connect('viewer');
        log('Viewer Reconnected');
        
        // Wait for init
        await new Promise(r => setTimeout(r, 1000));
        // Note: Full state sync relies on Master responding to request_code. 
        // This test script simulates WS clients but doesn't implement the full Master logic (responding to request_code).
        // The real Master client (browser) would handle this. 
        // Here we just verify we can reconnect.
        pass('Viewer reconnected successfully');

        log('🏁 All Tests Passed');
        process.exit(0);

    } catch (e) {
        fail(`Test Error: ${e.message}`);
    } finally {
        if (masterWs) masterWs.close();
        if (viewerWs) viewerWs.close();
    }
}

runTests();
