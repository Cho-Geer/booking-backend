/**
 * 用户模块端到端测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 获取普通用户认证token
    await request(app.getHttpServer())
      .post('/auth/send-code')
      .send({ phone: '13800138000' });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ phone: '13800138000', code: '123456' });

    authToken = loginResponse.body.token;

    // 获取管理员认证token
    await request(app.getHttpServer())
      .post('/auth/send-code')
      .send({ phone: '13900139000' });

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ phone: '13900139000', code: '123456' });

    adminToken = adminLoginResponse.body.token;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/users (POST)', () => {
    it('应该成功创建用户', () => {
      const createUserDto = {
        name: '新用户',
        phoneNumber: '13700137000',
        role: 'USER',
        status: 'ACTIVE',
        remarks: '测试创建用户',
      };

      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('用户创建成功');
          expect(res.body.data).toBeDefined();
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.name).toBe('新用户');
        });
    });

    it('应该失败当手机号已存在', async () => {
      const createUserDto = {
        name: '重复用户',
        phoneNumber: '13800138000', // 已存在的手机号
        role: 'USER',
        status: 'ACTIVE',
        remarks: '测试重复手机号',
      };

      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('手机号已存在');
        });
    });

    it('应该失败当没有权限', () => {
      const createUserDto = {
        name: '无权限用户',
        phoneNumber: '13600136000',
        role: 'USER',
        status: 'ACTIVE',
        remarks: '测试无权限',
      };

      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createUserDto)
        .expect(403);
    });
  });

  describe('/users (GET)', () => {
    it('应该成功获取用户列表', () => {
      return request(app.getHttpServer())
        .get('/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('获取用户列表成功');
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data.items)).toBe(true);
          expect(res.body.data.total).toBeDefined();
          expect(res.body.data.page).toBe(1);
          expect(res.body.data.limit).toBe(10);
        });
    });

    it('应该根据查询条件过滤用户', () => {
      return request(app.getHttpServer())
        .get('/users?name=测试&role=USER&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        });
    });

    it('应该只返回当前用户的信息当普通用户访问', () => {
      return request(app.getHttpServer())
        .get('/users?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        });
    });
  });

  describe('/users/:id (GET)', () => {
    let userId: string;

    beforeEach(async () => {
      // 先创建一个用户用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '详情测试用户',
          phoneNumber: '13500135000',
          role: 'USER',
          status: 'ACTIVE',
          remarks: '测试详情',
        });

      userId = createResponse.body.data.id;
    });

    it('应该成功获取用户详情', () => {
      return request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('获取用户详情成功');
          expect(res.body.data).toBeDefined();
          expect(res.body.data.id).toBe(userId);
          expect(res.body.data.name).toBe('详情测试用户');
        });
    });

    it('应该失败当用户不存在', () => {
      return request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('用户不存在');
        });
    });
  });

  describe('/users/:id (PUT)', () => {
    let userId: string;

    beforeEach(async () => {
      // 先创建一个用户用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新测试用户',
          phoneNumber: '13400134000',
          role: 'USER',
          status: 'ACTIVE',
          remarks: '测试更新',
        });

      userId = createResponse.body.data.id;
    });

    it('应该成功更新用户信息', () => {
      const updateUserDto = {
        name: '更新后的用户',
        role: 'ADMIN',
        status: 'INACTIVE',
        remarks: '已更新',
      };

      return request(app.getHttpServer())
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateUserDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('用户信息更新成功');
          expect(res.body.data).toBeDefined();
          expect(res.body.data.name).toBe('更新后的用户');
          expect(res.body.data.role).toBe('ADMIN');
          expect(res.body.data.status).toBe('INACTIVE');
        });
    });

    it('应该失败当没有权限', () => {
      const updateUserDto = {
        name: '无权限更新',
        role: 'ADMIN',
        status: 'INACTIVE',
        remarks: '无权限',
      };

      return request(app.getHttpServer())
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateUserDto)
        .expect(403);
    });
  });

  describe('/users/:id (DELETE)', () => {
    let userId: string;

    beforeEach(async () => {
      // 先创建一个用户用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '删除测试用户',
          phoneNumber: '13300133000',
          role: 'USER',
          status: 'ACTIVE',
          remarks: '测试删除',
        });

      userId = createResponse.body.data.id;
    });

    it('应该成功删除用户', () => {
      return request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('用户删除成功');
        });
    });

    it('应该失败当没有权限', () => {
      return request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('/users/profile (GET)', () => {
    it('应该成功获取当前用户信息', () => {
      return request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('获取用户信息成功');
          expect(res.body.data).toBeDefined();
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.name).toBeDefined();
        });
    });

    it('应该失败当未认证', () => {
      return request(app.getHttpServer())
        .get('/users/profile')
        .expect(401);
    });
  });

  describe('/users/statistics (GET)', () => {
    it('应该成功获取用户统计信息', () => {
      return request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('获取统计信息成功');
          expect(res.body.data).toBeDefined();
          expect(res.body.data.totalUsers).toBeDefined();
          expect(res.body.data.activeUsers).toBeDefined();
          expect(res.body.data.inactiveUsers).toBeDefined();
          expect(res.body.data.normalUsers).toBeDefined();
          expect(res.body.data.adminUsers).toBeDefined();
          expect(res.body.data.superAdminUsers).toBeDefined();
          expect(res.body.data.todayNewUsers).toBeDefined();
          expect(res.body.data.weekNewUsers).toBeDefined();
          expect(res.body.data.monthNewUsers).toBeDefined();
        });
    });

    it('应该失败当没有权限', () => {
      return request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});