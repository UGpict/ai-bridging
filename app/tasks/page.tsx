import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser, getTasksByAssignee } from "@/lib/firestore";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Task } from "@/types";

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

  const badgeLevelColors: Record<string, string> = {
    見習い: "text-gray-500",
    初級: "text-green-600",
    中級: "text-blue-600",
    上級: "text-purple-600",
    エキスパート: "text-yellow-600",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
          <h1 className="text-lg font-semibold text-gray-900">AI Bridging</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className={`text-xs font-medium ${badgeLevelColors[user.badgeLevel]}`}>
              {user.badgeLevel} · {user.badgeScore}pt
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Badge card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">あなたのバッジ</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">
                {user.badgeLevel === "エキスパート"
                  ? "🏆"
                  : user.badgeLevel === "上級"
                  ? "⭐"
                  : user.badgeLevel === "中級"
                  ? "🔵"
                  : user.badgeLevel === "初級"
                  ? "🟢"
                  : "⬜"}
              </span>
            </div>
            <div>
              <p className={`text-xl font-bold ${badgeLevelColors[user.badgeLevel]}`}>
                {user.badgeLevel}
              </p>
              <p className="text-sm text-gray-400">{user.badgeScore} pt</p>
            </div>
            <div className="ml-auto grid grid-cols-3 gap-3 text-center">
              {(["documentation", "communication", "technical"] as const).map((sk) => (
                <div key={sk}>
                  <p className="text-lg font-bold text-gray-900">{user.skills[sk]}</p>
                  <p className="text-xs text-gray-400">{sk.slice(0, 4)}</p>
                </div>
              ))}
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
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{task.title}</p>
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
