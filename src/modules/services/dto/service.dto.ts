import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, IsUrl } from 'class-validator';

export class ParamIdDto {
  @ApiProperty({ description: '资源ID' })
  @IsUUID('4', { message: 'ID格式不正确' })
  id: string;
}

export class CreateServiceDto {
  @ApiProperty({ description: '服务名称', example: '深度咨询' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '服务描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '服务时长(分钟)', example: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional({ description: '服务价格', example: 199 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ description: '服务图片地址', example: 'https://example.com/service.png' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: '图片URL格式不正确' })
  @MaxLength(255)
  imageUrl: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '显示顺序', example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['categoryId'] as const)
) {
  @ApiPropertyOptional({ description: '分类ID，传null表示解除分类' })
  @IsOptional()
  categoryId?: string | null;
}

export class ToggleServiceStatusDto {
  @ApiProperty({ description: '是否启用', example: true })
  @IsBoolean()
  isActive: boolean;
}
