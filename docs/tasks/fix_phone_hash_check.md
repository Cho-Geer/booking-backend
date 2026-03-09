# 修复手机号哈希检查问题

- **ID**: fix_phone_hash_check
- **执行时间戳**: 2026-03-09 13:20:00 (Approximate)
- **执行内容**: 修复手机号哈希使用 `bcrypt` 生成随机哈希导致无法根据手机号查找已存在用户的问题，从而引发数据库唯一约束冲突。
- **修改的代码路径**:
  - `booking-backend/src/modules/users/users.service.ts`
- **生成的代码路径**: 无
- **实现的内容**:
  1. 将 `hashPhoneNumber` 方法从使用 `bcrypt.hashSync` (随机盐) 改为使用 `crypto.createHash('sha256')` (确定性哈希)。
  2. 确保在注册时，`findUnique({ where: { phoneHash: ... } })` 能够正确找到已存在的用户，从而抛出 `PhoneNumberExistsException` 而不是尝试插入重复数据。
- **配置方式**: 无需额外配置，重新构建后端即可生效。
- **注意事项**: 
  - 旧数据（使用 bcrypt 哈希的）将无法通过手机号查找。建议在开发环境下重置数据库 (`npm run db:reset`)。
  - 生产环境需要进行数据迁移，重新计算所有用户的 phoneHash。
