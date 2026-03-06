# WebSocket 连接稳定性改进

## 问题诊断

原有的 WebSocket 实现存在以下问题：

1. **缺少心跳机制** - 无法检测"僵尸连接"（TCP 连接存在但应用层已失效）
2. **重连策略过于激进** - 固定 3 秒重连，网络波动时会造成服务器压力
3. **错误处理不完善** - send() 调用没有 try-catch，可能导致未捕获异常
4. **没有连接状态追踪** - 服务端无法主动清理死连接

## 实施的改进

### 1. 服务端心跳机制 (server/index.js)

```javascript
// 每 30 秒 ping 所有客户端
// 如果客户端没有响应 pong，则终止连接
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
```

**原理**：
- WebSocket 原生支持 ping/pong 帧（控制帧）
- 服务端每 30 秒发送 ping
- 客户端收到 ping 会自动回复 pong（浏览器自动处理）
- 如果客户端在下一次心跳前没有回复，标记为死连接并终止

### 2. 客户端指数退避重连

**Screen 客户端** (client/src/main.js):
```javascript
// 重连延迟：1s → 2s → 4s → 8s → 16s → 30s (最大)
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
```

**Mobile 客户端** (client/mobile/index.html):
```javascript
// 同样的指数退避策略
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
```

**好处**：
- 网络短暂波动时快速恢复（1-2 秒）
- 长时间断网时避免频繁重连造成服务器压力
- 连接成功后重置计数器，恢复快速重连

### 3. 客户端主动心跳

除了响应服务端的 ping，客户端也主动发送心跳：

```javascript
// 每 25 秒发送一次 ping（在服务端 30 秒超时之前）
heartbeatTimer = setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 25000);
```

**双向心跳的优势**：
- 服务端可以检测客户端死连接
- 客户端可以主动保持连接活跃
- 防止中间代理（如 Nginx、负载均衡器）因空闲超时关闭连接

### 4. 完善的错误处理

所有 `ws.send()` 调用都包裹在 try-catch 中：

```javascript
try {
  ws.send(JSON.stringify(msg));
} catch (e) {
  console.error('Failed to send message:', e.message);
}
```

**防止**：
- 向已关闭的连接发送消息导致崩溃
- 序列化错误导致服务中断
- 未捕获异常影响其他客户端

### 5. 连接关闭日志

```javascript
ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${clientType} (code: ${code}, reason: ${reason})`);
});
```

**便于调试**：
- 1000: 正常关闭
- 1001: 端点离开（如页面关闭）
- 1006: 异常关闭（网络问题）
- 1011: 服务器错误

## 测试建议

### 1. 网络波动测试
```bash
# 模拟网络延迟
sudo tc qdisc add dev eth0 root netem delay 100ms 50ms

# 模拟丢包
sudo tc qdisc add dev eth0 root netem loss 10%

# 恢复
sudo tc qdisc del dev eth0 root
```

### 2. 长连接测试
- 保持页面打开 1 小时以上
- 观察是否有自动断连/重连
- 检查服务端日志中的心跳信息

### 3. 快速断网恢复测试
- 关闭 WiFi 5 秒后重新打开
- 观察重连时间（应该在 1-2 秒内）

### 4. 长时间断网测试
- 关闭 WiFi 5 分钟
- 观察重连尝试间隔（应该逐渐增加到 30 秒）

## 监控指标

建议添加以下监控（未实现，可选）：

1. **连接数统计**
   - 当前活跃连接数
   - Master/Viewer/Mobile 分类统计

2. **心跳失败率**
   - 每分钟心跳超时的连接数
   - 可以反映网络质量

3. **重连频率**
   - 每分钟重连次数
   - 异常高频重连可能表示服务端问题

4. **消息发送失败率**
   - try-catch 捕获的错误数量
   - 可以发现潜在的序列化问题

## 进一步优化（可选）

### 1. 连接质量自适应
根据网络质量动态调整心跳间隔：
- 网络良好：60 秒心跳
- 网络一般：30 秒心跳
- 网络较差：15 秒心跳

### 2. 消息队列
客户端断线时缓存消息，重连后批量发送：
```javascript
const messageQueue = [];
if (ws.readyState !== WebSocket.OPEN) {
  messageQueue.push(msg);
} else {
  // 发送队列中的消息
  while (messageQueue.length > 0) {
    ws.send(messageQueue.shift());
  }
}
```

### 3. 连接池
对于高频消息（如 slider 控制），使用专用连接：
- 一个连接用于控制消息（高频、可丢失）
- 一个连接用于状态同步（低频、必达）

### 4. 压缩传输
对于大消息（如代码更新），启用 WebSocket 压缩：
```javascript
const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    }
  }
});
```

## 总结

通过以上改进，WebSocket 连接的鲁棒性显著提升：

✅ 自动检测并清理死连接
✅ 智能重连策略减少服务器压力
✅ 双向心跳保持连接活跃
✅ 完善的错误处理防止崩溃
✅ 详细的日志便于问题排查

预期效果：
- 正常网络环境下连接稳定，无异常断连
- 网络波动时快速自动恢复（1-2 秒）
- 长时间断网后智能重连，不会造成服务器压力
