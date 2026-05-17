import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser, getAllTasks, getAllMembers, getOrganizationByManager } from "@/lib/firestore";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Task, User } from "@/types";
import AddMemberButton from "./AddMemberButton";
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

  const [tasks, members, org] = await Promise.all([
    getAllTasks(),
    getAllMembers(),
    getOrganizationByManager(uid),
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
            { label: "総タスク", value: stats.total, color: "text-gray-900" },
            { label: "進行中", value: stats.pending, color: "text-blue-600" },
            { label: "提出済", value: stats.submitted, color: "text-yellow-600" },
            { label: "評価済", value: stats.evaluated, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
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
                  <BadgeBadge level={m.badgeLevel} />
                </div>
                <p className="text-2xl font-bold text-indigo-600">{m.badgeScore}</p>
                <p className="text-xs text-gray-400">累計スコア</p>
                <div className="mt-3 space-y-1">
                  {(["documentation", "communication", "technical"] as const).map((sk) => (
                    <div key={sk} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-28">{sk}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, m.skills[sk])}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{m.skills[sk]}</span>
                    </div>
                  ))}
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
