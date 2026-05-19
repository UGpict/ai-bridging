@AGENTS.md
# TascaLL — CLAUDE.md

> このファイルはClaude Codeへの指示の唯一の参照元。実装前に必ず読むこと。

---

## プロジェクト概要

**TascaLL** — 上司の曖昧な指示をGeminiが構造化・複数タスクに分解し、バッジスコアに基づいて最適な部下に自動割り振りするDevOps支援Webアプリ。（旧称: AI Bridging）

- ハッカソン: ファインディ × Google Cloud Japan「DevOps × AI Agent Hackathon」
- 締切: 2025年7月10日 / 決勝: 2025年8月19日（渋谷）
- 開発者: 1人

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js（App Router） |
| API層 | Next.js API Route |
| AI | Gemini 3.1 Flash Lite（`gemini-3.1-flash-lite`）via Vertex AI |
| DB | Firestore |
| 認証 | Firebase Authentication（Googleログイン・メール/パスワード） |
| ホスティング | Cloud Run |

---

## ディレクトリ構成

```
/
├── app/
│   ├── login/
│   │   └── page.tsx              # Googleログイン + メール/パスワードログイン・新規登録
│   ├── onboarding/
│   │   └── page.tsx              # 新規ユーザー：マネージャー作成 or 招待コードで参加
│   ├── dashboard/
│   │   ├── page.tsx              # 上司：4列カンバン・採点傾向チャート・メンバー一覧
│   │   ├── tasks/[id]/page.tsx   # 上司：タスクレビュー画面（スライダー評価・重み表示）
│   │   ├── AddMemberButton.tsx   # メンバー追加モーダル（Client Component）
│   │   ├── DeleteMemberButton.tsx # メンバー削除ボタン（Client Component）
│   │   └── InviteCodeCard.tsx    # 招待コード表示カード（Client Component）
│   ├── chat/
│   │   └── page.tsx              # 上司：モード選択→チャット→VS推薦カード→割り振り確定
│   ├── tasks/
│   │   ├── page.tsx              # 部下：自分のタスク一覧（バッジ・スキルバー表示）
│   │   └── [id]/
│   │       └── page.tsx          # 部下：タスク詳細＋成果物提出＋レベルアップモーダル
│   ├── components/
│   │   ├── BadgeDisplay.tsx      # バッジ・スコア・プログレスバー表示
│   │   ├── CandidateCards.tsx    # VS推薦カード（framer-motion）3枚スライドイン
│   │   ├── Header.tsx            # 共通ヘッダー
│   │   ├── LevelUpModal.tsx      # レベルアップ演出モーダル（confetti）
│   │   ├── Sidebar.tsx           # 左サイドバーナビ
│   │   └── ScoringWeightsChart.tsx # 採点重み棒グラフ（学習可視化）
│   └── api/
│       ├── auth/
│       │   ├── me/route.ts           # 自分のユーザー情報取得
│       │   ├── session/route.ts      # Cookieセッション発行・ロール返却
│       │   └── onboard/route.ts      # 新規ユーザーオンボーディング（組織作成/参加）
│       ├── chat/
│       │   └── route.ts          # Geminiとのチャット往復・タスク分解（mode対応）
│       ├── assign/
│       │   └── route.ts          # 3候補アルゴリズム推薦（Gemini不使用）・承認
│       ├── evaluate/
│       │   ├── route.ts          # AI採点のみ（status→ai_evaluated、バッジ更新なし）
│       │   └── manager/route.ts  # 上司スコア入力→重み学習→バッジ確定
│       ├── dev/
│       │   └── reset-weights/route.ts  # デモ用重みリセット（ENABLE_DEV_TOOLS=trueで有効）
│       ├── members/
│       │   ├── route.ts          # メンバー追加API（POST）
│       │   └── [uid]/route.ts    # メンバー削除API（DELETE）
│       └── tasks/
│           └── [id]/route.ts     # タスク個別取得・成果物提出
├── lib/
│   ├── gemini.ts             # Gemini API クライアント（Vertex AI）
│   ├── firebase.ts           # Firebase Client SDK初期化（APIキーはフォールバック値をハードコード）
│   ├── firebaseAdmin.ts      # Firebase Admin SDK初期化
│   └── firestore.ts          # Firestoreのread/write関数
├── types/
│   └── index.ts              # 型定義
├── scripts/
│   ├── make_env_yaml.py           # .env.local → env.yaml 変換スクリプト（デプロイ用）
│   └── seed-evaluation-history.ts # デモ用評価履歴シード（SEED_MANAGER_UID指定）
├── tsconfig.node.json        # スクリプト用TSConfig（CommonJS）
├── Dockerfile                # Cloud Run用マルチステージビルド
├── .dockerignore
└── CLAUDE.md                 # このファイル
```

