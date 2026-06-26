const NAV_ITEMS = [
  { label: "Inicio", href: "/", active: true },
  { label: "Catálogo", href: "#catalogo" },
  { label: "Ofertas", href: "#" },
  { label: "Novedades", href: "#" },
  { label: "Marcas", href: "#" },
];

export function MainNav() {
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className={[
            "cc-focus-ring rounded-cc-sm px-3 py-2 text-sm font-medium transition-[color,background] duration-[140ms] ease-cc-out",
            item.active
              ? "text-cc-text"
              : "text-cc-secondary hover:bg-cc-primary-softer hover:text-cc-primary",
          ].join(" ")}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
