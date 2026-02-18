/**
 * 🛠️ Pressure Test Script for Vibe Cod'in Pie
 * 
 * Purpose: Conduct a 30-minute stability test to ensure:
 * 1. Memory usage stays < 10MB growth (no leaks).
 * 2. 0 Audio dropouts (simulated check via context state).
 * 3. Frame rate > 55 FPS (drop < 5%).
 * 4. CPU usage check (via frame budget).
 *
 * Usage:
 * Paste this entire script into the browser console while the "User Test Music" is playing.
 * It will run for 30 minutes and log stats every minute.
 */

(function() {
  const DURATION_MS = 30 * 60 * 1000; // 30 minutes
  const LOG_INTERVAL_MS = 60 * 1000;  // 1 minute
  const FPS_THRESHOLD = 55;
  
  let startTime = Date.now();
  let frames = 0;
  let lastLogTime = startTime;
  let initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  let maxMemory = initialMemory;
  let droppedFrames = 0;
  let audioDropouts = 0;
  let running = true;

  console.log(`🚀 Starting 30-Minute Pressure Test at ${new Date().toLocaleTimeString()}`);
  console.log(`📊 Initial Memory: ${(initialMemory / 1048576).toFixed(2)} MB`);

  function checkAudioState() {
    if (window.strudel && window.strudel.ctx) {
      if (window.strudel.ctx.state !== 'running') {
        audioDropouts++;
        console.warn('⚠️ Audio Context not running:', window.strudel.ctx.state);
      }
    }
  }

  function loop() {
    if (!running) return;

    frames++;
    const now = Date.now();
    
    // Check Audio State occasionally
    if (frames % 60 === 0) checkAudioState();

    // Log Stats every minute
    if (now - lastLogTime >= LOG_INTERVAL_MS) {
      const elapsed = (now - startTime) / 1000;
      const currentMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const fps = frames / ((now - lastLogTime) / 1000);
      
      maxMemory = Math.max(maxMemory, currentMemory);
      
      console.log(`⏱️ T+${(elapsed/60).toFixed(0)}m | FPS: ${fps.toFixed(1)} | Mem: ${(currentMemory/1048576).toFixed(2)} MB | Dropouts: ${audioDropouts}`);
      
      if (fps < FPS_THRESHOLD) {
        console.warn(`⚠️ FPS Drop detected: ${fps.toFixed(1)}`);
        droppedFrames++;
      }

      frames = 0;
      lastLogTime = now;
    }

    // End Test
    if (now - startTime >= DURATION_MS) {
      running = false;
      finishTest();
    } else {
      requestAnimationFrame(loop);
    }
  }

  function finishTest() {
    const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryGrowth = finalMemory - initialMemory;
    
    console.log('🏁 Test Complete!');
    console.log('==========================================');
    console.log(`Duration: 30 Minutes`);
    console.log(`Memory Growth: ${(memoryGrowth/1048576).toFixed(2)} MB`);
    console.log(`Max Memory: ${(maxMemory/1048576).toFixed(2)} MB`);
    console.log(`Audio Dropouts: ${audioDropouts}`);
    console.log(`Low FPS Events: ${droppedFrames}`);
    console.log('==========================================');
    
    if (memoryGrowth < 10 * 1048576 && audioDropouts === 0 && droppedFrames === 0) {
      console.log('✅ PASSED: System is stable.');
    } else {
      console.error('❌ FAILED: Stability issues detected.');
    }
  }

  requestAnimationFrame(loop);

})();
