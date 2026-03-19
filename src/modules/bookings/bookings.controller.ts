/**
 * 预约控制器
 * 处理预约相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { TimeSlotAvailabilityDto, TimeSlotAvailabilityResponseDto } from '../time-slots/dto/time-slot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles, Permissions } from '../../common/decorators';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  AppointmentResponseDto,
  AppointmentQueryDto,
  AppointmentListResponseDto,
  AppointmentStatisticsDto,
} from './dto/booking.dto';
import { UserRole, UserType } from '../users/dto/user.dto';
import { ResourceNotFoundException } from '../../common/exceptions/business.exceptions';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 预约管理控制器
 * 提供预约的CRUD操作和统计功能
 */
@ApiTags('预约管理')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TransformInterceptor)
@ApiBearerAuth()
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly timeSlotsService: TimeSlotsService
  ) {}

  /**
   * 创建预约
   * @param createAppointmentDto 创建预约数据
   * @param user 当前用户信息
   * @returns 创建的预约信息
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建预约', description: '用户创建新的预约' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '预约创建成功',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数无效' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '时间段冲突' })
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,  // 移除ValidationPipe
    @CurrentUser() user: any,
  ): Promise<AppointmentResponseDto> {
    this.logger.log(`用户 ${user.id} 创建预约: ${JSON.stringify(createAppointmentDto)}`);
    
    // 如果DTO中没有提供userId，使用当前用户ID
    if (!createAppointmentDto.userId) {
      createAppointmentDto.userId = user.id;
    }
    
    return await this.bookingsService.createBooking(createAppointmentDto, user.id);
  }

  /**
   * 获取预约列表
   * @param query 查询参数
   * @param user 当前用户信息
   * @returns 预约列表
   */
  @Get('all')
  @ApiOperation({ summary: '获取预约列表', description: '根据条件查询预约列表' })
  @ApiResponse({status: HttpStatus.OK, description: '查询成功', type: AppointmentListResponseDto})
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量', example: 10 })
  async findAll(
    @Query(ValidationPipe) query: AppointmentQueryDto,
    @CurrentUser() user: any,
  ): Promise<AppointmentListResponseDto> {
    try {
      this.logger.log(`用户 ${user.id} 查询预约列表: ${JSON.stringify(query)}`);
      this.logger.log(`用户信息: ${JSON.stringify(user)}`);
      
      // 非管理员用户只能查看自己的预约
      if (user.userType !== UserType.ADMIN) {
        query.userId = user.id;
        this.logger.log(`非管理员用户，设置userId为: ${user.id}`);
      }
      
      this.logger.log(`查询条件: ${JSON.stringify(query)}`);
      const result = await this.bookingsService.findBookings(query, user.id);
      this.logger.log(`查询结果: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`查询预约列表失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取可用时间段
   * @param query 查询参数
   * @returns 可用时间段列表
   */
  @Get('available-slots')
  @ApiOperation({ summary: '获取可用时间段', description: '获取指定日期的可用时间段' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  async getAvailableSlots(@Query() query: TimeSlotAvailabilityDto) {
    return this.timeSlotsService.getAvailability(query);
  }

  /**
   * 获取指定日期的所有预约（无分页）
   * @param date 日期
   * @param user 当前用户信息
   * @returns 该日期的所有预约
   */
  @Get('by-date')
  @ApiOperation({ summary: '获取指定日期的所有预约', description: '获取指定日期的所有预约（无分页限制），用于时段状态映射' })
  @ApiResponse({ status: 200, description: '获取成功', type: AppointmentListResponseDto })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiQuery({ name: 'date', required: true, description: '日期 (YYYY-MM-DD)', example: '2024-01-15' })
  async findAllBookingsByDate(
    @Query('date') date: string,
    @CurrentUser() user: any,
  ): Promise<AppointmentListResponseDto> {
    this.logger.log(`用户 ${user.id} 查询日期 ${date} 的所有预约`);

    // 验证日期格式
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ResourceNotFoundException('日期格式无效，请使用 YYYY-MM-DD 格式');
    }

    // 非管理员用户只能查看自己的预约
    const userId = user.userType !== UserType.ADMIN ? user.id : undefined;
    
    return await this.bookingsService.findAllBookingsByDate(date, userId, user.id);
  }

  /**
   * 获取预约统计信息
   * @param user 当前用户信息
   * @returns 统计信息
   */
  @Get('stats/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '获取预约统计', description: '获取预约相关统计信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: AppointmentStatisticsDto,
  })
  async getStats(
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<AppointmentStatisticsDto>> {
    this.logger.log(`管理员 ${user.id} 查询预约统计`);
    
    const stats = await this.bookingsService.getBookingStats();
    return ApiResponseDto.success(stats, '获取预约统计信息成功');
  }

  /**
   * 根据ID获取预约详情
   * @param id 预约ID
   * @param user 当前用户信息
   * @returns 预约详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取预约详情', description: '根据ID获取预约详细信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '预约不存在' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<AppointmentResponseDto> {
    this.logger.log(`用户 ${user.id} 查询预约详情: ${id}`);
    
    const booking = await this.bookingsService.findBookingById(id);
    
    // 检查预约是否存在
    if (!booking) {
      throw new ResourceNotFoundException('预约');
    }
    
    // 非管理员用户只能查看自己的预约
    if (user.userType !== UserType.ADMIN && booking.userId !== user.id) {
      throw new ResourceNotFoundException('预约');
    }
    
    return booking;
  }

  /**
   * 更新预约
   * @param id 预约 ID
   * @param updateAppointmentDto 更新数据
   * @param user 当前用户信息
   * @returns 更新后的预约信息
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新预约', description: '更新预约信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '更新成功',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '预约不存在' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '权限不足' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数无效' })  // 添加 400 错误响应
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,  // 移除 ValidationPipe
    @CurrentUser() user: any,
  ): Promise<AppointmentResponseDto> {
    try {
      this.logger.log(`用户 ${user.id} 更新预约 ${id}: ${JSON.stringify(updateAppointmentDto)}`);
      
      // 检查权限
      const existingBooking = await this.bookingsService.findBookingById(id);
      // 检查预约是否存在
      if (!existingBooking) {
        throw new ResourceNotFoundException('预约');
      }
      
      if (user.userType !== UserType.ADMIN && existingBooking.userId !== user.id) {
        throw new ResourceNotFoundException('预约');
      }
      
      // 记录更新前的数据
      this.logger.log(`更新前的预约数据: ${JSON.stringify(existingBooking)}`);
      
      // 记录DTO验证信息
      this.logger.log(`更新DTO验证结果: ${JSON.stringify(updateAppointmentDto)}`);
      
      return await this.bookingsService.updateBooking(id, updateAppointmentDto, user.id);
    } catch (error) {
      this.logger.error(`更新预约 ${id} 失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 取消预约
   * @param id 预约 ID
   * @param user 当前用户信息
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '取消预约', description: '取消指定的预约' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '取消成功' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '预约不存在' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '权限不足' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    this.logger.log(`用户 ${user.id} 取消预约: ${id}`);
    
    // 检查权限
    const existingBooking = await this.bookingsService.findBookingById(id);
    // 检查预约是否存在
    if (!existingBooking) {
      throw new ResourceNotFoundException('预约');
    }
    
    if (user.userType !== UserType.ADMIN && existingBooking.userId !== user.id) {
      throw new ResourceNotFoundException('预约');
    }
    
    await this.bookingsService.cancelBooking(id, user.id);
  }

  /**
   * 取消预约（兼容接口）
   * @param id 预约ID
   * @param user 当前用户信息
   * @returns 取消结果
   */
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)  // 明确指定返回 200 状态码
  @ApiOperation({ summary: '取消预约', description: '取消指定的预约' })
  @ApiResponse({ status: HttpStatus.OK, description: '取消成功' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '预约不存在' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '权限不足' })
  async cancelBooking(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`用户 ${user.id} 取消预约: ${id}`);
    
    // 验证ID格式
    if (!id || id.length !== 36) {
      throw new ResourceNotFoundException('预约');
    }
    
    try {
      // 检查权限
      const existingBooking = await this.bookingsService.findBookingById(id);
      if (user.userType !== UserType.ADMIN && existingBooking.userId !== user.id) {
        throw new ResourceNotFoundException('预约');
      }
      
      await this.bookingsService.cancelBooking(id, user.id, user.userType);
      return ApiResponseDto.success(null, '预约取消成功');
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new ResourceNotFoundException('预约');
    }
  }
}