import { homeBenefits } from "@/lib/home-data";

export function HomeBenefitsStrip() {
  return (
    <section aria-labelledby="home-benefits-title" className="mt-4">
      <h2 id="home-benefits-title" className="sr-only">
        Beneficios de comprar en cloudcommerce
      </h2>
      <div className="grid gap-3 rounded-[24px] border border-cc-border bg-white p-3 shadow-cc-sm sm:grid-cols-2 lg:grid-cols-5">
        {homeBenefits.map(({ id, title, description, icon: Icon }) => (
          <div
            key={id}
            className="group flex items-center gap-3 rounded-cc-lg px-2 py-2 transition-colors duration-[180ms] ease-cc-out hover:bg-cc-primary-softer"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cc-primary-soft text-cc-primary transition-transform duration-[180ms] ease-cc-out group-hover:-translate-y-px group-hover:scale-[1.04]">
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-extrabold text-cc-text">{title}</span>
              <span className="block truncate text-[12px] font-medium text-cc-muted">{description}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
