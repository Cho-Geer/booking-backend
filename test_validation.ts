import { validate } from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';
import { IsOptional, IsString, IsEmail } from 'class-validator';

class TestDto {
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;
}

class TestDtoWithTransform {
  @Transform(({ value }) => value === "" ? null : value)
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;
}

async function test() {
  console.log('--- Testing original DTO with empty string ---');
  const dto1 = plainToInstance(TestDto, { email: '' });
  const errors1 = await validate(dto1);
  if (errors1.length > 0) {
    console.log('Validation failed:', errors1[0].constraints);
  } else {
    console.log('Validation passed');
  }

  console.log('--- Testing Transform DTO with empty string ---');
  const dto2 = plainToInstance(TestDtoWithTransform, { email: '' });
  const errors2 = await validate(dto2);
  if (errors2.length > 0) {
    console.log('Validation failed:', errors2[0].constraints);
  } else {
    console.log('Validation passed');
    console.log('Transformed value:', dto2.email);
  }
}

test();
