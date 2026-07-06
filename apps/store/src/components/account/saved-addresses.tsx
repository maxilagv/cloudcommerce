"use client";

import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAddresses } from "@/store/addresses";
import { toast } from "@/store/toast";
import { Modal } from "@/components/ui/modal";
import type { Address } from "@/lib/account-types";

type FormState = { label: string; name: string; street: string; city: string; isPrimary: boolean };

const emptyForm: FormState = {
  label: "",
  name: "",
  street: "",
  city: "",
  isPrimary: false,
};

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-cc-secondary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-cc-sm border border-cc-border bg-white px-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms] placeholder:text-cc-faint focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/10"
      />
    </label>
  );
}

export function SavedAddresses() {
  const addresses = useAddresses((s) => s.addresses);
  const add = useAddresses((s) => s.add);
  const update = useAddresses((s) => s.update);
  const remove = useAddresses((s) => s.remove);
  const setPrimary = useAddresses((s) => s.setPrimary);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(addr: Address) {
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      name: addr.name,
      street: addr.street,
      city: addr.city,
      isPrimary: addr.isPrimary,
    });
    setOpen(true);
  }

  function save() {
    if (!form.label.trim() || !form.name.trim() || !form.street.trim() || !form.city.trim()) {
      toast.error("Completá todos los campos");
      return;
    }
    if (editingId) {
      update(editingId, form);
      toast.success("Dirección actualizada");
    } else {
      add(form);
      toast.success("Dirección agregada");
    }
    setOpen(false);
  }

  const set = (key: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <div>
      <h2 className="text-[18px] font-bold text-cc-text mb-4">Mis direcciones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 relative"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-cc-sm bg-cc-primary-soft flex items-center justify-center">
                  <MapPin className="h-3.5 w-3.5 text-cc-primary" strokeWidth={1.8} />
                </span>
                <span className="text-[13px] font-bold text-cc-text">{addr.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {addr.isPrimary && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cc-success-soft text-cc-success">
                    Principal
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(addr)}
                  aria-label={`Editar ${addr.label}`}
                  className="h-7 w-7 rounded-cc-sm flex items-center justify-center text-cc-muted hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] cc-focus-ring"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    remove(addr.id);
                    toast.info("Dirección eliminada");
                  }}
                  aria-label={`Eliminar ${addr.label}`}
                  className="h-7 w-7 rounded-cc-sm flex items-center justify-center text-cc-muted hover:text-cc-danger hover:bg-cc-danger-soft transition-colors duration-[140ms] cc-focus-ring"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <p className="text-[13px] font-medium text-cc-text">{addr.name}</p>
            <p className="text-[13px] text-cc-secondary mt-0.5">{addr.street}</p>
            <p className="text-[13px] text-cc-muted">{addr.city}</p>
            {!addr.isPrimary && (
              <button
                type="button"
                onClick={() => {
                  setPrimary(addr.id);
                  toast.success("Dirección principal actualizada");
                }}
                className="mt-3 flex items-center gap-1 text-[12px] font-medium text-cc-primary hover:underline"
              >
                <Star className="h-3 w-3" strokeWidth={2} />
                Hacer principal
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={openAdd}
          className="flex flex-col items-center justify-center gap-2 h-full min-h-[130px] rounded-cc-xl border-2 border-dashed border-cc-border-strong text-cc-muted hover:border-cc-primary hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
        >
          <Plus className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[13px] font-medium">Agregar nueva dirección</span>
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar dirección" : "Nueva dirección"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-cc-sm px-4 py-2 text-[13px] font-medium text-cc-secondary hover:bg-cc-soft"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-cc-sm bg-cc-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-cc-primary-hover"
            >
              Guardar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Etiqueta" value={form.label} onChange={set("label")} placeholder="Casa, Oficina…" />
          <Input label="Nombre" value={form.name} onChange={set("name")} placeholder="Nombre completo" />
          <Input label="Dirección" value={form.street} onChange={set("street")} placeholder="Calle, número, apto" />
          <Input label="Ciudad" value={form.city} onChange={set("city")} placeholder="Ciudad, CP" />
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              className="h-4 w-4 accent-cc-primary"
            />
            <span className={cn("text-[13px]", form.isPrimary ? "text-cc-text" : "text-cc-secondary")}>
              Usar como dirección principal
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
