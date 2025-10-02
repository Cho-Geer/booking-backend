/**
 * 时间段服务
 * 处理时间段相关业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeSlotDto, UpdateTimeSlotDto, TimeSlotResponseDto, TimeSlotQueryDto, TimeSlotAvailabilityDto, TimeSlotAvailabilityResponseDto } from './dto/time-slot.dto';
import { BusinessException } from '../../common/exceptions/business.exceptions';
import { Prisma } from '@prisma/client';

@Injectable()
export class TimeSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建时间段
   * @param createTimeSlotDto 创建时间段数据
   * @returns 创建的时间段信息
   */
  async create(createTimeSlotDto: CreateTimeSlotDto): Promise<TimeSlotResponseDto> {
    try {
      // 检查时间段是否冲突
      const existingSlot = await this.prisma.timeSlot.findFirst({
        where: {
          slotTime: createTimeSlotDto.slotTime
        }
      });

      if (existingSlot) {
        throw new ConflictException('时间段与现有时间段冲突');
      }

      const timeSlot = await this.prisma.timeSlot.create({
        data: createTimeSlotDto
      });

      return this.toResponseDto(timeSlot);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BusinessException('CREATE_TIMESLOT_FAILED', '创建时间段失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取所有时间段
   * @param query 查询条件
   * @returns 时间段列表
   */
  async findAll(query?: TimeSlotQueryDto): Promise<TimeSlotResponseDto[]> {
    try {
      const where: Prisma.TimeSlotWhereInput = {};

      if (query?.slotTime) {
        where.slotTime = query.slotTime;
      }
      if (query?.isActive !== undefined) {
        where.isActive = query.isActive;
      }
      if (query?.minDuration) {
        where.durationMinutes = { gte: query.minDuration };
      }
      if (query?.maxDuration) {
        where.durationMinutes = { lte: query.maxDuration };
      }

      const timeSlots = await this.prisma.timeSlot.findMany({
        where,
        orderBy: { slotTime: 'asc' }
      });

      return timeSlots.map(slot => this.toResponseDto(slot));
    } catch (error) {
      throw new BusinessException('GET_TIMESLOTS_FAILED', '获取时间段列表失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取时间段详情
   * @param id 时间段ID
   * @returns 时间段信息
   */
  async findOne(id: string): Promise<TimeSlotResponseDto> {
    try {
      const timeSlot = await this.prisma.timeSlot.findUnique({
        where: { id }
      });

      if (!timeSlot) {
        throw new NotFoundException('时间段不存在');
      }

      return this.toResponseDto(timeSlot);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BusinessException('GET_TIMESLOT_FAILED', '获取时间段详情失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更新时间段
   * @param id 时间段ID
   * @param updateTimeSlotDto 更新数据
   * @returns 更新后的时间段信息
   */
  async update(id: string, updateTimeSlotDto: UpdateTimeSlotDto): Promise<TimeSlotResponseDto> {
    try {
      // 检查时间段是否存在
      const existingSlot = await this.prisma.timeSlot.findUnique({
        where: { id }
      });

      if (!existingSlot) {
        throw new NotFoundException('时间段不存在');
      }

      // 如果更新时间，检查是否与其他时间段冲突
      if (updateTimeSlotDto.slotTime && updateTimeSlotDto.slotTime !== existingSlot.slotTime.toString()) {
        const conflictSlot = await this.prisma.timeSlot.findFirst({
          where: {
            slotTime: updateTimeSlotDto.slotTime,
            id: { not: id }
          }
        });

        if (conflictSlot) {
          throw new ConflictException('时间段与现有时间段冲突');
        }
      }

      const timeSlot = await this.prisma.timeSlot.update({
        where: { id },
        data: updateTimeSlotDto
      });

      return this.toResponseDto(timeSlot);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BusinessException('UPDATE_TIMESLOT_FAILED', '更新时间段失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 删除时间段
   * @param id 时间段ID
   */
  async remove(id: string): Promise<void> {
    try {
      const existingSlot = await this.prisma.timeSlot.findUnique({
        where: { id }
      });

      if (!existingSlot) {
        throw new NotFoundException('时间段不存在');
      }

      await this.prisma.timeSlot.delete({
        where: { id }
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BusinessException('DELETE_TIMESLOT_FAILED', '删除时间段失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取时间段可用性
   * @param availabilityDto 可用性查询参数
   * @returns 时间段可用性信息
   */
  async getAvailability(query: TimeSlotAvailabilityDto): Promise<TimeSlotAvailabilityResponseDto[]> {
    try {
      const where: Prisma.TimeSlotWhereInput = {
        isActive: true
      };

      if (query.timeSlotId) {
        where.id = query.timeSlotId;
      }

      const timeSlots = await this.prisma.timeSlot.findMany({
        where,
        orderBy: { slotTime: 'asc' }
      });

      return await Promise.all(timeSlots.map(async (slot) => {
        // 查询该时间段在指定日期的预约数量
        const bookedCount = await this.prisma.appointment.count({
          where: {
            timeSlotId: slot.id,
            appointmentDate: new Date(query.date),
            status: { not: 'CANCELLED' }
          }
        });

        const maxCapacity = 10; // 假设每个时间段最大容量为10
        const availableCount = maxCapacity - bookedCount;
        const isAvailable = availableCount > 0 && slot.isActive;

        return {
          id: slot.id,
          slotTime: slot.slotTime.toString(),
          durationMinutes: slot.durationMinutes,
          bookedCount,
          isAvailable,
          availabilityStatus: this.getAvailabilityStatus(isAvailable, availableCount, maxCapacity)
        };
      }));
    } catch (error) {
      throw new BusinessException('GET_AVAILABILITY_FAILED', '获取时间段可用性失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取可用性状态描述
   * @param isAvailable 是否可用
   * @param availableCount 可用数量
   * @param capacity 总容量
   * @returns 状态描述
   */
  private getAvailabilityStatus(isAvailable: boolean, availableCount: number, capacity: number): string {
    if (!isAvailable) {
      return '不可用';
    }
    
    const ratio = availableCount / capacity;
    if (ratio > 0.7) {
      return '充足';
    } else if (ratio > 0.3) {
      return '紧张';
    } else {
      return '即将满员';
    }
  }

  /**
   * 转换为响应DTO
   * @param timeSlot 时间段实体
   * @returns 响应DTO
   */
  private toResponseDto(timeSlot: any): TimeSlotResponseDto {
    return {
      id: timeSlot.id,
      slotTime: timeSlot.slotTime,
      durationMinutes: timeSlot.durationMinutes,
      isActive: timeSlot.isActive,
      displayOrder: timeSlot.displayOrder,
      createdAt: timeSlot.createdAt,
      updatedAt: timeSlot.updatedAt
    };
  }
}