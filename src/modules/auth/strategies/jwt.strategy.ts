import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET configuration is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    // 返回用户对象，request.user 将包含这些字段
    const role = payload.role ?? payload.userType;
    const userType = payload.userType ?? role;
    return {
      id: payload.sub,
      sub: payload.sub,
      phoneHash: payload.phoneHash,
      userType,
      role,
      permissions: payload.permissions,
    };
  }
}
