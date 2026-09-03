/**
 * 集成命令控制器（P0-3 B-2/B-3・IF-02・DD-02 §2.3）
 * 受理 Salesforce 侧 POST /v1/integrations/salesforce/booking-commands 下发的预约取消命令。
 * - @SkipJwtAuth()：绕过全局 JwtAuthGuard（由 @UseGuards(IntegrationGuard) 承担服务间认证・A3）
 * - @HttpCode(HttpStatus.OK)：POST 默认 201，契约要求显式 200
 * @author Booking System
 * @since 2024
 */

import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationCommandsService } from './integration-commands.service';
import { IntegrationGuard } from '../../common/guards/integration.guard';
import { SkipJwtAuth } from '../../common/decorators';
import { BookingCommandRequestDto } from './dto/booking-command-request.dto';
import { BookingCommandResultDto } from './dto/booking-command-result.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 集成命令控制器
 * 提供外部系统（Salesforce）预约命令受理入口
 */
@ApiTags('integrations')
@Controller('integrations/salesforce/booking-commands')
@UseGuards(IntegrationGuard)
@ApiBearerAuth()
export class IntegrationCommandsController {
  constructor(private readonly integrationCommandsService: IntegrationCommandsService) {}

  /**
   * 受理预约取消命令
   * @param dto 取消命令请求 DTO（六项全必填，全局 ValidationPipe 校验）
   * @returns 统一响应信封（code 200・data 含 canonicalVersion/resultCode 等）
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @SkipJwtAuth()
  @ApiOperation({
    summary: '受理 Salesforce 预约取消命令',
    description: '幂等受理 CANCEL_BOOKING 命令；版本门冲突返回 409，状态不可取消返回 409，映射无效返回 403，预约不存在返回 404',
  })
  @ApiResponse({ status: HttpStatus.OK, description: '取消命令受理成功', type: BookingCommandResultDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数无效' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '集成令牌缺失或不一致' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '操作员映射无效' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '预约不存在' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '预约状态不可取消或版本不一致' })
  async receiveCommand(
    @Body() dto: BookingCommandRequestDto,
  ): Promise<ApiResponseDto<BookingCommandResultDto>> {
    const result = await this.integrationCommandsService.executeCancelCommand(dto);
    return ApiResponseDto.success(result, '取消命令受理成功');
  }
}
