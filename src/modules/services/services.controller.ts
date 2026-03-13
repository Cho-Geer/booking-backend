import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateServiceDto, ToggleServiceStatusDto, UpdateServiceDto } from './dto/service.dto';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  private ensureAdminAccess(user: any): void {
    const userType = (user?.userType || '').toString().toUpperCase();
    const role = (user?.role || '').toString().toUpperCase();
    if (userType !== 'ADMIN' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('仅管理员可操作服务管理');
    }
  }

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员获取全部服务列表' })
  @ApiResponse({ status: 200, description: '成功获取服务列表' })
  async findAllForAdmin(@CurrentUser() user: any) {
    this.ensureAdminAccess(user);
    const services = await this.servicesService.findAllForAdmin();
    return {
      data: services,
    };
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员创建服务' })
  @ApiResponse({ status: 201, description: '服务创建成功' })
  async createService(
    @Body(new ValidationPipe({ transform: true })) createServiceDto: CreateServiceDto,
    @CurrentUser() user: any,
  ) {
    this.ensureAdminAccess(user);
    const service = await this.servicesService.createService(createServiceDto);
    return {
      data: service,
    };
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员更新服务' })
  @ApiResponse({ status: 200, description: '服务更新成功' })
  async updateService(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) updateServiceDto: UpdateServiceDto,
    @CurrentUser() user: any,
  ) {
    this.ensureAdminAccess(user);
    const service = await this.servicesService.updateService(id, updateServiceDto);
    return {
      data: service,
    };
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员切换服务启用状态' })
  @ApiResponse({ status: 200, description: '服务状态更新成功' })
  async updateServiceStatus(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) toggleServiceStatusDto: ToggleServiceStatusDto,
    @CurrentUser() user: any,
  ) {
    this.ensureAdminAccess(user);
    const service = await this.servicesService.toggleServiceStatus(id, toggleServiceStatusDto);
    return {
      data: service,
    };
  }
}
