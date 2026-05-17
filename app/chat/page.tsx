"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ClarifiedTask, Assignment } from "@/types";
import Header from "@/app/components/Header";

type MessageRole = "user" | "assistant";
interface ChatMessage {
  role: MessageRole;
  content: string;
}

type Phase = "chatting" | "assigning" | "assigned";
type Mode = "project" | "today";

interface MemberScore {
  uid: string;
  name: string;
  skills: Record<string, number>;
}

interface AssignResult {
  task: ClarifiedTask;
  assignment: Assignment;
}

export default function ChatPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("project");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "こんにちは。どのようなことをチームに依頼しますか？" },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("chatting");
  const [tasks, setTasks] = useState<ClarifiedTask[]>([]);
  const [assignments, setAssignments] = useState<AssignResult[]>([]);
  const [memberScores, setMemberScores] = useState<MemberScore[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setMessages([
      {
        role: "assistant",
        content:
          newMode === "today"
            ? "今日中の緊急タスクを入力してください。すぐに分解・割り振りします。"
            : "こんにちは。どのようなことをチームに依頼しますか？",
      },
    ]);
    setSessionId(undefined);
    setPhase("chatting");
    setTasks([]);
    setAssignments([]);
    setMemberScores([]);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, sessionId, mode }),
      });
      const data = (await res.json()) as {
        status: string;
        sessionId: string;
        message?: string;
        tasks?: ClarifiedTask[];
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");

      setSessionId(data.sessionId);

      if (data.status === "complete" && data.tasks) {
        setTasks(data.tasks);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `指示を${data.tasks!.length}つのタスクに分解しました。担当者の推薦を行います...`,
          },
        ]);
        setPhase("assigning");
        await assignTasks(data.sessionId, data.tasks);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message ?? "" },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `エラー: ${e instanceof Error ? e.message : "不明なエラー"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const assignTasks = async (sid: string, taskList: ClarifiedTask[]) => {
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, tasks: taskList }),
      });
      const data = (await res.json()) as {
        assignments?: Assignment[];
        memberScores?: MemberScore[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "推薦に失敗しました");

      const results: AssignResult[] = taskList.map((task, i) => ({
        task,
        assignment: data.assignments![i] ?? data.assignments![0],
      }));
      setAssignments(results);
      setMemberScores(data.memberScores ?? []);
      setPhase("assigned");
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `担当者推薦エラー: ${e instanceof Error ? e.message : "不明なエラー"}`,
        },
      ]);
      setPhase("chatting");
    }
  };

  const handleApprove = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("承認に失敗しました");
      router.push("/dashboard");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  };

  const skillLabel: Record<string, string> = {
    documentation: "資料作成",
    communication: "コミュニケーション",
    technical: "技術",
    ci_cd: "CI/CD",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header pageTitle="指示入力チャット" backHref="/dashboard" />

      {/* Mode toggle */}
      <div className="max-w-4xl mx-auto w-full px-4 pt-4">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 gap-1">
          <button
            onClick={() => handleModeChange("project")}
            disabled={phase !== "chatting"}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              mode === "project"
                ? "bg-indigo-600 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            プロジェクト
          </button>
          <button
            onClick={() => handleModeChange("today")}
            disabled={phase !== "chatting"}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              mode === "today"
                ? "bg-red-500 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🔥 今日中
          </button>
        </div>
      </div>

      <div className="flex flex-1 max-w-4xl mx-auto w-full px-4 py-4 gap-6">
        {/* Chat */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-sm px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl text-sm text-gray-400">
                  考え中...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {phase === "chatting" && (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="指示を入力..."
                disabled={loading}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                送信
              </button>
            </div>
          )}
        </div>

        {/* Assignment panel */}
        {phase === "assigned" && (
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-gray-900">AI推薦の割り振り案</h2>
                {mode === "today" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">今日中</span>
                )}
              </div>
              <div className="space-y-4">
                {assignments.map((a, i) => {
                  const skill = a.task.requiredSkill;
                  const ranked = [...memberScores]
                    .sort((x, y) => (y.skills[skill] ?? 0) - (x.skills[skill] ?? 0));
                  const maxScore = ranked[0]?.skills[skill] ?? 1;
                  return (
                    <div key={i} className="border border-gray-100 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {skillLabel[skill] ?? skill}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">{a.task.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{a.assignment.reason}</p>
                      {ranked.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {ranked.map((m) => {
                            const s = m.skills[skill] ?? 0;
                            const isAssigned = m.uid === a.assignment.assigneeUid;
                            return (
                              <div key={m.uid} className="flex items-center gap-2">
                                <span className={`text-xs w-16 truncate ${isAssigned ? "font-bold text-indigo-600" : "text-gray-400"}`}>
                                  {isAssigned ? "▶ " : ""}{m.name}
                                </span>
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${isAssigned ? "bg-indigo-500" : "bg-gray-300"}`}
                                    style={{ width: `${(s / Math.max(maxScore, 1)) * 100}%` }}
                                  />
                                </div>
                                <span className={`text-xs w-6 text-right ${isAssigned ? "text-indigo-600 font-bold" : "text-gray-400"}`}>{s}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="w-full mt-5 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? "処理中..." : "一括承認してタスクを割り振る"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
