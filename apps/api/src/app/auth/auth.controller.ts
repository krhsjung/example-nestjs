import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  Query,
  Post,
  Body,
  Logger,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ExampleConfigService,
  UserDto,
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  JwtAuthGuard,
  CurrentUser,
} from '@example/common';
import { AuthCallback, AuthFlow, AuthProvider } from '@example/utils';

const CONTROLLER_PREFIX = 'auth';
const DEFAULT_AUTH_FLOW = AuthFlow.REDIRECT;
type RedirectResponse = 'done' | 'error';

/**
 * 인증 관련 API를 처리하는 컨트롤러
 *
 * 지원하는 인증 방식:
 * - 이메일/비밀번호 로그인
 * - OAuth 로그인 (Google, Apple)
 * - Apple 네이티브 SDK 로그인 (iOS/Android)
 *
 * 토큰 관리:
 * - JWT 기반 인증 (accessToken, refreshToken)
 * - HttpOnly 쿠키를 통한 토큰 저장
 * - 다중 세션 지원 및 개별/전체 로그아웃
 */
@Controller(CONTROLLER_PREFIX)
export class AuthController {
  private logger = new Logger(AuthController.name, { timestamp: true });

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ExampleConfigService
  ) {}

  /**
   * 현재 로그인된 사용자 정보 조회
   * @returns 현재 사용자 정보
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: UserDto): Promise<UserDto> {
    return user;
  }

  /**
   * 이메일/비밀번호 회원가입
   * 가입 후 자동 로그인 (세션 생성 + 토큰 발급)
   * @param registerDto - 회원가입 정보 (name, email, password)
   * @returns 사용자 정보 (토큰은 쿠키로 설정)
   */
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 3, ttl: 60000 },
    long: { limit: 10, ttl: 3600000 },
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserDto> {
    const tokens = await this.authService.handleRegister(registerDto);
    return this.setTokensAndReturnUser(response, tokens);
  }

  /**
   * 이메일/비밀번호 회원가입 (모바일)
   * 가입 후 자동 로그인, 토큰을 응답 body로 반환
   * @param registerDto - 회원가입 정보 (name, email, password)
   * @returns 토큰 + 사용자 정보
   */
  @Post('register/mobile')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 3, ttl: 60000 },
    long: { limit: 10, ttl: 3600000 },
  })
  async registerMobile(
    @Body() registerDto: RegisterDto
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.handleRegister(registerDto);
    const user = this.authService.getUserFromToken(tokens.accessToken);
    return { ...tokens, user };
  }

  /**
   * 이메일/비밀번호 로그인
   * @param loginDto - 로그인 정보 (email, password)
   * @returns 사용자 정보 (토큰은 쿠키로 설정)
   */
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 5, ttl: 60000 },
    long: { limit: 20, ttl: 3600000 },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserDto> {
    this.logger.log(
      `[login] starting login process for email: ${loginDto.email}`
    );

    const tokens = await this.authService.handleLogin(loginDto);
    return this.setTokensAndReturnUser(response, tokens);
  }

  /**
   * 이메일/비밀번호 로그인 (모바일)
   * 토큰을 응답 body로 반환
   * @param loginDto - 로그인 정보 (email, password)
   * @returns 토큰 + 사용자 정보
   */
  @Post('login/mobile')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 5, ttl: 60000 },
    long: { limit: 20, ttl: 3600000 },
  })
  async loginMobile(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    const tokens = await this.authService.handleLogin(loginDto);
    const user = this.authService.getUserFromToken(tokens.accessToken);
    return { ...tokens, user };
  }

  /**
   * 모바일 OAuth용 인증 코드 교환
   * 일회용 authCode로 토큰 발급, 토큰을 응답 body로 반환
   * @param code - 일회용 인증 코드
   * @returns 토큰 + 사용자 정보
   */
  @Post('exchange')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 5, ttl: 60000 },
    long: { limit: 30, ttl: 3600000 },
  })
  async exchange(@Body('code') code: string): Promise<AuthResponseDto> {
    const tokens = await this.authService.exchangeAuthCode(code);
    const user = this.authService.getUserFromToken(tokens.accessToken);
    return { ...tokens, user };
  }

  /**
   * 모바일 토큰 갱신
   * Refresh Token으로 새 토큰 쌍 발급 (Refresh Token Rotation)
   * @param refreshToken - 현재 보유한 Refresh Token
   * @returns 새로운 토큰 + 사용자 정보
   */
  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 10, ttl: 60000 },
    long: { limit: 60, ttl: 3600000 },
  })
  async refresh(
    @Body('refreshToken') refreshToken: string
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.refreshTokens(refreshToken);
    const user = this.authService.getUserFromToken(tokens.accessToken);
    return { ...tokens, user };
  }

  /**
   * 현재 세션 로그아웃
   * Access Token에서 세션 ID를 추출하여 해당 세션만 종료
   */
  @HttpCode(204)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: UserDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    const accessToken = this.extractAccessToken(request);

    if (accessToken) {
      const sessionId = this.authService.getSessionIdFromToken(accessToken);
      if (sessionId) {
        await this.authService.handleLogout(user.idx, sessionId);
      }
    }

    this.clearTokenCookies(response);
  }

  /**
   * 특정 세션 로그아웃
   * 다른 기기에서 로그인된 세션을 원격으로 종료할 때 사용
   * @param sessionId - 로그아웃할 세션 ID
   */
  @HttpCode(204)
  @Post('logout/:sessionId')
  @UseGuards(JwtAuthGuard)
  async logoutSession(
    @CurrentUser() user: UserDto,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    await this.authService.handleLogout(user.idx, sessionId);

    // 로그아웃한 세션이 현재 세션인 경우에만 쿠키 삭제
    const accessToken = this.extractAccessToken(request);
    if (accessToken) {
      const currentSessionId =
        this.authService.getSessionIdFromToken(accessToken);
      if (currentSessionId === sessionId) {
        this.clearTokenCookies(response);
      }
    }
  }

  /**
   * 모든 세션 로그아웃
   * 모든 기기에서 로그아웃 처리
   */
  @HttpCode(204)
  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: UserDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    await this.authService.handleLogoutAll(user.idx);

    this.clearTokenCookies(response);
  }

  /**
   * OAuth 로그인 URL로 리다이렉트
   * @param provider - OAuth 제공자 (google, apple)
   * @param flow - 인증 플로우 타입 (redirect, popup, ios, android)
   * @param origin - 인증 완료 후 리다이렉트할 URL
   * @param prompt - Google OAuth 전용: 동의 화면 표시 옵션 (consent, select_account 등)
   */
  @Get(':provider')
  async authUrl(
    @Res() response: Response,
    @Param('provider') provider: AuthProvider,
    @Query('flow') flow: AuthFlow = DEFAULT_AUTH_FLOW,
    @Query('origin') origin?: string,
    @Query('prompt') prompt?: string
  ): Promise<void> {
    response.redirect(
      this.authService.getAuthUrl(provider, flow, origin, prompt)
    );
  }

  /**
   * Apple 네이티브 SDK 로그인 (iOS/Android)
   * 클라이언트에서 Apple SDK로 받은 identityToken을 검증하고 로그인 처리
   * @param identityToken - Apple SDK에서 발급한 JWT
   * @param user - Apple 사용자 ID
   * @param email - 사용자 이메일 (최초 로그인 시에만 제공)
   * @param fullName - 사용자 이름 (최초 로그인 시에만 제공)
   * @returns 토큰 + 사용자 정보
   */
  @Post('apple/native')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    short: { limit: 5, ttl: 60000 },
    long: { limit: 20, ttl: 3600000 },
  })
  async appleNativeLogin(
    @Body('identityToken') identityToken: string,
    @Body('user') user: string,
    @Body('email') email?: string,
    @Body('fullName') fullName?: { givenName?: string; familyName?: string }
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.handleAppleNativeLogin(
      identityToken,
      { user, email, fullName }
    );
    const userDto = this.authService.getUserFromToken(tokens.accessToken);
    return { ...tokens, user: userDto };
  }

  /**
   * Google OAuth 콜백 처리
   * Google에서 authorization code를 받아 토큰 교환 및 사용자 정보 조회
   */
  @Get('google/callback')
  async authGoogleCallback(
    @Query() query: AuthCallback,
    @Res() response: Response
  ): Promise<void> {
    this.logger.debug(
      `[authGoogleCallback] callback data: ${JSON.stringify(query)}`
    );

    if (query.error) {
      return this.sendResponse(response, query.state, 'error', query.error);
    }

    await this.handleAuthCallback(
      response,
      AuthProvider.GOOGLE,
      query.code,
      query.state
    );
  }

  /**
   * Apple OAuth 콜백 처리 (웹 플로우)
   * Apple에서 form_post 방식으로 authorization code를 받음
   * 최초 로그인 시 body.user에 사용자 이름/이메일 정보 포함
   */
  @Post('apple/callback')
  async authAppleCallback(
    @Body() body: AuthCallback,
    @Res() response: Response
  ): Promise<void> {
    this.logger.debug(
      `[authAppleCallback] callback data: ${JSON.stringify(body)}`
    );

    if (body.error) {
      return this.sendResponse(response, body.state, 'error', body.error);
    }

    await this.handleAuthCallback(
      response,
      AuthProvider.APPLE,
      body.code,
      body.state,
      body.user
    );
  }

  /**
   * OAuth state 파라미터 파싱
   * @param state - JSON 문자열로 인코딩된 state (flow, origin 포함)
   */
  private parseState(state: string | undefined): {
    flow: AuthFlow;
    origin: string | null;
  } {
    return state
      ? (JSON.parse(state) as { flow: AuthFlow; origin: string })
      : { flow: DEFAULT_AUTH_FLOW as AuthFlow, origin: null };
  }

  /**
   * 리다이렉트 대상 URL 결정
   * @param origin - 클라이언트가 지정한 리다이렉트 URL
   * @param defaultPath - origin이 없을 때 사용할 기본 경로
   */
  private getTargetOrigin(origin: string | null, defaultPath: string): string {
    return origin || this.configService.globalPrefix + defaultPath;
  }

  /**
   * OAuth 결과 응답 전송
   * flow 타입에 따라 다른 방식으로 응답:
   * - IOS/ANDROID: 앱 딥링크로 리다이렉트
   * - POPUP: postMessage로 부모 창에 결과 전달
   * - REDIRECT: 지정된 URL로 리다이렉트
   */
  private sendResponse(
    response: Response,
    state: string | undefined,
    type: RedirectResponse,
    data?: UserDto | string,
    authCode?: string
  ): void {
    const { flow, origin } = this.parseState(state);
    const isDone = type === 'done';
    const targetOrigin = this.getTargetOrigin(
      origin,
      isDone ? '/auth/success' : '/auth/error'
    );

    if (flow === AuthFlow.IOS || flow === AuthFlow.ANDROID) {
      response
        .type('html')
        .send(this.mobileRedirectHtml(isDone, authCode, data));
    } else if (flow === AuthFlow.POPUP) {
      const payload = {
        type: `oauth:${type}`,
        ok: isDone,
        ...(isDone ? { user: data } : { message: data }),
      };
      const nonce = randomBytes(16).toString('base64');
      response
        .setHeader(
          'Content-Security-Policy',
          `script-src 'nonce-${nonce}';`
        )
        .type('html')
        .send(this.popupRedirectHtml(targetOrigin, payload, nonce));
    } else {
      response.redirect(targetOrigin);
    }
  }

  /**
   * HttpOnly 쿠키에 토큰 저장 후 사용자 정보 반환
   */
  private setTokensAndReturnUser(
    response: Response,
    tokens: { accessToken: string; refreshToken: string }
  ): UserDto {
    this.setTokenCookies(response, tokens);
    return this.authService.getUserFromToken(tokens.accessToken);
  }

  /**
   * HttpOnly 쿠키에 토큰 저장
   * XSS 공격 방지를 위해 HttpOnly 플래그 사용
   */
  private setTokenCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string }
  ): void {
    response.cookie(
      'accessToken',
      tokens.accessToken,
      this.configService.accessTokenCookieOptions
    );
    response.cookie(
      'refreshToken',
      tokens.refreshToken,
      this.configService.refreshTokenCookieOptions
    );
  }

  /**
   * Authorization 헤더 또는 쿠키에서 Access Token 추출
   */
  private extractAccessToken(request: Request): string | null {
    const bearer = request.headers.authorization;
    if (bearer?.startsWith('Bearer ')) {
      return bearer.slice(7);
    }
    return request.cookies?.accessToken ?? null;
  }

  /**
   * 인증 쿠키 삭제
   * 로그아웃 시 호출하여 클라이언트의 토큰 제거
   */
  private clearTokenCookies(response: Response): void {
    response.clearCookie(
      'accessToken',
      this.configService.accessTokenCookieOptions
    );
    response.clearCookie(
      'refreshToken',
      this.configService.refreshTokenCookieOptions
    );
  }

  /**
   * OAuth 콜백 공통 처리
   * 1. OAuth provider에서 사용자 정보 조회
   * 2. 모바일: authCode 생성하여 앱으로 전달
   * 3. 웹: 세션 생성 후 쿠키에 토큰 저장
   *
   * @param provider - OAuth 제공자
   * @param code - authorization code
   * @param state - 상태 정보 (flow, origin)
   * @param appleUserData - Apple 최초 로그인 시 사용자 정보 (JSON string)
   */
  private async handleAuthCallback(
    response: Response,
    provider: AuthProvider,
    code: string,
    state: string | undefined,
    appleUserData?: string
  ) {
    const { flow } = this.parseState(state);
    const isMobileFlow = flow === AuthFlow.IOS || flow === AuthFlow.ANDROID;

    try {
      // 공통: OAuth provider에서 사용자 정보 조회
      const user = await this.authService.getUserFromOAuthProvider(
        provider,
        code,
        appleUserData
      );

      if (isMobileFlow) {
        // 모바일: authCode 생성하여 전달 (세션은 exchange 시점에 생성)
        const authCode = await this.authService.createAuthCode(user);
        this.sendResponse(response, state, 'done', undefined, authCode);
      } else {
        // 웹: 세션 생성 후 쿠키에 토큰 저장
        const tokens = await this.authService.createSessionForUser(user);
        this.setTokenCookies(response, tokens);
        this.sendResponse(response, state, 'done', user);
      }
    } catch (error) {
      this.logger.error(
        `[handleAuthCallback] OAuth callback failed for ${provider}: ${error}`
      );
      this.sendResponse(response, state, 'error', 'OAuth authentication failed');
    }
  }

  private popupRedirectHtml(
    targetOrigin: string,
    payload: any,
    nonce: string
  ): string {
    return `
      <!doctype html><meta charset="utf-8">
      <script nonce="${nonce}">
      (function () {
        try {
          if (window.opener) {
            window.opener.postMessage(${JSON.stringify(
              payload
            )}, "${targetOrigin}");
          }
          window.close();
        } catch (e) {
          console.error('Popup error:', e);
        }
      })();
      </script>
    `;
  }

  private mobileRedirectHtml(
    success: boolean,
    authCode?: string,
    error?: UserDto | string
  ): string {
    const baseUrl = this.configService.appOAuthCallbackUrl;
    const params = new URLSearchParams();
    params.set('success', String(success));

    if (success && authCode) {
      params.set('code', authCode);
    } else if (!success && error) {
      params.set('error', String(error));
    }

    const redirectUrl = `${baseUrl}?${params.toString()}`;

    return `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${redirectUrl}">`;
  }
}
