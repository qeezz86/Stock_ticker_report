# Mistakes Log

- `npm`을 PowerShell에서 직접 실행하려 해 `npm.ps1` 실행 정책 오류를 만났다. 이후 `cmd /c npm.cmd ...`로 고정했다.
- 기본 `node --test`는 이 샌드박스에서 `spawn EPERM`으로 실패했다. 이후 `node --test --test-isolation=none`으로 바꿔 통과시켰다.
- 서버를 별도 프로세스로 띄워 확인하려는 스모크 테스트도 같은 spawn 제한에 걸렸다. 프로세스 기반 검증은 이 환경에서 피해야 한다.
