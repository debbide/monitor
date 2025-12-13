import { useState, useEffect } from 'react'
import { getTelegramSettings, setTelegramToken, TelegramStatus } from '../lib/api'

interface TelegramSettingsProps {
    onClose: () => void
}

export default function TelegramSettings({ onClose }: TelegramSettingsProps) {
    const [token, setToken] = useState('')
    const [status, setStatus] = useState<TelegramStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        loadSettings()
    }, [])

    async function loadSettings() {
        try {
            const data = await getTelegramSettings()
            setStatus(data)
            if (data.token) {
                setToken(data.token)
            }
        } catch (error) {
            console.error('加载设置失败:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setMessage('')
        try {
            const result = await setTelegramToken(token)
            setMessage(result.message)
            if (result.success) {
                await loadSettings()
                // 成功后 1.5 秒自动关闭
                setTimeout(() => {
                    onClose()
                }, 1500)
            }
        } catch (error: any) {
            setMessage('保存失败: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDisable() {
        setSaving(true)
        setMessage('')
        try {
            const result = await setTelegramToken('')
            setMessage(result.message)
            setToken('')
            await loadSettings()
        } catch (error: any) {
            setMessage('操作失败: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="modal-overlay">
                <div className="modal-content settings-modal">
                    <p>加载中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
                <h3>Telegram Bot 设置</h3>

                <div className="form-group">
                    <label>Bot 状态</label>
                    <div className="status-indicator">
                        <span className={`status-dot ${status?.connected ? 'online' : 'offline'}`}></span>
                        <span>{status?.connected ? '已连接' : (status?.enabled ? '未连接' : '未配置')}</span>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="tgToken">Bot Token</label>
                    <input
                        id="tgToken"
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="从 @BotFather 获取的 Token"
                    />
                    <span className="form-hint">
                        在 Telegram 找 @BotFather → /newbot 创建 Bot 获取 Token
                    </span>
                </div>

                {message && (
                    <div className={`message ${message.includes('失败') ? 'error' : 'success'}`}>
                        {message}
                    </div>
                )}

                <div className="form-actions">
                    <button className="btn-secondary" onClick={onClose}>
                        取消
                    </button>
                    {status?.connected && (
                        <button
                            className="btn-danger"
                            onClick={handleDisable}
                            disabled={saving}
                        >
                            停用 Bot
                        </button>
                    )}
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving || !token.trim()}
                    >
                        {saving ? '保存中...' : '保存并启动'}
                    </button>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                    <span className="form-hint" style={{ display: 'block', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                        <strong>使用说明：</strong><br />
                        1. 从 @BotFather 创建 Bot 获取 Token<br />
                        2. 将 Bot 加入到接收通知的群组<br />
                        3. 添加 "Telegram 群组监控" 类型的监控项
                    </span>
                </div>
            </div>
        </div>
    )
}
