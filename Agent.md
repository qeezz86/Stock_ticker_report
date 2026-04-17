# Mistakes Log

- `npm`을 PowerShell에서 직접 실행하려 해 `npm.ps1` 실행 정책 오류를 만났다. 이후 `cmd /c npm.cmd ...`로 고정했다.
- 기본 `node --test`는 이 샌드박스에서 `spawn EPERM`으로 실패했다. 이후 `node --test --test-isolation=none`으로 바꿔 통과시켰다.
- 서버를 별도 프로세스로 띄워 확인하려는 스모크 테스트도 같은 spawn 제한에 걸렸다. 프로세스 기반 검증은 이 환경에서 피해야 한다.
- 2026-04-17 셀프 테스트에서 `.env`가 없는데도 `process.loadEnvFile()`를 호출해 `ENOENT`로 서버가 종료된 적이 있다. 이후 `.env` 존재 여부를 확인한 뒤 로드하도록 수정했다.
- 2026-04-17 자동 실행 스크립트에서 `$home` 변수를 써서 PowerShell 예약 변수 `HOME`과 충돌한 적이 있다. 이후 `respHome` 같은 이름으로 바꿨다.
