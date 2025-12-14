const API_URL = ''

export interface Monitor {
  id: string
  name: string
  url: string
  check_interval: number
  check_interval_max: number | null
  check_type: 'http' | 'tcp' | 'komari' | 'telegram'
  check_method: 'GET' | 'HEAD' | 'POST'
  check_timeout: number
  expected_status_codes: string
  expected_keyword: string | null
  forbidden_keyword: string | null
  komari_offline_threshold: number
  tg_chat_id: string | null
  tg_server_name: string | null
  tg_offline_keywords: string | null
  tg_online_keywords: string | null
  tg_notify_chat_id: string | null
  webhook_url: string | null
  webhook_content_type: string
  webhook_headers: string | null
  webhook_body: string | null
  webhook_username: string | null
  is_active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MonitorCheck {
  id: number
  monitor_id: string
  status: 'up' | 'down'
  response_time: number
  status_code: number
  error_message: string
  checked_at: string
}

export interface Incident {
  id: number
  monitor_id: string
  started_at: string
  resolved_at: string | null
  duration_seconds: number
  notified: number
}

export interface KomariServer {
  name: string
  region: string
  updated_at: string
  minutes_ago: number
  is_online: boolean
}

export interface MonitorStats {
  total_checks: number
  uptime_percentage: number
  average_response_time: number
}

async function fetchAPI(path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

export async function getMonitors(): Promise<Monitor[]> {
  return fetchAPI('/api/monitors')
}

export async function createMonitor(monitor: {
  name: string
  url?: string
  check_interval?: number
  check_interval_max?: number | null
  check_type?: 'http' | 'tcp' | 'komari' | 'komari_webhook' | 'telegram'
  check_method?: 'GET' | 'HEAD' | 'POST'
  check_timeout?: number
  expected_status_codes?: string
  expected_keyword?: string
  forbidden_keyword?: string
  komari_offline_threshold?: number
  tg_chat_id?: string
  tg_server_name?: string
  tg_offline_keywords?: string
  tg_online_keywords?: string
  tg_notify_chat_id?: string
  webhook_url?: string
  webhook_content_type?: string
  webhook_headers?: Record<string, string>
  webhook_body?: Record<string, any>
  webhook_username?: string
}): Promise<Monitor> {
  return fetchAPI('/api/monitors', {
    method: 'POST',
    body: JSON.stringify(monitor),
  })
}

export async function deleteMonitor(id: string): Promise<void> {
  await fetchAPI(`/api/monitors/${id}`, {
    method: 'DELETE',
  })
}

export async function updateMonitor(id: string, monitor: {
  name: string
  url?: string
  check_interval?: number
  check_interval_max?: number | null
  check_type?: 'http' | 'tcp' | 'komari' | 'komari_webhook' | 'telegram'
  check_method?: 'GET' | 'HEAD' | 'POST'
  check_timeout?: number
  expected_status_codes?: string
  expected_keyword?: string
  forbidden_keyword?: string
  komari_offline_threshold?: number
  tg_chat_id?: string
  tg_server_name?: string
  tg_offline_keywords?: string
  tg_online_keywords?: string
  tg_notify_chat_id?: string
  webhook_url?: string
  webhook_content_type?: string
  webhook_headers?: Record<string, string>
  webhook_body?: Record<string, any>
  webhook_username?: string
  is_active?: number
}): Promise<Monitor> {
  return fetchAPI(`/api/monitors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(monitor),
  })
}

export async function getChecks(monitorId: string): Promise<MonitorCheck[]> {
  return fetchAPI(`/api/checks?monitor_id=${monitorId}`)
}

export async function getStats(monitorId: string): Promise<MonitorStats> {
  return fetchAPI(`/api/stats?monitor_id=${monitorId}`)
}

export async function testWebhook(monitorId: string): Promise<{ success: boolean; message: string }> {
  return fetchAPI('/api/test-webhook', {
    method: 'POST',
    body: JSON.stringify({ monitor_id: monitorId }),
  })
}

export async function checkNow(monitorId: string): Promise<{ success: boolean; check: MonitorCheck }> {
  return fetchAPI('/api/check-now', {
    method: 'POST',
    body: JSON.stringify({ monitor_id: monitorId }),
  })
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const result = await fetchAPI('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    return result.valid === true
  } catch (error) {
    return false
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await fetchAPI('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
}

export async function getKomariStatus(monitorId: string): Promise<{ servers: KomariServer[] }> {
  return fetchAPI(`/api/komari-status/${monitorId}`)
}

export async function reorderMonitors(orders: { id: string; sort_order: number }[]): Promise<void> {
  await fetchAPI('/api/monitors/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orders }),
  })
}

// Telegram 设置
export interface TelegramStatus {
  enabled: boolean
  connected: boolean
  token: string
}

export async function getTelegramSettings(): Promise<TelegramStatus> {
  return fetchAPI('/api/settings/telegram')
}

export async function setTelegramToken(token: string): Promise<{ success: boolean; message: string }> {
  return fetchAPI('/api/settings/telegram', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function testTelegramChat(chatId: string): Promise<{ success: boolean; message: string }> {
  return fetchAPI('/api/settings/telegram/test-chat', {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId }),
  })
}

// Komari 通知配置
export interface KomariNotifySettings {
  enabled: boolean
  chat_id: string
  webhook_url: string
  webhook_body: string
}

export async function getKomariNotifySettings(): Promise<KomariNotifySettings> {
  return fetchAPI('/api/settings/komari-notify')
}

export async function saveKomariNotifySettings(settings: Partial<KomariNotifySettings>): Promise<{ success: boolean; message: string }> {
  return fetchAPI('/api/settings/komari-notify', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}
