"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { TRPCClientError } from "@trpc/client";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 9 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } },
};

/** A 409 from login is always MFA_REQUIRED (the only conflict this procedure raises). */
function isMfaRequired(err: unknown): boolean {
  if (err instanceof TRPCClientError) {
    const data = err.data as { status?: number } | null;
    if (data?.status === 409) return true;
    if (typeof err.message === "string" && /mfa/i.test(err.message)) return true;
  }
  return false;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function bump() {
    const el = formRef.current;
    if (!el) return;
    el.classList.remove("admin-shake");
    void el.offsetWidth;
    el.classList.add("admin-shake");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await trpc.identity.login.mutate({
        email,
        password,
        ...(mfa && otp ? { otp } : {}),
      });
      router.replace(next);
    } catch (err) {
      if (isMfaRequired(err) && !mfa) {
        setMfa(true);
        setLoading(false);
        return;
      }
      const message =
        err instanceof TRPCClientError ? err.message : "No pudimos iniciar sesión. Revisá tus datos.";
      setError(mfa ? "Código inválido. Probá de nuevo." : message);
      setLoading(false);
      bump();
    }
  }

  return (
    <div className="admin-auth">
      <div className="admin-auth__form-col">
        <motion.form
          ref={formRef}
          className="admin-auth__form"
          variants={container}
          initial="hidden"
          animate="show"
          onSubmit={onSubmit}
        >
          <motion.div className="admin-auth__logo" variants={item}>
            <span className="m" />
            <b>CloudCommerce</b>
          </motion.div>
          <motion.div variants={item}>
            <h1>{mfa ? "Verificación en dos pasos" : "Bienvenido de nuevo"}</h1>
            <p className="admin-auth__sub">
              {mfa ? "Ingresá el código de tu app de autenticación." : "Ingresá para gestionar tu tienda."}
            </p>
          </motion.div>

          {!mfa ? (
            <>
              <motion.div className="admin-field" variants={item}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  className="ui-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dueño@tutienda.com"
                  required
                />
              </motion.div>
              <motion.div className="admin-field" variants={item}>
                <label htmlFor="password">Contraseña</label>
                <div className="admin-field__pw">
                  <input
                    id="password"
                    className="ui-input"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="admin-field__eye"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </motion.div>
              <motion.div className="admin-auth__row" variants={item}>
                <label>
                  <input type="checkbox" style={{ accentColor: "var(--admin-accent)" }} defaultChecked /> Recordarme
                </label>
                <a href="/recuperar">¿Olvidaste tu contraseña?</a>
              </motion.div>
            </>
          ) : (
            <motion.div className="admin-field" variants={item}>
              <label htmlFor="otp">Código de 6 dígitos</label>
              <input
                id="otp"
                className="ui-input admin-mono"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                required
              />
            </motion.div>
          )}

          {error && (
            <motion.div className="admin-auth__err" variants={item}>
              {error}
            </motion.div>
          )}

          <motion.div variants={item}>
            <Button type="submit" size="lg" loading={loading} style={{ width: "100%", justifyContent: "center" }}>
              {mfa ? "Verificar" : "Ingresar"}
            </Button>
          </motion.div>
          <motion.div className="admin-auth__foot" variants={item}>
            Protegido con MFA · sesión cifrada
          </motion.div>
        </motion.form>
      </div>

      <motion.div
        className="admin-auth__scene"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="admin-orb" style={{ width: 11, height: 11, top: "34%", left: "34%", background: "var(--admin-accent)" }} />
        <span className="admin-orb" style={{ width: 8, height: 8, top: "26%", left: "64%", background: "var(--chart-4)", animationDuration: "6s" }} />
        <span className="admin-orb" style={{ width: 15, height: 15, top: "66%", left: "28%", background: "var(--chart-2)", animationDuration: "7s", opacity: 0.85 }} />
        <div className="admin-scene-cards">
          <div className="admin-gcard" style={{ marginRight: "24%" }}>
            <div className="admin-gcard__row">
              <span className="admin-gcard__lbl">Ventas hoy</span>
              <span className="admin-gcard__up">↑ 12.4%</span>
            </div>
            <div className="admin-gcard__v">$248.900</div>
          </div>
          <div className="admin-gcard" style={{ marginLeft: "26%" }}>
            <div className="admin-gcard__row">
              <span className="admin-gcard__lbl">Pedidos activos</span>
              <span className="admin-gcard__up">18</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
