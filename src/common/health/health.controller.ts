import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '服务健康检查，包含 DB 和 Redis 状态' })
  async check(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.check();
    response.status(result.httpStatus);
    return result;
  }
}
