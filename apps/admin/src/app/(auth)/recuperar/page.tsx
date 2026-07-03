"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Button } from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await trpc.identity.startPasswordReset.mutate({ email });
    } catch {
      // response is intentionally generic — never reveal whether the email exists
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="admin-auth">
      <div className="admin-auth__form-col">
        <motion.form
          className="admin-auth__form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={onSubmit}
        >
          <div className="admin-auth__logo">
            <span className="m" />
            <b>CloudCommerce</b>
          </div>
          <div>
            <h1>Recuperar contraseña</h1>
            <p className="admin-auth__sub">
              {sent
                ? "Si el email está registrado, te enviamos un enlace para restablecer tu contraseña."
                : "Te enviaremos un enlace para restablecerla."}
            </p>
          </div>

          {!sent && (
            <>
              <div className="admin-field">
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
              </div>
              <Button type="submit" size="lg" loading={loading} style={{ width: "100%", justifyContent: "center" }}>
                Enviar enlace
              </Button>
            </>
          )}

          <a className="admin-auth__row" href="/login" style={{ color: "var(--admin-accent)", textDecoration: "none" }}>
            ← Volver al inicio de sesión
          </a>
        </motion.form>
      </div>
      <div className="admin-auth__scene">
        <span className="admin-orb" style={{ width: 11, height: 11, top: "40%", left: "40%", background: "var(--admin-accent)" }} />
        <span className="admin-orb" style={{ width: 13, height: 13, top: "62%", left: "58%", background: "var(--chart-4)", animationDuration: "6.5s" }} />
      </div>
    </div>
  );
}
