import { adminAuth } from "@/lib/firebaseAdmin";
import { createUser, getUser } from "@/lib/firestore";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import type { User } from "@/types";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const caller = await getUser(decoded.uid);
    if (!caller || caller.role !== "manager") {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    const { name, email, skills } = (await request.json()) as {
      name: string;
      email: string;
      skills: { documentation: number; communication: number; technical: number; ci_cd: number };
    };

    const badgeScore = 0;
    const badgeLevel = "見習い";
    const uid = randomUUID();

    const user: User = {
      uid,
      name,
      email,
      role: "member",
      badgeScore,
      badgeLevel,
      skills,
    };

    await createUser(user);

    return Response.json({ uid });
  } catch (error) {
    return Response.json(
      { error: "エラーが発生しました" },
      { status: 500 }
    );
  }
}
