
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ServicesService } from './services.service';

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
}