---

## 画面とロール

ログイン後、Firestoreのユーザードキュメントの`role`フィールドで分岐：
- `role: "manager"` → `/dashboard` にリダイレクト
- `role: "member"` → `/tasks` にリダイレクト
- `role: "new"`（未登録）→ `/onboarding` にリダイレクト

### オンボーディングフロー（`/onboarding`）
1. **マネージャーとして作成** → 組織名を入力 → 6桁招待コードが発行される
2. **メンバーとして参加** → 招待コードを入力 → 組織に参加

---

## データモデル（Firestore）

### `users/{uid}`
```ts
{
  uid: string
  name: string
  email: string
  role: "manager" | "member"
  badgeScore: number        // 累計スコア
  badgeLevel: "見習い" | "初級" | "中級" | "上級" | "エキスパート"
  skills: {                 // スキル別スコア（推薦に使用）
    documentation: number
    communication: number
    technical: number
    ci_cd: number
  }
}
```

### `tasks/{taskId}`
```ts
{
  id: string
  title: string
  description: string
  requiredSkill?: "documentation" | "communication" | "technical" | "ci_cd"
  deadline?: "today" | "project"
  assigneeUid: string
  assigneeName: string
  status: "pending" | "submitted" | "ai_evaluated" | "evaluated"
  //       進行中       提出済        AI採点済(上司待ち)   確定済
  createdAt: Timestamp
  submission?: string
  prUrl?: string
  evaluation?: {
    aiBreakdown: {
      requirement: number   // 0-40
      clarity: number       // 0-30
      completeness: number  // 0-30
    }
    aiScore: number         // breakdown合計（0-100）。上司には非表示
    aiFeedback: string      // 部下に表示するフィードバック
    managerScore?: number   // 上司が入力するまでundefined
    managerComment?: string
    finalScore: number      // managerScoreがあればそちら、なければaiScore
    delta: number           // バッジスコア増減
    level: string           // 更新後のバッジレベル
  }
}
```

### `organizations/{managerUid}`
```ts
{
  id: string
  name: string
  managerUid: string
  managerName: string
  inviteCode: string        // 6桁英数字
  scoringWeights?: {        // 採点重み（デフォルト全て1.0）
    requirement: number     // 0.5〜1.5
    clarity: number
    completeness: number
  }
  evaluationHistory?: {     // 直近20件の評価履歴（重み学習用）
    taskId: string
    aiScore: number
    managerScore: number
    aiBreakdown: { requirement, clarity, completeness }
    timestamp: Timestamp
  }[]
}
```

### `sessions/{sessionId}`
```ts
{
  id: string
  managerUid: string
  orgId?: string
  originalInstruction: string
  clarifiedTasks: ClarifiedTask[]
  assignmentProposal: Assignment[]    // 後方互換用（現在は candidateProposals を使用）
  candidateProposals?: {              // VS推薦カードデータ
    taskIndex: number
    taskTitle: string
    requiredSkill: string
    candidates: {                     // 1〜3枚
      uid: string
      name: string
      badgeLevel: string
      badgeScore: number
      type: "skill_match" | "growth" | "load_balance"
      reason: string
      skills: { ... }
    }[]
  }[]
  status: "chatting" | "proposed" | "approved"
  messages: { role: "user" | "model"; content: string }[]
  createdAt: Timestamp
}
```

---

## AIフロー詳細

### 1. タスク分解（`/api/chat`）

リクエストに `mode: "project" | "today"` を含める。

**projectモード（デフォルト）：**
- Q&Aを3〜5往復して曖昧な指示を明確化してからタスク分解
- 確認質問は1回につき1〜2個に絞る

**todayモード（今日中タスク）：**
- Q&Aは原則なし。最初のメッセージから即座にタスク分解
- どうしても不明な点が1つある場合のみ1問だけ質問可

**共通出力フォーマット：**

```json
{
  "status": "complete",
  "tasks": [
    {
      "title": "タスク名",
      "description": "詳細説明",
      "requiredSkill": "documentation | communication | technical",
      "deadline": "today | project"
    }
  ]
}
```

- 会話継続中は `{"status": "questioning", "message": "確認質問文"}` を返す

### 2. 担当者推薦（`/api/assign`）— Phase 1 改修済み

**Gemini不使用**。サーバー側アルゴリズムで各タスクに3枚のカードを生成する。

