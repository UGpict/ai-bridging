import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser, getAllTasks, getAllMembers, getOrganizationByManager } from "@/lib/firestore";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Task, User } from "@/types";
import AddMemberButton from "./AddMemberButton";
import DeleteMemberButton from "./DeleteMemberButton";
import InviteCodeCard from "./InviteCodeCard";
import Header from "@/app/components/Header";

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "進行中", cls: "bg-blue-100 text-blue-700" },
    submitted: { label: "提出済", cls: "bg-yellow-100 text-yellow-700" },
    evaluated: { label: "評価済", cls: "bg-green-100 text-green-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
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
    evaluated: tasks.filter((t) => t.status === "evaluated").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        userName={user.name}
        action={{ label: "新しい指示を入力", href: "/chat" }}
      />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {org && <InviteCodeCard code={org.inviteCode} teamName={org.name} />}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "総タスク", value: stats.total, gradient: "from-gray-700 to-gray-900", bg: "bg-gray-50" },
            { label: "進行中",   value: stats.pending,   gradient: "from-indigo-500 to-blue-600",   bg: "bg-indigo-50" },
            { label: "提出済",   value: stats.submitted, gradient: "from-amber-500 to-orange-500",  bg: "bg-amber-50" },
            { label: "評価済",   value: stats.evaluated, gradient: "from-emerald-500 to-green-600", bg: "bg-emerald-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 p-5 shadow-sm`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-3xl font-black mt-1 bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">チームメンバー</h2>
            <AddMemberButton />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {members.map((m: User) => (
              <div key={m.uid} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <BadgeBadge level={m.badgeLevel} />
                    <DeleteMemberButton uid={m.uid} name={m.name} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-indigo-600">{m.badgeScore}</p>
                <p className="text-xs text-gray-400">累計スコア</p>
                <div className="mt-3 space-y-1">
                  {(
                    [
                      { key: "documentation", label: "資料作成" },
                      { key: "communication", label: "調整・折衝" },
                      { key: "technical", label: "技術" },
                      { key: "ci_cd", label: "CI/CD" },
                    ] as const
                  ).map(({ key, label }) => {
                    const score = m.skills[key] ?? 0;
                    const growing = score > 50;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${growing ? "bg-indigo-500" : "bg-gray-300"}`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                        <span className="text-xs w-6 text-right text-gray-500">{score}</span>
                        {growing && <span className="text-xs text-green-500">↑</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tasks */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-4">全タスク一覧</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">
                タスクがありません。新しい指示を入力してください。
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">タスク</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">担当者</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">ステータス</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">スコア</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map((t: Task) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{t.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{t.assigneeName}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {t.evaluation ? `${t.evaluation.score}点` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
