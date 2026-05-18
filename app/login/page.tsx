"use client";

import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const redirectByRole = (role: string) => {
    if (role === "new") router.push("/onboarding");
    else if (role === "manager") router.push("/dashboard");
    else router.push("/tasks");
  };

  const postSession = async (idToken: string) => {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("セッション作成に失敗しました");
    return (await res.json()) as { role: string };
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      const idToken = await result.user.getIdToken();
      const data = await postSession(idToken);
      redirectByRole(data.role);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked") {
        setError("ポップアップがブロックされました。上のメール/パスワードでログインしてください。");
      } else {
        setError(e instanceof Error ? e.message : "ログインに失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      const result = isSignUp
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      const data = await postSession(idToken);
      redirectByRole(data.role);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else if (code === "auth/email-already-in-use") {
        setError("このメールアドレスはすでに使用されています");
      } else if (code === "auth/weak-password") {
        setError("パスワードは6文字以上で設定してください");
      } else {
        setError(e instanceof Error ? e.message : "ログインに失敗しました");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            TL
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TascaLL</h1>
          <p className="text-sm text-gray-500 text-center">
            曖昧な指示をAIが構造化し、<br />最適なメンバーに自動割り振り
          </p>
        </div>

        {error && (
          <div className="w-full bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Email/Password */}
        <div className="w-full space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード（6文字以上）"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => { if (e.key === "Enter") handleEmailAuth(); }}
          />
          <button
            onClick={handleEmailAuth}
            disabled={!email.trim() || !password.trim()}
            className="w-full bg-indigo-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSignUp ? "アカウント作成" : "ログイン"}
          </button>
          <p className="text-center text-xs text-gray-500">
            {isSignUp ? "すでにアカウントをお持ちですか？" : "アカウントをお持ちでない方は"}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="ml-1 text-indigo-600 hover:underline"
            >
              {isSignUp ? "ログイン" : "新規登録"}
            </button>
          </p>
        </div>

        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">または</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
          </svg>
          Googleでログイン
        </button>
      </div>
    </div>
  );
}
