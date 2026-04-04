import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Services Admin API (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const createAdminToken = (userId: string) => {
    return jwtService.sign({
      sub: userId,
      userType: 'ADMIN',
      role: 'ADMIN',
      phoneHash: 'admin-phone-hash',
    }, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prismaService.appointment.deleteMany();
    await prismaService.service.deleteMany();
    await prismaService.serviceCategory.deleteMany();
    await prismaService.userSession.deleteMany();
    await prismaService.user.deleteMany();
  });

  it('creates, updates and toggles service status through admin endpoints', async () => {
    const admin = await prismaService.user.create({
      data: {
        name: 'Admin User',
        phone: '13800000010',
        phoneHash: 'admin-hash-10',
        userType: 'ADMIN',
        status: 'ACTIVE',
        isVerified: true,
      },
    });

    const token = createAdminToken(admin.id);

    const createResponse = await request(app.getHttpServer())
      .post('/v1/services/admin')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '高级咨询服务',
        description: '测试服务',
        durationMinutes: 45,
        price: 199,
        imageUrl: 'https://example.com/service.png',
        isActive: true,
        displayOrder: 5,
      })
      .expect(201);

    expect(createResponse.body?.data?.name).toBe('高级咨询服务');
    expect(createResponse.body?.data?.durationMinutes).toBe(45);
    expect(createResponse.body?.data?.isActive).toBe(true);

    const serviceId = createResponse.body?.data?.id;
    expect(serviceId).toBeDefined();

    const updateResponse = await request(app.getHttpServer())
      .patch(`/v1/services/admin/${serviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '高级咨询服务-升级版',
        price: 299,
      })
      .expect(200);

    expect(updateResponse.body?.data?.name).toBe('高级咨询服务-升级版');
    expect(updateResponse.body?.data?.price).toBe(299);

    const toggleResponse = await request(app.getHttpServer())
      .patch(`/v1/services/admin/${serviceId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        isActive: false,
      })
      .expect(200);

    expect(toggleResponse.body?.data?.isActive).toBe(false);

    const listResponse = await request(app.getHttpServer())
      .get('/v1/services/all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(listResponse.body?.data?.items)).toBe(true);
    expect(listResponse.body.data.items.some((item: { id: string }) => item.id === serviceId)).toBe(true);
  });
});
