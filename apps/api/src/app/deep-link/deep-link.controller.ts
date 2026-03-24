import { Controller, Get, Param, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DeepLinkService } from './deep-link.service';

/**
 * .well-known 엔드포인트 (globalPrefix 제외)
 *
 * - /.well-known/apple-app-site-association: iOS Universal Links 검증
 * - /.well-known/assetlinks.json: Android App Links 검증
 */
@Controller('.well-known')
export class WellKnownController {
  constructor(private readonly deepLinkService: DeepLinkService) {}

  @Get('apple-app-site-association')
  getAppleAppSiteAssociation(@Res() response: Response): void {
    response
      .type('application/json')
      .send(this.deepLinkService.getAppleAppSiteAssociation());
  }

  @Get('assetlinks.json')
  getAssetLinks(@Res() response: Response): void {
    response
      .type('application/json')
      .send(this.deepLinkService.getAndroidAssetLinks());
  }
}

/**
 * 딥링크 리다이렉트 엔드포인트 (globalPrefix 제외)
 *
 * - /link/:path: 플랫폼별 리다이렉트
 */
@Controller('link')
export class DeepLinkController {
  private logger = new Logger(DeepLinkController.name, { timestamp: true });

  constructor(private readonly deepLinkService: DeepLinkService) {}

  /**
   * 딥링크 리다이렉트 엔드포인트
   * User-Agent를 기반으로 플랫폼을 감지하여:
   * - 데스크탑: 웹 페이지로 리다이렉트
   * - 모바일(앱 설치): OS가 Universal Link/App Link로 앱 실행
   * - 모바일(앱 미설치): 앱 스킴 시도 후 스토어/웹으로 fallback
   */
  @Get('*path')
  handleDeepLink(
    @Param('path') path: string,
    @Req() request: Request,
    @Res() response: Response
  ): void {
    const userAgent = request.headers['user-agent'] || '';
    const platform = this.deepLinkService.detectPlatform(userAgent);

    this.logger.debug(
      `[handleDeepLink] platform=${platform}, path=${path}, ua=${userAgent}`
    );

    // 원본 쿼리 스트링 유지 (예: ?email=test@example.com)
    const queryString = request.url.includes('?')
      ? request.url.slice(request.url.indexOf('?'))
      : '';

    if (platform === 'desktop') {
      const webUrl = this.deepLinkService.getRedirectUrl('desktop', path);
      const redirectUrl = `${webUrl}${queryString}`;
      this.logger.debug(
        `[handleDeepLink] Redirecting desktop to ${redirectUrl}`
      );
      response.redirect(redirectUrl);
    } else {
      // 모바일: fallback HTML로 앱 열기 시도
      response
        .type('html')
        .send(
          this.deepLinkService.getMobileFallbackHtml(
            platform,
            path + queryString
          )
        );
    }
  }
}
