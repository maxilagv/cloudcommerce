import { homeTrustItems } from "@/lib/home-data";

export function HomeTrustRow() {
  return (
    <section aria-labelledby="home-trust-title" className="mt-8 pb-8">
      <h2 id="home-trust-title" className="sr-only">
        Confianza y soporte
      </h2>
      <div className="cc-no-scrollbar flex gap-3 overflow-x-auto rounded-[24px] border border-cc-border bg-white p-3 shadow-cc-sm lg:grid lg:grid-cols-5">
        {homeTrustItems.map(({ id, title, description, icon: Icon }) => (
          <div
            key={id}
            className="group flex min-w-[220px] items-center gap-3 rounded-cc-lg px-3 py-3 transition-colors duration-[180ms] ease-cc-out hover:bg-cc-primary-softer"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cc-soft text-cc-secondary transition-[transform,background,color] duration-[180ms] ease-cc-out group-hover:-translate-y-px group-hover:bg-cc-primary-soft group-hover:text-cc-primary">
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-extrabold text-cc-text">{title}</span>
              <span className="block truncate text-[12px] text-cc-muted">{description}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
