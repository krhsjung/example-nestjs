import { Secret } from 'jsonwebtoken';
import { StringValue } from 'ms';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtConfig {
  accessTokenSecret: Secret;
  accessTokenExpiresIn: StringValue | number;
  refreshTokenSecret: Secret;
  refreshTokenExpiresIn: StringValue | number;
}