| カード | タイプ | 選出ロジック |
|---|---|---|
| ⚔️ スキルマッチ | `skill_match` | `requiredSkill` スコアが最高の人 |
| 🌱 成長機会 | `growth` | 次バッジ閾値まで最も近い人 |
| ⚖️ 負荷分散 | `load_balance` | 未評価タスク数が最少の人 |

- 同一人物が複数タイプに該当する場合は次点を補充
- メンバーが3人未満なら出せる枚数だけ返す（エラーにしない）
- カードの順序はシャッフル（VSゲーム感）
- POST: `candidateProposals` を返す + session に保存
- PUT: `selectedAssignments: {taskIndex, assigneeUid, assigneeName, candidateType}[]` を受け取りタスク作成

### 3. 成果物評価（2段階）— Phase 1 改修済み

#### Step 1: AI採点 `POST /api/evaluate`（部下が提出後に自動実行）

- status を `"ai_evaluated"` に変更（`"evaluated"` にはしない）
- `evaluation.aiBreakdown` + `evaluation.aiScore` + `evaluation.aiFeedback` を保存
- バッジ更新は**しない**
- 上司の `scoringWeights` を取得してプロンプトに反映（採点傾向補正）
- 部下へのレスポンスには `aiBreakdown` を含めない

#### Step 2: 上司評価 `POST /api/evaluate/manager`（上司がレビュー画面で入力）

- `managerScore`（0-100）+ `managerComment?` を受け取る
- バッジ更新: `updateUserBadge()` で `finalScore` 基準で更新
- 重み学習: `learnWeights()` で `scoringWeights` を更新
  - 学習率: 0.05、重みクリップ: 0.5〜1.5、最大変動: ±0.1/回
  - 履歴5件未満は学習しない（ノイズ防止）
- `evaluationHistory` に追記（直近20件を保持）

**採点ルーブリック（合計100点）：**

```
【タスク要件充足度】0-40点  【明確性】0-30点  【完結性】0-30点
```

**AI採点プロンプトへの重み反映例：**
```
あなたの会社の採点傾向として requirement を 1.30 倍で重視してください
```

---

## Gemini レート制限とリトライ戦略

Vertex AI の `gemini-3.1-flash-lite` には QPM（クエリ/分）制限がある。デモ中に 429 が出ると致命的。

### 現状の実装
`lib/gemini.ts` にリトライロジック**実装済み**。最大3回、exponential backoff（1s → 2s → 4s）。429は `isRateLimitError()` で検知してリトライ、最終的に失敗すると API Route の `catch` で 500 として返る。

### デモ対策（優先度順）
1. **デモ前にウォームアップしない** — デモ直前に大量テストをしない
2. **チャット送信を連打しない** — UI の `disabled={loading}` が保護しているが念のため
3. **429 が出たら** — リトライが3回走る（最大7秒）。それでも失敗なら30〜60秒待つ

---

## スキルスコアの初期値と推薦ロジック

### 初期値
`AddMemberButton.tsx` のスライダーで追加時に指定する。デフォルト値は全スキル **50**。メンバー追加モーダルでスライダーを調整することで差をつけられる。

### スコア更新ロジック（評価後）
`/api/evaluate/manager` → `updateUserBadge()` で以下を更新（Phase 1以降は上司評価確定時のみ）：
- `badgeScore` += `delta`（`finalScore` 基準で算出）
- `skills.{requiredSkill}` += `delta`
- `badgeLevel` は `badgeScore` の閾値で再計算

### デモ用シード
```powershell
# 評価履歴20件を投入して採点重みを偏った状態にする
$env:SEED_MANAGER_UID="<managerのUID>"; npx ts-node --project tsconfig.node.json scripts/seed-evaluation-history.ts
```
シード後: `requirement: 1.5x, clarity: 1.5x, completeness: 1.5x`（全傾向が上限値）になる。
実際のデモではシード後に数件リアル評価を入れて重みが動く様子を見せる。

---

## Firestore 複合インデックス

`firestore.indexes.json` に定義済み。`npx firebase-tools deploy --only firestore:indexes` でデプロイする。

必要なインデックス（追加・変更時に更新すること）：
- `tasks`: `orgId` (ASC) + `createdAt` (DESC) — ダッシュボードの全タスク一覧
- `tasks`: `assigneeUid` (ASC) + `createdAt` (DESC) — 部下のタスク一覧
- `users`: `role` (ASC) + `orgId` (ASC) — orgIdでフィルタしたメンバー取得

**注意:** `where`は必ず`orderBy`より前に書くこと。逆順だとFirestoreエラー。

---

## Firestore セキュリティルール

