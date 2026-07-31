# CRM 预约平台后端

本项目是面向 CRM 风格预约平台的 NestJS 后端。

本服务提供认证、预约管理、用户与服务管理、时段管理、基于 Redis 的缓存、Swagger 文档,以及基于 WebSocket 的实时通知。

详细的接口契约请参见: [docs/api-contract.md](./docs/api-contract.md)

## 技术栈

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- Swagger
- Jest

## 当前模块

应用在 [src/app.module.ts](./src/app.module.ts) 中装配了以下模块。

业务模块:

- `auth`
- `users`
- `bookings`
- `services`
- `time-slots`
- `email`
- `retention`

共享基础设施:

- `common/database`
- `common/prisma`
- `common/file-upload`
- `common/websocket`

## API 概览

本地后端运行于:

```text
http://localhost:3001
```

应用将全局 API 前缀设置为 `/v1`,因此应用接口都暴露在以下路径下:

```text
http://localhost:3001/v1/...
```

Swagger UI 地址:

```text
http://localhost:3001/api/docs
```

### 本分支的主要契约

这些是评审者与前端工作应视为当前契约的主要端点:

- `POST /v1/auth/login`
- `POST /v1/bookings`
- `GET /v1/bookings/all`
- `GET /v1/bookings/by-date?date=YYYY-MM-DD`
- `GET /v1/bookings/:id`
- `PATCH /v1/bookings/:id`
- `PATCH /v1/bookings/:id/cancel`
- `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`
- `GET /v1/services`
- `GET /v1/services/all`

### 重要的预约规则

- `/bookings/all` 在本分支中是用户端与管理端共用的列表端点。
- 对于非管理员用户,即便传入的查询范围更广,后端也会把 `/bookings/all` 限定为当前登录用户。
- 本分支不采用 `/bookings/me`,不应将其视为契约的一部分。

### 端点说明

#### 认证

- `POST /v1/auth/login`
  手机号加验证码登录。
  返回登录结果,并设置认证 Cookie。

#### 预约

- `POST /v1/bookings`
  为已认证用户创建预约。
  若未传 `userId`,后端会用当前用户填充。

- `GET /v1/bookings/all`
  用户/管理员共用的列表端点。
  接受预约查询筛选条件与分页参数。
  非管理员用户在服务端被限制为自己的记录。

- `GET /v1/bookings/by-date?date=YYYY-MM-DD`
  返回某一天的预约。
  用于按日期的可用性查询与日历样式视图。

- `GET /v1/bookings/:id`
  按 id 返回单条预约。
  非管理员用户只能访问自己的预约。

- `PATCH /v1/bookings/:id`
  更新一条预约。
  非管理员用户只能更新自己的预约。

- `PATCH /v1/bookings/:id/cancel`
  本分支中兼容前端的取消端点。

#### 时段

- `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`
  返回某一天的时段可用情况。
  `date` 必须以 `YYYY-MM-DD` 格式传入。

#### 服务

- `GET /v1/services`
  预约流程使用的共享服务列表端点。

- `GET /v1/services/all`
  面向管理员、支持分页/筛选的服务列表端点。

## 运行期功能

- 基于 JWT 的 access / refresh token 认证
- 认证 Cookie 与 CSRF token Cookie 支持
- 基于角色与权限的路由守卫
- 预约 CRUD 与预约统计
- 面向管理员的服务管理
- 时段可用性查询
- 用户管理与个人资料 API
- Redis 缓存配置
- WebSocket 网关支持
- 使用 Handlebars 模板的邮件模块
- 定时调度的留存清理任务
- 文件上传模块

## 数据模型

当前 Prisma schema 包含以下主要模型:

- `User`
- `UserSession`
- `Appointment`
- `AppointmentHistory`
- `TimeSlot`
- `Service`
- `ServiceCategory`
- `Notification`
- `SystemSetting`
- `BlockedTimeSlot`
- `ActivityLog`
- `SystemLog`
- `AppointmentStatistic`

完整 schema 请参见 [prisma/schema.prisma](./prisma/schema.prisma)。

## 环境

仓库中提供了环境变量示例文件:

- `.env.example`
- `.env.production.example`

本地开发时,请将 `.env.example` 复制为 `.env.development`,并根据本机环境调整值。

请勿提交包含真实密钥的环境文件。

主要变量包括:

