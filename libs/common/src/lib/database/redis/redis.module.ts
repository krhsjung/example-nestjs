import { RedisService } from '@example/common';
import {
  DynamicModule,
  Global,
  Module,
  OnModuleDestroy,
  Provider,
} from '@nestjs/common';
import Redis, {
  Cluster,
  ClusterNode,
  ClusterOptions,
  CommonRedisOptions,
  SentinelConnectionOptions,
} from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisMode = 'single' | 'sentinel' | 'cluster';

export type RedisModuleOptions =
  | { mode: 'single'; option: CommonRedisOptions }
  | { mode: 'sentinel'; option: SentinelConnectionOptions }
  | { mode: 'cluster'; option?: ClusterOptions; nodes: ClusterNode[] };

export interface RedisModuleAsyncOptions {
  isGlobal?: boolean;
  useFactory: (
    ...args: any[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;
  inject?: any[];
  imports?: any[];
}

class RedisClientHolder {
  private client!: Redis | Cluster;

  set(client: Redis | Cluster) {
    this.client = client;
  }

  get(): Redis | Cluster {
    return this.client;
  }

  async close() {
    if (!this.client) return;
    // ioredis: Redis & Cluster 모두 quit() 지원
    await this.client.quit();
  }
}

@Global()
@Module({})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly holder: RedisClientHolder) {}

  static register(options: RedisModuleOptions, isGlobal = true): DynamicModule {
    return {
      module: RedisModule,
      global: isGlobal,
      providers: [
        createRedisProvider(options),
        RedisClientHolder,
        RedisService,
      ],
      exports: [REDIS_CLIENT, RedisService],
    };
  }

  static registerAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const asyncProvider: Provider = {
      provide: REDIS_CLIENT,
      useFactory: async (...args: any[]) => {
        const opts = await options.useFactory(...args);
        return createClient(opts);
      },
      inject: options.inject ?? [],
    };

    return {
      module: RedisModule,
      global: options.isGlobal ?? true,
      imports: options.imports ?? [],
      providers: [asyncProvider, RedisClientHolder, RedisService],
      exports: [REDIS_CLIENT, RedisService],
    };
  }

  async onModuleDestroy() {
    await this.holder.close().catch(() => void 0);
  }
}

function createRedisProvider(options: RedisModuleOptions): Provider {
  return {
    provide: REDIS_CLIENT,
    useFactory: (holder: RedisClientHolder) => {
      const client = createClient(options);
      holder.set(client); // 종료 훅이 client를 닫을 수 있게 연결
      return client;
    },
    inject: [RedisClientHolder],
  };
}

function createClient(options: RedisModuleOptions): Redis | Cluster {
  const { mode, option } = options;

  switch (mode) {
    case 'single':
    case 'sentinel': {
      const client = new Redis(option);
      // 연결 미리 시도(앱 부팅 시 에러 빨리 감지)
      client.connect().catch(() => void 0);
      return client;
    }
    case 'cluster': {
      const nodes = options.nodes;
      const client = new Cluster(nodes, {
        redisOptions: option,
      });
      // cluster는 connect() 반환을 기다려도 되고, 백그라운드 연결도 가능
      client.connect().catch(() => void 0);
      return client;
    }
  }
}
