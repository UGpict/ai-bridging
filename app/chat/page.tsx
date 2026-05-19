"use client";

import { useState, useRef, useEffect } from "react";
import type { ClarifiedTask, Assignment } from "@/types";
import Sidebar from "@/app/components/Sidebar";

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
  const [mode, setMode] = useState<Mode>("project");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "こんにちは。どのようなことをチームに依頼しますか？" },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("chatting");
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
      window.location.href = "/dashboard";
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  };

  const skillLabel: Record<string, string> = {
    documentation: "資料作成",
    communication: "調整",
    technical: "技術",
    ci_cd: "CI/CD",
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium">Software › 指示を入力</p>
            <h1 className="text-xl font-black text-gray-900 mt-0.5">新しい指示</h1>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
              <button
                onClick={() => handleModeChange("project")}
                disabled={phase !== "chatting"}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                  mode === "project"
                    ? "bg-white text-indigo-700 shadow-sm border border-gray-200"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                プロジェクト
              </button>
              <button
                onClick={() => handleModeChange("today")}
                disabled={phase !== "chatting"}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                  mode === "today"
                    ? "bg-white text-red-600 shadow-sm border border-gray-200"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                🔥 今日中
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 gap-5 p-6 overflow-hidden min-h-0">

          {/* Chat column */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-0">
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${mode === "today" ? "bg-red-400" : "bg-indigo-400"}`} />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {mode === "today" ? "緊急タスク入力" : "タスク分解チャット"}
              </span>
              {phase === "assigning" && (
                <span className="ml-auto text-xs text-indigo-500 font-medium animate-pulse">推薦中...</span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-black mr-2.5 shrink-0 mt-0.5 shadow-sm">
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm"
                        : "bg-gray-50 border border-gray-100 text-gray-800"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && phase === "chatting" && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-black mr-2.5 shrink-0 shadow-sm">
                    AI
                  </div>
                  <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl text-sm text-gray-400">
                    考え中...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {phase === "chatting" && (
              <div className="px-5 py-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder={mode === "today" ? "緊急の依頼を入力..." : "指示を入力..."}
                    disabled={loading}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 disabled:opacity-50 bg-gray-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                  >
                    送信
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Assignment panel */}
          {phase === "assigned" && (
            <div className="w-80 shrink-0 flex flex-col gap-4">
              {/* Panel header */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">AI推薦の割り振り案</span>
                  {mode === "today" && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">🔥 今日中</span>
                  )}
                </div>

                <div className="p-4 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {assignments.map((a, i) => {
                    const skill = a.task.requiredSkill;
                    const ranked = [...memberScores]
                      .sort((x, y) => (y.skills[skill] ?? 0) - (x.skills[skill] ?? 0));
                    const maxScore = ranked[0]?.skills[skill] ?? 1;
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            {skillLabel[skill] ?? skill}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">{a.task.title}</p>
                        <p className="text-xs text-gray-400 leading-relaxed mb-2.5">{a.assignment.reason}</p>
                        {ranked.length > 0 && (
                          <div className="space-y-1.5">
                            {ranked.map((m) => {
                              const s = m.skills[skill] ?? 0;
                              const isAssigned = m.uid === a.assignment.assigneeUid;
                              return (
                                <div key={m.uid} className="flex items-center gap-2">
                                  <span className={`text-xs w-14 truncate ${isAssigned ? "font-bold text-indigo-600" : "text-gray-400"}`}>
                                    {isAssigned ? "▶ " : ""}{m.name}
                                  </span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full transition-all ${isAssigned ? "bg-gradient-to-r from-indigo-400 to-violet-500" : "bg-gray-300"}`}
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

                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                  >
                    {loading ? "処理中..." : "一括承認してタスクを割り振る →"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
