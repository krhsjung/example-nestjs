# Exception System

프론트엔드 다국어 지원을 위한 JSON 형식의 예외 메시지 시스템입니다.

## 구조

```
libs/common/src/lib/exceptions/
├── constants/
│   ├── auth.exceptions.ts      # 인증 관련 예외 메시지
│   ├── user.exceptions.ts      # 사용자 관련 예외 메시지
│   └── common.exceptions.ts    # 공통 예외 메시지
├── exception.helper.ts         # 예외 처리 헬퍼 함수
└── index.ts                    # 모듈 export
```

## 예외 메시지 형식

모든 예외 메시지는 다음 형식을 따릅니다:

```typescript
{
  id: string;                                // 프론트엔드 localization 식별자
  message: string;                           // Interpolated 영문 메시지
  params?: Record<string, string>;  // 동적 파라미터 (옵셔널)
}
```

- `id`: 클라이언트에서 localization 키로 사용 (Web i18n, Android strings.xml, iOS Localizable.strings)
- `message`: 서버에서 params를 interpolate한 영문 메시지 (fallback용)
- `params`: 원본 파라미터 값 (클라이언트에서 플랫폼별 localization에 사용)

## 사용 방법

### 1. 기본 사용 (정적 메시지)

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { AUTH_EXCEPTIONS, throwException } from '@example/common';

// Session not found 예외 발생
throwException(UnauthorizedException, AUTH_EXCEPTIONS.SESSION_NOT_FOUND);
```

**응답 예시:**

```json
{
  "statusCode": 401,
  "message": "{\"id\":\"auth_session_not_found\",\"message\":\"Session not found\"}"
}
```

### 2. 동적 메시지 (파라미터 포함)

```typescript
import { NotFoundException } from '@nestjs/common';
import { USER_EXCEPTIONS, throwException } from '@example/common';

// User not found 예외 발생 (ID 포함)
throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND, { id: '123' });
```

**응답 예시:**

```json
{
  "statusCode": 404,
  "message": "{\"id\":\"user_not_found\",\"message\":\"User with id=123 not found\",\"params\":{\"id\":\"123\"}}"
}
```

### 3. 여러 필드가 포함된 동적 메시지

```typescript
import { ConflictException } from '@nestjs/common';
import { USER_EXCEPTIONS, throwException } from '@example/common';

const conflictFields = ['id', 'email'];
throwException(ConflictException, USER_EXCEPTIONS.ALREADY_EXISTS, {
  fields: conflictFields.join(', '),
});
```

**응답 예시:**

```json
{
  "statusCode": 409,
  "message": "{\"id\":\"user_already_exists\",\"message\":\"User with id, email already exists\",\"params\":{\"fields\":\"id, email\"}}"
}
```

## 프론트엔드에서 사용하기

프론트엔드에서는 응답의 `message` 필드를 JSON으로 파싱하여 사용합니다:

```typescript
// 에러 응답 예시 (파라미터 없음)
const errorResponse = {
  statusCode: 401,
  message: '{"id":"auth_session_not_found","message":"Session not found"}',
};

// JSON 파싱
const errorData = JSON.parse(errorResponse.message);
console.log(errorData.id); // "auth_session_not_found"
console.log(errorData.message); // "Session not found"
console.log(errorData.params); // undefined

// i18n 라이브러리와 함께 사용
const translatedMessage = t(errorData.id); // i18n 키로 번역

// 에러 응답 예시 (파라미터 포함)
const errorResponseWithParams = {
  statusCode: 404,
  message: '{"id":"user_not_found","message":"User with id=123 not found","params":{"id":"123"}}',
};

// JSON 파싱
const errorDataWithParams = JSON.parse(errorResponseWithParams.message);
console.log(errorDataWithParams.id); // "user_not_found"
console.log(errorDataWithParams.message); // "User with id=123 not found"
console.log(errorDataWithParams.params); // { id: "123" }

