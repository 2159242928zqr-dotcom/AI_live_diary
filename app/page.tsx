"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Ticket } from "lucide-react";
import { Field, GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { getLocalUser, saveLocalUser } from "@/lib/local-diary";
import { qqEmailIsValid } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [expectedCode, setExpectedCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (getLocalUser()) router.replace("/home");
  }, [router]);

  function requestCode() {
    if (!qqEmailIsValid(email)) {
      setMessage("请输入合法的 QQ 邮箱，例如 123456@qq.com");
      return;
    }
    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    setExpectedCode(nextCode);
    setCodeSent(true);
    setMessage(`演示验证码：${nextCode}。配置 Supabase 后这里会发送真实邮件。`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!qqEmailIsValid(email)) {
      setMessage("请输入合法的 QQ 邮箱，例如 123456@qq.com");
      return;
    }
    if (!codeSent) {
      setMessage("请先发送验证码。");
      return;
    }
    if (code.trim() !== expectedCode) {
      setMessage("验证码不正确，请检查后再试。");
      return;
    }
    saveLocalUser(email, inviteCode);
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

          <Field label="验证码">
            <div className="flex gap-3">
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="输入验证码"
                value={code}
              />
              <button
                className="shrink-0 rounded-xl border border-white/10 bg-surface-container-high px-4 text-sm font-semibold text-secondary transition hover:border-secondary/40"
                onClick={requestCode}
                type="button"
              >
                {codeSent ? "重新发送" : "发送验证码"}
              </button>
            </div>
          </Field>

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

          {message ? <p className="rounded-xl bg-surface-dim px-4 py-3 text-sm text-on-surface-variant">{message}</p> : null}

          <GlowButton className="w-full py-4 text-base" type="submit">
            开启记忆之旅
            <ArrowRight size={18} />
          </GlowButton>
          <p className="text-center text-xs text-on-surface-variant/60">登录即代表您同意隐私协议与服务条款</p>
        </form>
      </Panel>
    </Shell>
  );
}
