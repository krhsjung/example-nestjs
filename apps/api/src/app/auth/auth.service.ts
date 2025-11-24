import {
  User,
  UserDto,
  LoginDto,
  ExampleConfigService,
  AUTH_EXCEPTIONS,
  throwException,
} from '@example/common';
import {
  AppleOAuthClient,
  AppleUserInformation,
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
  private appleOAuthClient: AppleOAuthClient;

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

    this.appleOAuthClient = new AppleOAuthClient(
      httpService,
      configService.appleClientOptions
    );
  }

  async handleMe(sessionId: string): Promise<UserDto> {
    const methodName = 'handleMe';
    this.logger.log(`[${methodName}] Me, sessionId: ${sessionId}`);

    if (!sessionId) {
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_NOT_FOUND);
    }

    const userJson = await this.redisService.get(`session:${sessionId}`);
    if (userJson) {
      return JSON.parse(userJson) as UserDto;
    }

    throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_INVALID);
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
      throwException(NotFoundException, AUTH_EXCEPTIONS.CREDENTIALS_INVALID);
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
      throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_NOT_FOUND);
    }
    await this.redisService.del(`session:${sessionId}`);
  }

  getAuthUrl(provider: AuthProvider, flow: AuthFlow, origin?: string): string {
    const methodName = 'getAuthUrl';

    this.logger.log(
      `[${methodName}][${provider}]: type to ${provider}, flow: ${flow}, origin: ${origin}`
    );

    if (provider === AuthProvider.GOOGLE) {
      return this.googleOAuthClient.generateAuthUrl(
        JSON.stringify({ flow, origin }),
        OAuthMethod.DIRECT
      );
    } else if (provider === AuthProvider.APPLE) {
      return this.appleOAuthClient.generateAuthUrl(
        JSON.stringify({ flow, origin })
      );
    }
    throwException(NotFoundException, AUTH_EXCEPTIONS.PROVIDER_UNSUPPORTED);
  }

  async handleAuthCallback(
    provider: AuthProvider,
    code: string
  ): Promise<SessionData> {
    const methodName = 'handleAuthCallback';

    this.logger.log(`[${methodName}] Handle Auth callback code: ${code}`);

    const sessionId = crypto.randomUUID();

    const handlers = {
      [AuthProvider.GOOGLE]: () => this.handleGoogleCallback(code),
      [AuthProvider.APPLE]: () => this.handleAppleCallback(code),
    };

    const handler = handlers[provider];
    if (!handler) {
      throwException(NotFoundException, AUTH_EXCEPTIONS.PROVIDER_UNSUPPORTED);
    }

    const user = await handler();

    await this.redisService.set(
      `session:${sessionId}`,
      JSON.stringify(user),
      7 * 24 * 60 * 60
    );

    return { sessionId, user };
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
    const userDto: UserDto = { id, email, name, picture, provider };

    await this.userRepository.save(userDto);

    return userDto;
  }

  private async handleAppleCallback(code: string): Promise<UserDto> {
    const token = await this.appleOAuthClient.getToken(code);

    const userInfo: AppleUserInformation =
      await this.appleOAuthClient.getUserInfo(token.id_token);
    this.logger.log(JSON.stringify(userInfo));

    const provider: AuthProvider = AuthProvider.APPLE;

    const userDto: UserDto = {
      id: userInfo.sub,
      email: userInfo.email || '',
      name: userInfo.email?.split('@')[0] || '',
      picture: '',
      provider,
    };

    await this.userRepository.save(userDto);

    return userDto;
  }
}
