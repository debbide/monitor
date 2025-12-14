export interface Monitor {
  id: string
  name: string
  url: string
  check_interval: number
  check_interval_max: number | null  // HTTP模式随机间隔最大值
  check_type: 'http' | 'tcp' | 'komari' | 'komari_webhook' | 'telegram'
  check_method: 'GET' | 'HEAD' | 'POST'
  check_timeout: number
  expected_status_codes: string
  expected_keyword: string | null
  forbidden_keyword: string | null
  komari_offline_threshold: number
  // Telegram 相关字段
  tg_chat_id: string | null
  tg_server_name: string | null  // 用于消息匹配的服务器名称
  tg_offline_keywords: string | null
  tg_online_keywords: string | null
  tg_notify_chat_id: string | null  // 用于 Komari 监控的 TG 群组通知
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
  id?: number
  monitor_id: string
  status: 'up' | 'down'
  response_time: number
  status_code: number
  error_message: string
  checked_at: string
}

export interface KomariServer {
  uuid: string
  name: string
  region: string
  updated_at: string
}

export interface KomariApiResponse {
  status: string
  message: string
  data: KomariServer[]
}
