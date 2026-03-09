# Commit1 后端Cookie认证改造执行说明

- **ID**: COMMIT1-COOKIE-AUTH-20260309-01
- **执行时间戳**: 2026-03-09 15:40:00
- **执行内容**: 按既定改造顺序完成 Commit1，仅落地后端侧 Cookie 能力并保持 Bearer 兼容。
- **修改的代码路径**:
  - `booking-backend/src/modules/auth/auth.controller.ts`
  - `booking-backend/src/common/guards/jwt-auth.guard.ts`
  - `booking-backend/src/main.ts`
  - `booking-backend/package.json`
- **生成的代码路径**:
  - `booking-backend/docs/tasks/Commit1-后端Cookie认证改造执行说明.md`
- **实现的内容**:
  1. 登录、注册、刷新接口增加 Cookie 下发能力，写入 `access_token` 与 `refresh_token`。
  2. Cookie 策略使用 `httpOnly`，并按环境切换 `secure` 与 `sameSite`。
  3. JWT 守卫改为优先从 Cookie 提取 token，保留 Authorization Bearer 回退逻辑以兼容旧链路。
  4. 后端入口启用 `cookie-parser`，支持读取请求 Cookie。
  5. 新增 Cookie 过期时间解析逻辑，兼容秒值与 `s/m/h/d` 时长格式。
- **配置方式**:
  - 环境变量：`JWT_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN`、`NODE_ENV`
  - 生产环境：`secure=true` 且 `sameSite=none`
  - 非生产环境：`secure=false` 且 `sameSite=lax`
- **注意事项**:
  - Commit1 仍保留响应体 token 字段，便于前端后续提交分阶段迁移。
  - 生产环境跨站部署需同时满足 HTTPS 与 CORS credentials 配置。
