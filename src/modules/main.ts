/**
 * 应用入口文件
 * 配置和启动NestJS应用
 * @author Booking System
 * @since 2024
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';

/**
 * 启动应用
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局前缀
  // app.setGlobalPrefix('api');

  // 全局管道
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

  // 全局异常过滤器
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
  );

  // CORS配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Swagger文档配置
  const config = new DocumentBuilder()
    .setTitle('预约系统API')
    .setDescription('预约系统后端API文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // 获取端口
  const port = process.env.PORT || 3000;

  // 启动服务
  await app.listen(port);
  
  console.log(`
    🚀 应用启动成功！
    📱 应用地址: http://localhost:${port}
    📚 API文档: http://localhost:${port}/api/docs
    🔗 GraphQL: http://localhost:${port}/graphql
  `);
}

// 启动应用
bootstrap();