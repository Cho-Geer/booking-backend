
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Service } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, ToggleServiceStatusDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Service[]> {
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

    return this.prisma.service.create({
      data,
      include: {
        category: true,
      },
    });
  }

  async updateService(id: string, updateServiceDto: UpdateServiceDto): Promise<Service> {
    const existingService = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
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

    return this.prisma.service.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async toggleServiceStatus(id: string, toggleServiceStatusDto: ToggleServiceStatusDto): Promise<Service> {
    const existingService = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      throw new NotFoundException('服务不存在');
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        isActive: toggleServiceStatusDto.isActive,
      },
      include: {
        category: true,
      },
    });
  }
}
