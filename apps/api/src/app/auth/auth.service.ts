import { User, UserDto, LoginDto, ExampleConfigService } from '@example/common';
import {
  AuthFlow,
  AuthProvider,
  GoogleOAuthClient,
  GoogleUserInformation,
  OAuthMethod,
  RedisService,
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

export interface SessionData {
  sessionId: string;
  user: UserDto;
}

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name, { timestamp: true });
  private googleOAuthClient: GoogleOAuthClient;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    private readonly configService: ExampleConfigService,
    private readonly redisService: RedisService
  ) {
    this.googleOAuthClient = new GoogleOAuthClient(
      httpService,
      configService.googleClientOptions
    );
  }

  async handleMe(sessionId: string): Promise<UserDto> {
    const methodName = 'handleMe';
    this.logger.log(`[${methodName}] Me, sessionId: ${sessionId}`);

    if (!sessionId) {
      throw new UnauthorizedException('Session not found');
    }

    const userJson = await this.redisService.get(`session:${sessionId}`);
    if (userJson) {
      return JSON.parse(userJson) as UserDto;
    }

    throw new UnauthorizedException('Invalid session');
  }

  async handleLogin(loginDto: LoginDto): Promise<SessionData> {
    const methodName = 'handleLogin';
    const { email, password } = loginDto;

    this.logger.log(
      `[${methodName}] Login for email: ${email} and password: ${password}`
    );

    const user = await this.userRepository.findOne({
      where: { email, password },
    });

    if (!user || user.password !== password) {
      throw new NotFoundException('Invalid email or password');
    }

    const sessionId = crypto.randomUUID();

    this.logger.log(
      `[${methodName}] Login successful, sessionId: ${sessionId}`
    );

    await this.redisService.set(
      `session:${sessionId}`,
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
      }),
      7 * 24 * 60 * 60
    );

    return { sessionId, user };
  }

  async handleLogout(sessionId: string): Promise<void> {
    const methodName = 'handleLogout';

    this.logger.log(`[${methodName}] Logout for sessionId: ${sessionId}`);

    if (!sessionId) {
      throw new UnauthorizedException('Session not found');
    }
    await this.redisService.del(`session:${sessionId}`);
  }

  getAuthUrl(provider: AuthProvider, flow: AuthFlow, origin?: string): string {
    const methodName = 'getAuthUrl';

    console.log(
      `[${methodName}][${provider}]: type to ${provider}, flow: ${flow}, origin: ${origin}`
    );

    if (provider === AuthProvider.GOOGLE) {
      return this.googleOAuthClient.generateAuthUrl(
        JSON.stringify({ flow, origin }),
        OAuthMethod.DIRECT
      );
    }
    throw new NotFoundException(`Unsupported auth type: ${provider}`);
  }

  async handleAuthCallback(
    provider: AuthProvider,
    code: string
  ): Promise<SessionData> {
    const methodName = 'handleAuthCallback';

    this.logger.log(`[${methodName}] Handle Auth callback code: ${code}`);

    const sessionId = crypto.randomUUID();

    const handlers = {
      [AuthProvider.GOOGLE]: () => this.handleGoogleCallback(provider, code),
    };

    const handler = handlers[provider];
    if (!handler) {
      throw new NotFoundException(`Unsupported auth provider: ${provider}`);
    }

    const user = await handler();

    await this.redisService.set(
      `session:${sessionId}`,
      JSON.stringify(user),
      7 * 24 * 60 * 60
    );

    return { sessionId, user };
  }

  private async handleGoogleCallback(
    provider: AuthProvider,
    code: string
  ): Promise<UserDto> {
    const token = await this.googleOAuthClient.getToken(
      code,
      OAuthMethod.DIRECT
    );

    const userInfo: GoogleUserInformation =
      await this.googleOAuthClient.getUserInfo(token.access_token);

    this.userRepository.save({
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: provider,
    });

    const { id, email, name, picture } = userInfo;
    return { id, email, name, picture, provider };
  }
}
