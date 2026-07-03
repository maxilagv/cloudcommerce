"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  Skeleton,
  useToast,
  type SelectOption,
} from "@cloudcommerce/ui";
import type { CategoryNode } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { slugify } from "@/lib/slug";

interface FlatCategory {
  node: CategoryNode;
  depth: number;
}

function flatten(nodes: CategoryNode[], depth = 0, acc: FlatCategory[] = []): FlatCategory[] {
  for (const node of nodes) {
    acc.push({ node, depth });
    if (node.children.length) flatten(node.children, depth + 1, acc);
  }
  return acc;
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");

  const query = useQuery({
    queryKey: ["catalog", "categories", "all"],
    queryFn: () => trpc.catalog.categories.list.query({ includeInactive: true }),
  });

  const flat = useMemo(() => (query.data ? flatten(query.data) : []), [query.data]);
  const parentOptions: SelectOption[] = useMemo(
    () => [{ value: "", label: "Sin categoría padre" }, ...flat.map((f) => ({ value: f.node.id, label: `${"— ".repeat(f.depth)}${f.node.name}` }))],
    [flat],
  );

  const create = useMutation({
    mutationFn: () =>
      trpc.catalog.categories.create.mutate({
        name: name.trim(),
        slug: slugify(name),
        ...(parentId ? { parentId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "categories"] });
      toast({ tone: "success", title: "Categoría creada" });
      setName("");
      setParentId("");
      setCreating(false);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Categorías</h1>
          <div className="admin-ph__sub">{flat.length} categorías</div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nueva categoría
          </Button>
        </div>
      </div>

      <div className="admin-tbl-card">
        {query.isLoading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={40} radius={10} />
            ))}
          </div>
        ) : flat.length === 0 ? (
          <div className="admin-empty" style={{ padding: 48 }}>
            <LayoutGrid size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
            <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin categorías</div>
          </div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Slug</th>
                <th style={{ textAlign: "right" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {flat.map(({ node, depth }) => (
                <tr key={node.id}>
                  <td>
                    <span style={{ paddingLeft: depth * 18, fontWeight: depth === 0 ? 600 : 500 }}>
                      {depth > 0 && <span style={{ color: "var(--admin-text-faint)", marginRight: 6 }}>└</span>}
                      {node.name}
                    </span>
                  </td>
                  <td className="admin-mono" style={{ color: "var(--admin-text-muted)", fontSize: 12 }}>
                    {node.slug}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Badge tone={node.isActive ? "success" : "muted"}>{node.isActive ? "Activa" : "Inactiva"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent
          title="Nueva categoría"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={create.isPending} disabled={name.trim().length < 2} onClick={() => create.mutate()}>
                Crear
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="admin-form-g">
              <span>Nombre</span>
              <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Electrodomésticos" />
              {name && <span className="admin-cell-sub admin-mono">slug: {slugify(name)}</span>}
            </label>
            <label className="admin-form-g">
              <span>Categoría padre</span>
              <Select options={parentOptions} value={parentId} onChange={(e) => setParentId(e.target.value)} />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
