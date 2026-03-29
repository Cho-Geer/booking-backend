/**
 * 主应用模块
 * 配置所有功能模块和全局设置
 * @author Booking System
 * @since 2024
 */

// import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
// import { APP_INTERCEPTOR } from '@nestjs/core';
// import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
// import { PrismaModule } from './prisma/prisma.module';
// import { UsersModule } from './users/users.module';
// import { AuthModule } from './auth/auth.module';
// import { BookingsModule } from './bookings/bookings.module';
// import { TimeSlotsModule } from './time-slots/time-slots.module';
// import { SystemModule } from './system/system.module';

// @Module({
//   imports: [
//     // 配置模块
//     ConfigModule.forRoot({
//       isGlobal: true,
//       envFilePath: ['.env.development','.env.production'],
//     }),
    
//     // 数据库模块
//     PrismaModule,
    
//     // 业务模块
//     UsersModule,
//     AuthModule,
//     BookingsModule,
//     TimeSlotsModule,
//     SystemModule,
//   ],
//   providers: [
//     // 全局响应转换拦截器
//     {
//       provide: APP_INTERCEPTOR,
//       useClass: TransformInterceptor,
//     },
//   ],
// })
// export class AppModule {}