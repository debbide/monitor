/**
 * Telegram Bot 监听模块
 * 监听群组消息，根据关键词判断服务状态
 */

import TelegramBot from 'node-telegram-bot-api'
import { queryAll, queryFirst, run, saveDatabase } from './db.js'
import { Monitor } from './types.js'

// Bot 实例
let bot: TelegramBot | null = null
let currentToken: string = ''

// 已处理的消息 ID（防重复）
const processedMessages = new Set<string>()
const MAX_PROCESSED_MESSAGES = 1000

// 最近状态变更记录（防止短时间内重复处理）
const recentChanges = new Map<string, number>()
const CHANGE_COOLDOWN = 60 * 1000 // 1分钟冷却

/**
 * 获取存储的 TG Bot Token
 */
export function getTgBotToken(): string {
    const result = queryFirst(
        "SELECT value FROM system_settings WHERE key = 'tg_bot_token'"
    ) as { value: string } | null
    return result?.value || ''
}

/**
 * 验证 TG Bot Token 是否有效
 */
async function validateToken(token: string): Promise<{ valid: boolean; botName?: string; error?: string }> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
            method: 'GET',
            headers: { 'User-Agent': 'UptimeMonitor/1.0' }
        })

        const data = await response.json()

        if (data.ok && data.result) {
            return { valid: true, botName: data.result.username }
        } else {
            return { valid: false, error: data.description || 'Token 无效' }
        }
    } catch (error: any) {
        return { valid: false, error: error.message }
    }
}

/**
 * 设置 TG Bot Token 并重新初始化 Bot
 */
export async function setTgBotToken(token: string): Promise<{ success: boolean; message: string }> {
    // 如果有 Token，先验证有效性
    if (token) {
        const validation = await validateToken(token)
        if (!validation.valid) {
            return { success: false, message: `Token 无效: ${validation.error}` }
        }
        console.log(`✅ Token 验证成功，Bot: @${validation.botName}`)
    }

    // 保存到数据库
    run(
        `INSERT OR REPLACE INTO system_settings (key, value, updated_at) 
         VALUES ('tg_bot_token', ?, datetime('now'))`,
        [token]
    )

    // 重新初始化 Bot
    stopTelegramBot()

    if (token) {
        const result = initTelegramBot()
        if (result) {
            return { success: true, message: 'Token 验证通过，Bot 已启动！' }
        } else {
            return { success: false, message: 'Bot 启动失败' }
        }
    }

    return { success: true, message: 'Token 已清除，Bot 已停止' }
}

/**
 * 初始化 Telegram Bot
 */
export function initTelegramBot(): boolean {
    const token = getTgBotToken()

    if (!token) {
        console.log('ℹ️ TG Bot Token 未设置，Telegram 监控功能已禁用')
        return false
    }

    try {
        // 如果已有 Bot 且 Token 相同，不重复初始化
        if (bot && currentToken === token) {
            return true
        }

        // 停止旧的 Bot
        if (bot) {
            bot.stopPolling()
        }

        bot = new TelegramBot(token, { polling: true })
        currentToken = token

        console.log('🤖 Telegram Bot 已启动')

        // 监听所有消息
        bot.on('message', handleMessage)

        // 错误处理
        bot.on('polling_error', (error) => {
            console.error('❌ TG Bot Polling 错误:', error.message)
        })

        return true
    } catch (error: any) {
        console.error('❌ TG Bot 初始化失败:', error.message)
        return false
    }
}

/**
 * 处理收到的消息
 */
