# 网站监控系统 (Docker 版)

[![Docker Build](https://github.com/debbide/monitor/actions/workflows/docker-build.yml/badge.svg)](https://github.com/debbide/monitor/actions/workflows/docker-build.yml)
[![Code Quality](https://github.com/debbide/monitor/actions/workflows/code-quality.yml/badge.svg)](https://github.com/debbide/monitor/actions/workflows/code-quality.yml)

基于 Docker 部署的网站监控系统，支持 HTTP/TCP/Komari 面板监控。

## ✨ 特性

- 🌐 **HTTP/HTTPS 检测** - 支持自定义请求方法和关键词检测
- 🔌 **TCP 连通性检测** - 端口可用性监控
- 📊 **Komari 面板监控** - 服务器状态监控
- 🔔 **Webhook 通知** - 自定义 Webhook 通知（支持 Discord、Slack 等）
- 🔍 **关键词检测** - 检测页面是否包含/不包含特定关键词
- ⏰ **定时检测** - 每 5 分钟自动检测

### 使用预构建镜像（推荐）

#### Docker Compose

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  uptime-monitor:
    image: ghcr.io/debbide/monitor:latest
    container_name: uptime-monitor
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/app/data
```

然后运行:

```bash
docker-compose up -d
```

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/debbide/monitor.git
cd monitor

# 使用 Docker Compose 构建并启动
docker-compose up -d

# 或使用 Docker 构建
docker build -t uptime-monitor .
docker run -d -p 3000:3000 -v ./data:/app/data uptime-monitor
```

## 📖 使用方法

### 访问界面

打开浏览器访问 `http://localhost:3000`

**默认密码**: `admin123`

⚠️ **首次使用请立即修改密码！**

### 添加监控

1. 点击"添加监控"按钮
2. 填写监控信息：
   - 名称：监控项目名称
   - URL：要监控的网址或服务器地址
   - 检测类型：HTTP、TCP 或 Komari
   - 检测间隔：检测频率（分钟）
   - Webhook URL：（可选）通知地址

### 配置 Webhook 通知

支持常见的 Webhook 服务：

#### Discord

```
https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

#### Slack

```
https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## 🛠️ 配置选项

### 环境变量

| 变量 | 默认值 | 说明 |
|-----|--------|------|
| `PORT` | 3000 | 服务端口 |
| `DATA_DIR` | /app/data | 数据目录 |
| `NODE_ENV` | production | 运行环境 |

### 数据持久化

数据存储在 `./data` 目录中（SQLite 数据库），使用 Docker 卷挂载确保数据不会丢失。

## 🏗️ 多平台支持

本项目使用 GitHub Actions 自动构建多平台 Docker 镜像：

- **linux/amd64** - x86_64 架构（普通 PC、服务器）
- **linux/arm64** - ARM64 架构（树莓派 4、Apple M1/M2 等）

Docker 会自动选择适合你系统的镜像版本。

## 🔧 开发

查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解如何参与开发。

### 开发环境要求

- Node.js 20+
- npm
- Docker (可选)

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行代码检查
npm run lint

# 格式化代码
npm run format

# 类型检查
npm run type-check
```

## 📦 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Express + TypeScript + Node.js 20
- **数据库**: SQLite (sql.js)
- **定时任务**: node-cron
- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，请提交 Issue。

