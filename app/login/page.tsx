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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Background: logo image full-screen blurred */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage: "url(/logo.webp)",
          filter: "blur(3px) brightness(0.55)",
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-violet-950/50 to-slate-950/70" />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md px-4">

        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3 select-none">
          {/* Logo icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-violet-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-violet-500/40">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
              {/* Arrow body */}
              <path
                d="M8 32 L20 10 L32 32"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Arrow tip up-right */}
              <path
                d="M22 10 L32 8 L30 18"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Person dot */}
              <circle cx="24" cy="15" r="2.5" fill="white" opacity="0.9" />
            </svg>
          </div>

          {/* Wordmark */}
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tight leading-none">
              <span className="text-white">Tasca</span>
              <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">LL</span>
              <span className="ml-2 text-xs font-bold bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-md px-1.5 py-0.5 align-super">
                LLM
              </span>
            </h1>
            <p className="text-white/50 text-sm mt-1 font-medium tracking-widest uppercase">
              by TascaLL Agent
            </p>
          </div>
        </div>

        {/* Login card — glassmorphism */}
        <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-7 shadow-2xl">

          {error && (
            <div className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-3 text-sm mb-5">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-transparent transition-all"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード（6文字以上）"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-transparent transition-all"
              onKeyDown={(e) => { if (e.key === "Enter") handleEmailAuth(); }}
            />
            <button
              onClick={handleEmailAuth}
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 shadow-lg shadow-violet-500/30"
            >
              {loading ? "処理中..." : isSignUp ? "アカウント作成" : "ログイン"}
            </button>
            <p className="text-center text-xs text-white/50">
              {isSignUp ? "すでにアカウントをお持ちですか？" : "アカウントをお持ちでない方は"}
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                className="ml-1 text-violet-300 hover:text-violet-200 font-medium hover:underline"
              >
                {isSignUp ? "ログイン" : "新規登録"}
              </button>
            </p>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-xs text-white/30">または</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white/10 border border-white/20 rounded-xl py-3 text-white text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-40"
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
