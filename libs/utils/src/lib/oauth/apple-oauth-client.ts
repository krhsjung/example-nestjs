import { HttpUtil } from '@example/utils';
import { HttpService } from '@nestjs/axios';
import * as jwt from 'jsonwebtoken';

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';

export interface AppleAuthClientOptions {
  appleTeamId: string; // Team ID
  appleClientId: string; // Services ID
  appleKeyId: string; // Key ID
  applePrivateKey: string; // Private key (p8 file content)
  appleRedirectUri: string;
}

export interface AppleAuthUrlOpts {
  scope?: string | string[];
  state?: string;
  response_type?: string;
  response_mode?: string;
}

export interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
}

export interface AppleUserInformation {
  sub: string; // Unique user identifier
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  real_user_status?: number;
}

export class AppleOAuthClient {
  private httpUtil: HttpUtil;

  constructor(
    private readonly httpService: HttpService,
    private readonly options: AppleAuthClientOptions
  ) {
    this.httpUtil = new HttpUtil(this.httpService);
  }

  /**
   * Generate Apple Sign In authorization URL
   */
  generateAuthUrl(
    state: string = Math.random().toString(36).substring(2, 15)
  ): string {
    const scopes = ['email', 'name'];
    const option: AppleAuthUrlOpts = {
      scope: scopes,
      state: state,
      response_type: 'code',
      response_mode: 'form_post', // Apple recommends form_post
    };

    return this.generateAppleAuthUrl(option);
  }

  /**
   * Generate Apple authorization URL manually
   */
  generateAppleAuthUrl(option: AppleAuthUrlOpts = {}): string {
    const params = this.toAppleAuthURLSearchParams({
      client_id: this.options.appleClientId,
      redirect_uri: this.options.appleRedirectUri,
      ...option,
    });
    return `${APPLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getToken(code: string): Promise<AppleTokenResponse> {
    return await this.getAppleToken(code);
  }

  /**
   * Exchange authorization code for Apple tokens
   */
  async getAppleToken(code: string): Promise<AppleTokenResponse> {
    const clientSecret = this.generateClientSecret();

    const body = {
      code,
      client_id: this.options.appleClientId,
      client_secret: clientSecret,
      redirect_uri: this.options.appleRedirectUri,
      grant_type: 'authorization_code',
    };

    try {
      const tokenData = await this.httpUtil.post<AppleTokenResponse>(
        APPLE_TOKEN_URL,
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
    } catch (error) {
      throw new Error(`Token exchange failed: ${error}`);
    }
  }

  /**
   * Decode and verify Apple ID token to get user information
   */
  async getUserInfo(idToken: string): Promise<AppleUserInformation> {
    try {
      // Decode without verification first to get basic info
      const decoded = jwt.decode(idToken) as AppleUserInformation;

      if (!decoded) {
        throw new Error('Failed to decode Apple ID token');
      }

      // In production, you should verify the token with Apple's public keys
      // For now, we'll return the decoded information
      return {
        sub: decoded.sub,
        email: decoded.email,
        email_verified: decoded.email_verified,
        is_private_email: decoded.is_private_email,
        real_user_status: decoded.real_user_status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get user info from ID token: ${errorMessage}`);
    }
  }

  /**
   * Generate client secret JWT for Apple
   * Apple requires a JWT signed with your private key as the client_secret
   */
  private generateClientSecret(): string {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: this.options.appleTeamId, // Team ID
      iat: now,
      exp: now + 3600 * 24 * 180, // 6 months (max allowed by Apple)
      aud: 'https://appleid.apple.com',
      sub: this.options.appleClientId, // Services ID
    };

    const header = {
      alg: 'ES256',
      kid: this.options.appleKeyId, // Key ID
    };

    // Format private key properly (handle escaped newlines from env vars)
    const privateKey = this.formatPrivateKey(this.options.applePrivateKey);

    return jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: header,
    });
  }

  /**
   * Format private key to ensure proper PEM format
   * Handles cases where newlines are escaped in environment variables
   */
  private formatPrivateKey(key: string): string {
    if (!key) {
      throw new Error('Apple private key is not configured');
    }

    // If key already has proper newlines, return as is
    if (key.includes('\n')) {
      return key;
    }

    // Replace escaped newlines with actual newlines
    return key.replace(/\\n/g, '\n');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AppleTokenResponse> {
    const clientSecret = this.generateClientSecret();

    const body = {
      client_id: this.options.appleClientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };

    const tokenData = await this.httpUtil.post<AppleTokenResponse>(
      APPLE_TOKEN_URL,
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!tokenData.access_token) {
      throw new Error(`Token refresh failed: ${JSON.stringify(tokenData)}`);
    }

    return tokenData;
  }

  /**
   * Revoke Apple tokens
   */
  async revokeToken(
    token: string,
    tokenType: 'access_token' | 'refresh_token' = 'access_token'
  ): Promise<void> {
    const clientSecret = this.generateClientSecret();

    const body = {
      client_id: this.options.appleClientId,
      client_secret: clientSecret,
      token: token,
      token_type_hint: tokenType,
    };

    await this.httpUtil.post('https://appleid.apple.com/auth/revoke', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Convert options to URLSearchParams
   */
  private toAppleAuthURLSearchParams(
    opts: AppleAuthUrlOpts & { client_id?: string; redirect_uri?: string } = {},
    extraParams?: Record<string, string | boolean | number>
  ): URLSearchParams {
    const params = new URLSearchParams();

    // Required parameters
    this.setIfPresent(params, 'client_id', opts.client_id);
    this.setIfPresent(params, 'redirect_uri', opts.redirect_uri);
    this.setIfPresent(params, 'state', opts.state);
    this.setIfPresent(params, 'response_type', opts.response_type ?? 'code');
    this.setIfPresent(
      params,
      'response_mode',
      opts.response_mode ?? 'form_post'
    );

    // Scope normalization
    const scope = this.normalizeScope(opts.scope);
    this.setIfPresent(params, 'scope', scope);

    // Custom parameters
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        this.setIfPresent(params, k, v);
      }
    }

    return params;
  }

  /**
   * Set value in URLSearchParams if present
   */
  private setIfPresent(params: URLSearchParams, key: string, v: unknown) {
    if (v === undefined || v === null) {
      return;
    }

    const val = typeof v === 'boolean' ? String(v) : String(v);
    if (val.trim() !== '') {
      params.set(key, val);
    }
  }

  /**
   * Normalize scope to space-separated string
   */
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

    // Allow comma/space separated input
    const arr = scope
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(arr)).join(' ');
  }
}
