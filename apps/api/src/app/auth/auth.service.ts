import {
  User,
  UserDto,
  LoginDto,
  ExampleConfigService,
  AUTH_EXCEPTIONS,
  throwException,
  TokenService,
  TokenSessionService,
} from '@example/common';
import { TokenPair } from '@example/utils';
import {
  AppleOAuthClient,
  AppleUserInformation,
  AppleNotificationEvents,
  AuthFlow,
  AuthProvider,
  GoogleOAuthClient,
  GoogleUserInformation,
  OAuthMethod,
} from '@example/utils';
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name, { timestamp: true });
  private googleOAuthClient: GoogleOAuthClient;
  private appleOAuthClient: AppleOAuthClient;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    private readonly configService: ExampleConfigService,
    private readonly tokenService: TokenService,
    private readonly tokenSessionService: TokenSessionService
  ) {
    this.googleOAuthClient = new GoogleOAuthClient(
      httpService,
      configService.googleClientOptions
    );

    this.appleOAuthClient = new AppleOAuthClient(
      httpService,
      configService.appleClientOptions
    );
  }

  /**
   * /me 엔드포인트는 JwtAuthGuard에서 이미 user를 검증하므로
   * Controller에서 @CurrentUser()로 직접 user를 반환하면 됨
   * 이 메서드는 제거 가능
   */

  async handleLogin(loginDto: LoginDto): Promise<TokenPair> {
    const methodName = 'handleLogin';
    const { email, password } = loginDto;

    this.logger.log(`[${methodName}] Login for email: ${email}`);

    const user = await this.userRepository.findOne({
      where: { email, password },
    });

    if (!user || user.password !== password) {
      throwException(NotFoundException, AUTH_EXCEPTIONS.CREDENTIALS_INVALID);
    }

    const userDto: UserDto = user.toDto();

    // JWT 토큰 생성 및 Refresh Token을 Redis에 저장
    const tokens = await this.tokenSessionService.createSession(userDto);

    this.logger.log(`[${methodName}] Login successful for user: ${user.email}`);

    return tokens;
  }

  async handleLogout(userId: string, sessionId: string): Promise<void> {
    const methodName = 'handleLogout';

    this.logger.log(
      `[${methodName}] Logout for userId: ${userId}, session: ${sessionId}`
    );

    // Redis에서 특정 세션의 Refresh Token 삭제
    await this.tokenSessionService.removeSession(userId, sessionId);
  }

  async handleLogoutAll(userId: string): Promise<void> {
    const methodName = 'handleLogoutAll';

    this.logger.log(
      `[${methodName}] Logout all sessions for userId: ${userId}`
    );

    // Redis에서 모든 Refresh Token 삭제
    await this.tokenSessionService.removeAllSessions(userId);
  }

  getAuthUrl(
    provider: AuthProvider,
    flow: AuthFlow,
    origin?: string,
    prompt?: string
  ): string {
    const methodName = 'getAuthUrl';

    this.logger.log(
      `[${methodName}][${provider}]: type to ${provider}, flow: ${flow}, origin: ${origin}`
    );

    if (provider === AuthProvider.GOOGLE) {
      return this.googleOAuthClient.generateAuthUrl(
        JSON.stringify({ flow, origin }),
        OAuthMethod.DIRECT,
        prompt
      );
    } else if (provider === AuthProvider.APPLE) {
      return this.appleOAuthClient.generateAuthUrl(
        JSON.stringify({ flow, origin })
      );
    }
    throwException(NotFoundException, AUTH_EXCEPTIONS.PROVIDER_UNSUPPORTED);
  }

  /**
   * OAuth provider에서 사용자 정보 조회
   */
  async getUserFromOAuthProvider(
    provider: AuthProvider,
    code: string
  ): Promise<UserDto> {
    const methodName = 'getUserFromOAuthProvider';

    this.logger.log(`[${methodName}] Fetching user info from ${provider}`);

    const handlers = {
      [AuthProvider.GOOGLE]: () => this.handleGoogleCallback(code),
      [AuthProvider.APPLE]: () => this.handleAppleCallback(code),
    };

    const handler = handlers[provider];
    if (!handler) {
      throwException(NotFoundException, AUTH_EXCEPTIONS.PROVIDER_UNSUPPORTED);
    }

    return handler();
  }

  private async handleGoogleCallback(code: string): Promise<UserDto> {
    const token = await this.googleOAuthClient.getToken(
      code,
      OAuthMethod.DIRECT
    );

    const userInfo: GoogleUserInformation =
      await this.googleOAuthClient.getUserInfo(token.access_token);

    const provider: AuthProvider = AuthProvider.GOOGLE;
    const { id, email, name, picture } = userInfo;

    const existingUser = await this.userRepository.findOne({ where: { id } });

    const user = Object.assign(existingUser ?? new User(), {
      id,
      email,
      name,
      picture,
      provider,
    });

    await this.userRepository.save(user);

    return user.toDto();
  }

  private async handleAppleCallback(code: string): Promise<UserDto> {
    const token = await this.appleOAuthClient.getToken(code);

    const userInfo: AppleUserInformation =
      await this.appleOAuthClient.getUserInfo(token.id_token);
    this.logger.log(JSON.stringify(userInfo));

    const provider: AuthProvider = AuthProvider.APPLE;
    const id = userInfo.sub;
    const email = userInfo.email || '';
    const name = userInfo.email?.split('@')[0] || '';
    const picture = null;

    // 사용자 정보 저장 (없으면 생성, 있으면 업데이트)
    await this.userRepository.save({ id, email, name, picture, provider });

    // 저장된 사용자 정보 조회 (maxSessions 포함)
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('Failed to save user');
    }

    return user.toDto();
  }

  /**
   * Access Token에서 사용자 정보 추출
   */
  getUserFromToken(accessToken: string): UserDto {
    const payload = this.tokenService.verifyAccessToken(accessToken);
    return this.tokenService.payloadToUser(payload);
  }

  /**
   * Access Token에서 세션 ID 추출
   */
  getSessionIdFromToken(accessToken: string): string {
    const payload = this.tokenService.verifyAccessToken(accessToken);
    return payload.jti || '';
  }

  /**
   * 사용자를 위한 세션 생성
   */
  async createSessionForUser(user: UserDto): Promise<TokenPair> {
    return this.tokenSessionService.createSession(user);
  }

  /**
   * 모바일 OAuth용 일회용 인증 코드 생성
   */
  async createAuthCode(user: UserDto): Promise<string> {
    return this.tokenSessionService.createAuthCode(user);
  }

  /**
   * 인증 코드로 토큰 교환
   */
  async exchangeAuthCode(code: string): Promise<TokenPair> {
    const tokens = await this.tokenSessionService.exchangeAuthCode(code);
    if (!tokens) {
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.AUTH_CODE_INVALID);
    }
    return tokens;
  }
}
