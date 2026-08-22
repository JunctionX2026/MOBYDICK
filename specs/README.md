# 스펙

구현 전에 합의한 동작과 계약을 여기에 둬요. 스펙이 없는 동작은 구현하지 않고, 구현이 스펙과 달라지면 스펙을 먼저 고쳐요.

## 흐름

```
brief  →  spec  →  구현  →  스펙 상태 갱신
```

1. `product/brief.md`가 무엇을 왜 만드는지 정해요. 기능 스펙은 여기서 벗어나지 않아요.
2. 기능 스펙은 동작과 계약, 인수 기준, 미정 항목을 적어요. 구현 방법은 최소한만 적어요.
3. 스펙에 남은 `미정`이 구현을 막는다면 먼저 정하고 표에서 지워요. 정하지 못하면 범위를 줄여요.
4. 구현이 끝나면 인수 기준을 체크하고 상태를 `implemented`로 바꿔요.

## 상태

| 값            | 뜻                                                     |
| ------------- | ------------------------------------------------------ |
| `draft`       | 초안이에요. 미정이 남아 있어 구현을 시작하지 않아요.   |
| `agreed`      | 팀이 합의했어요. 이 문서를 근거로 구현할 수 있어요.    |
| `implemented` | 구현과 인수 기준이 일치해요.                           |

## 현황

| 스펙                                                                                     | 담당 범위                          | 상태    |
| ---------------------------------------------------------------------------------------- | ---------------------------------- | ------- |
| [`product/brief.md`](product/brief.md)                                                   | 제품 정의와 범위                   | `agreed` |
| [`product/glossary.md`](product/glossary.md)                                             | 도메인 용어 · 그래프 모델 · 식별자 규칙 | `agreed` |
| [`features/010-seam-suggestion-to-canvas.md`](features/010-seam-suggestion-to-canvas.md) | 접합부 A: 제안 → 캔버스            | `draft` |
| [`features/011-seam-workflow-to-deployment.md`](features/011-seam-workflow-to-deployment.md) | 접합부 B: 워크플로 → 배포      | `draft` |
| [`features/001-graph-knowledge-base.md`](features/001-graph-knowledge-base.md)            | ① 그래프 지식 베이스              | `draft` |
| [`features/002-workflow-canvas.md`](features/002-workflow-canvas.md)                      | ② 워크플로 캔버스                 | `draft` |
| [`features/003-serve-api-mcp.md`](features/003-serve-api-mcp.md)                          | ③ API / MCP 배포                  | `draft` |
| [`features/004-project.md`](features/004-project.md)                                      | 파이프를 담는 프로젝트 단위        | `agreed` |

접합부 스펙을 기능 스펙보다 먼저 확정해요. 접합부가 비어 있으면 세 기능이 따로 놀아요.

## 파일 규칙

- 기능 스펙은 `features/<3자리 번호>-<kebab-case 이름>.md`로 만들어요. `0xx`는 기능, `01x`는 접합부예요.
- 새 스펙은 [`TEMPLATE.md`](TEMPLATE.md)를 복사해서 시작하고 위 현황 표에 한 줄을 추가해요.
- 한 스펙은 사용자에게 보이는 하나의 결과를 설명해요. 화면 단위나 파일 단위로 쪼개지 않아요.
- 완료된 계획, 회의록, 시점별 리뷰는 여기에 남기지 않고 Git 기록에 맡겨요.
