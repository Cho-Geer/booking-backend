
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Service } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, ToggleServiceStatusDto, ServiceListResponseDto, ServiceQueryDto, ServiceResponseDto } from './dto/service.dto';
import { DatabaseException } from '../../common/exceptions/business.exceptions';
import { EmailService } from '../email/email.service';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async findAll(): Promise<Service[]> {
    this.logger.log('Fetching all active services');
    return this.prisma.service.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        category: true,
      }
    });
  }

  async findAllForAdmin(query: ServiceQueryDto): Promise<ServiceListResponseDto> {
    this.logger.log('Fetching all services for admin');
    try{
      const { page = 1, limit = 10 } = query;
      // 确保page和limit是数字类型
      const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
      const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
      const skip = (pageNum - 1) * limitNum;

      // 构建查询条件
      const where: Prisma.ServiceWhereInput = {};

      if (query.name) {
        where.name = query.name;
      }

      if (query.price) {
        where.price = query.price;
      }

      if (query.categoryId) {
        where.categoryId = query.categoryId;
      }

      if (query.durationMinutes) {
        where.durationMinutes = query.durationMinutes;
      }

      if (query.isActive) {
        where.isActive = query.isActive;
      }

      // 查询总数
      const total = await this.prisma.service.count({ where });
      this.logger.log(`查询到的总数: ${total}`);

      const services = await this.prisma.service.findMany({
        where,
        orderBy: {
          displayOrder: 'asc',
        },
        include: {
          category: true,
        },
        skip,
        take: limitNum,
      });

      this.logger.log(`查询到的服務数量: ${services.length}`);
      const items = services.map(service => {
        try {
          return this.mapToResponseDto(service);
        } catch (error) {
          this.logger.error(`映射服務数据失败: ${error.message}`, error);
          throw error;
        }
      });
      this.logger.log(`映射后的服務数量: ${items.length}`);

      // 直接返回对象而不是使用构造函数
      const result = {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      };
      
      this.logger.log(`最终返回结果: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('查询服務列表失败', error);
      throw new DatabaseException('查询服務列表失败');
    }
  }

  async createService(createServiceDto: CreateServiceDto): Promise<Service> {
    this.logger.log(`Creating service: ${createServiceDto.name}`);
    
    const data: Prisma.ServiceCreateInput = {
      name: createServiceDto.name,
      description: createServiceDto.description,
      durationMinutes: createServiceDto.durationMinutes,
      price: createServiceDto.price,
      imageUrl: createServiceDto.imageUrl,
      isActive: createServiceDto.isActive ?? true,
      displayOrder: createServiceDto.displayOrder,
      category: createServiceDto.categoryId
        ? {
            connect: {
              id: createServiceDto.categoryId,
            },
          }
        : undefined,
    };

    const service = await this.prisma.service.create({
      data,
      include: {
        category: true,
      },
    });
    
    this.logger.log(`Service created successfully: ${service.id}`);
    return service;
  }

  async updateService(id: string, updateServiceDto: UpdateServiceDto): Promise<Service> {
    this.logger.log(`Updating service: ${id}`);
    
    return this.prisma.$transaction(async (tx) => {
      const existingService = await tx.service.findUnique({
        where: { id },
      });

      if (!existingService) {
        this.logger.warn(`Service not found for update: ${id}`);
        throw new NotFoundException('服务不存在');
      }

      const data: Prisma.ServiceUpdateInput = {
        name: updateServiceDto.name,
        description: updateServiceDto.description,
        durationMinutes: updateServiceDto.durationMinutes,
        price: updateServiceDto.price,
        imageUrl: updateServiceDto.imageUrl,
        isActive: updateServiceDto.isActive,
        displayOrder: updateServiceDto.displayOrder,
        category: updateServiceDto.categoryId
          ? {
              connect: {
                id: updateServiceDto.categoryId,
              },
            }
          : updateServiceDto.categoryId === null
            ? {
                disconnect: true,
              }
            : undefined,
      };

      const service = await tx.service.update({
        where: { id },
        data,
        include: {
          category: true,
        },
      });
      
      this.logger.log(`Service updated successfully: ${id}`);
      return service;
    });
  }

  async toggleServiceStatus(id: string, toggleServiceStatusDto: ToggleServiceStatusDto): Promise<ServiceResponseDto> {
    this.logger.log(`Toggling service status: ${id} to ${toggleServiceStatusDto.isActive}`);
    
    let bookingsToNotify: Array<{
      customerEmail: string;
      customerName: string;
      appointmentDate: Date;
      timeSlot?: { slotTime: any };
      serviceName?: string;
      appointmentNumber: string;
      notes?: string;
    }> = [];

    const service = await this.prisma.$transaction(async (tx) => {
      const existingService = await tx.service.findUnique({
        where: { id },
      });

      if (!existingService) {
        this.logger.warn(`Service not found for status toggle: ${id}`);
        throw new NotFoundException('服务不存在');
      }

      // サービスを無効化する場合、PENDING または CONFIRMED の予約をキャンセル
      if (!toggleServiceStatusDto.isActive && existingService.isActive) {
        // 該当サービスのアクティブな予約を取得
        const activeBookings = await tx.appointment.findMany({
          where: {
            serviceId: id,
            status: {
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
            },
          },
          include: {
            timeSlot: true,
            service: true,
          },
        });

        this.logger.log(`無効化されるサービスに関連するアクティブな予約数：${activeBookings.length}`);

        // 各予約をキャンセル（トランザクション内）
        for (const booking of activeBookings) {
          await tx.appointment.update({
            where: { id: booking.id },
            data: {
              status: AppointmentStatus.CANCELLED,
              cancelledAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // メール送信情報を保存（トランザクション外で送信）
          if (booking.customerEmail) {
            bookingsToNotify.push({
              customerEmail: booking.customerEmail,
              customerName: booking.customerName,
              appointmentDate: booking.appointmentDate,
              timeSlot: booking.timeSlot,
              serviceName: booking.service?.name,
              appointmentNumber: booking.appointmentNumber,
              notes: booking.notes,
            });
          }
        }
      }

      const service = await tx.service.update({
        where: { id },
        data: {
          isActive: toggleServiceStatusDto.isActive,
        },
        include: {
          category: true,
        },
      });
      
      this.logger.log(`Service status toggled successfully: ${id}`);
      return service;
    });

    // トランザクションの外でメール送信（非同期）
    for (const booking of bookingsToNotify) {
      this.emailService.sendBookingCancellation(
        booking.customerEmail,
        {
          customerName: booking.customerName,
          appointmentDate: booking.appointmentDate.toLocaleDateString('zh-CN'),
          timeSlot: booking.timeSlot?.slotTime?.toString() || '',
          serviceName: booking.serviceName || 'Standard Service',
          appointmentNumber: booking.appointmentNumber,
          notes: booking.notes || '',
        },
      ).catch(err => this.logger.error('Error sending cancellation email', err));
    }

    const response = this.mapToResponseDto(service);
    this.logger.log(`Mapped response: ${JSON.stringify(response)}`);
    return response;
  }

  /**
   * 将服務实体转换为响应DTO
   * @param service 服務实体
   * @returns 服務响应DTO
   */
  private mapToResponseDto(service: any): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      description: service?.description,
      durationMinutes: service.durationMinutes,
      price: service?.price,
      imageUrl: service?.imageUrl,
      categoryId: service?.categoryId,
      isActive: service.isActive,
      displayOrder: service?.displayOrder,
      category: service.category ? {
        id: service.category.id,
        name: service.category.name,
      } : undefined,
    };
  }
}
