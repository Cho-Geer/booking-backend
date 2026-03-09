# 登出功能改进建议

## 本次回答ID
logout-improvement-20260310

## 执行时间戳
2026-03-10

## 执行内容
分析当前登出功能实现，提供改进建议，包括刷新令牌黑名单、Redis token吊销和登出失效机制。

## 修改的代码路径
- `/home/zhaoge/temp/booking-backend/src/modules/auth/auth.service.ts`
- `/home/zhaoge/temp/booking-backend/src/modules/auth/auth.controller.ts`

## 实现的内容
### 1. 刷新令牌黑名单实现

#### 后端修改建议

1. **修改 AuthService 的 logout 方法**:

```typescript
/**
 * 用户登出
 * @param userId 用户ID
 * @param refreshToken 刷新令牌
 * @returns 登出结果
 */
async logout(userId: string, refreshToken: string): Promise<ApiResponseDto<void>> {
  try {
    // 将刷新令牌加入黑名单
    await this.addRefreshTokenToBlacklist(refreshToken);
    this.logger.log(`用户登出: ${userId}`);
    
    return ApiResponseDto.success(null, '登出成功');
  } catch (error) {
    this.logger.error(`用户登出失败: ${error.message}`, error.stack);
    throw new DatabaseException('登出失败');
  }
}

/**
 * 将刷新令牌加入黑名单
 * @param refreshToken 刷新令牌
 */
private async addRefreshTokenToBlacklist(refreshToken: string): Promise<void> {
  try {
    // 验证刷新令牌并获取过期时间
    const payload = this.jwtService.verify(refreshToken, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });
    
    // 计算令牌剩余有效期（秒）
    const expiresAt = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAt - now;
    
    if (ttl > 0) {
      // 使用Redis存储黑名单，键为令牌哈希，值为1，过期时间为令牌剩余有效期
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
    }
  } catch (error) {
    // 令牌无效时忽略错误，不影响登出流程
    this.logger.warn(`无效的刷新令牌: ${error.message}`);
  }
}
```

2. **修改 AuthController 的 logout 方法**:

```typescript
async logout(
  @CurrentUser() currentUser: any,
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
): Promise<ApiResponseDto<void>> {
  // 从Cookie获取refresh_token
  const refreshToken = request.cookies?.['refresh_token'];
  await this.authService.logout(currentUser.id, refreshToken);
  // 清除Cookie
  response.clearCookie('access_token');
  response.clearCookie('refresh_token');
  response.clearCookie('csrf_token');
  return ApiResponseDto.success(null, '登出成功');
}
```

3. **修改 refreshToken 方法，检查黑名单**:

```typescript
async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<LoginResponseDto> {
  try {
    // 检查刷新令牌是否在黑名单中
    const tokenHash = crypto.createHash('sha256').update(refreshTokenDto.refreshToken).digest('hex');
    const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
    
    if (isBlacklisted) {
      throw new AuthenticationException('刷新令牌已被吊销');
    }
    
    // 验证刷新令牌
    const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
      secret: this.configService.get('JWT_SECRET'),
    });
    
    // 后续代码保持不变...
  }
}
```

### 2. Redis Token 吊销实现

#### 配置依赖
确保项目已安装并配置了 Redis 缓存：

```bash
# 安装依赖
npm install cache-manager redis-store
```

#### 配置 Redis 连接
在 `app.module.ts` 中配置 Redis 缓存：

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      ttl: 60 * 60 * 24, // 默认缓存时间
    }),
    // 其他模块...
  ],
  // 其他配置...
})
export class AppModule {}
```

### 3. 登出失效机制完善

#### 前端改进建议

在 `authService.ts` 中，确保登出后清除本地存储的用户信息：

```typescript
async logout() {
  try {
    const response = await api.post('/auth/logout');
    // 清除本地存储的用户信息
    localStorage.removeItem('user');
    // 清除其他相关存储
    return response.data;
  } catch (error) {
    // 即使后端失败，也清除本地状态
    localStorage.removeItem('user');
    throw error;
  }
}
```

## 配置方式

1. **环境变量配置**:

```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800
```

2. **Redis 服务**:
确保 Redis 服务已启动并运行在配置的主机和端口上。

## 注意事项

1. **安全性**:
   - 令牌黑名单使用 SHA256 哈希存储，避免直接存储令牌
   - 设置与令牌过期时间相同的黑名单过期时间，避免内存泄漏

2. **性能**:
   - Redis 操作是异步的，不会阻塞主流程
   - 黑名单检查在令牌验证之前进行，减少不必要的计算

3. **可靠性**:
   - 即使 Redis 服务不可用，登出流程仍能正常完成（只是令牌不会被加入黑名单）
   - 令牌过期机制作为最后一道防线，确保即使黑名单失效，令牌也会最终过期

4. **兼容性**:
   - 修改后的代码保持了与现有接口的兼容性，前端无需修改调用方式
   - 支持从 Cookie 中获取刷新令牌，与现有实现一致

## 总结

通过实现刷新令牌黑名单、使用 Redis 进行 token 吊销和完善登出失效机制，可以显著提高系统的安全性。这些改进确保了：

1. 登出后，刷新令牌立即失效，无法用于获取新的访问令牌
2. 即使攻击者获取了刷新令牌，也无法在用户登出后使用
3. 系统能够有效管理令牌生命周期，避免令牌滥用

这些改进不会影响项目的展示，但会使认证系统更加完整和安全。