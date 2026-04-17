# Error White Paper

## 1. `npm -v` 실행 실패

**오류 내용**

- `npm -v` 실행 시 PowerShell 실행 정책 때문에 `npm.ps1`가 로드되지 않아 실패했다.

**실행 명령 및 코드**

- 실패: `npm -v`
- 우회: `cmd /c npm.cmd -v`

**원인 분석**

- Windows PowerShell은 `npm.ps1` 실행을 제한할 수 있다.
- 이 환경에서는 `npm.cmd` 경로로 실행하는 것이 안전하다.

**해결 및 방안**

- npm 실행은 `npm.cmd`로 표준화했다.
- PowerShell에서는 `cmd /c npm.cmd ...` 패턴을 사용한다.

**재검증 결과**

- lint: 성공
- build: 성공
- test: 성공
- `cmd /c npm.cmd -v`: 성공 (`11.9.0`)

---

## 2. `node --test` 실행 실패 (`EPERM`)

**오류 내용**

- `node --test` 실행이 하위 프로세스 spawn 단계에서 `EPERM`으로 실패했다.

**실행 명령 및 코드**

- 실패: `node --test`
- 우회: `node --test --test-isolation=none`
- 스크립트: `npm.cmd test` (내부적으로 `node --test --test-isolation=none` 실행)

**원인 분석**

- `node --test`는 기본 설정에서 테스트 격리를 위해 subprocess를 사용한다.
- 현재 샌드박스 환경은 프로세스 spawn 동작이 제한된다.

**해결 및 방안**

- 테스트 실행을 `node --test --test-isolation=none`으로 고정했다.
- 프로세스 spawn이 필요한 검증은 동일 프로세스 방식으로 우회한다.

**재검증 결과**

- lint: 성공
- build: 성공
- test: 성공 (`node --test --test-isolation=none`)

---

## 3. 서버 스모크 테스트 실행 실패 (`node:child_process`)

**오류 내용**

- `node:child_process`로 서버 프로세스를 띄우는 스모크 테스트가 `EPERM`으로 실패했다.

**실행 명령 및 코드**

- 실패 유형: `node:child_process` 기반 프로세스 생성 (예: `spawn`)

**원인 분석**

- 별도 프로세스 기반 스모크 테스트도 동일한 spawn 제한을 받는다.
- 이 환경에서는 child process 생성 자체가 제한된다.

**해결 및 방안**

- 서버 기동 검증은 동일 프로세스 기준 검증으로 우회한다.
- 별도 프로세스 기반 테스트는 환경 허용 여부를 먼저 확인하고 선택적으로 실행한다.

**재검증 결과**

- lint: 성공
- build: 성공
- test: 성공
- 스모크 테스트(별도 프로세스): 미실행 (환경 제약)
