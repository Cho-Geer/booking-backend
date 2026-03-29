import { Body, Controller, Get, Param, Patch, Post, UseGuards, ValidationPipe, Query, Logger, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateServiceDto, ToggleServiceStatusDto, UpdateServiceDto, ParamIdDto, ServiceQueryDto, ServiceListResponseDto } from './dto/service.dto';
import { User } from '@prisma/client';
import { UserType } from '../users/dto/user.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('Services')
@Controller('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TransformInterceptor)
export class ServicesController {
  private readonly logger = new Logger(ServicesController.name);

  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: '获取所有服务列表' })
  @ApiResponse({ status: 200, description: '成功获取服务列表' })
  async findAll() {
    try {
      return await this.servicesService.findAll();
    } catch (error) {
      this.logger.error(`查询服務列表失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员获取全部服务列表' })
  @ApiResponse({ status: 200, description: '成功获取服务列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量', example: 10 })
  async findAllForAdmin(@Query(ValidationPipe) query: ServiceQueryDto): Promise<ServiceListResponseDto> {
    try {
      return await this.servicesService.findAllForAdmin(query);
    } catch (error) {
      this.logger.error(`查询服務列表失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员创建服务' })
  @ApiResponse({ status: 201, description: '服务创建成功' })
  async createService(
    @Body(new ValidationPipe({ transform: true })) createServiceDto: CreateServiceDto,
  ) {
    const service = await this.servicesService.createService(createServiceDto);
    return {
      data: service,
    };
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员更新服务' })
  @ApiResponse({ status: 200, description: '服务更新成功' })
  async updateService(
    @Param() { id }: ParamIdDto,
    @Body(new ValidationPipe({ transform: true })) updateServiceDto: UpdateServiceDto,
  ) {
    const service = await this.servicesService.updateService(id, updateServiceDto);
    return {
      data: service,
    };
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员切换服务启用状态' })
  @ApiResponse({ status: 200, description: '服务状态更新成功' })
  async updateServiceStatus(
    @Param() { id }: ParamIdDto,
    @Body(new ValidationPipe({ transform: true })) toggleServiceStatusDto: ToggleServiceStatusDto,
  ): Promise<ApiResponseDto> {
    const result = await this.servicesService.toggleServiceStatus(id, toggleServiceStatusDto);
    return ApiResponseDto.success(result);
  }
}
