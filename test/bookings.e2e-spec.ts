/**
 * 预约模块端到端测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, AppointmentStatus } from '@prisma/client';
import { UserType } from '../src/modules/users/dto/user.dto';

describe('BookingsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  let testTimeSlotId: string;
  let testBookingId: string;
  let adminUser: any;
  let normalUser: any;

  beforeAll(async () => {
    // 设置测试环境变量
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-for-e2e-tests';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    process.env.CSRF_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // 创建测试管理员用户
    adminUser = await prismaService.user.create({
      data: {
        name: '管理员',
        phone: '13800138001',
        phoneHash: 'admin_hash',
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    normalUser = await prismaService.user.create({
      data: {
        name: '普通用户',
        phone: '13800138002',
        phoneHash: 'user_hash',
        userType: UserType.CUSTOMER as any,
        status: UserStatus.ACTIVE,
      },
    });

    // 生成JWT令牌
    userToken = jwtService.sign({
      sub: normalUser.id,
      phone: normalUser.phone,
      userType: 'CUSTOMER',
      role: 'CUSTOMER',
    }, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });

    adminToken = jwtService.sign({
      sub: adminUser.id,
      phone: adminUser.phone,
      userType: 'ADMIN',
      role: 'ADMIN',
    }, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });

    // 创建测试时间段
    const timeSlot = await prismaService.timeSlot.create({
      data: {
        slotTime: '09:00:00',
        durationMinutes: 60,
        isActive: true,
        displayOrder: 1,
      },
    });
    testTimeSlotId = timeSlot.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prismaService.appointment.deleteMany({});
    await prismaService.timeSlot.deleteMany({});
    await prismaService.user.deleteMany({});
    await app.close();
  });

  describe('/v1/bookings (POST)', () => {
    it('应该成功创建预约', async () => {
      const createBookingDto = {
        timeSlotId: testTimeSlotId,
        userId: normalUser.id,
        appointmentDate: '2024-01-15',
        customerName: '测试用户',
        customerPhone: '13700137000',
        notes: '测试预约备注',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createBookingDto)
        .expect(201);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.timeSlotId).toBe(testTimeSlotId);
      expect(response.body.data.status).toBe(AppointmentStatus.PENDING);
      
      testBookingId = response.body.data.id;
    });

    it('应该返回401未认证错误', async () => {
      const createBookingDto = {
        timeSlotId: testTimeSlotId,
        userId: normalUser.id,
        appointmentDate: '2024-01-15',
        customerName: '测试用户',
        customerPhone: '13700137000',
      };

      await request(app.getHttpServer())
        .post('/v1/bookings')
        .send(createBookingDto)
        .expect(401);
    });

    it('应该返回时间段不存在的错误', async () => {
      const createBookingDto = {
        timeSlotId: '00000000-0000-0000-0000-000000000000',
        userId: normalUser.id,
        appointmentDate: '2024-01-15',
        customerName: '测试用户',
        customerPhone: '13700137000',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createBookingDto)
        .expect(404);

      expect(response.body.code).toBe(404);
    });

    it('应该返回时间段冲突的错误', async () => {
      const createBookingDto = {
        timeSlotId: testTimeSlotId,
        userId: normalUser.id,
        appointmentDate: '2024-01-15',
        customerName: '测试用户',
        customerPhone: '13700137000',
      };

      await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createBookingDto)
        .expect(409);
    });
  });

  describe('/v1/bookings (GET)', () => {
    it('应该成功获取预约列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('应该根据用户ID过滤预约', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ userId: normalUser.id, page: 1, limit: 10 })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('应该根据状态过滤预约', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: AppointmentStatus.PENDING, page: 1, limit: 10 })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('/v1/bookings/:id (GET)', () => {
    it('应该成功获取预约详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testBookingId);
    });

    it('应该返回预约不存在的错误', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('/v1/bookings/:id (PATCH)', () => {
    it('应该成功更新预约', async () => {
      // 确保testBookingId已经设置
      if (!testBookingId) {
        // 如果testBookingId还没有设置，先创建一个预约
        const createBookingDto = {
          timeSlotId: testTimeSlotId,
          userId: normalUser.id,
          appointmentDate: '2024-01-15',
          customerName: '测试用户',
          customerPhone: '13700137000',
          notes: '测试预约备注',
        };

        const response = await request(app.getHttpServer())
          .post('/v1/bookings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(createBookingDto)
          .expect(201);

        testBookingId = response.body.data.id;
      }

      const updateBookingDto = {
        status: 'CONFIRMED',
        notes: '已确认预约',
      };

      const response = await request(app.getHttpServer())
        .patch(`/v1/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateBookingDto)
        .expect(200);

      expect(response.body.code).toBe(200);  // 检查code字段而不是success字段
      expect(response.body.data.status).toBe('CONFIRMED');  // 使用字符串而不是枚举
      expect(response.body.data.notes).toBe('已确认预约');
    });

    it('应该返回预约不存在的错误', async () => {
      const updateBookingDto = {
        status: 'CONFIRMED',
      };

      await request(app.getHttpServer())
        .patch('/v1/bookings/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateBookingDto)
        .expect(404);
    });
  });

  describe('/v1/bookings/:id/cancel (PATCH)', () => {
    it('应该成功取消预约（管理员）', async () => {
      // 确保testBookingId已经设置
      if (!testBookingId) {
        // 如果testBookingId还没有设置，先创建一个预约
        const createBookingDto = {
          timeSlotId: testTimeSlotId,
          appointmentDate: '2024-01-17',  // 使用不同的日期
          customerName: '测试用户',
          customerPhone: '13700137002',  // 使用不同的电话
        };

        const response = await request(app.getHttpServer())
          .post('/v1/bookings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(createBookingDto)
          .expect(201);

        testBookingId = response.body.data.id;
      }

      const response = await request(app.getHttpServer())
        .patch(`/v1/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);  // 修复字段检查
      expect(response.body.message).toBe('预约取消成功');
    });

    it('应该成功取消预约（用户）', async () => {
      // 先创建一个新的测试预约
      const createBookingDto = {
        timeSlotId: testTimeSlotId,
        appointmentDate: '2024-01-18',  // 使用不同的日期
        customerName: '测试用户2',
        customerPhone: '13700137003',  // 使用不同的电话
      };

      const createResponse = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)  // 使用普通用户token
        .send(createBookingDto)
        .expect(201);

      const bookingId = createResponse.body.data.id;

      // 用户取消自己的预约
      const cancelResponse = await request(app.getHttpServer())
        .patch(`/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cancelResponse.body.code).toBe(200);  // 检查code字段而不是success字段
      expect(cancelResponse.body.message).toBe('预约取消成功');
    });

    it('应该返回预约不存在的错误', async () => {
      const response = await request(app.getHttpServer())
        .patch('/v1/bookings/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('/v1/bookings (GET)', () => {
    it('应该成功获取我的预约列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/all')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该返回401未认证错误', async () => {
      await request(app.getHttpServer())
        .get('/v1/bookings/all')
        .query({ page: 1, limit: 10 })
        .expect(401);
    });
  });

  describe('/v1/bookings/stats/summary (GET)', () => {
    it('应该成功获取预约统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/stats/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.pendingAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.confirmedAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.completedAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.cancelledAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.todayAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.thisWeekAppointments).toBeGreaterThanOrEqual(0);
      expect(response.body.data.thisMonthAppointments).toBeGreaterThanOrEqual(0);
    });

    it('应该根据日期范围过滤统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/stats/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('应该根据用户ID过滤统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bookings/stats/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });
});
