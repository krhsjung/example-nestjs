import { Injectable } from '@nestjs/common';
import { ExampleConfigService } from '@example/common';
import * as crypto from 'crypto';

export interface IceServerConfig {
  iceServers: {
    urls: string[];
    username: string;
    credential: string;
  }[];
}

@Injectable()
export class TurnService {
  constructor(private readonly configService: ExampleConfigService) {}

  generateCredentials(userId: number): IceServerConfig {
    const ttl = 5 * 60; // 5분 유효 (권장: 5분~10분)
    const timestamp = Math.floor(Date.now() / 1000) + ttl;
    const username = `${timestamp}:${userId}`;

    const hmac = crypto.createHmac('sha1', this.configService.coturnTurnSecret);
    hmac.update(username);
    const credential = hmac.digest('base64');

    const turnServer = this.configService.domain;

    return {
      iceServers: [
        {
          urls: [
            `turn:${turnServer}:3478`,
            `turn:${turnServer}:3478?transport=tcp`,
          ],
          username,
          credential,
        },
      ],
    };
  }
}
