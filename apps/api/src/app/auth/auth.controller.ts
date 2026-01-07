import {
  Controller,
  Get,
  Param,
  Res,
  Query,
  Post,
  Body,
  Logger,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  ExampleConfigService,
  UserDto,
  LoginDto,
  JwtAuthGuard,
  CurrentUser,
} from '@example/common';
import { AuthCallback, AuthFlow, AuthProvider, Cookie } from '@example/utils';

const CONTROLLER_PREFIX = 'auth';
const DEFAULT_AUTH_FLOW = AuthFlow.REDIRECT;
type RedirectResponse = 'done' | 'error';

@Controller(CONTROLLER_PREFIX)
export class AuthController {
  private logger = new Logger(AuthController.name, { timestamp: true });

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ExampleConfigService
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: UserDto): Promise<UserDto> {
    return user;
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserDto> {
    const methodName = 'login';
    this.logger.log(`[${methodName}] starting ${methodName}`);

    const tokens = await this.authService.handleLogin(loginDto);
    return this.setTokensAndReturnUser(response, tokens);
  }

  /**
   * 모바일 OAuth용 인증 코드 교환
   * 일회용 authCode로 토큰 발급 및 쿠키 저장
   */
  @Post('exchange')
  async exchange(
    @Body('code') code: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserDto> {
    const tokens = await this.authService.exchangeAuthCode(code);
    return this.setTokensAndReturnUser(response, tokens);
  }

  @HttpCode(204)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: UserDto,
    @Cookie('accessToken') accessToken: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    // Access Token에서 세션 ID 추출
    const sessionId = this.authService.getSessionIdFromToken(accessToken);

    if (sessionId) {
      // 현재 세션만 로그아웃
      await this.authService.handleLogout(user.id, sessionId);
    }

    // 쿠키 삭제
    this.clearTokenCookies(response);
  }

  @HttpCode(204)
  @Post('logout/:sessionId')
  @UseGuards(JwtAuthGuard)
  async logoutSession(
    @CurrentUser() user: UserDto,
    @Param('sessionId') sessionId: string,
    @Cookie('accessToken') accessToken: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    // 특정 세션 로그아웃
    await this.authService.handleLogout(user.id, sessionId);

    // 로그아웃한 세션이 현재 세션인 경우에만 쿠키 삭제
    const currentSessionId =
      this.authService.getSessionIdFromToken(accessToken);

    if (currentSessionId === sessionId) {
      this.clearTokenCookies(response);
    }
  }

  @HttpCode(204)
  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: UserDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    // 모든 세션 로그아웃
    await this.authService.handleLogoutAll(user.id);

    // 쿠키 삭제
    this.clearTokenCookies(response);
  }

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

  @Get('google/callback')
  async authGooleCallback(
    @Query() query: AuthCallback,
    @Res() response: Response
  ): Promise<void> {
    this.logger.debug(`[authGoogleCallback] callback data:`, query);

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

  @Post('apple/callback')
  async authAppleCallback(
    @Body() body: AuthCallback,
    @Res() response: Response
  ): Promise<void> {
    this.logger.debug(`[authAppleCallback] callback data:`, body);

    if (body.error) {
      return this.sendResponse(response, body.state, 'error', body.error);
    }

    await this.handleAuthCallback(
      response,
      AuthProvider.APPLE,
      body.code,
      body.state
    );
  }

  private parseState(state: string): { flow: AuthFlow; origin: string | null } {
    return state
      ? (JSON.parse(state) as { flow: AuthFlow; origin: string })
      : { flow: DEFAULT_AUTH_FLOW as AuthFlow, origin: null };
  }

  private getTargetOrigin(origin: string | null, defaultPath: string): string {
    return origin || this.configService.globalPrefix + defaultPath;
  }

  private sendResponse(
    response: Response,
    state: string,
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
      response.type('html').send(this.popupRedirectHtml(targetOrigin, payload));
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
   * 쿠키 삭제
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

  private async handleAuthCallback(
    response: Response,
    provider: AuthProvider,
    code: string,
    state: string
  ) {
    const { flow } = this.parseState(state);
    const isMobileFlow = flow === AuthFlow.IOS || flow === AuthFlow.ANDROID;

    // 공통: OAuth provider에서 사용자 정보 조회
    const user = await this.authService.getUserFromOAuthProvider(
      provider,
      code
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
  }

  private popupRedirectHtml(targetOrigin: string, payload: any): string {
    return `
      <!doctype html><meta charset="utf-8">
      <script>
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

    return `
      <!doctype html><meta charset="utf-8">
      <script>
        window.location.href = "${redirectUrl}";
      </script>
    `;
  }
}
