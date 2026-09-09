# booking-backend 文档索引

## 关于本文档

- **目的**: 在一页内说明 `docs/` 下各文档的定位与推荐阅读顺序。

## 画面画廊

### 邮件通知模板

预约确认、更新、取消时发送的 HTML 邮件的渲染示例。

**预约确认（Booking Confirmed）**

![预约确认邮件的渲染示例](docs/images/email-template-confirmation.png)

**预约更新（Booking Updated）**

![预约更新邮件的渲染示例](docs/images/email-template-updated.png)

**预约取消（Booking Cancelled）**

![预约取消邮件的渲染示例](docs/images/email-template-cancellation.png)

## 推荐阅读顺序

| 顺序 | 文档 | 一句话说明 |
|---|---|---|
| 1 | [api-contract.md](./docs/api-contract.md) | 接口级 API 契约。前后端集成的唯一事实来源（不含服务端到服务端的 IF-01/IF-02）。 |
| 2 | [sequence-diagrams/01–05](./docs/sequence-diagrams/) | 用 5 张时序图覆盖全部 43 个业务场景（场景矩阵 + 代码依据）。 |
| 3 | [scenario-deep-dive.md](./docs/scenario-deep-dive.md) | 对冲突与授权类的 3 个代表性场景（P2034 重试 / P2034 耗尽·P2002 / 非所有者取消 404）连同处理流程、代码依据与验证命令进行深度剖析。 |
| 4 | [redis-usage-and-schema.md](./docs/redis-usage-and-schema.md) | Redis 的连接方式、键 schema 与分用途细节（令牌黑名单 / 短信验证码 / 健康检查）。 |
| 5 | [manual-retry-procedure.md](./docs/manual-retry-procedure.md) | Salesforce 集成（IF-02 命令系 / IF-01 投影系）失败或滞留时的手动重试运维手册。 |

## 时序图构成

全部 43 个业务场景由 5 张时序图覆盖。每张图由「业务场景一览 + 分场景解说 + Participant evidence（代码依据）」构成。

| 图 | 覆盖流程 | 场景数 |
|---|---|---|
| [01](./docs/sequence-diagrams/01-authentication-login-register.md) | 认证（send-code / login / register → JWT 签发） | 7 |
| [02](./docs/sequence-diagrams/02-service-timeslot-discovery.md) | 服务与时段发现（3 个 GET 流程与状态合成） | 6 |
| [03](./docs/sequence-diagrams/03-booking-creation.md) | 预约创建（POST /bookings、Serializable 事务） | 10 |
| [04](./docs/sequence-diagrams/04-booking-cancellation.md) | 预约取消（PATCH /bookings/:id/cancel） | 8 |
| [05](./docs/sequence-diagrams/05-jwt-guard-token-refresh.md) | JWT 守卫 + axios 401 自动刷新 | 12 |
| **合计** | — | **43** |

## 关联仓库

- 前端: [booking-frontend](https://github.com/Cho-Geer/booking-frontend)（React + Redux + axios）

## 文档新增与更新规约

- `.gitignore` 默认忽略 `docs/`，需要纳入版本管理的文档必须加入 `!/docs/...` 白名单。
- file:line 锚点为特定 commit 时点的 `grep -n` 实测值，源码变更后需重新实测更新（不得沿用旧文档的行号）。
- 源码中的错误消息字符串不翻译，按中文原文引用，必要时以（※代码内消息原文）注记。

---

🌍 [日本語](./README.md) | [English](./README.en.md) | 中文