async function handleMessage(msg: TelegramBot.Message) {
    const chatId = msg.chat.id.toString()
    const messageId = `${chatId}_${msg.message_id}`
    const text = msg.text || ''
    const chatTitle = msg.chat.title || '私聊'

    // 消息 ID 去重
    if (processedMessages.has(messageId)) {
        return
    }
    processedMessages.add(messageId)

    // 限制 Set 大小
    if (processedMessages.size > MAX_PROCESSED_MESSAGES) {
        const first = processedMessages.values().next().value
        if (first) {
            processedMessages.delete(first)
        }
    }

    // 查找监听此群组的 Telegram 类型监控
    const monitors = queryAll(
        "SELECT * FROM monitors WHERE check_type = 'telegram' AND is_active = 1 AND tg_chat_id = ?",
        [chatId]
    ) as Monitor[]

    if (monitors.length === 0) {
        return // 没有监控项监听这个群组
    }

    for (const monitor of monitors) {
        await processMonitorMessage(monitor, text, chatTitle, msg)
    }
}

/**
 * 处理单个监控的消息匹配
 */
async function processMonitorMessage(
    monitor: Monitor,
    text: string,
    chatTitle: string,
    msg: TelegramBot.Message
) {
    const textLower = text.toLowerCase()
    const monitorNameLower = monitor.name.toLowerCase()

    // 首先检查消息是否包含监控名称（必须匹配）
    if (!textLower.includes(monitorNameLower)) {
        return // 不包含监控名称，跳过
    }

    // 解析关键词
    const offlineKeywords = (monitor.tg_offline_keywords || '离线,offline,down,掉线')
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k)

    const onlineKeywords = (monitor.tg_online_keywords || '上线,online,up,恢复')
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k)

    // 检测状态（名称已匹配，再检查关键词）
    const isOffline = offlineKeywords.some(kw => textLower.includes(kw))
    const isOnline = onlineKeywords.some(kw => textLower.includes(kw))

    if (!isOffline && !isOnline) {
        return // 名称匹配但不包含状态关键词
    }

    // 如果同时包含离线和上线关键词，以离线优先
    const newStatus = isOffline ? 'down' : 'up'

    // 防重复：检查冷却时间
    const changeKey = `${monitor.id}_${newStatus}`
    const lastChange = recentChanges.get(changeKey)
    if (lastChange && Date.now() - lastChange < CHANGE_COOLDOWN) {
        return // 冷却中
    }

    // 获取当前状态
    const lastCheck = queryFirst(
        'SELECT status FROM monitor_checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1',
        [monitor.id]
    ) as { status: string } | null

    // 防重复：状态相同不处理
    if (lastCheck && lastCheck.status === newStatus) {
        return
    }

    // 记录本次变更
    recentChanges.set(changeKey, Date.now())

    console.log(`📩 [${chatTitle}] 检测到 "${monitor.name}" 状态变更: ${newStatus.toUpperCase()}`)
    console.log(`   消息内容: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`)

    // 保存检查记录
    const now = new Date().toISOString()
    run(
        `INSERT INTO monitor_checks (monitor_id, status, response_time, status_code, error_message, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [
            monitor.id,
            newStatus,
            0,
            0,
            newStatus === 'down' ? `TG 通知: ${text.substring(0, 100)}` : '',
            now
        ]
    )

    // 处理事件
    if (newStatus === 'down') {
        await handleDownStatus(monitor, text, now)
    } else {
        await handleUpStatus(monitor, now)
    }

    // 发送群组确认消息
    if (bot && msg.chat.id) {
        const statusEmoji = newStatus === 'down' ? '🔴' : '🟢'
        const statusText = newStatus === 'down' ? '离线' : '上线'
        const confirmMsg = [
            `${statusEmoji} **已收到通知**`,
            `📊 监控: ${monitor.name}`,
            `📌 状态: ${statusText} → 监控系统已更新`,
            `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ].join('\n')

        try {
            await bot.sendMessage(msg.chat.id, confirmMsg, { parse_mode: 'Markdown' })
        } catch (err) {
            console.error('发送确认消息失败:', err)
        }
    }
}

/**
 * 处理离线状态
 */