### 現状の方針
**Firestore への全アクセスは Firebase Admin SDK（サーバーサイド）経由のみ。**
クライアント SDK は Firebase Authentication の認証のみに使用し、Firestore への直接読み書きは行っていない。

### 設定済みルール（2026-05-17 適用）
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
クライアントから直接アクセスする実装を追加する場合は必ずルールを見直すこと。

---

## Cloud Run ロールバック手順

### 直前デプロイが壊れた場合
```bash
# リビジョン一覧を確認
gcloud run revisions list --service tascall --region asia-northeast1

# 前のリビジョンに100%切り戻し（例: tascall-00001-s7t）
gcloud run services update-traffic tascall \
  --to-revisions=tascall-00001-s7t=100 \
  --region asia-northeast1
```
切り戻しは **30秒以内**に完了する。

### デモ直前のデプロイ禁止ライン
**デモ開始30分前以降は新規デプロイしない。** 動いているリビジョンのURLをブックマークしておくこと。

現行リビジョン: `tascall-00004-bgg`（2026-05-19時点）

---

## バッジレベル定義

| レベル | スコア範囲 |
|---|---|
| 見習い | 0〜199 |
| 初級 | 200〜399 |
| 中級 | 400〜599 |
| 上級 | 600〜799 |
| エキスパート | 800〜 |

---

## 実装ルール

### 必須
- TypeScript strict mode（`"strict": true`）
- サーバーサイド処理はAPI Routeに集約（Gemini APIキー・Firebase Admin SDKはサーバーのみ）
- Firestoreへの書き込みは`lib/firestore.ts`の関数経由のみ（直接書き込み禁止）
- 認証チェックはProxy（`proxy.ts`）で行う（Next.js 16で`middleware.ts`→`proxy.ts`にリネームされた）

### 禁止
- `any`型の使用
- `console.log`の本番コードへの混入
- クライアントサイドへのAPIキー露出
- `<form>`タグの使用（`onClick`/`onChange`で代替）

### エラーハンドリング
- API Routeは必ず`try/catch`でラップ
- Geminiのレスポンスは`JSON.parse`前にマークダウンコードブロックを除去する

```ts
const clean = text.replace(/```json|```/g, "").trim();
const parsed = JSON.parse(clean);
```

---

## Gemini API（Vertex AI）の注意事項

- `@google/genai` SDK を `vertexai: true` + `location: "global"` で使用
- モデル名: `gemini-3.1-flash-lite`（このプロジェクトでアクセス可能な唯一のモデル）
- `us-central1` など特定リージョンでは404になる → `"global"` 必須
- ローカル開発時はADC（Application Default Credentials）で認証
  - `gcloud auth application-default login` を実行済みであること
  - `gcloud auth application-default set-quota-project ai-bridging` も実行済み
- Cloud Runデプロイ時はサービスアカウントに `roles/aiplatform.user` を付与することでADC自動動作
- 組織ポリシーによりAPIキー認証が禁止されているため、APIキー方式は使用不可

---

## 環境変数

`.env.local` に設定すること。値にカンマや余分なクォートを付けないこと（過去に認証エラーの原因になった）。`FIREBASE_PRIVATE_KEY` のみダブルクォートで囲む（改行文字`\n`を含むため）。

```
FIREBASE_PROJECT_ID=ai-bridging
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ai-bridging.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-bridging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-bridging
```

### Cloud Runデプロイ時の注意
- `NEXT_PUBLIC_*` はビルド時にバンドルへ焼き込まれる。`--set-build-env-vars` では **Dockerの `--build-arg` に渡らない**ため、`lib/firebase.ts` に `||` フォールバック値をハードコードしている（Firebase APIキーは公開値なので問題なし）
- `env.yaml` は `scripts/make_env_yaml.py` で生成する（`GEMINI_API_KEY` は除外、Vertex AIはADC認証のため不要）
- `env.yaml` は `.gitignore` 対象（秘密鍵を含むため）
- デプロイコマンド：`gcloud run deploy tascall --source . --region asia-northeast1 --allow-unauthenticated --env-vars-file env.yaml --platform managed --quiet`

