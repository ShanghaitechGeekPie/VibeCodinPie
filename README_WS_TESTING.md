# WebSocket 稳定性测试指南

## 快速测试

### 1. 启动服务器
```bash
npm start
```

### 2. 运行自动化测试
在另一个终端运行：
```bash
npm run test:ws
```

测试将验证：
- ✅ 基本连接建立
- ✅ 心跳机制响应
- ✅ 快速连接压力测试（10个并发连接）
- ✅ 高负载消息处理（100条消息）
- ✅ 空闲连接存活（35秒无活动）

## 手动测试场景

### 场景 1: 网络波动恢复
**目的**: 验证短暂断网后能快速重连

1. 打开浏览器访问 `http://localhost:3000/submit`
2. 打开开发者工具 Console
3. 观察连接状态（应该显示"已连接"）
4. 关闭 WiFi 或断开网络 5 秒
5. 重新连接网络

**预期结果**:
- 断网后状态变为"断开连接"
- 重连后 1-2 秒内恢复连接
- Console 显示: `Reconnecting in 1000ms (attempt 1)...`

### 场景 2: 长时间断网
**目的**: 验证指数退避策略

1. 打开浏览器访问 `http://localhost:3000/submit`
2. 打开开发者工具 Console
3. 关闭服务器: `Ctrl+C`
4. 观察 Console 中的重连日志

**预期结果**:
```
Reconnecting in 1000ms (attempt 1)...
Reconnecting in 2000ms (attempt 2)...
Reconnecting in 4000ms (attempt 3)...
Reconnecting in 8000ms (attempt 4)...
Reconnecting in 16000ms (attempt 5)...
Reconnecting in 30000ms (attempt 6)...  // 最大延迟
Reconnecting in 30000ms (attempt 7)...
```

### 场景 3: 长连接稳定性
**目的**: 验证心跳机制保持连接活跃

1. 打开浏览器访问 `http://localhost:3000/submit`
2. 保持页面打开 5 分钟
3. 观察服务器日志和浏览器 Console

**预期结果**:
- 连接保持稳定，无异常断开
- 服务器每 30 秒发送 ping（不会在日志中显示，除非失败）
- 客户端每 25 秒发送 ping（可在 Network 面板 WS 标签中看到）

### 场景 4: 多客户端并发
**目的**: 验证服务器能处理多个客户端

1. 打开 3 个浏览器标签页访问 `http://localhost:3000/submit`
2. 打开 1 个标签页访问 `http://localhost:3000/` (大屏)
3. 观察服务器日志

**预期结果**:
```
📱 Mobile client connected
📱 Mobile client connected
📱 Mobile client connected
🖥️  MASTER Screen connected
```

4. 关闭其中一个移动端标签页

**预期结果**:
```
Connection closed: mobile (code: 1001, reason: )
```

### 场景 5: 心跳超时检测
**目的**: 验证服务器能检测死连接

1. 启动服务器
2. 使用测试脚本建立连接但不响应 pong：

```javascript
// test_dead_connection.js
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/ws?type=mobile&session=dead-test');

ws.on('open', () => {
  console.log('Connected, but will not respond to pings...');
});

// Override pong handler to do nothing
ws.on('ping', () => {
  console.log('Received ping, but ignoring...');
  // Don't send pong
});

ws.on('close', (code, reason) => {
  console.log(`Connection terminated by server: ${code} - ${reason}`);
});
```

3. 运行: `node test_dead_connection.js`
4. 等待 30 秒

**预期结果**:
- 服务器日志显示: `⚠️  Terminating unresponsive connection`
- 客户端收到关闭事件

## 性能监控

### 使用浏览器开发者工具

1. 打开 Chrome DevTools
2. 切换到 **Network** 标签
3. 过滤 **WS** (WebSocket)
4. 点击 WebSocket 连接查看：
   - **Messages**: 所有发送/接收的消息
   - **Timing**: 连接建立时间
   - **Frames**: 控制帧（ping/pong）

### 监控指标

**正常连接应该显示**:
- Ping 帧每 30 秒（服务端发送）
- Pong 帧每 30 秒（客户端响应）
- 客户端 ping 消息每 25 秒

**异常情况**:
- 频繁的连接/断开（可能是网络问题）
- 没有 ping/pong 帧（心跳机制未工作）
- 大量错误消息（可能是代码问题）

## 压力测试

### 高频消息测试
```bash
# 使用 artillery 进行 WebSocket 压力测试
npm install -g artillery

# 创建测试配置 ws-load-test.yml
cat > ws-load-test.yml << EOF
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
  engines:
    ws:
      timeout: 30000

scenarios:
  - engine: ws
    flow:
      - connect:
          target: "/ws?type=mobile&session=load-test-{{ \$uuid }}"
      - think: 1
      - send:
          payload: '{"type":"control_slider","id":"test","force":0.5}'
      - think: 0.1
      - loop:
        - send:
            payload: '{"type":"control_slider","id":"test","force":{{ \$randomNumber(0,1) }}}'
        - think: 0.05
        count: 100
EOF

# 运行测试
artillery run ws-load-test.yml
```

**预期结果**:
- 所有连接成功建立
- 消息发送成功率 > 99%
- 平均延迟 < 50ms
- 无服务器崩溃或内存泄漏

## 故障排查

### 问题: 连接频繁断开
**可能原因**:
1. 反向代理超时设置过短（Nginx/Apache）
2. 防火墙关闭空闲连接
3. 客户端/服务端心跳配置不匹配

**解决方案**:
- 检查 Nginx 配置: `proxy_read_timeout 60s;`
- 调整心跳间隔（服务端 30s，客户端 25s）
- 查看服务器日志中的关闭代码

### 问题: 重连过于频繁
**可能原因**:
1. 服务器不稳定或频繁重启
2. 网络质量差
3. 指数退避未生效

**解决方案**:
- 检查服务器日志是否有错误
- 验证 `reconnectAttempts` 变量是否正确递增
- 确认 `reconnectAttempts` 在连接成功后重置为 0

### 问题: 消息丢失
**可能原因**:
1. 发送时连接已关闭
2. 消息队列未实现
3. 网络拥塞

**解决方案**:
- 检查 `ws.readyState === WebSocket.OPEN` 再发送
- 实现客户端消息队列（可选）
- 添加消息确认机制（可选）

## 日志分析

### 正常运行的日志模式
```
🖥️  MASTER Screen connected
📱 Mobile client connected
📱 Mobile client connected
🎚️  Registered 3 sliders from Master
📝 Prompt queued (#1): "加一些鼓点"
🤖 Generating code for: "加一些鼓点"
✅ Code updated for prompt: "加一些鼓点"
```

### 异常日志模式
```
⚠️  Terminating unresponsive connection  // 心跳超时
Connection closed: mobile (code: 1006, reason: )  // 异常断开
WebSocket error (mobile): Connection reset by peer  // 网络错误
Failed to send message: WebSocket is not open  // 向已关闭连接发送
```

## 总结

通过以上测试，你可以验证：
- ✅ 连接建立和断开的正确性
- ✅ 心跳机制的有效性
- ✅ 重连策略的合理性
- ✅ 错误处理的完善性
- ✅ 多客户端并发的稳定性

如果所有测试通过，说明 WebSocket 连接已经足够鲁棒，可以在生产环境中使用。
