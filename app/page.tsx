"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Ticket } from "lucide-react";
import { Field, GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { authFetch } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { qqEmailIsValid } from "@/lib/utils";

type AuthMode = "login" | "register";
type LoginMethod = "password" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/home");
    });
  }, [router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setCode("");
    setCodeSent(false);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
  }

  function validatePassword() {
    if (mode === "login" && loginMethod === "code") return true;
    if (password.length < 8) {
      setMessage("密码至少需要 8 位。");
      return false;
    }
    if (mode === "register" && password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return false;
    }
    return true;
  }

  function translateAuthError(error: string) {
    const lower = error.toLowerCase();
    if (lower.includes("email rate limit")) return "邮箱发送太频繁了，请稍等一会儿再试。";
    if (lower.includes("invalid login credentials")) return "邮箱或密码不正确。";
    if (lower.includes("otp") || lower.includes("token")) return "验证码不正确或已过期，请重新检查。";
    if (lower.includes("user already registered") || lower.includes("already registered")) return "这个邮箱已经注册过了，请直接登录。";
    if (lower.includes("signup")) return "注册失败，请稍后再试。";
    return error;
  }

  async function emailExists() {
    const response = await fetch("/api/auth/email-exists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "检查邮箱失败，请稍后再试。");
    return Boolean(payload.exists);
  }

  async function requestCode() {
    if (!qqEmailIsValid(email)) {
      setMessage("请输入合法的 QQ 邮箱，例如 123456@qq.com");
      return;
    }
    if (!validatePassword()) return;
    setLoading(true);
    setMessage("");

    let error: Error | null = null;
    try {
      if (mode === "register") {
        const exists = await emailExists();
        if (exists) {
          setLoading(false);
          setMessage("这个邮箱已经注册过了，请切换到登录。");
          return;
        }
        const result = await getSupabaseBrowserClient().auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        error = result.error;
      } else {
        const result = await getSupabaseBrowserClient().auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        error = result.error;
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error("发送验证码失败，请稍后再试。");
    }
    setLoading(false);
    if (error) {
      setMessage(translateAuthError(error.message));
      return;
    }
    setCodeSent(true);
    setMessage(mode === "register" ? "注册验证码已发送，请查看 QQ 邮箱。" : "登录验证码已发送，请查看 QQ 邮箱。");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!qqEmailIsValid(email)) {
      setMessage("请输入合法的 QQ 邮箱，例如 123456@qq.com");
      return;
    }
    if (!validatePassword()) return;
    setLoading(true);
    setMessage("");

    if (mode === "login") {
      const { error } =
        loginMethod === "password"
          ? await getSupabaseBrowserClient().auth.signInWithPassword({
              email: email.trim(),
              password
            })
          : await getSupabaseBrowserClient().auth.verifyOtp({
              email: email.trim(),
              token: code.trim(),
              type: "email"
            });
      if (error) {
        setLoading(false);
        setMessage(translateAuthError(error.message));
        return;
      }
    } else {
      if (!codeSent) {
        setLoading(false);
        setMessage("请先发送注册验证码。");
        return;
      }
      if (code.trim().length < 6) {
        setLoading(false);
        setMessage("请输入邮箱里的完整验证码。");
        return;
      }
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "signup"
      });
      if (error) {
        setLoading(false);
        setMessage(translateAuthError(error.message));
        return;
      }
    }

    const { error } = await getSupabaseBrowserClient().auth.getSession();
    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }
    try {
      await authFetch("/api/auth/profile", {
        method: "POST",
        body: JSON.stringify({ inviteCode })
      });
    } catch (error) {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "登录后初始化资料失败。");
      return;
    }
    setLoading(false);
    router.push("/home");
  }

  return (
    <Shell contentClassName="items-center justify-center">
      <Panel className="book-cover w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            alt="怪咖日记 logo"
            className="mb-4 size-28 rounded-3xl object-cover shadow-glow"
            height={112}
            priority
            src="/weirdo-diary-logo.png"
            width={112}
          />
          <h1 className="font-serif text-4xl font-bold text-primary">怪咖日记</h1>
          <p className="mt-2 text-sm text-on-surface-variant">你的专属 AI 语音日记</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-surface-dim p-1">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "login" ? "bg-secondary-container text-secondary shadow-glow" : "text-on-surface-variant"
            }`}
            onClick={() => switchMode("login")}
            type="button"
          >
            登录
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === "register" ? "bg-secondary-container text-secondary shadow-glow" : "text-on-surface-variant"
            }`}
            onClick={() => switchMode("register")}
            type="button"
          >
            注册
          </button>
        </div>

        {mode === "login" ? (
          <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-surface-dim p-1">
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                loginMethod === "password" ? "bg-surface-container-high text-secondary" : "text-on-surface-variant"
              }`}
              onClick={() => {
                setLoginMethod("password");
                setCode("");
                setCodeSent(false);
                setMessage("");
              }}
              type="button"
            >
              密码登录
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                loginMethod === "code" ? "bg-surface-container-high text-secondary" : "text-on-surface-variant"
              }`}
              onClick={() => {
                setLoginMethod("code");
                setPassword("");
                setMessage("");
              }}
              type="button"
            >
              邮箱验证码
            </button>
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={submit}>
          <Field label="QQ 邮箱">
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-on-surface-variant" size={18} />
              <input
                className={`${inputClass} pl-10`}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="输入您的 QQ 邮箱"
                type="email"
                value={email}
              />
            </div>
          </Field>

          {mode === "register" || loginMethod === "password" ? (
            <PasswordField label="密码" onChange={setPassword} placeholder="至少 8 位密码" value={password} />
          ) : null}

          {mode === "register" ? (
            <PasswordField label="确认密码" onChange={setConfirmPassword} placeholder="再次输入密码" value={confirmPassword} />
          ) : null}

          {mode === "register" || loginMethod === "code" ? (
            <Field label={mode === "register" ? "注册验证码" : "登录验证码"}>
              <div className="flex gap-3">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="输入邮箱验证码"
                  value={code}
                />
                <button
                  className="shrink-0 rounded-xl border border-white/10 bg-surface-container-high px-4 text-sm font-semibold text-secondary transition hover:border-secondary/40 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={requestCode}
                  disabled={loading}
                  type="button"
                >
                  {codeSent ? "重新发送" : "发送验证码"}
                </button>
              </div>
            </Field>
          ) : null}

          {mode === "register" ? (
            <Field label="邀请码（可选）">
              <div className="relative">
                <Ticket className="absolute left-3 top-3.5 text-on-surface-variant" size={18} />
                <input
                  className={`${inputClass} pl-10`}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="输入邀请码（如有）"
                  value={inviteCode}
                />
              </div>
            </Field>
          ) : null}

          {message ? <p className="rounded-xl bg-surface-dim px-4 py-3 text-sm text-on-surface-variant">{message}</p> : null}

          <GlowButton className="w-full py-4 text-base" disabled={loading} type="submit">
            {loading ? "请稍候..." : mode === "login" ? "登录" : "完成注册"}
            <ArrowRight size={18} />
          </GlowButton>
          <p className="text-center text-xs text-on-surface-variant/60">
            {mode === "login" ? "还没有账号？点击上方注册。" : "验证码可能是 6 位或 8 位，请按邮件完整输入。"}
          </p>
        </form>
      </Panel>
    </Shell>
  );
}

function PasswordField({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-3.5 text-on-surface-variant" size={18} />
        <input
          className={`${inputClass} pl-14 pr-12`}
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "隐藏密码" : "显示密码"}
          className="absolute right-3 top-3.5 text-on-surface-variant transition hover:text-secondary"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </Field>
  );
}
