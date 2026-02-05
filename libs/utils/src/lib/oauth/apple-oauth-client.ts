import { HttpUtil } from '@example/utils';
import { HttpService } from '@nestjs/axios';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

export interface AppleAuthClientOptions {
  appleTeamId: string; // Team ID
  appleClientId: string; // Services ID (for web)
  appleBundleId?: string; // Bundle ID (for iOS/Android native)
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

interface AppleJWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

// Apple Server-to-Server Notification Types
export type AppleNotificationType =
  | 'consent-revoked'
  | 'account-delete'
  | 'email-disabled'
  | 'email-enabled';

export interface AppleServerNotification {
  payload: string; // Signed JWT
}

export interface AppleNotificationPayload {
  iss: string;
  aud: string;
  iat: number;
  jti: string;
  events: string; // JSON string of AppleNotificationEvents
}

export interface AppleNotificationEvents {
  type: AppleNotificationType;
  sub: string; // User identifier
  email?: string;
  is_private_email?: boolean | string;
  event_time: number;
}

export class AppleOAuthClient {
  private httpUtil: HttpUtil;
  private cachedKeys: AppleJWK[] | null = null;
  private keysCachedAt = 0;
  private static readonly KEYS_CACHE_TTL = 3600 * 1000; // 1시간

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
   * Apple 공개 키 조회 (메모리 캐싱)
   * TTL 내에는 캐시된 키를 반환하고, 만료 시에만 Apple 서버에서 재조회합니다.
   */
  private async getApplePublicKeys(): Promise<AppleJWK[]> {
    const now = Date.now();
    if (
      this.cachedKeys &&
      now - this.keysCachedAt < AppleOAuthClient.KEYS_CACHE_TTL
    ) {
      return this.cachedKeys;
    }

    const response = await this.httpUtil.get<{ keys: AppleJWK[] }>(
      APPLE_KEYS_URL
    );
    this.cachedKeys = response.keys;
    this.keysCachedAt = now;
    return this.cachedKeys;
  }

  /**
   * kid에 해당하는 Apple 공개 키 조회
   * 캐시에 kid가 없으면 캐시를 무효화하고 재조회합니다. (키 교체 대응)
   */
  private async findAppleKey(kid: string): Promise<AppleJWK> {
    let keys = await this.getApplePublicKeys();
    let key = keys.find((k) => k.kid === kid);

    if (!key) {
      this.cachedKeys = null;
      keys = await this.getApplePublicKeys();
      key = keys.find((k) => k.kid === kid);
    }

    if (!key) {
      throw new Error('Apple public key not found for kid: ' + kid);
    }
    return key;
  }

  /**
   * Verify identity token using Apple's public keys
   * Used for both web OAuth callback (id_token) and native SDK (identityToken)
   * Fetches Apple's public keys and verifies the JWT signature
   */
  async verifyIdentityToken(
    identityToken: string
  ): Promise<AppleUserInformation> {
    try {
      // 1. Decode header to get key ID (kid)
      if (!identityToken) {
        throw new Error('identityToken is required');
      }
      const trimmedToken = identityToken.trim();
      const decoded = jwt.decode(trimmedToken, { complete: true });
      if (!decoded?.header?.kid) {
        throw new Error(
          `Invalid identity token: missing kid in header (decoded: ${JSON.stringify(
            decoded
          )})`
        );
      }

      // 2. Find Apple public key (with cache)
      const appleKey = await this.findAppleKey(decoded.header.kid);

      // 3. Convert JWK to PEM format
      const publicKey = this.jwkToPem(appleKey);

      // 4. Verify and decode the token
      // Allow both web (Services ID) and native (Bundle ID) audiences
      const audience: [string, ...string[]] = this.options.appleBundleId
        ? [this.options.appleClientId, this.options.appleBundleId]
        : [this.options.appleClientId];
      const verified = jwt.verify(trimmedToken, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience,
      }) as AppleUserInformation & { aud: string; iss: string; exp: number };

      return {
        sub: verified.sub,
        email: verified.email,
        email_verified: verified.email_verified,
        is_private_email: verified.is_private_email,
        real_user_status: verified.real_user_status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to verify identity token: ${errorMessage}`);
    }
  }

  /**
   * Verify and decode Apple Server-to-Server notification payload
   * Used for handling account events (consent-revoked, account-delete, etc.)
   */
  async verifyWebhookPayload(
    signedPayload: string
  ): Promise<AppleNotificationEvents> {
    try {
      // 1. Decode header to get key ID (kid)
      const header = jwt.decode(signedPayload, { complete: true })?.header;
      if (!header?.kid) {
        throw new Error('Invalid webhook payload: missing kid in header');
      }

      // 2. Find Apple public key (with cache)
      const appleKey = await this.findAppleKey(header.kid);

      // 3. Convert JWK to PEM format
      const publicKey = this.jwkToPem(appleKey);

      // 4. Verify and decode the payload
      const decoded = jwt.verify(signedPayload, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: this.options.appleClientId,
      }) as AppleNotificationPayload;

      // 5. Parse the events JSON string
      const events = JSON.parse(decoded.events) as AppleNotificationEvents;

      return events;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to verify webhook payload: ${errorMessage}`);
    }
  }

  /**
   * Convert JWK (JSON Web Key) to PEM format using Node.js crypto
   */
  private jwkToPem(jwk: AppleJWK): string {
    const keyObject = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    });

    return keyObject.export({ type: 'spki', format: 'pem' }) as string;
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
