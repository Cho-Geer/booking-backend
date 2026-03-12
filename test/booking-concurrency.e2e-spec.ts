
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import * as request from 'supertest';
import { CreateAppointmentDto } from '../src/modules/bookings/dto/booking.dto';
import { UserType, UserStatus } from '../src/modules/users/dto/user.dto';

describe('Booking Concurrency (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let container: StartedTestContainer;

  // Timeout for container startup
  jest.setTimeout(60000);

  beforeAll(async () => {
    console.log('Starting PostgreSQL container...');
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'booking_test_concurrency',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
      })
      .withExposedPorts(5432)
      .start();

    const port = container.getMappedPort(5432);
    const host = container.getHost();
    const databaseUrl = `postgresql://test:test@${host}:${port}/booking_test_concurrency?schema=public`;

    process.env.DATABASE_URL = databaseUrl;
    // Set dummy JWT secrets for testing if not present
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
    
    console.log(`Database URL: ${databaseUrl}`);

    // Run migrations
    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  beforeEach(async () => {
    // Clean up appointments before each test
    await prismaService.appointment.deleteMany();
    await prismaService.user.deleteMany();
    await prismaService.timeSlot.deleteMany();
    await prismaService.service.deleteMany();
  });

  const generateToken = (user: any) => {
    const payload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phone,
      role: user.userType,
    };
    return jwtService.sign(payload, {
      secret: configService.get('JWT_SECRET'),
      expiresIn: '1h',
    });
  };

  it('should handle concurrent bookings for the same slot correctly', async () => {
    // 1. Setup Data
    const timeSlot = await prismaService.timeSlot.create({
      data: {
        slotTime: '10:00:00',
        durationMinutes: 30,
        isActive: true,
      },
    });

    const user1 = await prismaService.user.create({
      data: {
        name: 'User 1',
        phone: '13800000001',
        phoneHash: 'hash1',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    const user2 = await prismaService.user.create({
      data: {
        name: 'User 2',
        phone: '13800000002',
        phoneHash: 'hash2',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    const token1 = generateToken(user1);
    const token2 = generateToken(user2);

    const appointmentDate = '2026-05-01';

    const bookingRequest1: CreateAppointmentDto = {
      timeSlotId: timeSlot.id,
      userId: user1.id,
      appointmentDate,
      customerName: 'User 1',
      customerPhone: '13800000001',
    };

    const bookingRequest2: CreateAppointmentDto = {
      timeSlotId: timeSlot.id,
      userId: user2.id,
      appointmentDate,
      customerName: 'User 2',
      customerPhone: '13800000002',
    };

    // 2. Execute Concurrent Requests
    const results = await Promise.all([
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token1}`)
        .send(bookingRequest1),
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token2}`)
        .send(bookingRequest2),
    ]);

    // 3. Verify Results
    const successResponses = results.filter((res) => res.status === 201);
    const conflictResponses = results.filter((res) => res.status === 409); // Conflict

    console.log('Success count:', successResponses.length);
    console.log('Conflict count:', conflictResponses.length);

    // Only ONE should succeed
    expect(successResponses.length).toBe(1);
    // The rest should fail with 409
    expect(conflictResponses.length).toBe(1);

    // Verify DB state
    const appointments = await prismaService.appointment.findMany({
      where: {
        timeSlotId: timeSlot.id,
        appointmentDate: new Date(appointmentDate),
      },
    });
    expect(appointments.length).toBe(1);
  });

  it('should prevent booking if slot is disabled', async () => {
    const timeSlot = await prismaService.timeSlot.create({
      data: {
        slotTime: '11:00:00',
        durationMinutes: 30,
        isActive: false, // Disabled
      },
    });

    const user1 = await prismaService.user.create({
      data: {
        name: 'User 1',
        phone: '13800000001',
        phoneHash: 'hash1',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    const token1 = generateToken(user1);

    const bookingRequest: CreateAppointmentDto = {
      timeSlotId: timeSlot.id,
      appointmentDate: '2026-05-02',
      customerName: 'User 1',
      customerPhone: '13800000001',
    };

    const response = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${token1}`)
      .send(bookingRequest);

    expect(response.status).toBe(409); // Should be conflict or bad request depending on implementation
  });
});

