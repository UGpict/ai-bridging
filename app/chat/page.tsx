"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClarifiedTask, TaskCandidates, SelectedAssignment } from "@/types";
import Sidebar from "@/app/components/Sidebar";
import CandidateCards from "@/app/components/CandidateCards";

type MessageRole = "user" | "assistant";
interface ChatMessage {
  role: MessageRole;
  content: string;
}

type Phase = "chatting" | "assigning" | "assigned";
type Mode = "project" | "today";

export default function ChatPage() {
  const [mode, setMode] = useState<Mode>("project");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "こんにちは。どのようなことをチームに依頼しますか？" },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("chatting");
  const [proposals, setProposals] = useState<TaskCandidates[]>([]);
  const [selections, setSelections] = useState<Record<number, string>>({});
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
    setProposals([]);
    setSelections({});
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
        await fetchCandidates(data.sessionId, data.tasks);
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

  const fetchCandidates = async (sid: string, taskList: ClarifiedTask[]) => {
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, tasks: taskList }),
      });
      const data = (await res.json()) as {
        candidateProposals?: TaskCandidates[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "推薦に失敗しました");

      setProposals(data.candidateProposals ?? []);
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

  const handleSelect = (taskIndex: number, uid: string) => {
    setSelections((prev) => ({ ...prev, [taskIndex]: uid }));
  };

  const allSelected = proposals.length > 0 && proposals.every((p) => selections[p.taskIndex]);

  const handleApprove = async () => {
    if (!sessionId || !allSelected) return;
    setLoading(true);
    try {
      const selectedAssignments: SelectedAssignment[] = proposals.map((p) => {
        const selectedUid = selections[p.taskIndex];
        const candidate = p.candidates.find((c) => c.uid === selectedUid)!;
        return {
          taskIndex: p.taskIndex,
          assigneeUid: candidate.uid,
          assigneeName: candidate.name,
          candidateType: candidate.type,
        };
      });

      const res = await fetch("/api/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, selectedAssignments }),
      });
      if (!res.ok) throw new Error("承認に失敗しました");
      window.location.href = "/dashboard";
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
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
        </header>

        {/* Main content */}
        <div className="flex flex-1 gap-5 p-6 overflow-hidden min-h-0">

          {/* Chat column */}
          <div className={`flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-0 transition-all duration-300 ${phase === "assigned" ? "w-72 shrink-0" : "flex-1"}`}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${mode === "today" ? "bg-red-400" : "bg-indigo-400"}`} />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {mode === "today" ? "緊急タスク入力" : "タスク分解チャット"}
              </span>
              {phase === "assigning" && (
                <span className="ml-auto text-xs text-indigo-500 font-medium animate-pulse">推薦中...</span>
              )}
            </div>

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
                    className={`max-w-xs px-4 py-3 rounded-2xl text-sm leading-relaxed ${
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

          {/* Candidate cards panel */}
          <AnimatePresence>
            {phase === "assigned" && proposals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col overflow-hidden min-h-0"
              >
                {/* Panel header */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <div>
                    <h2 className="text-sm font-black text-gray-800">担当者を選んでください</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      各タスクについて3つの推薦から1人を選択
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {Object.keys(selections).length}/{proposals.length} 選択済み
                    </span>
                    <button
                      onClick={handleApprove}
                      disabled={!allSelected || loading}
                      className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm"
                    >
                      {loading ? "処理中..." : "割り振りを確定 →"}
                    </button>
                  </div>
                </div>

                {/* Scrollable card area */}
                <div className="flex-1 overflow-y-auto">
                  <CandidateCards
                    proposals={proposals}
                    selections={selections}
                    onSelect={handleSelect}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
