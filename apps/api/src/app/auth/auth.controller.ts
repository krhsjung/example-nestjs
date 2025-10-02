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
import {
  AuthCallbackQuery,
  AuthFlow,
  AuthProvider,
  Cookie,
} from '@example/utils';

const CONTROLLER_PREFIX = 'auth';
const DEFAULT_AUTH_FLOW = AuthFlow.REDIRECT;

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
  @Get('logout')
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

  @Get(':provider/callback')
  async authCallback(
    @Param('provider') provider: AuthProvider,
    @Query() query: AuthCallbackQuery,
    @Res() response: Response
  ): Promise<void> {
    const { code, state } = query;

    const { sessionId, user } = await this.authService.handleAuthCallback(
      provider,
      code
    );

    const cookieOptions = this.configService.cookieOptions;
    response.cookie('sessionId', sessionId, cookieOptions);

    const { flow, origin } = state
      ? (JSON.parse(state) as { flow: AuthFlow; origin: string })
      : { flow: DEFAULT_AUTH_FLOW as AuthFlow, origin: null };

    const targetOrigin =
      origin || this.configService.globalPrefix + '/auth/success';

    if (flow === AuthFlow.POPUP) {
      response.type('html').send(this.popupRedirectHtml(targetOrigin, user));
    } else if (flow === AuthFlow.REDIRECT) {
      response.redirect(targetOrigin);
    }
  }

  private popupRedirectHtml(targetOrigin: string, user: UserDto) {
    return `
      <!doctype html><meta charset="utf-8">
      <script>
      (function () {
        var targetOrigin = "${targetOrigin}";
        var user = ${JSON.stringify(user)};
        function send() {
          try {
            if (window.opener) {
              window.opener.postMessage({ 
                type: "oauth:done", 
                ok: true,
                user: user 
              }, targetOrigin);
            }
            window.close();
          } catch (e) {}
        }
        send();
      })();
      </script>
  `;
  }
}
