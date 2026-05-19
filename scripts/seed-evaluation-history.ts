/**
 * 評価履歴シードスクリプト
 *
 * 使い方:
 *   SEED_MANAGER_UID=xxx npx ts-node --project tsconfig.node.json scripts/seed-evaluation-history.ts
 *
 * 結果: requirement 重みが高めになる偏った履歴20件を投入する
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const managerUid = process.env.SEED_MANAGER_UID;
if (!managerUid) {
  console.error("環境変数 SEED_MANAGER_UID を設定してください");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

// managerScore > aiScore のパターンを多めにして requirement 重みを上げる
const SEED_ENTRIES = [
  { aiScore: 55, managerScore: 72, req: 30, cla: 15, comp: 10 },
  { aiScore: 60, managerScore: 78, req: 32, cla: 18, comp: 10 },
  { aiScore: 50, managerScore: 65, req: 28, cla: 12, comp: 10 },
  { aiScore: 70, managerScore: 85, req: 35, cla: 20, comp: 15 },
  { aiScore: 65, managerScore: 80, req: 33, cla: 18, comp: 14 },
  { aiScore: 58, managerScore: 70, req: 30, cla: 16, comp: 12 },
  { aiScore: 72, managerScore: 88, req: 36, cla: 22, comp: 14 },
  { aiScore: 45, managerScore: 60, req: 25, cla: 12, comp: 8 },
  { aiScore: 68, managerScore: 75, req: 34, cla: 20, comp: 14 },
  { aiScore: 75, managerScore: 90, req: 38, cla: 23, comp: 14 },
  { aiScore: 80, managerScore: 92, req: 40, cla: 25, comp: 15 },
  { aiScore: 62, managerScore: 70, req: 31, cla: 18, comp: 13 },
  { aiScore: 55, managerScore: 68, req: 29, cla: 15, comp: 11 },
  { aiScore: 70, managerScore: 82, req: 35, cla: 21, comp: 14 },
  { aiScore: 48, managerScore: 62, req: 26, cla: 13, comp: 9 },
  { aiScore: 76, managerScore: 88, req: 38, cla: 24, comp: 14 },
  { aiScore: 60, managerScore: 72, req: 31, cla: 17, comp: 12 },
  { aiScore: 65, managerScore: 73, req: 33, cla: 19, comp: 13 },
  { aiScore: 58, managerScore: 65, req: 29, cla: 16, comp: 13 },
  { aiScore: 72, managerScore: 80, req: 36, cla: 21, comp: 15 },
] as const;

async function seed() {
  console.log(`シード対象: managerUid=${managerUid}`);

  const orgDoc = await db.collection("organizations").doc(managerUid!).get();
  if (!orgDoc.exists) {
    console.error("組織が見つかりません。先にオンボーディングを完了してください。");
    process.exit(1);
  }

  const history = SEED_ENTRIES.map((e, i) => ({
    taskId: `seed-task-${i}`,
    aiScore: e.aiScore,
    managerScore: e.managerScore,
    aiBreakdown: {
      requirement: e.req,
      clarity: e.cla,
      completeness: e.comp,
    },
    timestamp: FieldValue.serverTimestamp(),
  }));

  // 重みを事前計算してセット（学習シミュレーション）
  const LEARNING_RATE = 0.05;
  let weights = { requirement: 1.0, clarity: 1.0, completeness: 1.0 };
  for (const e of SEED_ENTRIES) {
    const diff = e.managerScore - e.aiScore;
    const safeAi = Math.max(e.aiScore, 1);
    const scale = LEARNING_RATE * Math.min(1, Math.abs(diff) / 20);
    weights = {
      requirement: Math.min(1.5, Math.max(0.5, weights.requirement + diff * (e.req / safeAi) * scale)),
      clarity: Math.min(1.5, Math.max(0.5, weights.clarity + diff * (e.cla / safeAi) * scale)),
      completeness: Math.min(1.5, Math.max(0.5, weights.completeness + diff * (e.comp / safeAi) * scale)),
    };
  }

  console.log("計算された重み:", weights);

  await db.collection("organizations").doc(managerUid!).update({
    evaluationHistory: history,
    scoringWeights: weights,
  });

  console.log("シード完了!");
  console.log(`  要件充足: ${weights.requirement.toFixed(3)}x`);
  console.log(`  明確性:   ${weights.clarity.toFixed(3)}x`);
  console.log(`  完結性:   ${weights.completeness.toFixed(3)}x`);
}

seed().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
