import { adminAuth } from "@/lib/firebaseAdmin";
import {
  createSession,
  getSession,
  updateSessionMessages,
  updateSessionWithTasks,
} from "@/lib/firestore";
import { generateContentWithHistory } from "@/lib/gemini";
import type { GeminiChatResponse, SessionMessage } from "@/types";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";

const SYSTEM_PROMPT = `あなたはDevOpsチームを支援するAIアシスタントです。
上司から曖昧な指示を受け取り、会話を通じて指示を明確化してから、複数の具体的なタスクに分解してください。

【ルール】
- 確認質問は1回につき1〜2個に絞る
- 十分な情報が集まったら（通常3〜5往復以内）タスクを分解する
- 会話継続中は必ず以下のJSON形式で返す（マークダウン不要）:
{"status":"questioning","message":"質問文"}
- タスク分解完了時は必ず以下のJSON形式で返す（マークダウン不要）:
{"status":"complete","tasks":[{"title":"タスク名","description":"詳細説明","requiredSkill":"documentation|communication|technical"}]}

【requiredSkillの選び方】
- documentation: 資料作成・ドキュメント・報告書
- communication: 調整・連絡・折衝・会議
- technical: 技術作業・開発・設定・セットアップ`;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const { message, sessionId } = (await request.json()) as {
      message: string;
      sessionId?: string;
    };

    let currentSessionId = sessionId;
    let messages: SessionMessage[] = [];

    if (currentSessionId) {
      const existing = await getSession(currentSessionId);
      if (!existing) {
        return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
      }
      messages = existing.messages;
    } else {
      currentSessionId = await createSession({
        managerUid: decoded.uid,
        originalInstruction: message,
        clarifiedTasks: [],
        assignmentProposal: [],
        status: "chatting",
        messages: [],
        createdAt: FieldValue.serverTimestamp() as unknown as import("firebase-admin/firestore").Timestamp,
      });
    }

    messages.push({ role: "user", content: message });

    const rawResponse = await generateContentWithHistory(SYSTEM_PROMPT, messages);
    const clean = rawResponse.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as GeminiChatResponse;

    messages.push({ role: "model", content: rawResponse });
    await updateSessionMessages(currentSessionId, messages);

    if (parsed.status === "complete" && parsed.tasks) {
      return Response.json({
        status: "complete",
        sessionId: currentSessionId,
        tasks: parsed.tasks,
      });
    }

    return Response.json({
      status: "questioning",
      sessionId: currentSessionId,
      message: parsed.message ?? "",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "エラーが発生しました" },
      { status: 500 }
    );
  }
}
