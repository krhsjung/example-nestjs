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
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * 인증 관련 비즈니스 로직을 처리하는 서비스
 *
 * 주요 기능:
 * - 이메일/비밀번호 로그인
 * - OAuth 로그인 (Google, Apple)
 * - Apple 네이티브 SDK 로그인 (iOS/Android)
 * - 세션 관리 (생성, 로그아웃)
 * - Apple Server-to-Server Notifications 처리
 *
 * 의존성:
 * - UserRepository: 사용자 정보 저장/조회
 * - TokenService: JWT 토큰 생성/검증
 * - TokenSessionService: 세션 관리 (Redis)
 * - GoogleOAuthClient: Google OAuth 처리
 * - AppleOAuthClient: Apple OAuth 처리
 */
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
   * 이메일/비밀번호 로그인 처리
   *
   * @param loginDto - 로그인 정보 (email, password)
   * @returns 토큰 쌍 (accessToken, refreshToken)
   * @throws NotFoundException - 이메일/비밀번호가 일치하지 않는 경우
   */
  async handleLogin(loginDto: LoginDto): Promise<TokenPair> {
    const { email, password } = loginDto;

    this.logger.log(`[handleLogin] Login for email: ${email}`);

    const user = await this.userRepository.findOne({
      where: { email, password },
    });

    if (!user || user.password !== password) {
      throwException(NotFoundException, AUTH_EXCEPTIONS.CREDENTIALS_INVALID);
    }

    const userDto: UserDto = user.toDto();
    const tokens = await this.tokenSessionService.createSession(userDto);

    this.logger.log(`[handleLogin] Login successful for user: ${user.email}`);

    return tokens;
  }

  /**
   * 특정 세션 로그아웃
   * Redis에서 해당 세션의 Refresh Token을 삭제하여 세션 무효화
   *
   * @param userId - 사용자 ID
   * @param sessionId - 로그아웃할 세션 ID
   */
  async handleLogout(userId: string, sessionId: string): Promise<void> {
    this.logger.log(
      `[handleLogout] Logout for userId: ${userId}, session: ${sessionId}`
    );

    await this.tokenSessionService.removeSession(userId, sessionId);
  }

  /**
   * 모든 세션 로그아웃
   * 사용자의 모든 기기에서 로그아웃 처리
   *
   * @param userId - 사용자 ID
   */
  async handleLogoutAll(userId: string): Promise<void> {
    this.logger.log(
      `[handleLogoutAll] Logout all sessions for userId: ${userId}`
    );

    await this.tokenSessionService.removeAllSessions(userId);
  }

  /**
   * OAuth 인증 URL 생성
   * 사용자를 OAuth 제공자의 로그인 페이지로 리다이렉트하기 위한 URL 생성
   *
   * @param provider - OAuth 제공자 (google, apple)
   * @param flow - 인증 플로우 타입 (redirect, popup, ios, android)
   * @param origin - 인증 완료 후 리다이렉트할 URL
   * @param prompt - Google OAuth 전용: 동의 화면 표시 옵션
   * @returns OAuth 인증 URL
   * @throws NotFoundException - 지원하지 않는 provider인 경우
   */
  getAuthUrl(
    provider: AuthProvider,
    flow: AuthFlow,
    origin?: string,
    prompt?: string
  ): string {
    this.logger.log(
      `[getAuthUrl][${provider}]: flow: ${flow}, origin: ${origin}`
    );

    const state = JSON.stringify({ flow, origin });
    const urlGenerators: { [key in AuthProvider]?: () => string } = {
      [AuthProvider.GOOGLE]: () =>
        this.googleOAuthClient.generateAuthUrl(state, OAuthMethod.DIRECT, prompt),
      [AuthProvider.APPLE]: () =>
        this.appleOAuthClient.generateAuthUrl(state),
    };

    const generator = urlGenerators[provider];
    if (!generator) {
      throwException(NotFoundException, AUTH_EXCEPTIONS.PROVIDER_UNSUPPORTED);
    }

    return generator();
  }

  /**
   * OAuth provider에서 사용자 정보 조회
   *
   * @param provider - OAuth provider (google, apple)
   * @param code - authorization code
   * @param appleUserData - Apple 웹 OAuth 최초 로그인 시 전달되는 사용자 정보 (JSON string)
   */
  async getUserFromOAuthProvider(
    provider: AuthProvider,
    code: string,
    appleUserData?: string
  ): Promise<UserDto> {
    this.logger.log(`[getUserFromOAuthProvider] Fetching user info from ${provider}`);

    const handlers: { [key in AuthProvider]?: () => Promise<UserDto> } = {
      [AuthProvider.GOOGLE]: () => this.handleGoogleCallback(code),
      [AuthProvider.APPLE]: () => this.handleAppleCallback(code, appleUserData),
    };

    const handler = handlers[provider];
    if (!handler) {
      throwException(NotFoundException, AUTH_EXCEPTIONS.PROVIDER_UNSUPPORTED);
    }

    return handler();
  }

  /**
   * Google OAuth 콜백 처리
   * Authorization code로 토큰을 교환하고 사용자 정보를 조회/저장
   *
   * @param code - Google에서 발급한 authorization code
   * @returns 저장된 사용자 정보
   */
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

  /**
   * Apple 웹 OAuth 콜백 처리
   * Authorization code로 토큰을 교환하고 사용자 정보를 조회/저장
   *
   * Apple 특이사항:
   * - 최초 로그인 시에만 appleUserData에 이름/이메일 정보가 포함됨
   * - 이후 로그인에서는 JWT의 sub(사용자 ID)만 제공됨
   * - 따라서 최초 로그인 시 정보를 반드시 저장해야 함
   *
   * @param code - Apple에서 발급한 authorization code
   * @param appleUserData - 최초 로그인 시 전달되는 사용자 정보 (JSON string)
   *   예: '{"name":{"firstName":"길동","lastName":"홍"},"email":"user@example.com"}'
   * @returns 저장된 사용자 정보
   */
  private async handleAppleCallback(
    code: string,
    appleUserData?: string
  ): Promise<UserDto> {
    const token = await this.appleOAuthClient.getToken(code);

    const userInfo: AppleUserInformation =
      await this.appleOAuthClient.getUserInfo(token.id_token);
    this.logger.log(JSON.stringify(userInfo));

    const { fullName, email: additionalEmail } =
      this.parseAppleUserData(appleUserData);

    const mergedUserInfo: AppleUserInformation = {
      ...userInfo,
      email: userInfo.email || additionalEmail,
    };

    return this.saveAppleUser(mergedUserInfo, fullName);
  }

  /**
   * Apple 웹 OAuth에서 전달된 사용자 데이터 파싱
   *
   * @param appleUserData - Apple에서 전달한 JSON 문자열
   * @returns 파싱된 fullName과 email
   */
  private parseAppleUserData(appleUserData?: string): {
    fullName?: { givenName?: string; familyName?: string };
    email?: string;
  } {
    if (!appleUserData) {
      return {};
    }

    try {
      const parsed = JSON.parse(appleUserData) as {
        name?: { firstName?: string; lastName?: string };
        email?: string;
      };

      return {
        fullName: parsed.name
          ? {
              givenName: parsed.name.firstName,
              familyName: parsed.name.lastName,
            }
          : undefined,
        email: parsed.email,
      };
    } catch {
      this.logger.warn(`Failed to parse Apple user data: ${appleUserData}`);
      return {};
    }
  }

  /**
   * Apple 네이티브 SDK 로그인 처리 (iOS/Android)
   *
   * 웹 OAuth와 달리 네이티브 SDK는 identityToken(JWT)을 직접 발급하므로
   * authorization code 교환 과정 없이 바로 JWT를 검증합니다.
   *
   * 처리 흐름:
   * 1. Apple 공개키로 identityToken 서명 검증
   * 2. JWT에서 사용자 정보 추출 (sub, email 등)
   * 3. 클라이언트에서 전달한 정보와 병합 (최초 로그인 시에만 email/fullName 제공)
   * 4. 사용자 저장/업데이트
   * 5. 세션 생성 및 토큰 발급
   *
   * @param identityToken - Apple SDK에서 발급한 JWT (RS256 서명)
   * @param credential - Apple SDK에서 제공한 사용자 정보
   *   - user: Apple 사용자 ID (JWT의 sub와 동일)
   *   - email: 사용자 이메일 (최초 로그인 시에만 제공)
   *   - fullName: 사용자 이름 (최초 로그인 시에만 제공)
   * @returns 토큰 쌍 (accessToken, refreshToken)
   */
  async handleAppleNativeLogin(
    identityToken: string,
    credential: {
      user: string;
      email?: string;
      fullName?: { givenName?: string; familyName?: string };
    }
  ): Promise<TokenPair> {
    this.logger.log(
      '[handleAppleNativeLogin] Verifying Apple identity token from native SDK'
    );

    const userInfo: AppleUserInformation =
      await this.appleOAuthClient.verifyIdentityToken(identityToken);

    this.logger.log(`[handleAppleNativeLogin] Token verified for user: ${userInfo.sub}`);

    const mergedUserInfo: AppleUserInformation = {
      ...userInfo,
      email: userInfo.email || credential.email,
    };

    const user = await this.saveAppleUser(mergedUserInfo, credential.fullName);

    const tokens = await this.tokenSessionService.createSession(user);

    this.logger.log(
      `[handleAppleNativeLogin] Native login successful for user: ${user.email}`
    );

    return tokens;
  }

  /**
   * Apple 사용자 정보 저장/업데이트
   *
   * Apple은 최초 로그인 시에만 이메일과 이름을 제공하므로,
   * 기존 사용자의 정보는 보존하고 새로운 정보만 업데이트합니다.
   *
   * 처리 로직:
   * 1. 기존 사용자 조회 (sub로 식별)
   * 2. 기존 사용자인 경우: 새로 제공된 정보만 업데이트
   * 3. 신규 사용자인 경우: 새 사용자 생성 (email 필수)
   *
   * 이름 생성 규칙:
   * - fullName이 있으면: "givenName familyName" (예: "길동 홍")
   * - fullName이 없으면: 이메일의 @ 앞부분 (예: "user")
   *
   * @param userInfo - JWT에서 추출한 사용자 정보
   * @param fullName - 사용자 이름 (최초 로그인 시에만 제공)
   * @returns 저장된 사용자 정보
   * @throws Error - 신규 사용자인데 email이 없는 경우
   */
  private async saveAppleUser(
    userInfo: AppleUserInformation,
    fullName?: { givenName?: string; familyName?: string }
  ): Promise<UserDto> {
    const provider: AuthProvider = AuthProvider.APPLE;
    const id = userInfo.sub;

    const existingUser = await this.userRepository.findOne({ where: { id } });

    if (existingUser) {
      let updated = false;

      if (userInfo.email && existingUser.email !== userInfo.email) {
        existingUser.email = userInfo.email;
        updated = true;
      }

      if (fullName?.givenName || fullName?.familyName) {
        const newName = this.buildAppleName(fullName, userInfo.email);
        if (newName && existingUser.name !== newName) {
          existingUser.name = newName;
          updated = true;
        }
      }

      if (updated) {
        await this.userRepository.save(existingUser);
      }

      return existingUser.toDto();
    }

    if (!userInfo.email) {
      throwException(BadRequestException, AUTH_EXCEPTIONS.APPLE_EMAIL_REQUIRED);
    }

    const newUser = this.userRepository.create({
      id,
      email: userInfo.email,
      name: this.buildAppleName(fullName, userInfo.email),
      picture: null,
      provider,
    });

    await this.userRepository.save(newUser);

    return newUser.toDto();
  }

  /**
   * Apple 사용자 이름 생성
   *
   * @param fullName - Apple에서 제공한 이름 정보
   * @param email - 사용자 이메일 (fallback용)
   * @returns 생성된 이름 (fullName이 있으면 "givenName familyName", 없으면 이메일 앞부분)
   */
  private buildAppleName(
    fullName?: { givenName?: string; familyName?: string },
    email?: string
  ): string {
    if (fullName?.givenName || fullName?.familyName) {
      return [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
    }
    return email?.split('@')[0] || '';
  }

  /**
   * Access Token에서 사용자 정보 추출
   * JWT payload를 디코딩하여 UserDto 형태로 반환
   *
   * @param accessToken - JWT access token
   * @returns 토큰에 포함된 사용자 정보
   */
  getUserFromToken(accessToken: string): UserDto {
    const payload = this.tokenService.verifyAccessToken(accessToken);
    return this.tokenService.payloadToUser(payload);
  }

  /**
   * Access Token에서 세션 ID 추출
   * JWT의 jti(JWT ID) 클레임에서 세션 식별자를 가져옴
   *
   * @param accessToken - JWT access token
   * @returns 세션 ID (jti 클레임 값)
   */
  getSessionIdFromToken(accessToken: string): string {
    const payload = this.tokenService.verifyAccessToken(accessToken);
    return payload.jti || '';
  }

  /**
   * 사용자를 위한 세션 생성
   * 새로운 accessToken/refreshToken 쌍을 생성하고 Redis에 저장
   *
   * @param user - 세션을 생성할 사용자 정보
   * @returns 토큰 쌍 (accessToken, refreshToken)
   */
  async createSessionForUser(user: UserDto): Promise<TokenPair> {
    return this.tokenSessionService.createSession(user);
  }

  /**
   * 모바일 OAuth용 일회용 인증 코드 생성
   *
   * 모바일 앱에서는 쿠키 대신 이 코드를 받아 /auth/exchange로 토큰 교환
   * 코드는 짧은 TTL을 가지며 한 번만 사용 가능
   *
   * @param user - 인증 코드를 생성할 사용자 정보
   * @returns 일회용 인증 코드
   */
  async createAuthCode(user: UserDto): Promise<string> {
    return this.tokenSessionService.createAuthCode(user);
  }

  /**
   * 인증 코드로 토큰 교환
   * 모바일 앱에서 받은 일회용 코드를 accessToken/refreshToken으로 교환
   *
   * @param code - 일회용 인증 코드
   * @returns 토큰 쌍 (accessToken, refreshToken)
   * @throws UnauthorizedException - 유효하지 않거나 만료된 코드인 경우
   */
  async exchangeAuthCode(code: string): Promise<TokenPair> {
    const tokens = await this.tokenSessionService.exchangeAuthCode(code);
    if (!tokens) {
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.AUTH_CODE_INVALID);
    }
    return tokens;
  }

  /**
   * Apple Server-to-Server Notification 웹훅 처리
   *
   * Apple에서 계정 관련 이벤트 발생 시 서버로 알림을 보냄
   * Apple Developer Console에서 웹훅 URL 등록 필요
   *
   * 처리하는 이벤트:
   * - consent-revoked: 사용자가 앱 연결 해제 → 모든 세션 로그아웃
   * - account-delete: 사용자가 Apple ID 삭제 → 모든 세션 로그아웃
   * - email-disabled: 이메일 릴레이 비활성화 → 로깅만 수행
   * - email-enabled: 이메일 릴레이 활성화 → 로깅만 수행
   *
   * @param signedPayload - Apple이 서명한 JWT 페이로드
   */
  async handleAppleWebhook(signedPayload: string): Promise<void> {
    const events: AppleNotificationEvents =
      await this.appleOAuthClient.verifyWebhookPayload(signedPayload);

    this.logger.log(
      `[handleAppleWebhook] Received Apple webhook: ${events.type} for user: ${events.sub}`
    );

    switch (events.type) {
      case 'consent-revoked':
        await this.revokeAppleUserSessions(events.sub, 'User revoked consent');
        break;

      case 'account-delete':
        await this.revokeAppleUserSessions(events.sub, 'User deleted Apple ID');
        break;

      case 'email-disabled':
        this.logger.log(
          `[handleAppleWebhook] Email relay disabled for user: ${events.sub}`
        );
        break;

      case 'email-enabled':
        this.logger.log(
          `[handleAppleWebhook] Email relay enabled for user: ${events.sub}`
        );
        break;

      default:
        this.logger.warn(`[handleAppleWebhook] Unknown event type: ${events.type}`);
    }
  }

  /**
   * Apple 사용자 세션 무효화 (consent-revoked, account-delete 공통 처리)
   *
   * @param userId - Apple 사용자 ID (sub)
   * @param reason - 세션 무효화 사유 (로깅용)
   */
  private async revokeAppleUserSessions(
    userId: string,
    reason: string
  ): Promise<void> {
    this.logger.log(`[revokeAppleUserSessions] ${reason}: ${userId}`);

    await this.tokenSessionService.removeAllSessions(userId);
  }
}
