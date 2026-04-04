import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { csrfProtectionMiddleware } from './common/middleware/csrf.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { writeStructuredLog } from './common/logging/structured-log.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.use((req, res, next) => {
    const request = req as typeof req & { startTime?: number; requestId?: string };
    request.startTime = Date.now();
    request.requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    res.setHeader('X-Request-Id', request.requestId);
    res.on('finish', () => {
      writeStructuredLog('log', 'http_request', 'HTTP', {
        requestId: request.requestId,
        method: req.method,
        path: req.originalUrl ?? req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - (request.startTime ?? Date.now()),
        ip: req.ip,
      });
    });
    next();
  });
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS 配置 - 支持多前端实例
  const allowedOrigins = getAllowOrigins();
  app.enableCors({
    origin: function (origin, callback) {
      // 允许没有 origin 的请求（如移动端、Postman）
      if (!origin) return callback(null, true);
      
      // 检查是否在允许的列表中
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  
  app.use(cookieParser());
  if (process.env.CSRF_ENABLED === 'true') {
    app.use(process.env.API_PREFIX, csrfProtectionMiddleware);
  }

  // Swagger 文档配置
  const config = new DocumentBuilder()
    .setTitle('预约系统 API')
    .setDescription('预约系统后端 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT;
  await app.listen(port);
  writeStructuredLog('log', 'application_started', 'Bootstrap', {
    port,
    apiDocsUrl: `http://localhost:${port}/api/docs`,
    healthUrl: `http://localhost:${port}/v1/health`,
    allowedOrigins,
  });
}

/**
 * 获取允许的 CORS 来源列表
 * @returns 允许的 URL 列表
 */
function getAllowOrigins(): string[] {
  // 优先使用 FRONTEND_URLS（多实例配置）
  if (process.env.FRONTEND_URLS) {
    return process.env.FRONTEND_URLS.split(',').map(url => url.trim());
  }
  
  // 兼容旧的 FRONTEND_URL 配置
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  if (process.env.FRONTEND_URL) {
    return [process.env.FRONTEND_URL, ...defaultOrigins];
  }
  
  return defaultOrigins;
}

bootstrap();
