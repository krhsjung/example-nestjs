import { Injectable } from '@nestjs/common';
import { ExampleConfigService } from '@example/common';

export interface AppleAppSiteAssociation {
  applinks: {
    apps: string[];
    details: { appID: string; paths: string[] }[];
  };
}

export interface AndroidAssetLinks {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

@Injectable()
export class DeepLinkService {
  constructor(private readonly configService: ExampleConfigService) {}

  /**
   * iOS Universal Links용 apple-app-site-association 생성
   */
  getAppleAppSiteAssociation(): AppleAppSiteAssociation {
    const appID = `${this.configService.appleTeamId}.${this.configService.appleBundleId}`;

    return {
      applinks: {
        apps: [],
        details: [
          {
            appID,
            paths: ['/link/*'],
          },
        ],
      },
    };
  }

  /**
   * Android App Links용 assetlinks.json 생성
   */
  getAndroidAssetLinks(): AndroidAssetLinks[] {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: this.configService.androidPackageName,
          sha256_cert_fingerprints: [
            this.configService.androidSha256Fingerprint,
          ],
        },
      },
    ];
  }

  /**
   * User-Agent 기반 플랫폼 감지
   */
  detectPlatform(userAgent: string): 'ios' | 'android' | 'desktop' {
    const ua = userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(ua)) {
      return 'ios';
    }
    if (/android/.test(ua)) {
      return 'android';
    }
    return 'desktop';
  }

  /**
   * 플랫폼별 리다이렉트 URL 생성
   */
  getRedirectUrl(
    platform: 'ios' | 'android' | 'desktop',
    path: string
  ): string {
    const webUrl = this.configService.domainUrl;
    const appScheme = this.configService.appUrlScheme;

    switch (platform) {
      case 'desktop':
        return `${webUrl}/${path}`;
      case 'ios':
      case 'android':
        // Universal Link / App Link가 동작하면 OS가 앱을 열어줌
        // 앱이 미설치된 경우를 위한 fallback HTML을 생성
        return `${appScheme}://${path}`;
    }
  }

  /**
   * 모바일 fallback HTML 생성
   *
   * 이 HTML이 브라우저에 표시된다는 것은 Universal Link/App Link가
   * 동작하지 않았다는 뜻 (= 앱 미설치 상태)
   *
   * iOS: Custom Scheme 시도 시 에러 팝업이 뜨므로, 바로 fallback으로 리다이렉트
   * Android: intent:// 스킴 사용 (에러 팝업 없이 fallback 처리 가능)
   */
  getMobileFallbackHtml(platform: 'ios' | 'android', path: string): string {
    const webUrl = `${this.configService.domainUrl}/${path}`;
    const storeUrl =
      platform === 'ios'
        ? this.configService.appStoreUrl
        : this.configService.playStoreUrl;
    const fallbackUrl = storeUrl || webUrl;

    if (platform === 'ios') {
      // iOS: 바로 스토어/웹으로 리다이렉트
      return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${fallbackUrl}">
<title>Redirecting...</title>
</head>
<body>
<p>Redirecting...</p>
</body>
</html>`;
    }

    // Android: intent:// 스킴으로 앱 열기 시도, 실패 시 fallback
    const intentUrl = `intent://${path}#Intent;scheme=${
      this.configService.appUrlScheme
    };package=${
      this.configService.androidPackageName
    };S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${intentUrl}">
<title>Redirecting...</title>
</head>
<body>
<p>Redirecting...</p>
</body>
</html>`;
  }
}
