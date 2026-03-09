/**
 * 用户控制器
 * 处理用户相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { ApiResponseDto, PaginationQueryDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles, Permissions } from '../../common/decorators/index';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';

@ApiTags('用户管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TransformInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 创建用户
   * @param createUserDto 创建用户数据
   * @param currentUser 当前登录用户
   * @returns 创建的用户信息
   */
  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users.create')
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({
    status: 201,
    description: '用户创建成功',
    type: UserResponseDto,
  })
  async createUser(
    @Body(new ValidationPipe()) createUserDto: CreateUserDto,
    @CurrentUser() currentUser: any,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.createUser(createUserDto);
    return ApiResponseDto.success(user, '用户创建成功');
  }

  /**
   * 获取用户列表
   * @param query 查询参数
   * @param pagination 分页参数
   * @returns 用户列表
   */
  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users.read')
  @ApiOperation({ summary: '获取用户列表' })
  @ApiQuery({ name: 'name', required: false, description: '用户姓名' })
  @ApiQuery({ name: 'phoneNumber', required: false, description: '手机号' })
  @ApiQuery({ name: 'role', required: false, enum: ['USER', 'ADMIN', 'SUPER_ADMIN'], description: '用户角色' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], description: '用户状态' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async findUsers(
    @Query() query: any,
    @Query(new ValidationPipe()) pagination: PaginationQueryDto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.usersService.findUsers(query, pagination);
    return ApiResponseDto.success(result, '获取用户列表成功');
  }

  /**
   * 获取用户详情
   * @param id 用户ID
   * @returns 用户详情
   */
  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users.read')
  @ApiOperation({ summary: '获取用户详情' })
  @ApiResponse({
    status: 200,
    description: '获取用户详情成功',
    type: UserResponseDto,
  })
  async findUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.findUserById(id);
    return ApiResponseDto.success(user, '获取用户详情成功');
  }

  /**
   * 更新用户信息
   * @param id 用户ID
   * @param updateUserDto 更新数据
   * @param currentUser 当前登录用户
   * @returns 更新后的用户信息
   */
  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users.update')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({
    status: 200,
    description: '用户更新成功',
    type: UserResponseDto,
  })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe()) updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.updateUser(id, updateUserDto);
    return ApiResponseDto.success(user, '用户更新成功');
  }

  /**
   * 删除用户
   * @param id 用户ID
   * @param currentUser 当前登录用户
   */
  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users.delete')
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({
    status: 200,
    description: '用户删除成功',
  })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ): Promise<ApiResponseDto<void>> {
    await this.usersService.deleteUser(id);
    return ApiResponseDto.success(null, '用户删除成功');
  }

  /**
   * 获取当前用户信息
   * @param currentUser 当前登录用户
   * @returns 当前用户信息
   */
  @Get('profile/me')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({
    status: 200,
    description: '获取当前用户信息成功',
    type: UserResponseDto,
  })
  async getCurrentUserProfile(
    @CurrentUser() currentUser: any,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.findUserById(currentUser.id);
    return ApiResponseDto.success(user, '获取当前用户信息成功');
  }

  /**
   * 获取用户统计信息
   * @param currentUser 当前登录用户
   * @returns 用户统计信息
   */
  @Get('statistics')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users.stats')
  @ApiOperation({ summary: '获取用户统计信息' })
  @ApiResponse({
    status: 200,
    description: '获取用户统计信息成功',
  })
  async getStatistics(): Promise<ApiResponseDto<any>> {
    const statistics = await this.usersService.getUserStats();
    return ApiResponseDto.success(statistics, '获取统计信息成功');
  }
}
