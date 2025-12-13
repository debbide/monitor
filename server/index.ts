import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { initDatabase, queryAll, queryFirst, run } from './db.js'
import { Monitor, MonitorCheck } from './types.js'
import { checkAllMonitors, checkMonitor, hashPassword, verifyPassword } from './monitor.js'
import { initTelegramBot, getTelegramBotStatus, stopTelegramBot, setTgBotToken, getTgBotToken, testChatConnection, sendTgMessage } from './telegram.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')))

// API 路由
app.get('/api/monitors', (req, res) => {
  try {
    const monitors = queryAll('SELECT * FROM monitors ORDER BY sort_order ASC, created_at DESC')
    res.json(monitors)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/monitors', async (req, res) => {
  try {
    const body = req.body
    const id = crypto.randomUUID()

    run(
      `INSERT INTO monitors (id, name, url, check_interval, check_interval_max, check_type, check_method, check_timeout, expected_status_codes, expected_keyword, forbidden_keyword, komari_offline_threshold, tg_chat_id, tg_offline_keywords, tg_online_keywords, webhook_url, webhook_content_type, webhook_headers, webhook_body, webhook_username, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        body.name,
        body.url || '',
        parseInt(body.check_interval) || 5,
        body.check_interval_max ? parseInt(body.check_interval_max) : null,
        body.check_type || 'http',
        body.check_method || 'GET',
        parseInt(body.check_timeout) || 30,
        body.expected_status_codes || '200,201,204,301,302',
        body.expected_keyword || null,
        body.forbidden_keyword || null,
        parseInt(body.komari_offline_threshold) || 3,
        body.tg_chat_id || null,
        body.tg_offline_keywords || null,
        body.tg_online_keywords || null,
        body.webhook_url || null,
        body.webhook_content_type || 'application/json',
        body.webhook_headers && typeof body.webhook_headers === 'object' ? JSON.stringify(body.webhook_headers) : (body.webhook_headers || null),
        body.webhook_body && typeof body.webhook_body === 'object' ? JSON.stringify(body.webhook_body) : (body.webhook_body || null),
        body.webhook_username || null
      ]
    )

    const monitor = queryFirst('SELECT * FROM monitors WHERE id = ?', [id]) as Monitor

    // 创建后立即检查一次（Telegram 类型插入默认正常状态）
    if (monitor) {
      if (monitor.check_type === 'telegram') {
        // Telegram 类型：插入一条默认正常状态的记录
        run(
          `INSERT INTO monitor_checks (monitor_id, status, response_time, status_code, error_message, checked_at)
           VALUES (?, 'up', 0, 0, NULL, datetime('now'))`,
          [id]
        )
      } else {
        await checkMonitor(monitor)
      }
    }

    res.status(201).json(monitor)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 批量更新排序 - 必须放在 /api/monitors/:id 之前
app.put('/api/monitors/reorder', (req, res) => {
  try {
    const { orders } = req.body as { orders: { id: string; sort_order: number }[] }

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders array required' })
    }

    for (const item of orders) {
      run('UPDATE monitors SET sort_order = ? WHERE id = ?', [item.sort_order, item.id])
    }

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/monitors/:id', (req, res) => {
  try {
    const { id } = req.params
    const body = req.body

    run(
      `UPDATE monitors SET
        name = ?,
        url = ?,
        check_interval = ?,
        check_interval_max = ?,
        check_type = ?,
        check_method = ?,
        check_timeout = ?,
        expected_status_codes = ?,
        expected_keyword = ?,
        forbidden_keyword = ?,
        komari_offline_threshold = ?,
        webhook_url = ?,
        webhook_content_type = ?,
        webhook_headers = ?,
        webhook_body = ?,
        webhook_username = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        body.name,
        body.url,
        body.check_interval || 5,
        body.check_interval_max || null,
        body.check_type || 'http',
        body.check_method || 'GET',
        body.check_timeout || 30,
        body.expected_status_codes || '200,201,204,301,302',
        body.expected_keyword || null,
        body.forbidden_keyword || null,
        body.komari_offline_threshold || 3,
        body.webhook_url || null,
        body.webhook_content_type || 'application/json',
        body.webhook_headers ? JSON.stringify(body.webhook_headers) : null,
        body.webhook_body ? JSON.stringify(body.webhook_body) : null,
        body.webhook_username || null,
        body.is_active !== undefined ? body.is_active : 1,
        new Date().toISOString(),
        id
      ]
    )

    const monitor = queryFirst('SELECT * FROM monitors WHERE id = ?', [id])
    res.json(monitor)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/monitors/:id', (req, res) => {
  try {
    const { id } = req.params
    run('DELETE FROM monitors WHERE id = ?', [id])
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/checks', (req, res) => {
  try {
    const monitorId = req.query.monitor_id as string
    if (!monitorId) {
      return res.status(400).json({ error: 'monitor_id required' })
    }

    const checks = queryAll(
      'SELECT * FROM monitor_checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 100',
      [monitorId]
    )

    res.json(checks)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/stats', (req, res) => {
  try {
    const monitorId = req.query.monitor_id as string
    if (!monitorId) {
      return res.status(400).json({ error: 'monitor_id required' })
    }

    const total = queryFirst(
      'SELECT COUNT(*) as count FROM monitor_checks WHERE monitor_id = ?',
      [monitorId]
    ) as any

    const upCount = queryFirst(
      "SELECT COUNT(*) as count FROM monitor_checks WHERE monitor_id = ? AND status = 'up'",
      [monitorId]
    ) as any

    const avgResponseTime = queryFirst(
      'SELECT AVG(response_time) as avg FROM monitor_checks WHERE monitor_id = ?',
      [monitorId]
    ) as any

    const uptime = total.count > 0 ? (upCount.count / total.count) * 100 : 0

    res.json({
      total_checks: total.count,
      uptime_percentage: uptime,
      average_response_time: avgResponseTime.avg || 0
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/test-webhook', async (req, res) => {
  try {
    const { monitor_id } = req.body
    const monitor = queryFirst('SELECT * FROM monitors WHERE id = ?', [monitor_id]) as Monitor

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found' })
    }

    if (!monitor.webhook_url) {
      return res.status(400).json({ error: 'No webhook URL configured' })
    }

    const testCheck: MonitorCheck = {
      monitor_id: monitor.id,
      status: 'up',
      response_time: 123,
      status_code: 200,
      error_message: '',
      checked_at: new Date().toISOString()
    }

    // 发送测试 webhook
    const variables = {
      monitor_name: monitor.name,
      monitor_url: monitor.url,
      status: 'down',
      error: 'Test notification',
      timestamp: testCheck.checked_at,
      response_time: testCheck.response_time.toString(),
      status_code: testCheck.status_code.toString()
    }

    let payload: any
    let headers: Record<string, string> = {}

    if (monitor.webhook_body) {
      const body = JSON.parse(monitor.webhook_body)
      payload = processWebhookBody(body, variables)
    } else {
      payload = {
        monitor: monitor.name,
        url: monitor.url,
        status: 'down',
        timestamp: testCheck.checked_at,
        response_time: testCheck.response_time,
        status_code: testCheck.status_code,
        error: 'Test notification',
        message: `🚨 ${monitor.name} is DOWN! Test notification`
      }
    }

    headers['Content-Type'] = monitor.webhook_content_type || 'application/json'

    if (monitor.webhook_headers) {
      const customHeaders = JSON.parse(monitor.webhook_headers)
      headers = { ...headers, ...customHeaders }
    }

    if (monitor.webhook_username) {
      const encodedAuth = Buffer.from(`${monitor.webhook_username}:`).toString('base64')
      headers['Authorization'] = `Basic ${encodedAuth}`
    }

    await fetch(monitor.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    // 如果是 Telegram 类型，向群组发送确认消息
    if (monitor.check_type === 'telegram' && monitor.tg_chat_id) {
      try {
        const webhookConfirmMsg = [
          `📤 **Webhook 测试成功**`,
          `📊 监控: ${monitor.name}`,
          `🔗 Webhook 已发送测试通知`,
          `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ].join('\n')
        await sendTgMessage(monitor.tg_chat_id, webhookConfirmMsg)
      } catch (err) {
        console.error('发送 TG 确认消息失败:', err)
      }
    }

    res.json({ success: true, message: 'Test webhook sent' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

function processWebhookBody(body: Record<string, any>, variables: Record<string, any>): Record<string, any> {
  const processed: Record<string, any> = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      let result = value
      for (const [k, v] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      }
      processed[key] = result
    } else if (typeof value === 'object' && value !== null) {
      processed[key] = processWebhookBody(value, variables)
    } else {
      processed[key] = value
    }
  }
  return processed
}

app.post('/api/check-now', async (req, res) => {
  try {
    const { monitor_id } = req.body
    const monitor = queryFirst('SELECT * FROM monitors WHERE id = ?', [monitor_id]) as Monitor

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found' })
    }

    await checkMonitor(monitor)

    const latestCheck = queryFirst(
      'SELECT * FROM monitor_checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1',
      [monitor_id]
    )

    res.json({ success: true, check: latestCheck })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { password } = req.body
    const result = queryFirst('SELECT password_hash FROM admin_credentials LIMIT 1') as any

    if (!result) {
      return res.status(500).json({ error: 'No admin credentials found' })
    }

    const isValid = await verifyPassword(password, result.password_hash)

    if (isValid) {
      res.json({ valid: true })
    } else {
      res.status(401).json({ valid: false })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    const result = queryFirst('SELECT password_hash FROM admin_credentials LIMIT 1') as any

    if (!result) {
      return res.status(500).json({ error: 'No admin credentials found' })
    }

    const isValid = await verifyPassword(current_password, result.password_hash)

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const newHash = await hashPassword(new_password)

    run(
      'UPDATE admin_credentials SET password_hash = ?, updated_at = ? WHERE id = 1',
      [newHash, new Date().toISOString()]
    )

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 获取 TG Bot 设置和状态
app.get('/api/settings/telegram', (req, res) => {
  try {
    const status = getTelegramBotStatus()
    res.json(status)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 设置 TG Bot Token
app.post('/api/settings/telegram', async (req, res) => {
  try {
    const { token } = req.body
    const result = await setTgBotToken(token || '')
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 测试群组连通性
app.post('/api/settings/telegram/test-chat', async (req, res) => {
  try {
    const { chat_id } = req.body
    const result = await testChatConnection(chat_id)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 接收 Komari TG 中转服务的 Webhook
app.post('/api/webhook/komari', async (req, res) => {
  try {
    const { source, status, server_name, raw_message, timestamp } = req.body

    console.log(`📩 收到 Komari TG 中转通知: ${server_name} -> ${status}`)

    // 查找匹配的 Komari 监控项
    const monitors = queryAll(
      "SELECT * FROM monitors WHERE check_type = 'komari' AND is_active = 1"
    ) as Monitor[]

    let matched = false

    for (const monitor of monitors) {
      // 检查是否匹配目标服务器
      const targetServers = monitor.expected_keyword
        ? monitor.expected_keyword.split(',').map(s => s.trim()).filter(s => s)
        : null

      // 如果设置了目标服务器，检查是否匹配
      if (targetServers && targetServers.length > 0) {
        const isTarget = targetServers.some(target =>
          server_name.toLowerCase().includes(target.toLowerCase()) ||
          target.toLowerCase().includes(server_name.toLowerCase())
        )
        if (!isTarget) continue
      }

      matched = true
      const checkStatus = status === 'down' ? 'down' : 'up'

      // 保存检查记录
      run(
        `INSERT INTO monitor_checks (monitor_id, status, response_time, status_code, error_message, checked_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          monitor.id,
          checkStatus,
          0,
          0,
          checkStatus === 'down' ? `TG 通知: ${server_name} 离线` : '',
          timestamp || new Date().toISOString()
        ]
      )

      // 如果是离线状态，创建事件
      if (checkStatus === 'down') {
        const existingIncident = queryFirst(
          'SELECT id FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL',
          [monitor.id]
        )

        if (!existingIncident) {
          run(
            'INSERT INTO incidents (monitor_id, started_at, notified) VALUES (?, ?, 1)',
            [monitor.id, new Date().toISOString()]
          )
        }
      } else {
        // 上线则解决事件
        const incident = queryFirst(
          'SELECT * FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL',
          [monitor.id]
        ) as any

        if (incident) {
          const resolvedAt = new Date().toISOString()
          const startedAt = new Date(incident.started_at)
          const durationSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000)

          run(
            'UPDATE incidents SET resolved_at = ?, duration_seconds = ? WHERE id = ?',
            [resolvedAt, durationSeconds, incident.id]
          )
        }
      }

      console.log(`✅ 已更新监控 "${monitor.name}" 状态为 ${checkStatus}`)
    }

    if (matched) {
      res.json({ success: true, message: 'Status updated' })
    } else {
      res.json({ success: true, message: 'No matching monitor found' })
    }
  } catch (error: any) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// 获取 Komari 服务器状态
app.get('/api/komari-status/:id', async (req, res) => {
  try {
    const { id } = req.params
    const monitor = queryFirst('SELECT * FROM monitors WHERE id = ?', [id]) as Monitor

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found' })
    }

    if (monitor.check_type !== 'komari') {
      return res.status(400).json({ error: 'Not a Komari monitor' })
    }

    const response = await fetch(monitor.url, {
      method: 'GET',
      headers: { 'User-Agent': 'UptimeMonitor/1.0' }
    })

    if (!response.ok) {
      return res.status(502).json({ error: `Komari API returned ${response.status}` })
    }

    const data = await response.json() as any

    if (data.status !== 'success') {
      return res.status(502).json({ error: data.message || 'Komari API error' })
    }

    const offlineThreshold = (monitor.komari_offline_threshold || 3) * 60 * 1000
    const now = Date.now()
    const targetServers = monitor.expected_keyword
      ? monitor.expected_keyword.split(',').map((s: string) => s.trim()).filter((s: string) => s)
      : null

    const servers = data.data.map((server: any) => {
      if (targetServers && targetServers.length > 0) {
        const isTarget = targetServers.some((target: string) => server.name === target)
        if (!isTarget) return null
      }

      const updatedAt = new Date(server.updated_at).getTime()
      const timeSinceUpdate = now - updatedAt
      const isOnline = timeSinceUpdate <= offlineThreshold

      return {
        name: server.name,
        region: server.region,
        updated_at: server.updated_at,
        minutes_ago: Math.floor(timeSinceUpdate / 60000),
        is_online: isOnline
      }
    }).filter(Boolean)

    res.json({ servers })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 手动触发检查
app.get('/trigger', async (req, res) => {
  await checkAllMonitors()
  res.json({ message: 'Monitor check triggered' })
})

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// 初始化并启动服务
async function start() {
  await initDatabase()

  // 初始化 Telegram Bot（如果配置了 Token）
  initTelegramBot()

  // 启动定时任务 - 每分钟检查一次，根据各监控的间隔决定是否执行
  cron.schedule('* * * * *', () => {
    console.log('Running scheduled monitor check...')
    checkAllMonitors()
  })

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log('Monitor check scheduled every minute (respects individual intervals)')

    // 启动时执行一次检查
    checkAllMonitors()
  })

  // 优雅关闭
  process.on('SIGTERM', () => {
    stopTelegramBot()
    process.exit(0)
  })
}

start().catch(console.error)
