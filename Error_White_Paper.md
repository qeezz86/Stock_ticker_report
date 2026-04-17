# Error White Paper

## 1. `npm -v` 실행 실패

**오류 내용**

- `npm -v` 실행 시 PowerShell 실행 정책 때문에 `npm.ps1`가 로드되지 않아 실패했다.

**실행 명령 및 코드**

- 실패: `npm -v`
- 회피: `cmd /c npm.cmd -v`

**원인 분석**

- Windows PowerShell은 `npm.ps1` 실행을 제한할 수 있다.
- 이 환경에서는 `npm.cmd` 경로로 실행하는 것이 안전하다.

**해결 및 방안**

- npm 실행은 `npm.cmd`로 통일했다.
- PowerShell에서는 `cmd /c npm.cmd ...` 패턴을 사용한다.

**검증 결과**

- lint: 성공
- build: 성공
- test: 성공
- `cmd /c npm.cmd -v`: 성공 (`11.9.0`)

---

## 2. `node --test` 실행 실패 (`EPERM`)

**오류 내용**

- `node --test` 실행 시 하위 프로세스 spawn 단계에서 `EPERM`으로 실패했다.

**실행 명령 및 코드**

- 실패: `node --test`
- 회피: `node --test --test-isolation=none`
- 스크립트: `npm.cmd test` (내부적으로 `node --test --test-isolation=none` 실행)

**원인 분석**

- `node --test`는 기본 설정에서 테스트 격리를 위해 subprocess를 사용한다.
- 현재 샌드박스 환경은 프로세스 spawn 동작을 제한한다.

**해결 및 방안**

- 테스트 실행은 `node --test --test-isolation=none`으로 고정했다.
- 프로세스 spawn이 필요한 검증은 동일 프로세스 방식으로 대체한다.

**검증 결과**

- lint: 성공
- build: 성공
- test: 성공 (`node --test --test-isolation=none`)

---

## 3. 서버 스모크 테스트 실패 (`node:child_process`)

**오류 내용**

- `node:child_process`로 서버 프로세스를 띄워 확인하려는 스모크 테스트가 `EPERM`으로 실패했다.

**실행 명령 및 코드**

- 실패 유형: `node:child_process` 기반 프로세스 생성

**원인 분석**

- 별도 프로세스 기반 테스트도 동일한 spawn 제한에 걸린다.
- 이 환경에서는 child process 생성 자체가 제한된다.

**해결 및 방안**

- 서버 기동 검증은 동일 프로세스 또는 단순 HTTP 호출 방식으로 대체한다.
- 별도 프로세스 기반 테스트는 환경 허용 여부를 먼저 확인한다.

**검증 결과**

- lint: 성공
- build: 성공
- test: 성공
- 별도 프로세스 기반 스모크 테스트: 미실행(환경 제약)

---

## 4. 2026-04-17 셀프 테스트 중 추가 오류

**오류 내용**

- `server.js`에서 `process.loadEnvFile()`를 `.env` 존재 확인 없이 호출해, `.env`가 없는 상태에서 `ENOENT: no such file or directory, open '.env'`로 서버가 종료됐다.
- 자동 실행 테스트 스크립트에서 `$home` 변수를 사용해 PowerShell 예약 변수 `HOME`과 충돌하는 오류가 발생했다.

**원인 분석**

- `.env`는 선택 설정 파일인데, 강제 로드하면 파일이 없을 때 서버 시작 자체가 실패한다.
- PowerShell은 `HOME`을 예약 변수로 취급하므로 동일한 이름의 변수를 만들 수 없다.

**해결 및 방안**

- `.env`가 존재할 때만 `process.loadEnvFile()`를 호출하도록 수정했다.
- 셀프 테스트 스크립트에서 `$respHome` 같은 비충돌 변수명을 사용했다.
- 향후 실행 스크립트는 예약 변수명과 선택 파일 부재를 먼저 점검한다.

**검증 결과**

- lint: 성공
- build: 성공
- test: 성공
