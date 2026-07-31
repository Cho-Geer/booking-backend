# CRM 予約プラットフォーム バックエンド

CRM スタイルの予約プラットフォーム向け、NestJS ベースのバックエンドです。

本サービスは、認証、予約管理、ユーザーとサービスの管理、予約枠管理、Redis ベースのキャッシュ、Swagger ドキュメント、WebSocket ベースのリアルタイム通知を提供します。

詳細なエンドポイント仕様: [docs/api-contract.md](./docs/api-contract.md)

## 技術スタック

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- Swagger
- Jest

## 現在のモジュール

本アプリケーションは [src/app.module.ts](./src/app.module.ts) で以下のモジュールを配線しています。

業務モジュール:

- `auth`
- `users`
- `bookings`
- `services`
- `time-slots`
- `email`
- `retention`

共有インフラ:

- `common/database`
- `common/prisma`
- `common/file-upload`
- `common/websocket`

## API 概要

ローカルバックエンドの起動アドレス:

```text
http://localhost:3001
```

アプリはグローバル API プレフィックスを `/v1` に設定しているため、アプリケーションのエンドポイントは次の配下で公開されます:

```text
http://localhost:3001/v1/...
```

Swagger UI は次のアドレスで利用可能です:

```text
http://localhost:3001/api/docs
```

### このブランチの主要契約

これらはレビュアーとフロントエンド作業が現在の契約として扱うべき主要エンドポイントです:

- `POST /v1/auth/login`
- `POST /v1/bookings`
- `GET /v1/bookings/all`
- `GET /v1/bookings/by-date?date=YYYY-MM-DD`
- `GET /v1/bookings/:id`
- `PATCH /v1/bookings/:id`
- `PATCH /v1/bookings/:id/cancel`
- `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`
- `GET /v1/services`
- `GET /v1/services/all`

### 重要な予約ルール

- `/bookings/all` はこのブランチにおいて、ユーザーと管理者クライアントの共有一覧エンドポイントです。
- 非管理者ユーザーについては、入力クエリが広くても、バックエンドは `/bookings/all` を現在ログイン中のユーザーに絞り込みます。
- このブランチでは `/bookings/me` を採用していないため、契約の一部として扱わないでください。

### エンドポイント補足

#### 認証

- `POST /v1/auth/login`
  電話番号と確認コードによるログイン。
  ログイン情報を返し、認証 Cookie を設定します。

#### 予約

- `POST /v1/bookings`
  認証ユーザー向けに予約を作成します。
  `userId` が省略された場合、バックエンドは現在のユーザーから補完します。

- `GET /v1/bookings/all`
  ユーザー / 管理者共有の一覧エンドポイント。
  予約クエリフィルタとページネーションパラメータを受け付けます。
  非管理者ユーザーはサーバーサイドで自分のレコードに制限されます。

- `GET /v1/bookings/by-date?date=YYYY-MM-DD`
  単一日付の予約を返します。
  日付ベースの空き状況確認やカレンダー形式のビューで使用されます。

- `GET /v1/bookings/:id`
  指定 ID の予約を 1 件返します。
  非管理者ユーザーは自分の予約のみアクセス可能です。

- `PATCH /v1/bookings/:id`
  予約を更新します。
  非管理者ユーザーは自分の予約のみ更新可能です。

- `PATCH /v1/bookings/:id/cancel`
  このブランチでフロントエンド互換のキャンセル用エンドポイント。

#### 予約枠

- `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`
  単一日のスロット空き状況を返します。
  `date` は `YYYY-MM-DD` 形式で指定する必要があります。

#### サービス

- `GET /v1/services`
  予約フローで使用される共有サービス一覧エンドポイント。

- `GET /v1/services/all`
  ページネーション / フィルタリングをサポートした管理者向けサービス一覧エンドポイント。

## ランタイム機能

- アクセストークンとリフレッシュトークンを用いた JWT ベース認証
- 認証 Cookie および CSRF トークン Cookie のサポート
- ロールと権限によるルートガード
- 予約 CRUD と予約統計
- 管理者向けサービス管理
- 予約枠の可用性照会
- ユーザー管理とプロフィール API
- Redis キャッシュ設定
- WebSocket ゲートウェイ対応
- Handlebars テンプレートを利用したメールモジュール
- スケジュール実行されるリテンションジョブ
- ファイルアップロードモジュール

## データモデル

現在の Prisma スキーマには以下の主要モデルが含まれています:

- `User`
- `UserSession`
- `Appointment`
- `AppointmentHistory`
- `TimeSlot`
- `Service`
- `ServiceCategory`
- `Notification`
- `SystemSetting`
- `BlockedTimeSlot`
- `ActivityLog`
- `SystemLog`
- `AppointmentStatistic`

完全なスキーマは [prisma/schema.prisma](./prisma/schema.prisma) を参照してください。

## 環境

サンプル env ファイルが用意されています:

- `.env.example`
- `.env.production.example`

ローカル開発では、`.env.example` を `.env.development` にコピーし、各自の環境に合わせて値を調整してください。

シークレットを含む実環境の env ファイルはコミットしないでください。

主要な変数:

