import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { csrfProtectionMiddleware } from './common/middleware/csrf.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

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
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
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
