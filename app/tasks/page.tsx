import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser, getTasksByAssignee } from "@/lib/firestore";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Task } from "@/types";
import Header from "@/app/components/Header";
import BadgeDisplay from "@/app/components/BadgeDisplay";

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

export default async function TasksPage() {
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
  if (!user) redirect("/login");

  const tasks = await getTasksByAssignee(uid);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        userName={user.name}
        badgeInfo={{ level: user.badgeLevel, score: user.badgeScore }}
      />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Badge card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-4">あなたのバッジ</h2>
          <div className="flex items-start gap-8">
            <div className="w-44 shrink-0">
              <BadgeDisplay level={user.badgeLevel} score={user.badgeScore} />
            </div>
            <div className="flex-1 pt-2">
              <p className="text-xs font-medium text-gray-500 mb-3">スキルスコア</p>
              <div className="space-y-3">
                {(
                  [
                    { key: "documentation", label: "資料作成" },
                    { key: "communication", label: "調整・折衝" },
                    { key: "technical", label: "技術" },
                    { key: "ci_cd", label: "CI/CD" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, user.skills[key] ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-6 text-right font-mono">
                      {user.skills[key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Task list */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">担当タスク</h2>
        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">現在、担当タスクはありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: Task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className={`block bg-white rounded-xl border p-5 hover:shadow-sm transition-all ${
                  task.deadline === "today"
                    ? "border-red-300 hover:border-red-400"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.deadline === "today" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">🔥 今日中</span>
                      )}
                      <p className="font-medium text-gray-900">{task.title}</p>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                {task.evaluation && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                    <span className="text-sm font-bold text-indigo-600">
                      {task.evaluation.score}点
                    </span>
                    <span className="text-xs text-green-600">
                      +{task.evaluation.delta}pt
                    </span>
                    <span className="text-xs text-gray-400 line-clamp-1 flex-1">
                      {task.evaluation.feedback}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
