import { HttpUtil, OAuthMethod } from '@example/utils';
import { HttpService } from '@nestjs/axios';
import {
  Credentials,
  GenerateAuthUrlOpts,
  OAuth2Client,
} from 'google-auth-library';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface GoogleAuthClientOptions {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
}
export interface GoogleAuthUrlOpts extends GenerateAuthUrlOpts {}
export interface GoogleTokenResponse extends Credentials {}
export interface GoogleUserInformation {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export class GoogleOAuthClient {
  private client: OAuth2Client;
  private httpUtil: HttpUtil;

  constructor(
    private readonly httpService: HttpService,
    private readonly options: GoogleAuthClientOptions
  ) {
    this.client = new OAuth2Client({
      clientId: options.googleClientId,
      clientSecret: options.googleClientSecret,
      redirectUri: options.googleRedirectUri,
    });
    this.httpUtil = new HttpUtil(this.httpService);
  }

  getClient(): OAuth2Client {
    return this.client;
  }

  generateAuthUrl(
    state: string = Math.random().toString(36).substring(2, 15),
    oauthMethod: OAuthMethod = OAuthMethod.LIBRARY,
    prompt?: string
  ): string {
    const scopes = ['email', 'profile'];
    const option: GoogleAuthUrlOpts = {
      scope: scopes,
      state: state,
      response_type: 'code',
      access_type: 'offline',
      prompt,
    };

    const authUrl =
      oauthMethod === OAuthMethod.LIBRARY
        ? this.client.generateAuthUrl(option)
        : this.generateGoogleAuthUrl(option);
    return authUrl;
  }

  generateGoogleAuthUrl(option: GoogleAuthUrlOpts = {}): string {
    const params = this.toGoogleAuthURLSearchParams({
      client_id: this.options.googleClientId,
      redirect_uri: this.options.googleRedirectUri,
      ...option,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async getToken(
    code: string,
    oauthMethod: OAuthMethod = OAuthMethod.LIBRARY
  ): Promise<GoogleTokenResponse> {
    const token: GoogleTokenResponse =
      oauthMethod === OAuthMethod.LIBRARY
        ? (await this.client.getToken(code)).tokens
        : await this.getGoogleToken(code);
    return token;
  }

  async getGoogleToken(code: string): Promise<GoogleTokenResponse> {
    const body = {
      code,
      client_id: this.options.googleClientId,
      client_secret: this.options.googleClientSecret,
      redirect_uri: this.options.googleRedirectUri,
      grant_type: 'authorization_code',
    };

    const tokenData = await this.httpUtil.post<GoogleTokenResponse>(
      GOOGLE_TOKEN_URL,
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!tokenData.access_token) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    return tokenData;
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInformation> {
    return await this.httpUtil.get<GoogleUserInformation>(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**  option을 URLSearchParams로 변환 **/
  private toGoogleAuthURLSearchParams(
    opts: GoogleAuthUrlOpts = {},
    extraParams?: Record<string, string | boolean | number>
  ): URLSearchParams {
    const params = new URLSearchParams();

    // 1) 필수/일반
    this.setIfPresent(params, 'client_id', opts.client_id);
    this.setIfPresent(params, 'redirect_uri', opts.redirect_uri);
    this.setIfPresent(params, 'state', opts.state);
    this.setIfPresent(params, 'prompt', opts.prompt);
    this.setIfPresent(params, 'login_hint', opts.login_hint);
    this.setIfPresent(params, 'hd', opts.hd);
    this.setIfPresent(params, 'access_type', opts.access_type);

    if (opts.include_granted_scopes !== undefined) {
      this.setIfPresent(
        params,
        'include_granted_scopes',
        opts.include_granted_scopes
      );
    }

    // 2) scope 정규화
    const scope = this.normalizeScope(opts.scope);
    this.setIfPresent(params, 'scope', scope);

    // 3) code flow & PKCE
    this.setIfPresent(params, 'response_type', opts.response_type ?? 'code');
    this.setIfPresent(params, 'code_challenge', opts.code_challenge);
    this.setIfPresent(
      params,
      'code_challenge_method',
      opts.code_challenge_method
    );

    // 4) 커스텀 파라미터
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        this.setIfPresent(params, k, v);
      }
    }
    return params;
  }

  /** 값이 비어있지 않으면 URLSearchParams에 set */
  private setIfPresent(params: URLSearchParams, key: string, v: unknown) {
    if (v === undefined || v === null) {
      return;
    }

    const val = typeof v === 'boolean' ? String(v) : String(v);
    if (val.trim() !== '') {
      params.set(key, val);
    }
  }

  /** scope를 공백 구분 문자열로 정규화 */
  private normalizeScope(scope?: string | string[]): string | undefined {
    if (!scope) {
      return undefined;
    }
    if (Array.isArray(scope)) {
      const arr = scope
        .filter(Boolean)
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
      return Array.from(new Set(arr)).join(' ');
    }

    // 쉼표/공백 혼용 입력을 허용
    const arr = scope
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(arr)).join(' ');
  }
}
