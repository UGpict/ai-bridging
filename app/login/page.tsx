"use client";

import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const redirectByRole = (role: string) => {
    if (role === "new") window.location.href = "/onboarding";
    else if (role === "manager") window.location.href = "/dashboard";
    else window.location.href = "/tasks";
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
        setError("ポップアップがブロックされました。メール/パスワードをご利用ください。");
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative overflow-hidden p-12">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 w-full max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.webp"
            alt="TascaLL"
            className="rounded-2xl shadow-2xl w-full object-cover object-center"
            style={{ maxHeight: 320 }}
          />
          <div className="mt-8 text-white">
            <h2 className="text-3xl font-black tracking-tight">TascaLL</h2>
            <p className="mt-2 text-white/80 text-base leading-relaxed">
              曖昧な指示をAIが構造化し、<br />バッジスコアで最適なメンバーに自動割り振り
            </p>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col gap-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-2">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md">
              TL
            </div>
            <h1 className="text-xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              TascaLL
            </h1>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900">ログイン</h2>
            <p className="text-sm text-gray-500 mt-0.5">アカウントにアクセス</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード（6文字以上）"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter") handleEmailAuth(); }}
            />
            <button
              onClick={handleEmailAuth}
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-6 py-3 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "処理中..." : isSignUp ? "アカウント作成" : "ログイン"}
            </button>
            <p className="text-center text-xs text-gray-500">
              {isSignUp ? "すでにアカウントをお持ちですか？" : "アカウントをお持ちでない方は"}
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                className="ml-1 text-indigo-600 hover:underline font-medium"
              >
                {isSignUp ? "ログイン" : "新規登録"}
              </button>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">または</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
            </svg>
            Googleでログイン
          </button>
        </div>
      </div>
    </div>
  );
}
