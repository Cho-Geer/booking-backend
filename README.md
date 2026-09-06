# booking-backend ドキュメント一覧

## ドキュメント情報

- **目的**: `docs/` 配下のドキュメントの役割と読書動線を一枚で示す。

## 推奨読書動線

| 順 | ドキュメント | 一言説明 |
|---|---|---|
| 1 | [api-contract.md](./docs/api-contract.md) | エンドポイント単位の API 契約。フロント/バック統合の single source of truth（server-to-server の IF-01/IF-02 は対象外）。 |
| 2 | [sequence-diagrams/01〜05](./docs/sequence-diagrams/) | 全 43 業務シナリオを 5 つのシーケンス図で網羅。処理フローとコード根拠（file:line）を図で追う。 |
| 3 | [scenario-deep-dive.md](./docs/scenario-deep-dive.md) | 競合系・認可系の代表 3 シナリオ（P2034 再試行 / P2034 枯渇・P2002 / 非所有者キャンセル 404）を処理フロー・コード根拠・検証コマンド付きで深掘り。 |
| 4 | [redis-usage-and-schema.md](./docs/redis-usage-and-schema.md) | Redis の接続方法・キー schema・用途別詳細（トークンブラックリスト / SMS 検証コード / ヘルスチェック）。 |
| 5 | [manual-retry-procedure.md](./docs/manual-retry-procedure.md) | Salesforce 連携（IF-02 コマンド系 / IF-01 投影系）の失敗・滞留時の手動リトライ運用手順書。 |

## シーケンス図の構成

全 43 業務シナリオを 5 つのシーケンス図で網羅する。各図は「ビジネスシナリオ一覧 + シナリオ別解説 + Participant evidence（コード根拠）」で構成する。

| 図 | 対象フロー | シナリオ数 |
|---|---|---|
| [01](./docs/sequence-diagrams/01-authentication-login-register.md) | 認証（send-code / login / register → JWT 発行） | 7 |
| [02](./docs/sequence-diagrams/02-service-timeslot-discovery.md) | サービス・時間枠発見（3 つの GET フローと状態合成） | 6 |
| [03](./docs/sequence-diagrams/03-booking-creation.md) | 予約作成（POST /bookings、Serializable トランザクション） | 10 |
| [04](./docs/sequence-diagrams/04-booking-cancellation.md) | 予約キャンセル（PATCH /bookings/:id/cancel） | 8 |
| [05](./docs/sequence-diagrams/05-jwt-guard-token-refresh.md) | JWT ガード + axios 401 自動リフレッシュ | 12 |
| **計** | — | **43** |

## 関連リポジトリ

- フロントエンド: [booking-frontend](https://github.com/Cho-Geer/booking-frontend)（React + Redux + axios）

## ドキュメント追加・更新の規約

- `.gitignore` は `docs/` を既定で無視するため、バージョン管理対象のドキュメントは `!/docs/...` の whitelist に追加する。
- file:line アンカーは commit 時点の grep -n 実測値で記載し、ソース変更後は再実測で更新する（原文の行号を流用しない）。
- ソースコード内のエラーメッセージは翻訳せず中国語 literal のまま引用し、必要に応じて（※コード内のメッセージ literal）を注記する。
