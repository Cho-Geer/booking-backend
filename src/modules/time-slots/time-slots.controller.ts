/**
 * 时间段控制器
 * 处理时间段相关HTTP请求
 * @author Booking System
 * @since 2024
 */

import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { TimeSlotsService } from './time-slots.service';
import { CreateTimeSlotDto, UpdateTimeSlotDto, TimeSlotQueryDto, TimeSlotAvailabilityDto } from './dto/time-slot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/index';
import { UserRole } from '../users/dto/user.dto';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('时间段管理')
@ApiBearerAuth()
@UseInterceptors(TransformInterceptor)
@Controller('time-slots')
export class TimeSlotsController {
  constructor(private readonly timeSlotsService: TimeSlotsService) {}

  /**
   * 创建时间段
   * @param createTimeSlotDto 创建时间段数据
   * @returns 创建结果
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建时间段', description: '管理员创建新的时间段' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 409, description: '时间段冲突' })
  @ApiResponse({ status: 403, description: '无权限' })
  async create(@Body() createTimeSlotDto: CreateTimeSlotDto) {
    return this.timeSlotsService.create(createTimeSlotDto);
  }

  /**
   * 获取时间段列表
   * @param query 查询条件
   * @returns 时间段列表
   */
  @Get()
  @ApiOperation({ summary: '获取时间段列表', description: '获取所有时间段列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAll(@Query() query: TimeSlotQueryDto) {
    return this.timeSlotsService.findAll(query);
  }

  /**
   * 获取时间段可用性
   * @param query 可用性查询参数
   * @returns 时间段可用性信息
   */
  @Get('available-slots')
  @ApiOperation({ summary: '获取时间段可用性', description: '获取指定日期的时间段可用性信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiQuery({ name: 'date', required: true, description: '日期 (YYYY-MM-DD)', example: '2024-01-15' })
  async getAvailability(@Query('date') date: string): Promise<ApiResponseDto> {
    const result = await this.timeSlotsService.getAvailability({date});
    return ApiResponseDto.success(result);
  }

  /**
   * 获取时间段详情
   * @param id 时间段ID
   * @returns 时间段详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取时间段详情', description: '根据ID获取时间段详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '时间段不存在' })
  async findOne(@Param('id') id: string) {
    return this.timeSlotsService.findOne(id);
  }

  /**
   * 更新时间段
   * @param id 时间段ID
   * @param updateTimeSlotDto 更新数据
   * @returns 更新结果
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新时间段', description: '管理员更新时间段信息' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '时间段不存在' })
  @ApiResponse({ status: 409, description: '时间段冲突' })
  @ApiResponse({ status: 403, description: '无权限' })
  async update(@Param('id') id: string, @Body() updateTimeSlotDto: UpdateTimeSlotDto) {
    return this.timeSlotsService.update(id, updateTimeSlotDto);
  }

  /**
   * 删除时间段
   * @param id 时间段ID
   * @returns 删除结果
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除时间段', description: '管理员删除时间段' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '时间段不存在' })
  @ApiResponse({ status: 409, description: '时间段已被预约' })
  @ApiResponse({ status: 403, description: '无权限' })
  async remove(@Param('id') id: string) {
    return this.timeSlotsService.remove(id);
  }
}