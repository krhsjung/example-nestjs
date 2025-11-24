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
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ExampleConfigService, UserDto, LoginDto } from '@example/common';
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
  async me(@Cookie('sessionId') sessionId: string): Promise<UserDto> {
    return await this.authService.handleMe(sessionId);
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserDto> {
    const methodName = 'login';
    this.logger.log(`[${methodName}] starting ${methodName}`);
    const { sessionId, user } = await this.authService.handleLogin(loginDto);

    const cookieOptions = this.configService.cookieOptions;
    response.cookie('sessionId', sessionId, cookieOptions);

    return user;
  }

  @HttpCode(204)
  @Post('logout')
  async logout(
    @Cookie('sessionId') sessionId: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    const cookieOptions = this.configService.cookieOptions;
    response.clearCookie('sessionId', cookieOptions);

    await this.authService.handleLogout(sessionId);
  }

  @Get(':provider')
  async authUrl(
    @Res() response: Response,
    @Param('provider') provider: AuthProvider,
    @Query('flow') flow: AuthFlow = DEFAULT_AUTH_FLOW,
    @Query('origin') origin?: string
  ): Promise<void> {
    response.redirect(this.authService.getAuthUrl(provider, flow, origin));
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
    data?: UserDto | string
  ): void {
    const { flow, origin } = this.parseState(state);
    const isDone = type === 'done';
    const targetOrigin = this.getTargetOrigin(
      origin,
      isDone ? '/auth/success' : '/auth/error'
    );

    if (flow === AuthFlow.POPUP) {
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

  private async handleAuthCallback(
    response: Response,
    provider: AuthProvider,
    code: string,
    state: string
  ) {
    const { sessionId, user } = await this.authService.handleAuthCallback(
      provider,
      code
    );

    response.cookie('sessionId', sessionId, this.configService.cookieOptions);

    this.sendResponse(response, state, 'done', user);
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
}
