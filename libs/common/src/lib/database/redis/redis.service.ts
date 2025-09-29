import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.module';
import Redis, { Cluster } from 'ioredis';

type Client = Redis | Cluster;

@Injectable()
export class RedisService implements OnModuleInit {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Client) {}

  async onModuleInit() {
    try {
      const pong = await this.ping();
      console.log(`Redis connected: ${pong}`);
    } catch (e) {
      console.log('Redis ping failed', e as any);
    }
  }

  // 공용 클라이언트 그대로 노출이 필요하면 getter 제공
  get raw(): Client {
    return this.client;
  }

  // 기본 유틸
  ping() {
    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    return (this.client as any).get(key);
  }

  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec && ttlSec > 0) {
      await (this.client as any).set(key, value, 'EX', ttlSec);
    } else {
      await (this.client as any).set(key, value);
    }
  }

  // JSON 유틸
  async setJson<T>(key: string, value: T, ttlSec?: number) {
    const payload = JSON.stringify(value);
    if (ttlSec && ttlSec > 0) {
      await (this.client as any).set(key, payload, 'EX', ttlSec);
    } else {
      await (this.client as any).set(key, payload);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const v = await (this.client as any).get(key);
    return v ? (JSON.parse(v) as T) : null;
  }

  // 기타 유틸
  del(key: string) {
    return (this.client as any).del(key);
  }

  incrBy(key: string, n = 1) {
    return (this.client as any).incrby(key, n);
  }

  decrBy(key: string, n = 1) {
    return (this.client as any).decrby(key, n);
  }

  expire(key: string, ttlSec: number) {
    return (this.client as any).expire(key, ttlSec);
  }

  /**
   * 간단 분산락 (SET NX EX) – 업무에 맞게 보완해서 쓰세요.
   */
  async lock(key: string, ttlSec = 5): Promise<boolean> {
    const ok = await (this.client as any).set(
      `lock:${key}`,
      '1',
      'NX',
      'EX',
      ttlSec
    );
    return ok === 'OK';
  }

  async unlock(key: string) {
    await (this.client as any).del(`lock:${key}`);
  }
}
