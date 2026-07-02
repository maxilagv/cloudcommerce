import Link from "next/link";

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "Ver todo",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cc-primary">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-[22px] font-black tracking-[-0.035em] text-cc-text sm:text-[26px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-cc-secondary">
            {description}
          </p>
        ) : null}
      </div>

      {href ? (
        <Link
          href={href}
          className="cc-focus-ring inline-flex h-10 items-center justify-center rounded-full border border-cc-primary-border bg-white px-4 text-sm font-bold text-cc-primary transition-[transform,border-color,box-shadow] duration-[180ms] ease-cc-out hover:-translate-y-px hover:shadow-cc-sm"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
