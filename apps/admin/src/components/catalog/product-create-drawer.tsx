"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button, Dialog, DialogClose, DialogContent, Select, useToast, type SelectOption } from "@cloudcommerce/ui";
import type { CategoryNode } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { slugify } from "@/lib/slug";

function flattenCategories(nodes: CategoryNode[], depth = 0, acc: SelectOption[] = []): SelectOption[] {
  for (const node of nodes) {
    acc.push({ value: node.id, label: `${"— ".repeat(depth)}${node.name}` });
    if (node.children.length) flattenCategories(node.children, depth + 1, acc);
  }
  return acc;
}

export function ProductCreateDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");

  const categories = useQuery({
    queryKey: ["catalog", "categories", "all"],
    queryFn: () => trpc.catalog.categories.list.query({ includeInactive: true }),
    enabled: open,
  });

  const options = useMemo(() => (categories.data ? flattenCategories(categories.data) : []), [categories.data]);
  const effectiveCategory = categoryId || options[0]?.value || "";

  const create = useMutation({
    mutationFn: () =>
      trpc.catalog.products.create.mutate({
        slug: slugify(title),
        title: title.trim(),
        description: description.trim(),
        categoryId: effectiveCategory,
        ...(sku.trim() ? { sku: sku.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      toast({ tone: "success", title: "Producto creado", message: "Ya podés editarlo y publicarlo." });
      reset();
      onClose();
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo crear", message: err instanceof Error ? err.message : "Revisá los datos." }),
  });

  function reset() {
    setTitle("");
    setDescription("");
    setCategoryId("");
    setSku("");
  }

  const canSubmit = title.trim().length >= 2 && description.trim().length >= 1 && effectiveCategory.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Nuevo producto"
        description="Cargá lo esencial; el resto (imágenes, variantes, SEO) se completa en el detalle."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
              Crear producto
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="admin-form-g">
            <span>Nombre</span>
            <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Heladera Inverter 300L" />
            {title && <span className="admin-cell-sub admin-mono">slug: {slugify(title)}</span>}
          </label>
          <label className="admin-form-g">
            <span>Categoría</span>
            {options.length === 0 ? (
              <span className="admin-cell-sub">Creá una categoría primero.</span>
            ) : (
              <Select options={options} value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)} />
            )}
          </label>
          <label className="admin-form-g">
            <span>SKU (opcional)</span>
            <input className="ui-input admin-mono" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-000" />
          </label>
          <label className="admin-form-g">
            <span>Descripción</span>
            <textarea
              className="ui-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del producto…"
            />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
