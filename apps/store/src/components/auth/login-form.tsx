"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Cloud, Loader2, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";

export function LoginForm() {
  const router = useRouter();
  const returnTo = useSearchParams().get("returnTo") || "/account";
  const login = useAuth((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Ingresá un correo válido");
      return;
    }
    if (password.length === 0) {
      setError("Ingresá tu contraseña");
      return;
    }
    setError("");
    setLoading(true);
    const ok = await login(email, password);
    if (ok) {
      toast.success("Sesión iniciada", { description: email });
      router.replace(returnTo);
      return;
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cc-page px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-cc-sm bg-cc-primary text-white">
            <Cloud className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-[18px] font-extrabold tracking-tight text-cc-text">
            CloudCommerce
          </span>
        </Link>

        <div className="rounded-cc-xl border border-cc-border bg-white p-6 shadow-cc-sm sm:p-7">
          <h1 className="text-[20px] font-bold text-cc-text">Iniciá sesión</h1>
          <p className="mt-1 text-[13px] text-cc-muted">
            Necesitás una cuenta para completar tu compra.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-cc-secondary">Correo</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  autoComplete="email"
                  className="h-11 w-full rounded-cc-sm border border-cc-border bg-white pl-9 pr-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms] placeholder:text-cc-faint focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/10"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-cc-secondary">Contraseña</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-cc-sm border border-cc-border bg-white pl-9 pr-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms] placeholder:text-cc-faint focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/10"
                />
              </div>
            </label>

            {error && <p className="text-[12px] text-cc-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(11,107,255,0.24)] transition-[filter] hover:brightness-[1.03]",
                loading && "opacity-70",
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Iniciar sesión
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-cc-muted">
            ¿No tenés cuenta?{" "}
            <Link
              href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
              className="font-semibold text-cc-primary hover:underline"
            >
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
