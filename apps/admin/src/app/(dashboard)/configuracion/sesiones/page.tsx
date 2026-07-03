"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogClose,
  Skeleton,
  useToast,
} from "@cloudcommerce/ui";
import { trpc, type SessionList } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

export default function SessionsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [target, setTarget] = useState<SessionList[number] | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["identity", "sessions"],
    queryFn: () => trpc.identity.listSessions.query(),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => trpc.identity.revokeSession.mutate({ sessionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["identity", "sessions"] });
      toast({ tone: "success", title: "Sesión revocada" });
      setTarget(null);
    },
    onError: () => toast({ tone: "error", title: "No se pudo revocar", message: "Intentá de nuevo." }),
  });

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Sesiones activas</h1>
          <div className="admin-ph__sub">Dispositivos donde tu cuenta tiene sesión abierta.</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={70} radius={14} />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="admin-panel admin-empty">
          <Monitor size={40} />
          <h4>Sin sesiones</h4>
        </div>
      ) : (
        sessions.map((s) => (
          <div className="admin-session" key={s.id}>
            <span className="admin-session__ic">
              <Monitor size={18} />
            </span>
            <div className="admin-session__info">
              <div className="admin-session__t">{s.deviceLabel || "Dispositivo desconocido"}</div>
              <div className="admin-session__m admin-mono">
                {s.ip} · inició {formatDate(s.createdAt)} · expira {formatDate(s.expiresAt)}
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setTarget(s)}>
              Revocar
            </Button>
          </div>
        ))
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent
          tone="danger"
          title="¿Revocar esta sesión?"
          description="El dispositivo tendrá que iniciar sesión de nuevo."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={revoke.isPending}
                onClick={() => target && revoke.mutate(target.id)}
              >
                Revocar sesión
              </Button>
            </>
          }
        >
          <p className="admin-mono" style={{ fontSize: 12.5, color: "var(--admin-text-muted)" }}>
            {target?.ip} · {target?.deviceLabel}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
