import { Injectable, Logger } from '@nestjs/common';
import { TokenSessionService } from '../../../token';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  UpdateEvent,
} from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * User Entity의 이벤트를 구독하는 Subscriber
 *
 * maxSessions 변경 시 기존 세션을 자동으로 정리합니다.
 */
@EventSubscriber()
@Injectable()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  private readonly logger = new Logger(UserSubscriber.name, {
    timestamp: true,
  });

  private tokenSessionService?: TokenSessionService;

  constructor(sessionService?: TokenSessionService) {
    this.tokenSessionService = sessionService;
  }

  /**
   * SessionService를 설정합니다 (수동 주입용)
   */
  setSessionService(sessionService: TokenSessionService): void {
    this.tokenSessionService = sessionService;
  }

  listenTo() {
    return User;
  }

  /**
   * User 업데이트 후 이벤트 처리
   * maxSessions가 변경되었을 때 기존 세션을 정리합니다.
   */
  async afterUpdate(event: UpdateEvent<User>): Promise<void> {
    // SessionService가 주입되지 않았으면 동작하지 않음
    if (!this.tokenSessionService) {
      this.logger.warn(
        'SessionService not available, skipping session enforcement'
      );
      return;
    }

    const entity = event.entity as User;
    const databaseEntity = event.databaseEntity;

    // maxSessions 필드가 변경되었는지 확인
    if (
      entity &&
      databaseEntity &&
      entity.maxSessions !== databaseEntity.maxSessions
    ) {
      const oldMaxSessions = databaseEntity.maxSessions;
      const newMaxSessions = entity.maxSessions;

      this.logger.log(
        `maxSessions changed for user ${entity.idx}: ${oldMaxSessions} -> ${newMaxSessions}`
      );

      // 새로운 maxSessions 값이 이전보다 작을 때만 세션 정리
      if (newMaxSessions < oldMaxSessions) {
        try {
          await this.tokenSessionService.enforceMaxSessions(
            entity.idx,
            newMaxSessions
          );
          this.logger.log(
            `Successfully enforced maxSessions=${newMaxSessions} for user ${entity.idx}`
          );
        } catch (error) {
          this.logger.error(
            `Failed to enforce maxSessions for user ${entity.idx}`,
            error
          );
        }
      }
    }
  }
}
