# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建前端和后端
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --omit=dev

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV NODE_OPTIONS="--no-warnings"

EXPOSE 3000

# 启动服务
CMD ["node", "dist/server/index.js"]