// i18n 라이브러리와 params 함께 사용
const translatedMessageWithParams = t(errorDataWithParams.id, errorDataWithParams.params);
```

## 사용 가능한 예외 메시지

### 인증 (AUTH_EXCEPTIONS)

| 상수                   | ID                          | 기본 메시지               |
| ---------------------- | --------------------------- | ------------------------- |
| `SESSION_NOT_FOUND`    | `auth_session_not_found`    | Session not found         |
| `SESSION_INVALID`      | `auth_session_invalid`      | Invalid session           |
| `CREDENTIALS_INVALID`  | `auth_credentials_invalid`  | Invalid email or password |
| `PROVIDER_UNSUPPORTED` | `auth_provider_unsupported` | Unsupported auth provider |

### 사용자 (USER_EXCEPTIONS)

| 상수             | ID                    | 기본 메시지                       | 파라미터   |
| ---------------- | --------------------- | --------------------------------- | ---------- |
| `NOT_FOUND`      | `user_not_found`      | User with id={id} not found       | `{id}`     |
| `ALREADY_EXISTS` | `user_already_exists` | User with {fields} already exists | `{fields}` |

### 공통 (COMMON_EXCEPTIONS)

| 상수                    | ID                             | 기본 메시지           |
| ----------------------- | ------------------------------ | --------------------- |
| `INTERNAL_SERVER_ERROR` | `common_internal_server_error` | Internal server error |
| `BAD_REQUEST`           | `common_bad_request`           | Bad request           |
| `FORBIDDEN`             | `common_forbidden`             | Forbidden             |
| `NOT_FOUND`             | `common_not_found`             | Resource not found    |

## 새로운 예외 메시지 추가하기

### 1. 기존 카테고리에 추가

예를 들어, `auth.exceptions.ts`에 새로운 메시지를 추가:

```typescript
export const AUTH_EXCEPTIONS = {
  // ... 기존 메시지들
  TOKEN_EXPIRED: {
    id: 'auth_token_expired',
    message: 'Token has expired',
  },
} as const;
```

### 2. 새로운 카테고리 생성

새로운 파일 생성: `libs/common/src/lib/exceptions/constants/order.exceptions.ts`

```typescript
export const ORDER_EXCEPTIONS = {
  NOT_FOUND: {
    id: 'order_not_found',
    message: 'Order with id={id} not found',
  },
  ALREADY_CANCELLED: {
    id: 'order_already_cancelled',
    message: 'Order is already cancelled',
  },
} as const;

export type OrderExceptionKey = keyof typeof ORDER_EXCEPTIONS;
```

그리고 `libs/common/src/lib/exceptions/index.ts`에 export 추가:

```typescript
export * from './constants/order.exceptions';
```

## Helper 함수

### throwException

예외를 JSON 메시지와 함께 던집니다. `params`가 제공되면 메시지 interpolation과 함께 응답 JSON에 `params` 필드가 포함됩니다.

```typescript
throwException(
  exceptionClass: new (message: string) => HttpException,
  exceptionMessage: ExceptionMessage,
  params?: Record<string, string | number>
): never
```

**응답 형식 (params 없음):**

```json
{
  "id": "auth_session_not_found",
  "message": "Session not found"
}
```

**응답 형식 (params 있음):**

```json
{
  "id": "user_not_found",
  "message": "User with id=123 not found",
  "params": {
    "id": "123"
  }
}
```

## 파라미터 인터폴레이션

메시지에서 `{key}` 형식의 플레이스홀더를 사용할 수 있습니다:

```typescript
// 메시지 정의
const USER_EXCEPTIONS = {
  NOT_FOUND: {
    id: 'user_not_found',
    message: 'User with id={id} not found',
  },
};

// 파라미터와 함께 사용
throwException(NotFoundException, USER_EXCEPTIONS.NOT_FOUND, { id: '123' });

// 응답 JSON:
// {
//   "id": "user_not_found",
//   "message": "User with id=123 not found",
//   "params": { "id": "123" }
// }
```

## Best Practices

1. **일관된 ID 명명 규칙**: `<domain>_<context>_<detail>` 형식 사용 (언더스코어)

   - 예: `auth_session_not_found`, `user_profile_invalid`
   - 모바일 플랫폼(Android/iOS) 호환성을 위해 언더스코어 사용

2. **동적 값은 파라미터로**: 메시지에 변수가 필요하면 `{key}` 플레이스홀더 사용

3. **명확한 메시지**: 프론트엔드 개발자가 이해하기 쉬운 기본 메시지 작성

4. **타입 안정성**: TypeScript의 `as const`를 사용하여 타입 안정성 보장

5. **문서화**: 새로운 예외를 추가할 때 이 README를 업데이트

## 프론트엔드 i18n 예시

### React (react-i18next)

```typescript
// i18n 설정
const resources = {
  ko: {
    translation: {
      auth_session_not_found: '세션을 찾을 수 없습니다',
      auth_session_invalid: '유효하지 않은 세션입니다',
      user_not_found: 'ID가 {{id}}인 사용자를 찾을 수 없습니다',
    },
  },
};

