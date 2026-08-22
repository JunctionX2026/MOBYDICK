# 문서 탐색 안내

필요한 사실을 가장 가까운 원본에서 한 번에 찾도록 문서를 구성해요. 구현과 테스트가 현재 동작의 최종 근거이고, 스펙은 합의한 동작의 근거예요. 문서는 경로와 결정 이유만 설명해요.

| 알고 싶은 내용            | 먼저 볼 곳                                                     |
| ------------------------- | -------------------------------------------------------------- |
| 저장소 공통 규칙과 스택   | [`AGENTS.md`](../AGENTS.md)                                    |
| 무엇을 왜 만드는지        | [`specs/product/brief.md`](../specs/product/brief.md)          |
| 기능별 합의된 동작        | [`specs/README.md`](../specs/README.md)                        |
| 도메인 용어와 식별자 규칙 | [`specs/product/glossary.md`](../specs/product/glossary.md)    |
| 단계 사이 데이터 형식     | `specs/features/010-*`, `specs/features/011-*`                 |
| 외부 사례를 채택한 이유   | [`research/README.md`](../research/README.md)                  |
| 테스트 계층과 판단 기준   | [`QUALITY.md`](QUALITY.md)                                     |
| 실제 검증 명령            | 루트와 각 워크스페이스의 `package.json`                        |

새 문서를 만들기 전에 소스, 테스트, 스펙, 가까운 `AGENTS.md` 또는 기존 연구 노트로 설명할 수 있는지 확인해요. 완료된 계획, 시점별 리뷰, 현재 구현과 중복되는 설명은 Git 기록에 맡기고 저장소에서는 제거해요.
