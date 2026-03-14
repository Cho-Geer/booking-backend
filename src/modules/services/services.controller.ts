import { Body, Controller, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateServiceDto, ToggleServiceStatusDto, UpdateServiceDto, ParamIdDto } from './dto/service.dto';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: '获取所有服务列表' })
  @ApiResponse({ status: 200, description: '成功获取服务列表' })
  async findAll() {
    const services = await this.servicesService.findAll();
    return {
      data: services
    };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员获取全部服务列表' })
  @ApiResponse({ status: 200, description: '成功获取服务列表' })
  async findAllForAdmin() {
    const services = await this.servicesService.findAllForAdmin();
    return {
      data: services,
    };
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
  ) {
    const service = await this.servicesService.toggleServiceStatus(id, toggleServiceStatusDto);
    return {
      data: service,
    };
  }
}
