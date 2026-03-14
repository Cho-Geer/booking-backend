
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Service } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, ToggleServiceStatusDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  
  constructor(private prisma: PrismaService) {}

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

  async findAllForAdmin(): Promise<Service[]> {
    this.logger.log('Fetching all services for admin');
    return this.prisma.service.findMany({
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        category: true,
      },
    });
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

  async toggleServiceStatus(id: string, toggleServiceStatusDto: ToggleServiceStatusDto): Promise<Service> {
    this.logger.log(`Toggling service status: ${id} to ${toggleServiceStatusDto.isActive}`);
    
    return this.prisma.$transaction(async (tx) => {
      const existingService = await tx.service.findUnique({
        where: { id },
      });

      if (!existingService) {
        this.logger.warn(`Service not found for status toggle: ${id}`);
        throw new NotFoundException('服务不存在');
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
  }
}