async function handleDownStatus(monitor: Monitor, message: string, timestamp: string) {
    // 检查是否已有未解决的事件
    const existingIncident = queryFirst(
        'SELECT id FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL',
        [monitor.id]
    )

    if (!existingIncident) {
        run(
            'INSERT INTO incidents (monitor_id, started_at, notified) VALUES (?, ?, 1)',
            [monitor.id, timestamp]
        )

        // 发送 Webhook 通知
        if (monitor.webhook_url) {
            await sendWebhook(monitor, 'down', message, timestamp)
        }
    }
}

/**
 * 处理上线状态
 */
async function handleUpStatus(monitor: Monitor, timestamp: string) {
    const incident = queryFirst(
        'SELECT * FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL',
        [monitor.id]
    ) as any

    if (incident) {
        const startedAt = new Date(incident.started_at)
        const durationSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000)

        run(
            'UPDATE incidents SET resolved_at = ?, duration_seconds = ? WHERE id = ?',
            [timestamp, durationSeconds, incident.id]
        )

        // 发送恢复通知
        if (monitor.webhook_url) {
            await sendWebhook(monitor, 'up', '', timestamp)
        }
    }
}

/**
 * 发送 Webhook 通知
 */
async function sendWebhook(
    monitor: Monitor,
    status: 'up' | 'down',
    message: string,
    timestamp: string
) {
    if (!monitor.webhook_url) return

    try {
        const payload = {
            monitor: monitor.name,
            url: monitor.url,
            status,
            timestamp,
            message: status === 'down'
                ? `🚨 ${monitor.name} is DOWN! ${message.substring(0, 100)}`
                : `✅ ${monitor.name} is back UP!`
        }

        let headers: Record<string, string> = {
            'Content-Type': monitor.webhook_content_type || 'application/json'
        }

        if (monitor.webhook_headers) {
            try {
                const customHeaders = JSON.parse(monitor.webhook_headers)
                headers = { ...headers, ...customHeaders }
            } catch { }
        }

        await fetch(monitor.webhook_url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        })
    } catch (error) {
        console.error('❌ Webhook 发送失败:', error)
    }
}

/**
 * 获取 Bot 状态
 */
export function getTelegramBotStatus(): { enabled: boolean; connected: boolean; token: string } {
    const token = getTgBotToken()
    return {
        enabled: !!token,
        connected: bot !== null,
        token: token ? `${token.substring(0, 10)}...` : ''
    }
}

/**
 * 停止 Bot
 */
export function stopTelegramBot() {
    if (bot) {
        bot.stopPolling()
        bot = null
        console.log('👋 Telegram Bot 已停止')
    }
}

/**
 * 发送自定义消息到群组
 */
export async function sendTgMessage(chatId: string, message: string): Promise<{ success: boolean; message: string }> {
    if (!bot) {
        return { success: false, message: 'Bot 未启动' }
    }

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
        return { success: true, message: '消息已发送' }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

/**
 * 测试群组连通性 - 发送测试消息到群组
 */
export async function testChatConnection(chatId: string): Promise<{ success: boolean; message: string }> {
    if (!bot) {
        return { success: false, message: 'Bot 未启动，请先配置 Token' }
    }

    if (!chatId) {
        return { success: false, message: '请输入群组 ID' }
    }

    try {
        const testMsg = [
            '✅ **连接测试成功**',
            '',
            '📊 监控系统已成功连接到此群组',
            `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ].join('\n')

        await bot.sendMessage(chatId, testMsg, { parse_mode: 'Markdown' })
        return { success: true, message: '测试消息已发送到群组' }
    } catch (error: any) {
        if (error.message?.includes('chat not found')) {
            return { success: false, message: '群组不存在或 Bot 未加入该群组' }
        }
        if (error.message?.includes('bot was kicked')) {
            return { success: false, message: 'Bot 已被踢出该群组' }
        }
        return { success: false, message: `发送失败: ${error.message}` }
    }
}
