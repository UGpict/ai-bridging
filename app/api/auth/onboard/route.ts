import { adminAuth } from "@/lib/firebaseAdmin";
import { createUser, createOrganization, getOrganizationByCode } from "@/lib/firestore";
import { cookies } from "next/headers";
import type { User, Organization } from "@/types";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const uid = decoded.uid;
    const displayName = decoded.name ?? decoded.email ?? uid;
    const email = decoded.email ?? "";

    const { action, teamName, inviteCode } = (await request.json()) as {
      action: string;
      teamName?: string;
      inviteCode?: string;
    };

    if (action === "create") {
      if (!teamName?.trim()) {
        return Response.json({ error: "チーム名を入力してください" }, { status: 400 });
      }

      const code = generateInviteCode();
      const org: Organization = {
        id: uid,
        name: teamName.trim(),
        managerUid: uid,
        managerName: displayName,
        inviteCode: code,
      };

      await createOrganization(org);

      const user: User = {
        uid,
        name: displayName,
        email,
        role: "manager",
        badgeScore: 0,
        badgeLevel: "見習い",
        skills: { documentation: 0, communication: 0, technical: 0 },
        orgId: org.id,
      };

      await createUser(user);

      return Response.json({ role: "manager", inviteCode: code });
    }

    if (action === "join") {
      if (!inviteCode?.trim()) {
        return Response.json({ error: "招待コードを入力してください" }, { status: 400 });
      }

      const org = await getOrganizationByCode(inviteCode.trim().toUpperCase());
      if (!org) {
        return Response.json({ error: "招待コードが正しくありません" }, { status: 404 });
      }

      const user: User = {
        uid,
        name: displayName,
        email,
        role: "member",
        badgeScore: 0,
        badgeLevel: "見習い",
        skills: { documentation: 0, communication: 0, technical: 0 },
        orgId: org.id,
      };

      await createUser(user);

      return Response.json({ role: "member" });
    }

    return Response.json({ error: "無効なアクション" }, { status: 400 });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
