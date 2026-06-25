"use client";

import { useState } from "react";
import { CheckCircle2, Shield, Truck, RotateCcw, ThumbsUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductDetailData } from "@/lib/mock-product-detail";

type Tab = "descripcion" | "especificaciones" | "servicios" | "opiniones" | "preguntas";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  shield: Shield,
  truck: Truck,
  rotate: RotateCcw,
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill={n <= Math.round(rating) ? "var(--cc-star)" : "var(--cc-border-strong)"}
        >
          <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.885l-3.09 1.625.59-3.44L2 4.635l3.455-.505z" />
        </svg>
      ))}
    </span>
  );
}

function ReviewCard({
  review,
}: {
  review: ProductDetailData["reviews"][number];
}) {
  const [helpful, setHelpful] = useState(review.helpful);
  const [voted, setVoted] = useState(false);

  function vote() {
    if (voted) return;
    setHelpful((v) => v + 1);
    setVoted(true);
  }

  return (
    <div className="py-5 border-b border-cc-border-subtle last:border-0">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-cc-primary-soft flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-cc-primary">{review.initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-cc-text">{review.author}</span>
            <StarRating rating={review.rating} size={12} />
            <span className="text-[11px] text-cc-faint">{review.date}</span>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-cc-text">{review.title}</p>
          <p className="mt-1 text-[13px] text-cc-secondary leading-relaxed">{review.body}</p>
          <button
            type="button"
            onClick={vote}
            className={cn(
              "mt-3 flex items-center gap-1.5 text-[12px] transition-colors duration-[140ms]",
              voted
                ? "text-cc-primary font-semibold"
                : "text-cc-muted hover:text-cc-text",
            )}
          >
            <ThumbsUp
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-[140ms] ease-cc-spring",
                voted && "scale-110",
              )}
              strokeWidth={1.8}
            />
            Útil ({helpful})
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionAccordion({
  q,
}: {
  q: ProductDetailData["questions"][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-cc-border rounded-cc-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-cc-soft transition-colors duration-[140ms]"
      >
        <span className="text-[13px] font-semibold text-cc-text">{q.question}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-cc-muted flex-shrink-0 transition-transform duration-[220ms] ease-cc-out",
            open && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-[13px] text-cc-secondary leading-relaxed border-t border-cc-border-subtle bg-cc-soft">
          <p className="pt-3">{q.answer}</p>
          <p className="mt-2 text-[11px] text-cc-faint">{q.date}</p>
        </div>
      )}
    </div>
  );
}

export function ContentTabs({ product }: { product: ProductDetailData }) {
  const [activeTab, setActiveTab] = useState<Tab>("descripcion");

  const tabs: { id: Tab; label: string }[] = [
    { id: "descripcion", label: "Descripción" },
    { id: "especificaciones", label: "Especificaciones" },
    { id: "servicios", label: "Servicios" },
    {
      id: "opiniones",
      label: `Opiniones (${product.reviewCount.toLocaleString("es-CO")})`,
    },
    { id: "preguntas", label: `Preguntas (34)` },
  ];

  const totalReviews = product.reviewDistribution.reduce(
    (s, r) => s + r.count,
    0,
  );

  return (
    <div id="tabs-section">
      {/* Tab bar */}
      <div className="border-b border-cc-border flex gap-0 overflow-x-auto cc-no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-3.5 text-[13px] font-medium whitespace-nowrap flex-shrink-0",
              "transition-colors duration-[140ms] ease-cc-out",
              "border-b-2",
              activeTab === tab.id
                ? "border-cc-primary text-cc-primary"
                : "border-transparent text-cc-muted hover:text-cc-text hover:bg-cc-soft",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {/* Descripción */}
        {activeTab === "descripcion" && (
          <div className="max-w-3xl">
            <p className="text-[14px] text-cc-secondary leading-relaxed">
              {product.longDescription}
            </p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {product.descriptionBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="h-4 w-4 text-cc-primary flex-shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <span className="text-[14px] text-cc-text">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Especificaciones */}
        {activeTab === "especificaciones" && (
          <div className="flex flex-col gap-6">
            {product.specs.map((section) => (
              <div key={section.category}>
                <h3 className="text-[13px] font-bold text-cc-text uppercase tracking-wide mb-2">
                  {section.category}
                </h3>
                <table className="w-full text-[13px] border border-cc-border-subtle rounded-cc-sm overflow-hidden">
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-cc-soft" : "bg-white"}
                      >
                        <td className="px-4 py-2.5 text-cc-muted w-[40%]">
                          {row.label}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-cc-text">
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Servicios */}
        {activeTab === "servicios" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {product.services.map((svc, i) => {
              const Icon = SERVICE_ICONS[svc.icon] ?? Shield;
              return (
                <div
                  key={i}
                  className="flex gap-3 p-4 rounded-cc-lg border border-cc-border bg-white hover:border-cc-primary-border hover:shadow-cc-xs transition-[border-color,box-shadow] duration-[220ms]"
                >
                  <div className="mt-0.5 h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-full bg-cc-primary-soft">
                    <Icon className="h-4.5 w-4.5 text-cc-primary" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-cc-text">{svc.title}</p>
                    <p className="mt-1 text-[12px] text-cc-secondary leading-relaxed">
                      {svc.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Opiniones */}
        {activeTab === "opiniones" && (
          <div id="tab-reviews">
            {/* Summary header */}
            <div className="flex flex-col sm:flex-row gap-6 items-start pb-6 border-b border-cc-border-subtle">
              {/* Big rating */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <span className="text-[48px] font-black text-cc-text leading-none">
                  {product.rating.toFixed(1)}
                </span>
                <StarRating rating={product.rating} size={18} />
                <span className="text-[12px] text-cc-muted mt-0.5">
                  {product.reviewCount.toLocaleString("es-CO")} reseñas
                </span>
              </div>
              {/* Distribution bars */}
              <div className="flex-1 flex flex-col gap-1.5 w-full">
                {product.reviewDistribution.map((row) => {
                  const pct = totalReviews
                    ? Math.round((row.count / totalReviews) * 100)
                    : 0;
                  return (
                    <div key={row.stars} className="flex items-center gap-2">
                      <span className="text-[12px] text-cc-muted w-4 text-right flex-shrink-0">
                        {row.stars}
                      </span>
                      <svg
                        className="h-3 w-3 flex-shrink-0"
                        viewBox="0 0 14 14"
                        fill="var(--cc-star)"
                      >
                        <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.885l-3.09 1.625.59-3.44L2 4.635l3.455-.505z" />
                      </svg>
                      <div className="flex-1 h-2 rounded-full bg-cc-border-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cc-star"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-cc-muted w-7 flex-shrink-0">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual reviews */}
            <div className="mt-2">
              {product.reviews.map((review, i) => (
                <ReviewCard key={i} review={review} />
              ))}
            </div>

            <button
              type="button"
              className="mt-4 text-[13px] text-cc-primary font-medium hover:underline"
            >
              Ver las {product.reviewCount.toLocaleString("es-CO")} reseñas →
            </button>
          </div>
        )}

        {/* Preguntas */}
        {activeTab === "preguntas" && (
          <div className="max-w-2xl">
            <div className="flex flex-col gap-3">
              {product.questions.map((q, i) => (
                <QuestionAccordion key={i} q={q} />
              ))}
            </div>
            <button
              type="button"
              className="mt-5 text-[13px] text-cc-primary font-medium hover:underline"
            >
              Ver las 34 preguntas →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
