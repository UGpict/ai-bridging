import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser, getAllTasks, getAllMembers, getOrganizationByManager } from "@/lib/firestore";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Task, User, ScoringWeights, EvaluationHistoryEntry } from "@/types";
import AddMemberButton from "./AddMemberButton";
import DeleteMemberButton from "./DeleteMemberButton";
import InviteCodeCard from "./InviteCodeCard";
import Sidebar from "@/app/components/Sidebar";
import ScoringWeightsChart from "@/app/components/ScoringWeightsChart";
import Link from "next/link";

function BadgeBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    見習い: "bg-gray-100 text-gray-600",
    初級: "bg-green-100 text-green-700",
    中級: "bg-blue-100 text-blue-700",
    上級: "bg-purple-100 text-purple-700",
    エキスパート: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[level] ?? "bg-gray-100 text-gray-600"}`}>
      {level}
    </span>
  );
}

const COLUMNS = [
  {
    key: "pending" as const,
    label: "進行中",
    accent: "border-indigo-400",
    dot: "bg-indigo-400",
    badge: "bg-indigo-50 text-indigo-700",
  },
  {
    key: "submitted" as const,
    label: "提出済",
    accent: "border-amber-400",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
  },
  {
    key: "ai_evaluated" as const,
    label: "レビュー待ち",
    accent: "border-violet-400",
    dot: "bg-violet-400",
    badge: "bg-violet-50 text-violet-700",
  },
  {
    key: "evaluated" as const,
    label: "確定済",
    accent: "border-emerald-400",
    dot: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700",
  },
] as const;

function KanbanCard({ task, col }: { task: Task; col: typeof COLUMNS[number] }) {
  const isReviewable = task.status === "ai_evaluated";
  const cardContent = (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${col.accent} p-4 shadow-sm hover:shadow-md transition-shadow ${isReviewable ? "cursor-pointer hover:border-l-violet-500" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.deadline === "today" && (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">🔥</span>
          )}
          <p className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</p>
        </div>
        {isReviewable && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">評価待</span>
        )}
      </div>
      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">{task.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">{task.assigneeName}</span>
        {task.evaluation && (
          <span className="text-xs font-bold text-indigo-600">{task.evaluation.finalScore}点</span>
        )}
      </div>
    </div>
  );

  if (isReviewable) {
    return (
      <Link href={`/dashboard/tasks/${task.id}`}>
        {cardContent}
      </Link>
    );
  }
  return cardContent;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session");
  if (!session) redirect("/login");

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(session.value);
    uid = decoded.uid;
  } catch {
    redirect("/login");
  }

  const user = await getUser(uid);
  if (!user || user.role !== "manager") redirect("/tasks");

  const org = await getOrganizationByManager(uid);
  const [tasks, members] = await Promise.all([
    getAllTasks(org?.id),
    getAllMembers(org?.id),
  ]);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    submitted: tasks.filter((t) => t.status === "submitted").length,
    aiEvaluated: tasks.filter((t) => t.status === "ai_evaluated").length,
    evaluated: tasks.filter((t) => t.status === "evaluated").length,
  };

  const weights: ScoringWeights = org?.scoringWeights ?? {
    requirement: 1.0,
    clarity: 1.0,
    completeness: 1.0,
  };
  const history: EvaluationHistoryEntry[] = (org?.evaluationHistory ?? []) as EvaluationHistoryEntry[];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium">Software › Dashboard</p>
            <h1 className="text-xl font-black text-gray-900 mt-0.5">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">{user.name}</span>
            <Link
              href="/chat"
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              + 新しい指示
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 overflow-x-hidden">

          {/* Invite */}
          {org && <InviteCodeCard code={org.inviteCode} teamName={org.name} />}

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: "総タスク",       value: stats.total,       gradient: "from-gray-700 to-gray-900",     bg: "bg-gray-50"     },
              { label: "進行中",         value: stats.pending,     gradient: "from-indigo-500 to-violet-600", bg: "bg-indigo-50"   },
              { label: "提出済",         value: stats.submitted,   gradient: "from-amber-500 to-orange-500",  bg: "bg-amber-50"    },
              { label: "レビュー待ち",   value: stats.aiEvaluated, gradient: "from-violet-500 to-purple-600", bg: "bg-violet-50"   },
              { label: "確定済",         value: stats.evaluated,   gradient: "from-emerald-500 to-green-600", bg: "bg-emerald-50"  },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 p-5 shadow-sm`}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-3xl font-black mt-1 bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Scoring weights */}
          <ScoringWeightsChart weights={weights} history={history} />

          {/* Members */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">チームメンバー</h2>
              <AddMemberButton />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {members.map((m: User) => (
                <div key={m.uid} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{m.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <BadgeBadge level={m.badgeLevel} />
                      <DeleteMemberButton uid={m.uid} name={m.name} />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-indigo-600">{m.badgeScore}</p>
                  <p className="text-xs text-gray-400 mb-2">累計スコア</p>
                  <div className="space-y-1">
                    {(
                      [
                        { key: "documentation", label: "資料" },
                        { key: "communication", label: "調整" },
                        { key: "technical",     label: "技術" },
                        { key: "ci_cd",         label: "CI/CD" },
                      ] as const
                    ).map(({ key, label }) => {
                      const score = m.skills[key] ?? 0;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all"
                              style={{ width: `${Math.min(100, score)}%` }}
                            />
                          </div>
                          <span className="text-xs w-6 text-right text-gray-500">{score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Kanban board */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">タスクボード</h2>
              <span className="text-xs text-gray-400">Kanban</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.key);
                return (
                  <div key={col.key} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{col.label}</span>
                      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="space-y-3 min-h-24">
                      {colTasks.length === 0 ? (
                        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-4 text-center">
                          <p className="text-xs text-gray-300">タスクなし</p>
                        </div>
                      ) : (
                        colTasks.map((t: Task) => (
                          <KanbanCard key={t.id} task={t} col={col} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
