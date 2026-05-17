@AGENTS.md
# AI Bridging — CLAUDE.md

> このファイルはClaude Codeへの指示の唯一の参照元。実装前に必ず読むこと。

---

## プロジェクト概要

**AI Bridging** — 上司の曖昧な指示をGeminiが構造化・複数タスクに分解し、バッジスコアに基づいて最適な部下に自動割り振りするDevOps支援Webアプリ。

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
| 認証 | Firebase Authentication（Googleログイン） |
| ホスティング | Cloud Run |

---

## ディレクトリ構成

```
/
├── app/
│   ├── login/
│   │   └── page.tsx          # Googleログイン画面
│   ├── dashboard/
│   │   ├── page.tsx          # 上司：チーム全体タスク・バッジ一覧
│   │   └── AddMemberButton.tsx  # メンバー追加モーダル（Client Component）
│   ├── chat/
│   │   └── page.tsx          # 上司：指示入力チャット→タスク分解→割り振り承認
│   ├── tasks/
│   │   ├── page.tsx          # 部下：自分のタスク一覧
│   │   └── [id]/
│   │       └── page.tsx      # 部下：タスク詳細＋成果物提出
│   └── api/
│       ├── auth/
│       │   ├── me/route.ts       # 自分のユーザー情報取得
│       │   └── session/route.ts  # Cookieセッション発行・ロール返却
│       ├── chat/
│       │   └── route.ts      # Geminiとのチャット往復・タスク分解
│       ├── assign/
│       │   └── route.ts      # バッジスコアに基づく担当者推薦
│       ├── evaluate/
│       │   └── route.ts      # 成果物AIチェック・スコア更新
│       ├── members/
│       │   └── route.ts      # メンバー追加API
│       └── tasks/
│           └── [id]/route.ts # タスク個別操作
├── lib/
│   ├── gemini.ts             # Gemini API クライアント（Vertex AI）
│   ├── firebase.ts           # Firebase Client SDK初期化
│   ├── firebaseAdmin.ts      # Firebase Admin SDK初期化
│   └── firestore.ts          # Firestoreのread/write関数
├── types/
│   └── index.ts              # 型定義
└── CLAUDE.md                 # このファイル
```

---

## 画面とロール

ログイン後、Firestoreのユーザードキュメントの`role`フィールドで分岐：
- `role: "manager"` → `/dashboard` にリダイレクト
- `role: "member"` → `/tasks` にリダイレクト

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
  }
}
```

### `tasks/{taskId}`
```ts
{
  id: string
  title: string
  description: string
  assigneeUid: string
  assigneeName: string
  status: "pending" | "submitted" | "evaluated"
  createdAt: Timestamp
  submission?: string       // 部下が提出したテキスト
  evaluation?: {
    score: number           // 0-100
    delta: number           // スコア増減
    level: string           // 更新後のバッジレベル
    feedback: string        // 自然言語フィードバック
  }
}
```

### `sessions/{sessionId}`
```ts
{
  id: string
  managerUid: string
  originalInstruction: string   // 上司の元の曖昧な指示
  clarifiedTasks: Task[]        // 分解されたタスク一覧
  assignmentProposal: Assignment[]  // AI推薦の割り振り案
  status: "chatting" | "proposed" | "approved"
  messages: {
    role: "user" | "model"
    content: string
  }[]
  createdAt: Timestamp
}
```

---

## AIフロー詳細

### 1. タスク分解（`/api/chat`）

**システムプロンプト要件：**
- 上司との会話を通じて曖昧な指示を明確化する
- 確認質問は1回につき1〜2個に絞る（ユーザーの負荷を下げる）
- 十分な情報が集まったら、タスクを複数に分解してJSONで返す
- 最終出力フォーマット：

```json
{
  "status": "complete",
  "tasks": [
    {
      "title": "タスク名",
      "description": "詳細説明",
      "requiredSkill": "documentation | communication | technical"
    }
  ]
}
```

- 会話継続中は `{"status": "questioning", "message": "確認質問文"}` を返す

### 2. 担当者推薦（`/api/assign`）

- Firestoreから全メンバーのバッジスコア・スキルスコアを取得
- 各タスクの`requiredSkill`に対して最適なメンバーを推薦
- 推薦理由も含めてレスポンスに含める

### 3. 成果物評価（`/api/evaluate`）

**Geminiへの指示：**
- タスクの要件と提出テキストを照合し、以下のルーブリックに従って採点する
- 各項目を個別に採点してから合計することでブレを抑える
- 必ずJSONで返す（マークダウンコードブロック不要）

**採点ルーブリック（合計100点）：**

```
【タスク要件充足度】0-40点
- タスクの全要件に言及しているか
- 具体的な内容が含まれているか

【明確性】0-30点
- 読んで意味が伝わるか
- 曖昧な表現がないか

【完結性】0-30点
- 結論が明示されているか
- 次のアクションが明確か
```

**レスポンスフォーマット：**

```json
{
  "breakdown": {
    "requirement": 35,
    "clarity": 25,
    "completeness": 20
  },
  "score": 80,
  "delta": 8,
  "level": "上級",
  "feedback": "自然言語でのフィードバック文（良かった点・改善点を含む）"
}
```

- `score` は `breakdown` の合計値と一致させること
- `delta` はスコアに応じて算出（上限±30点）
- `feedback` はユーザーに直接表示するため、丁寧語で記述する

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
- 認証チェックはミドルウェア（`middleware.ts`）で行う

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

---

## デモシナリオ（実装の優先度判断に使うこと）

1. 上司がチャット画面で「新製品の展示会準備、よろしく」と入力
2. GeminiがQ&Aを往復して指示を明確化
3. タスクが3つに分解される（資料作成・会場手配・デモ機セットアップ）
4. AIが3人の部下を推薦（スキルスコアに基づく）→上司が一括承認
5. 部下3人に通知→各自がタスク詳細を確認
6. 1人が成果物テキストを提出→AIが評価→バッジレベルアップ
7. 上司がダッシュボードでチーム全体のバッジ状況を確認

**デモに映らない機能は後回しにしてよい。**

---

## 現在の実装状況

- [x] プロジェクト初期化（Next.js + TypeScript + Tailwind）
- [x] Firebase / Firestore セットアップ
- [x] 認証（Googleログイン・ロール分岐）
- [x] チャット画面（タスク分解フロー）
- [x] 割り振り承認画面
- [x] 部下タスク一覧・詳細画面
- [x] 成果物提出・AI評価
- [x] ダッシュボード（チーム全体）
- [x] メンバー追加UI（ダッシュボードのモーダル）
- [ ] バッジビジュアル・レベルアップ演出
- [ ] Cloud Runデプロイ