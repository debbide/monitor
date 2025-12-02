# 开发与贡献指南

欢迎为项目做贡献！本文档包含开发环境设置、代码规范和 GitHub Actions 使用说明。

## 📋 目录

- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [GitHub Actions](#github-actions)
- [发布流程](#发布流程)
- [贡献指南](#贡献指南)

## 开发环境设置

### 前置要求

- Node.js 20+
- npm
- Docker (可选)

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev

# 或单独启动
npm run dev:client  # 前端 (Vite)
npm run dev:server  # 后端 (Express)
```

## 代码规范

项目使用 ESLint 和 Prettier 保持代码质量。

### 可用命令

```bash
# ESLint 检查
npm run lint

# 自动修复 ESLint 问题
npm run lint:fix

# 格式化代码
npm run format

# 检查代码格式
npm run format:check

# TypeScript 类型检查
npm run type-check
```

### 提交前检查

建议在提交代码前运行：

```bash
npm run lint:fix && npm run format && npm run type-check
```

### 构建

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## GitHub Actions

项目配置了自动化工作流，在代码推送时自动构建和检查。

### 工作流概览

#### 1. Docker 多平台构建 (`.github/workflows/docker-build.yml`)

**触发条件:**
- 推送到 `main` 或 `master` 分支
- 推送版本标签 (格式: `v*.*.*`)
- Pull Request
- 手动触发

**功能:**
- 自动构建多平台 Docker 镜像:
  - `linux/amd64` (x86_64)
  - `linux/arm64` (ARM64)
  - `linux/arm/v7` (ARM v7)
- 推送到 GitHub Container Registry (ghcr.io)
- 支持构建缓存优化

#### 2. 代码质量检查 (`.github/workflows/code-quality.yml`)

**触发条件:**
- 推送到 `main`、`master` 或 `develop` 分支
- Pull Request

**检查项:**
- ESLint 代码检查
- Prettier 格式检查
- TypeScript 类型检查
- 构建测试

### 使用预构建镜像

```bash
# 拉取最新版本
docker pull ghcr.io/debbide/monitor:latest

# 运行容器
docker run -d \
  --name uptime-monitor \
  -p 3000:3000 \
  -v ./data:/app/data \
  --restart unless-stopped \
  ghcr.io/debbide/monitor:latest
```

### 配置 Docker Hub（可选）

如果要推送到 Docker Hub，需要在 GitHub 仓库设置中添加 Secrets：

1. **创建 Docker Hub 访问令牌**
   - 登录 [Docker Hub](https://hub.docker.com/)
   - Account Settings → Security → New Access Token
   - 复制生成的令牌

2. **在 GitHub 添加 Secrets**
   - 仓库 Settings → Secrets and variables → Actions
   - 添加 `DOCKERHUB_USERNAME` (Docker Hub 用户名)
   - 添加 `DOCKERHUB_TOKEN` (访问令牌)

### 镜像标签策略

| 触发方式 | 生成的标签 |
|---------|----------|
| 推送到 main | `latest`, `main`, `main-{sha}` |
| 推送标签 v1.2.3 | `v1.2.3`, `v1.2`, `v1`, `latest` |
| Pull Request | `pr-{number}` |

## 发布流程

### 1. 更新版本号

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 次版本 (1.0.0 -> 1.1.0)
npm version minor

# 主版本 (1.0.0 -> 2.0.0)
npm version major
```

### 2. 推送标签

```bash
git push origin main --tags
```

### 3. 自动构建

GitHub Actions 会自动：
- 构建多平台镜像
- 推送到 GitHub Container Registry
- 生成版本标签

## 贡献指南

### 贡献流程

1. **Fork 项目**
2. **创建特性分支**
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **提交更改**
   ```bash
   git commit -m 'feat: Add some AmazingFeature'
   ```
4. **推送到分支**
   ```bash
   git push origin feature/AmazingFeature
   ```
5. **开启 Pull Request**

### 提交信息规范

使用语义化提交信息：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建/工具相关

示例：
```
feat: add webhook retry mechanism
fix: resolve monitor sorting issue
docs: update installation guide
```

### 代码审查标准

确保你的代码：
- ✅ 通过所有 lint 检查
- ✅ 通过类型检查
- ✅ 符合项目代码风格
- ✅ 包含必要的注释
- ✅ 功能正常工作

## 项目结构

```
uptime-monitor-docker/
├── src/                      # 前端源代码
│   ├── components/           # React 组件
│   ├── lib/                  # 工具函数和 API
│   ├── App.tsx               # 主应用
│   └── main.tsx              # 入口文件
├── server/                   # 后端源代码
│   ├── index.ts              # Express 服务器
│   ├── monitor.ts            # 监控逻辑
│   ├── db.ts                 # 数据库操作
│   └── types.ts              # 类型定义
├── dist/                     # 构建输出
├── data/                     # SQLite 数据库
├── .github/workflows/        # GitHub Actions 工作流
└── public/                   # 静态资源
```

## Docker 开发

### 本地构建镜像

```bash
# 构建镜像
docker build -t uptime-monitor:dev .

# 运行容器
docker run -d -p 3000:3000 -v ./data:/app/data uptime-monitor:dev
```

### 使用 Docker Compose

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

## 常见问题

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### TypeScript 类型错误

```bash
# 运行类型检查查看详细错误
npm run type-check
```

### Docker 构建失败

```bash
# 清理 Docker 缓存
docker system prune -a
```

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Express + TypeScript + Node.js 20
- **数据库**: SQLite (sql.js)
- **定时任务**: node-cron
- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

## 获取帮助

- 📝 提交 [Issue](https://github.com/debbide/monitor/issues)
- 💬 参与 [Discussions](https://github.com/debbide/monitor/discussions)
- 📧 查看现有的 Pull Requests

感谢你的贡献！🎉