### Cloud Run 固有のハマりポイント（実績あり）
- **Firestore `settings()` 二重呼び出しエラー**: 並列ワーカーが同一Firestoreインスタンスに`settings()`を複数回呼ぶ。`lib/firebaseAdmin.ts`でtry-catchしているため現在は対処済み
- **`next/image` でwebpが読めない**: AlpineベースのDockerイメージに`sharp`がないため画像最適化が失敗する。`public/`配下の静的画像は`<img>`タグを使うこと（`next/image`は使わない）
- **ログイン後のCookieタイミング**: `router.push()`はNext.jsクライアントルーティングのためCookieが乗る前にページが描画される場合がある。ログイン後のリダイレクトは`window.location.href`を使うこと
- **Googleログイン `signInWithRedirect`**: `firebaseapp.com`経由のOAuthリダイレクトをGoogleがポリシー違反として弾く。`signInWithPopup`を使い、popup-blockedエラー時はメール/パスワードへ誘導する

---

## デモシナリオ（実装の優先度判断に使うこと）

**シナリオA: プロジェクトタスク（Phase 1 対応済み）**
1. 上司がチャット画面で「新製品の展示会準備、よろしく」と入力
2. GeminiがQ&Aを往復して指示を明確化
3. タスクが3つに分解 → 各タスクにVS推薦カード3枚がスライドイン
4. 上司が各タスクで担当者カードを選択（⚔️スキル / 🌱成長 / ⚖️負荷）→ 割り振り確定
5. 部下が成果物を提出 → AI採点（status: ai_evaluated）
6. 上司がダッシュボードの「レビュー待ち」列からタスクをクリック
7. スライダーでスコア入力 → 確定 → 重みチャートが更新される
8. 「AIが私の採点傾向を学習している」をアピール

**シナリオB: 今日中タスク（緊急対応）**
1. 上司がチャット画面で「今日中」モードを選択
2. 「クライアントへの障害報告書を今日中に出して」と入力
3. GeminiがQ&Aなしで即座にタスク分解（🔥今日中バッジ付き）
4. VS推薦カードで担当者を選択 → 部下のタスク一覧に赤バッジで表示

**デモに映らない機能は後回しにしてよい。**

---

## 現在の実装状況

- [x] プロジェクト初期化（Next.js + TypeScript + Tailwind）
- [x] Firebase / Firestore セットアップ
- [x] 認証（Googleログイン・ロール分岐）
- [x] メール/パスワードログイン・新規登録（審査員がその場で試せる）
- [x] オンボーディング（組織作成・招待コード参加）
- [x] チャット画面（プロジェクト / 今日中モード切り替え）
- [x] 割り振り承認画面
- [x] 部下タスク一覧・詳細画面（🔥今日中バッジ表示）
- [x] 成果物提出・AI評価
- [x] ダッシュボード（チーム全体・招待コード表示）
- [x] メンバー追加UI（ダッシュボードのモーダル・スキルスライダー・初期値50）
- [x] メンバー削除UI（DeleteMemberButton + DELETE /api/members/[uid]）
- [x] バッジビジュアル・レベルアップ演出
- [x] Cloud Runデプロイ（`https://tascall-649847191589.asia-northeast1.run.app`）
- [x] APIルートの認可チェック（セッション所有者・担当者確認・org分離）
- [x] Firestore複合インデックス（`firestore.indexes.json`、デプロイ済み）
- [x] Firestoreクエリ順序修正（`where`→`orderBy`の順）
- [x] `ignoreUndefinedProperties: true`（orgIdがundefinedでも書き込めるよう対処）
- [x] セッションCookieに`SameSite: lax`追加
- [x] PRのURL検証（https必須・`new URL()`で構文チェック）
- [x] Geminiリトライロジック（最大3回 exponential backoff）
- [x] セッション（sessions）にorgIdを付与・型定義に追加
- [x] lint warnings 全解消（未使用import・catch変数・未使用state）
- [x] Cloud Runデプロイ（最新版、メール認証・メンバー削除含む）
- [x] UIリニューアル（Geminiグラデーション・紙吹雪・2カラムログイン・TascaLLロゴ）
- [x] モバイルログイン修正（`router.push` → `window.location.href` でCookieタイミング問題解消）
- [x] Cloud RunクラッシュFix（Firestore `settings()`二重呼び出し・`next/image`→`<img>`）
- [x] カンバンUIリニューアル（Sidebar + 4列カンバン + ダッシュボード刷新）
- [x] **Phase 1: VS推薦カード**（framer-motion 3枚スライドイン・⚔️スキル/🌱成長/⚖️負荷分散）
- [x] **Phase 1: 評価2段階化**（ai_evaluated → 上司レビュー → evaluated）
- [x] **Phase 1: 採点重み学習**（上司スコアとAI採点の差分から継続学習・ダッシュボード可視化）
- [x] **Phase 1: 上司レビュー画面**（`/dashboard/tasks/[id]` スライダー入力）
- [x] **Phase 1: デモシードスクリプト**（`scripts/seed-evaluation-history.ts`）