- `PORT`
- `API_PREFIX`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL` 或 `FRONTEND_URLS`
- `CSRF_ENABLED`

环境说明:

- 本分支预期本地后端端口为 `PORT=3001`。
- 由于运行时代码挂载 CSRF 中间件时仍会引用 `process.env.API_PREFIX`,示例中保留 `API_PREFIX=/v1`。
- 本分支的 API 契约为 `/v1`。
- `FRONTEND_URL` 是旧版的单源 CORS 设置。
- `FRONTEND_URLS` 是允许多个前端来源时的多源 CORS 白名单。

## 本地开发

安装依赖:

```bash
npm install
```

启动开发服务器:

```bash
npm run start:dev
```

本地前端默认预期为 `http://localhost:3000`,后端 API 运行于 `http://localhost:3001`。

本地期望地址:

```text
http://localhost:3001
```

生产构建:

```bash
npm run build
```

启动构建产物:

```bash
npm run start:prod
```

## 数据库命令

常用 Prisma 脚本:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm run db:init
```

## 测试

运行单元测试:

```bash
npm run test
```

运行覆盖率:

```bash
npm run test:cov
```

运行 e2e 测试:

```bash
npm run test:e2e
```

## Docker

仓库自带的 [docker-compose.yml](./docker-compose.yml) 仅启动基础设施服务:

- PostgreSQL
- Redis

使用以下命令启动它们:

```bash
docker compose up -d
```

NestJS API 本身不在此命令中启动,需要通过上面的 npm 脚本单独启动。

## 测试的 Docker 环境设置

E2E 测试使用 TestContainers 启动 PostgreSQL 容器。要在本地运行这些测试,你需要可用的 Docker 环境。

### 1. 安装 Docker

#### Windows
1. 下载并安装 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. 安装过程中启用 WSL 2 后端(推荐)或 Hyper-V 后端
3. 安装完成后重启电脑
4. 从开始菜单启动 Docker Desktop

#### macOS
1. 下载并安装 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. 将 Docker.app 移动到 Applications 文件夹
3. 从 Applications 启动 Docker Desktop

#### Linux(Ubuntu/Debian)
```bash
# 卸载旧版本
sudo apt-get remove docker docker-engine docker.io containerd runc

# 安装依赖
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 设置稳定版仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. 校验 Docker 安装

```bash
docker --version
docker info
docker run hello-world
```

### 3. 配置用户权限(Linux/macOS)

将当前用户加入 `docker` 组,以避免每次使用 `sudo`:

```bash
sudo usermod -aG docker $USER
# 注销并重新登录以使设置生效
```

### 4. 配置 TestContainers 环境

TestContainers 需要能够检测到 Docker。请设置环境变量:

#### Windows PowerShell
```powershell
$env:DOCKER_HOST = "npipe:////./pipe/docker_engine"
```

#### Linux/macOS Bash
```bash
export DOCKER_HOST=unix:///var/run/docker.sock
# 加入 ~/.bashrc 或 ~/.zshrc 以持久化
echo 'export DOCKER_HOST=unix:///var/run/docker.sock' >> ~/.bashrc
```

### 5. 验证 TestContainers 配置

运行一个简单测试以验证 Docker 集成:

```bash
# 在 booking-backend 目录下
npm run test:e2e -- --testNamePattern="setup" --verbose
```

也可以使用校验脚本来检查 Docker 环境:

```powershell
# 运行校验脚本(Windows)
./scripts/check-docker-env.ps1

# Linux/macOS 上可以编写类似的 bash 脚本
```

### 6. 常见问题排查

#### "Could not find a working container runtime strategy"
- 确认 Docker Desktop 正在运行(Windows/macOS)
- 确认 Docker 服务已启动(Linux: `sudo systemctl status docker`)
- 确认 `DOCKER_HOST` 环境变量设置正确
- 检查用户权限(Linux: 用户应在 `docker` 组中)

#### "Permission denied while trying to connect to the Docker daemon socket"
```bash
# Linux/macOS
sudo usermod -aG docker $USER
# 注销并重新登录
```

#### TestContainers 超时
- 为加速下载,请配置 Docker 镜像加速器(中国用户)
- 必要时增大测试配置中的超时

### 7. 替代方案:跳过 Docker 测试

如果没有 Docker,可以跳过 E2E 测试:

```bash
npm run test  # 仅运行单元测试
```

在 CI/CD 环境中,基于 Docker 的测试会自动运行。

---

## 🇯🇵 日本語 | 🇬🇧 English

- [日本語版](./README.md)
- [English version](./README.en.md)