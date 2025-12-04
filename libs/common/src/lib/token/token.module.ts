import { Global, Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { TokenSessionService } from './token-session.service';
import { JwtTokenService } from '@example/utils';
import { ExampleConfigModule, ExampleConfigService } from '../config';
import { JwtPayload } from './types/jwt-payload.types';

/**
 * 토큰 관리 모듈
 *
 * 도메인 토큰 서비스 및 세션 관리 서비스를 제공합니다.
 * Global 모듈로 설정되어 다른 모듈에서 import 없이 사용 가능합니다.
 */
@Global()
@Module({
  imports: [ExampleConfigModule],
  providers: [
    {
      provide: JwtTokenService,
      useFactory: (configService: ExampleConfigService) => {
        return new JwtTokenService<JwtPayload>({
          accessTokenSecret: configService.jwtSecret,
          accessTokenExpiresIn: configService.jwtAccessTokenExpiresIn,
          refreshTokenSecret: configService.jwtRefreshSecret,
          refreshTokenExpiresIn: configService.jwtRefreshTokenExpiresIn,
        });
      },
      inject: [ExampleConfigService],
    },
    TokenService,
    TokenSessionService,
  ],
  exports: [TokenService, TokenSessionService],
})
export class TokenModule {}
