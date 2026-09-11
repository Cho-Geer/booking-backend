/**
 * Prisma CLI 统一配置。
 * 规则:NODE_ENV ∈ {development, test, production}(缺省 development)
 *      → 加载 <仓库根>/.env.<NODE_ENV>;文件缺失仅告警不阻断
 *      (CI 与迁移容器没有 env 文件,变量由 workflow env / compose env_file 注入)。
 *
 * 重要:本文件一旦被 CLI 检测到,CLI 将不再自动加载任何 .env 文件
 *      (CLI 会打印 "Prisma config detected, skipping environment variable loading.")。
 * dotenv 默认 override:false → 进程内已有变量(CI/容器注入)永远优先。
 *
 * 路径基准:__dirname(本文件位于仓库根;项目为 CommonJS,jiti 以 CJS 执行,
 * __dirname 可用;勿用 import.meta.url —— module:commonjs 下过不了 tsc)。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

const ALLOWED_ENVS = ['development', 'test', 'production'] as const;
const environment =
  (process.env.NODE_ENV as (typeof ALLOWED_ENVS)[number] | undefined) ?? 'development';

if (!(ALLOWED_ENVS as readonly string[]).includes(environment)) {
  throw new Error(
    `[prisma.config] 不支持的 NODE_ENV="${process.env.NODE_ENV}",允许值: ${ALLOWED_ENVS.join(' / ')}`,
  );
}

const envPath = path.resolve(__dirname, `.env.${environment}`);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(
    `[prisma.config] 环境文件不存在: ${envPath} (NODE_ENV=${environment}),仅使用进程内已有环境变量`,
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});
