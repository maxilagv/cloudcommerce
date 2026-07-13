"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Mail } from "lucide-react";

/** TODO: connect newsletter submission to the store email provider. */
export function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  function submit(event: React.FormEvent) { event.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email)) setSubmitted(true); }
  return <form onSubmit={submit} className="mt-5 max-w-[520px]"><div className="flex min-h-12 overflow-hidden rounded-full border border-cc-shell/30 bg-cc-shell/10 p-1"><AnimatePresence mode="wait" initial={false}>{submitted ? <motion.p key="success" initial={{ opacity: 0, transform: "scale(0.97)" }} animate={{ opacity: 1, transform: "scale(1)" }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 items-center gap-2 px-3 text-[13px] font-semibold text-cc-shell"><Check className="h-4 w-4 text-cc-success" strokeWidth={2} />Listo, te avisamos primero.</motion.p> : <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 items-center"><Mail className="ml-3 h-4 w-4 shrink-0 text-cc-primary-border" strokeWidth={1.75} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Tu correo electrónico" className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[13px] text-cc-shell outline-none placeholder:text-cc-primary-border" /><button type="submit" className="cc-focus-ring rounded-full bg-cc-shell px-4 text-[13px] font-bold text-cc-primary transition-[background-color,transform] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-soft active:scale-[0.98]">Suscribirme</button></motion.div>}</AnimatePresence></div></form>;
}