// 에러 핸들러
const handleError = (error) => {
  const errorData = JSON.parse(error.response.data.message);
  const message = t(errorData.id, errorData.params);
  toast.error(message);
};
```

### Vue (vue-i18n)

```typescript
// i18n 설정
const messages = {
  ko: {
    auth_session_not_found: '세션을 찾을 수 없습니다',
    user_not_found: 'ID가 {id}인 사용자를 찾을 수 없습니다',
  },
};

// 에러 핸들러
const handleError = (error) => {
  const errorData = JSON.parse(error.response.data.message);
  const message = $t(errorData.id);
  notification.error({ message });
};
```

### Android (strings.xml)

```xml
<!-- res/values/strings.xml (English) -->
<resources>
    <string name="auth_session_not_found">Session not found</string>
    <string name="auth_session_invalid">Invalid session</string>
    <string name="auth_credentials_invalid">Invalid email or password</string>
    <string name="user_not_found">User with id=%1$s not found</string>
</resources>

<!-- res/values-ko/strings.xml (Korean) -->
<resources>
    <string name="auth_session_not_found">세션을 찾을 수 없습니다</string>
    <string name="auth_session_invalid">유효하지 않은 세션입니다</string>
    <string name="auth_credentials_invalid">이메일 또는 비밀번호가 올바르지 않습니다</string>
    <string name="user_not_found">ID가 %1$s인 사용자를 찾을 수 없습니다</string>
</resources>
```

```kotlin
// Kotlin 사용 예시
data class ErrorResponse(val id: String, val message: String)

fun handleError(errorJson: String) {
    val error = Gson().fromJson(errorJson, ErrorResponse::class.java)

    // 리소스 ID로 변환 (auth_session_not_found -> R.string.auth_session_not_found)
    val resourceId = context.resources.getIdentifier(
        error.id,
        "string",
        context.packageName
    )

    val localizedMessage = if (resourceId != 0) {
        context.getString(resourceId)
    } else {
        error.message // 폴백: 기본 영문 메시지
    }

    Toast.makeText(context, localizedMessage, Toast.LENGTH_SHORT).show()
}
```

### iOS (Localizable.strings)

```swift
// en.lproj/Localizable.strings (English)
"auth_session_not_found" = "Session not found";
"auth_session_invalid" = "Invalid session";
"auth_credentials_invalid" = "Invalid email or password";
"user_not_found" = "User with id=%@ not found";

// ko.lproj/Localizable.strings (Korean)
"auth_session_not_found" = "세션을 찾을 수 없습니다";
"auth_session_invalid" = "유효하지 않은 세션입니다";
"auth_credentials_invalid" = "이메일 또는 비밀번호가 올바르지 않습니다";
"user_not_found" = "ID가 %@인 사용자를 찾을 수 없습니다";
```

```swift
// Swift 사용 예시
struct ErrorResponse: Codable {
    let id: String
    let message: String
}

func handleError(errorJson: String) {
    guard let data = errorJson.data(using: .utf8),
          let error = try? JSONDecoder().decode(ErrorResponse.self, from: data) else {
        return
    }

    // NSLocalizedString으로 번역된 메시지 가져오기
    let localizedMessage = NSLocalizedString(
        error.id,
        value: error.message, // 폴백: 기본 영문 메시지
        comment: ""
    )

    // 알림 표시
    let alert = UIAlertController(
        title: "Error",
        message: localizedMessage,
        preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "OK", style: .default))
    present(alert, animated: true)
}
```

## 모바일 플랫폼 호환성

### ✅ Android/iOS에서 언더스코어(\_) 사용 가능

**Android:**

- `strings.xml`의 `<string name="...">`에서 언더스코어 사용 가능
- 리소스 이름으로 인식됨 (예: `R.string.auth_session_not_found`)
- ✅ **권장**: 언더스코어는 표준 네이밍 컨벤션

**iOS:**

- `Localizable.strings`의 키로 언더스코어 사용 가능
- `NSLocalizedString`에서 정상 작동
- ✅ **권장**: 언더스코어는 일반적으로 사용됨

### ❌ Dot(.)는 모바일에서 비권장

**Android:**

- Dot(.)은 리소스 이름에 사용 불가
- XML에서 에러 발생: `<string name="auth.session.notFound">` ❌
- 대안이 필요함 (언더스코어로 변환 등)

**iOS:**

- Dot은 기술적으로 가능하지만 권장되지 않음
- 일부 도구에서 문제 발생 가능

### 권장 사항

따라서 **언더스코어(`_`)를 사용하는 것이 모든 플랫폼에서 호환성이 가장 좋습니다**:

- ✅ Web (React, Vue, Angular 등)
- ✅ Android
- ✅ iOS
- ✅ React Native
- ✅ Flutter