- `PORT`
- `API_PREFIX`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL` または `FRONTEND_URLS`
- `CSRF_ENABLED`

環境に関する補足:

- このブランチでは `PORT=3001` が想定されるローカルバックエンドのポートです。
- ランタイムコードが CSRF ミドルウェアのマウント時に `process.env.API_PREFIX` を参照しているため、サンプルには `API_PREFIX=/v1` が残っています。
- このブランチの API 契約は `/v1` です。
- `FRONTEND_URL` はレガシーな単一オリジン向け CORS 設定です。
- `FRONTEND_URLS` は複数のフロントエンドオリジンを許可する必要がある場合の複数オリジン CORS 許可リストです。

## ローカル開発

依存関係をインストール:

```bash
npm install
```

開発サーバーを起動:

```bash
npm run start:dev
```

ローカルでの想定フロントエンドは `http://localhost:3000`、バックエンド API は `http://localhost:3001` です。

ローカル URL:

```text
http://localhost:3001
```

本番ビルド:

```bash
npm run build
```

ビルド済みアプリを起動:

```bash
npm run start:prod
```

## データベースコマンド

よく使う Prisma スクリプト:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm run db:init
```

## テスト

ユニットテストを実行:

```bash
npm run test
```

カバレッジを実行:

```bash
npm run test:cov
```

e2e テストを実行:

```bash
npm run test:e2e
```

## Docker

付属の [docker-compose.yml](./docker-compose.yml) はインフラサービスのみを起動します:

- PostgreSQL
- Redis

次のコマンドで起動します:

```bash
docker compose up -d
```

NestJS API 自体はこのコマンドでは起動せず、上記の npm スクリプトで別途起動します。

## テスト用 Docker 環境セットアップ

E2E テストは TestContainers を使用して PostgreSQL コンテナを起動します。ローカルでこれらのテストを実行するには、動作する Docker 環境が必要です。

### 1. Docker のインストール

#### Windows
1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) をダウンロードしてインストール
2. インストール時に WSL 2 バックエンド(推奨)または Hyper-V バックエンドを有効化
3. インストール後にコンピュータを再起動
4. スタートメニューから Docker Desktop を起動

#### macOS
1. [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) をダウンロードしてインストール
2. Docker.app を Applications フォルダに移動
3. Applications から Docker Desktop を起動

#### Linux(Ubuntu/Debian)
```bash
# 古いバージョンをアンインストール
sudo apt-get remove docker docker-engine docker.io containerd runc

# 依存関係をインストール
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release

# Docker 公式の GPG キーを追加
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 安定版リポジトリをセットアップ
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker Engine をインストール
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io

# Docker サービスを起動
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Docker インストールの確認

```bash
docker --version
docker info
docker run hello-world
```

### 3. ユーザー権限の設定(Linux/macOS)

`sudo` を使わずに済むよう、ユーザーを `docker` グループに追加します:

```bash
sudo usermod -aG docker $USER
# 変更を反映するため、一度ログアウトして再ログイン
```

### 4. TestContainers 環境の設定

TestContainers が Docker を検出できるよう環境変数を設定します:

#### Windows PowerShell
```powershell
$env:DOCKER_HOST = "npipe:////./pipe/docker_engine"
```

#### Linux/macOS Bash
```bash
export DOCKER_HOST=unix:///var/run/docker.sock
# 永続化のため ~/.bashrc または ~/.zshrc に追加
echo 'export DOCKER_HOST=unix:///var/run/docker.sock' >> ~/.bashrc
```

### 5. TestContainers 設定の確認

Docker 統合を確認するため、簡単なテストを実行します:

```bash
# booking-backend ディレクトリで
npm run test:e2e -- --testNamePattern="setup" --verbose
```

もしくは、検証スクリプトを使って Docker 環境を確認できます:

```powershell
# (Windows で)検証スクリプトを実行
./scripts/check-docker-env.ps1

# Linux/macOS の場合は、同様の bash スクリプトを作成してください
```

### 6. よくある問題のトラブルシューティング

#### "Could not find a working container runtime strategy"
- Docker Desktop が起動していることを確認(Windows/macOS)
- Docker サービスが起動していることを確認(Linux: `sudo systemctl status docker`)
- `DOCKER_HOST` 環境変数が正しく設定されているか確認
- ユーザー権限を確認(Linux: ユーザーが `docker` グループに属していること)

#### "Permission denied while trying to connect to the Docker daemon socket"
```bash
# Linux/macOS
sudo usermod -aG docker $USER
# 一度ログアウトして再ログイン
```

#### TestContainers タイムアウト
- (中国国内ユーザー向け)Docker イメージアクセラレータを設定してダウンロードを高速化
- 必要に応じてテスト設定のタイムアウトを延長

### 7. 代替案: Docker テストをスキップする

Docker が利用できない環境では、E2E テストをスキップできます:

```bash
npm run test  # ユニットテストのみ実行
```

CI/CD 環境では、Docker ベースのテストが自動で実行されます。

---

## 🇬🇧 English | 🇨🇳 中文

- [English version](./README.en.md)
- [中文版本](./README.zh.md)