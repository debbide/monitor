import { useState, useEffect } from 'react'
import { createMonitor, updateMonitor, Monitor, testTelegramChat } from '../lib/api'

interface AddMonitorFormProps {
  onSuccess: () => void
  onCancel?: () => void
  editMonitor?: Monitor | null
}

export default function AddMonitorForm({ onSuccess, onCancel, editMonitor }: AddMonitorFormProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval] = useState('5')
  const [intervalMax, setIntervalMax] = useState('')
  const [enableRandomInterval, setEnableRandomInterval] = useState(false)
  const [checkType, setCheckType] = useState<'http' | 'tcp' | 'komari' | 'telegram'>('http')
  const [checkMethod, setCheckMethod] = useState<'GET' | 'HEAD' | 'POST'>('GET')
  const [checkTimeout, setCheckTimeout] = useState('30')
  const [expectedStatusCodes, setExpectedStatusCodes] = useState('200,201,204,301,302')
  const [expectedKeyword, setExpectedKeyword] = useState('')
  const [forbiddenKeyword, setForbiddenKeyword] = useState('')
  const [komariOfflineThreshold, setKomariOfflineThreshold] = useState('3')
  // Telegram 相关状态
  const [tgChatId, setTgChatId] = useState('')
  const [tgOfflineKeywords, setTgOfflineKeywords] = useState('离线,offline,down,掉线')
  const [tgOnlineKeywords, setTgOnlineKeywords] = useState('上线,online,up,恢复')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [contentType, setContentType] = useState('application/json')
  const [headers, setHeaders] = useState('')
  const [body, setBody] = useState('')
  const [username, setUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = !!editMonitor

  useEffect(() => {
    if (editMonitor) {
      setName(editMonitor.name)
      setUrl(editMonitor.url)
      setInterval(String(editMonitor.check_interval))
      setIntervalMax(editMonitor.check_interval_max ? String(editMonitor.check_interval_max) : '')
      setEnableRandomInterval(!!editMonitor.check_interval_max)
      setCheckType(editMonitor.check_type || 'http')
      setCheckMethod(editMonitor.check_method || 'GET')
      setCheckTimeout(String(editMonitor.check_timeout || 30))
      setExpectedStatusCodes(editMonitor.expected_status_codes || '200,201,204,301,302')
      setExpectedKeyword(editMonitor.expected_keyword || '')
      setForbiddenKeyword(editMonitor.forbidden_keyword || '')
      setKomariOfflineThreshold(String(editMonitor.komari_offline_threshold || 3))
      setTgChatId(editMonitor.tg_chat_id || '')
      setTgOfflineKeywords(editMonitor.tg_offline_keywords || '离线,offline,down,掉线')
      setTgOnlineKeywords(editMonitor.tg_online_keywords || '上线,online,up,恢复')
      setWebhookUrl(editMonitor.webhook_url || '')
      setContentType(editMonitor.webhook_content_type || 'application/json')
      setHeaders(editMonitor.webhook_headers || '')
      setBody(editMonitor.webhook_body || '')
      setUsername(editMonitor.webhook_username || '')
    }
  }, [editMonitor])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      alert('请填写监控名称')
      return
    }

    // Telegram 类型需要群组 ID，其他类型需要 URL
    if (checkType === 'telegram') {
      if (!tgChatId.trim()) {
        alert('请填写群组 ID')
        return
      }
    } else {
      if (!url.trim()) {
        alert('请填写 URL')
        return
      }
    }

    let parsedHeaders = {}
    let parsedBody = {}

    if (headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers)
      } catch (error) {
        alert('Headers格式错误，请输入有效的JSON')
        return
      }
    }

    if (body.trim()) {
      try {
        parsedBody = JSON.parse(body)
      } catch (error) {
        alert('Body格式错误，请输入有效的JSON')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const intervalNum = parseInt(interval) || 5
      const intervalMaxNum = intervalMax ? parseInt(intervalMax) : null
      const timeoutNum = parseInt(checkTimeout) || 30
      const thresholdNum = parseInt(komariOfflineThreshold) || 3

      const monitorData = {
        name: name.trim(),
        url: checkType === 'telegram' ? '' : url.trim(),
        check_interval: intervalNum,
        check_interval_max: (checkType === 'http' && enableRandomInterval && intervalMaxNum && intervalMaxNum > intervalNum) ? intervalMaxNum : null,
        check_type: checkType,
        check_method: checkMethod,
        check_timeout: timeoutNum,
        expected_status_codes: expectedStatusCodes.trim() || '200,201,204,301,302',
        expected_keyword: expectedKeyword.trim() || undefined,
        forbidden_keyword: forbiddenKeyword.trim() || undefined,
        komari_offline_threshold: thresholdNum,
        tg_chat_id: tgChatId.trim() || undefined,
        tg_offline_keywords: tgOfflineKeywords.trim() || undefined,
        tg_online_keywords: tgOnlineKeywords.trim() || undefined,
        webhook_url: webhookUrl.trim() || undefined,
        webhook_content_type: contentType,
        webhook_headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
        webhook_body: Object.keys(parsedBody).length > 0 ? parsedBody : undefined,
        webhook_username: username.trim() || undefined
      }

      if (isEditMode && editMonitor) {
        await updateMonitor(editMonitor.id, monitorData)
      } else {
        await createMonitor(monitorData)
        resetForm()
      }

      onSuccess()
    } catch (error: any) {
      console.error('Error saving monitor:', error)
      const errorMsg = error?.message || '未知错误'
      alert(isEditMode ? `保存失败: ${errorMsg}` : `添加失败: ${errorMsg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setName('')
    setUrl('')
    setInterval('5')
    setIntervalMax('')
    setEnableRandomInterval(false)
    setCheckType('http')
    setCheckMethod('GET')
    setCheckTimeout('30')
    setExpectedStatusCodes('200,201,204,301,302')
    setExpectedKeyword('')
    setForbiddenKeyword('')
    setKomariOfflineThreshold('3')
    setTgChatId('')
    setTgOfflineKeywords('离线,offline,down,掉线')
    setTgOnlineKeywords('上线,online,up,恢复')
    setWebhookUrl('')
    setContentType('application/json')
    setHeaders('')
    setBody('')
    setUsername('')
  }

  return (
    <form className="add-monitor-form" onSubmit={handleSubmit}>
      <h3>{isEditMode ? '编辑监控' : '添加新监控'}</h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="name">监控名称</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 我的网站"
            required
          />
        </div>

        {checkType !== 'telegram' && (
          <div className="form-group">
            <label htmlFor="url">
              {checkType === 'komari' ? 'Komari API 地址' : '网站URL'}
            </label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={checkType === 'komari'
                ? 'https://your-komari-domain.com/api/client'
                : 'https://example.com 或 example.com:8080'}
              required
            />
          </div>
        )}
      </div>

      <div className="form-section">
        <h4>检测配置</h4>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="checkType">检测类型</label>
            <select
              id="checkType"
              value={checkType}
              onChange={(e) => setCheckType(e.target.value as 'http' | 'tcp' | 'komari' | 'telegram')}
            >
              <option value="http">HTTP 检测</option>
              <option value="tcp">TCP 连通性检测 (Ping)</option>
              <option value="komari">Komari 面板监控</option>
              <option value="telegram">Telegram 群组监控</option>
            </select>
          </div>

          {checkType === 'http' && (
            <div className="form-group">
              <label htmlFor="checkMethod">请求方法</label>
              <select
                id="checkMethod"
                value={checkMethod}
                onChange={(e) => setCheckMethod(e.target.value as 'GET' | 'HEAD' | 'POST')}
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
                <option value="POST">POST</option>
              </select>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="interval">
              {enableRandomInterval ? '最小间隔（分钟）' : '检查间隔（分钟）'}
            </label>
            <input
              id="interval"
              type="number"
              min="1"
              max="1440"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </div>

          {checkType === 'http' && enableRandomInterval && (
            <div className="form-group">
              <label htmlFor="intervalMax">最大间隔（分钟）</label>
              <input
                id="intervalMax"
                type="number"
                min={(parseInt(interval) || 1) + 1}
                max="1440"
                value={intervalMax || (parseInt(interval) + 5)}
                onChange={(e) => setIntervalMax(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="checkTimeout">超时时间（秒）</label>
            <input
              id="checkTimeout"
              type="number"
              min="5"
              max="120"
              value={checkTimeout}
              onChange={(e) => setCheckTimeout(e.target.value)}
            />
          </div>
        </div>

        {checkType === 'http' && (
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enableRandomInterval}
                onChange={(e) => {
                  setEnableRandomInterval(e.target.checked)
                  if (e.target.checked && !intervalMax) {
                    setIntervalMax(String((parseInt(interval) || 5) + 5))
                  }
                }}
              />
              启用随机间隔
            </label>
            <span className="form-hint">每次检查后在设定范围内随机选择下次检查时间，让访问更自然</span>
          </div>
        )}

        {checkType === 'http' && (
          <>
            <div className="form-group">
              <label htmlFor="expectedStatusCodes">期望状态码（逗号分隔）</label>
              <input
                id="expectedStatusCodes"
                type="text"
                value={expectedStatusCodes}
                onChange={(e) => setExpectedStatusCodes(e.target.value)}
                placeholder="200,201,204,301,302"
              />
              <span className="form-hint">返回这些状态码视为正常</span>
            </div>

            <div className="form-group">
              <label htmlFor="expectedKeyword">期望关键词（可选）</label>
              <input
                id="expectedKeyword"
                type="text"
                value={expectedKeyword}
                onChange={(e) => setExpectedKeyword(e.target.value)}
                placeholder="例如: success 或 OK"
              />
              <span className="form-hint">响应内容必须包含此关键词才视为正常</span>
            </div>

            <div className="form-group">
              <label htmlFor="forbiddenKeyword">禁止关键词（可选）</label>
              <input
                id="forbiddenKeyword"
                type="text"
                value={forbiddenKeyword}
                onChange={(e) => setForbiddenKeyword(e.target.value)}
                placeholder="例如: 离线 或 offline"
              />
              <span className="form-hint">响应内容包含此关键词则判定为故障（用于监控探针页面）</span>
            </div>
          </>
        )}

        {checkType === 'komari' && (
          <>
            <div className="form-group">
              <label htmlFor="komariOfflineThreshold">离线判断阈值（分钟）</label>
              <input
                id="komariOfflineThreshold"
                type="number"
                min="1"
                max="60"
                value={komariOfflineThreshold}
                onChange={(e) => setKomariOfflineThreshold(e.target.value)}
              />
              <span className="form-hint">服务器超过此时间未更新状态则判定为离线</span>
            </div>
            <div className="form-group">
              <label htmlFor="expectedKeyword">监控目标服务器（可选）</label>
              <input
                id="expectedKeyword"
                type="text"
                value={expectedKeyword}
                onChange={(e) => setExpectedKeyword(e.target.value)}
                placeholder="例如: FR①,HK-①,oracle"
              />
              <span className="form-hint">填写完整服务器名称，多个用逗号分隔；留空则监控所有服务器</span>
            </div>
            <div className="form-group">
              <span className="form-hint" style={{ display: 'block', marginTop: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <strong>URL 格式：</strong>填写 Komari 面板的 API 地址，例如：<br />
                <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>https://your-domain.com/api/client</code>
              </span>
            </div>
          </>
        )}

        {checkType === 'telegram' && (
          <>
            <div className="form-group">
              <label htmlFor="tgChatId">群组 ID</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="tgChatId"
                  type="text"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  placeholder="例如: -1001234567890"
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    if (!tgChatId.trim()) {
                      alert('请先输入群组 ID')
                      return
                    }
                    try {
                      const result = await testTelegramChat(tgChatId.trim())
                      alert(result.message)
                    } catch (err: any) {
                      alert('测试失败: ' + err.message)
                    }
                  }}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  📡 测试连接
                </button>
              </div>
              <span className="form-hint">Telegram 群组 ID（负数），可通过 @userinfobot 获取</span>
            </div>
            <div className="form-group">
              <label htmlFor="tgOfflineKeywords">离线关键词</label>
              <input
                id="tgOfflineKeywords"
                type="text"
                value={tgOfflineKeywords}
                onChange={(e) => setTgOfflineKeywords(e.target.value)}
                placeholder="离线,offline,down,掉线"
              />
              <span className="form-hint">消息包含这些关键词时判定为离线，多个用逗号分隔</span>
            </div>
            <div className="form-group">
              <label htmlFor="tgOnlineKeywords">上线关键词</label>
              <input
                id="tgOnlineKeywords"
                type="text"
                value={tgOnlineKeywords}
                onChange={(e) => setTgOnlineKeywords(e.target.value)}
                placeholder="上线,online,up,恢复"
              />
              <span className="form-hint">消息包含这些关键词时判定为上线，多个用逗号分隔</span>
            </div>
            <div className="form-group">
              <span className="form-hint" style={{ display: 'block', marginTop: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <strong>使用说明：</strong><br />
                1. 先在顶栏 🤖 按钮配置 Bot Token<br />
                2. 将 Bot 加入到监控的群组<br />
                3. 填写群组 ID 后可点击下方按钮测试连通性
              </span>
            </div>
          </>
        )}
      </div>

      <div className="form-section">
        <h4>Webhook通知（可选）</h4>

        <div className="form-group">
          <label htmlFor="webhook">Webhook URL</label>
          <input
            id="webhook"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/..."
          />
          <span className="form-hint">故障时发送通知到此地址</span>
        </div>

        <div className="form-group">
          <label htmlFor="contentType">Content-Type</label>
          <input
            id="contentType"
            type="text"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            placeholder="application/json"
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">用户名（Basic Auth，可选）</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用于Basic认证"
          />
        </div>

        <div className="form-group">
          <label htmlFor="headers">自定义Headers（JSON格式，可选）</label>
          <textarea
            id="headers"
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            placeholder='{"Authorization": "Bearer token"}'
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="body">自定义Body（JSON格式，可选）</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"event_type": "monitor_alert", "name": "{{monitor_name}}"}'
            rows={4}
          />
          <span className="form-hint">
            可用变量: {`{{monitor_name}}, {{monitor_url}}, {{status}}, {{error}}, {{timestamp}}`}
          </span>
        </div>
      </div>

      <div className="form-actions">
        {isEditMode && onCancel && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
          >
            取消
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (isEditMode ? '保存中...' : '添加中...') : (isEditMode ? '保存' : '添加监控')}
        </button>
      </div>
    </form>
  )
}
