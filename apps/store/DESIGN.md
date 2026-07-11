# Design

Visual system for CloudCommerce Store, scanned from `apps/store/src/app/globals.css` and existing components. Source of truth for tokens lives in CSS; this file documents it for design decisions and keeps variants on-brand. See also `.claude/Skills/frontend/estetica.md`, `Microanimaciones.md`, `tarjetas.md`.

## Color System

Single light theme (no dark mode yet — deliberate scope decision, see `docs/PLAN-VISUAL-STORE.md`).

| Role | Token | Value |
|---|---|---|
| Page background | `--cc-bg-page` | `#f6f8fb` |
| Shell / surface | `--cc-bg-shell`, `--cc-bg-surface` | `#ffffff` |
| Soft surface | `--cc-bg-surface-soft` | `#f8fafd` |
| Brand tint surface | `--cc-bg-surface-blue` | `#f3f8ff` |
| Primary | `--cc-primary` | `#0b6bff` |
| Primary hover / active | `--cc-primary-hover` / `--cc-primary-active` | `#005be8` / `#004ecc` |
| Primary soft / softer | `--cc-primary-soft` / `--cc-primary-softer` | `#eaf3ff` / `#f4f8ff` |
| Text primary → faint | `--cc-text-primary` → `--cc-text-faint` | `#101828` → `#98a2b3` |
| Success / warning / danger | `--cc-success` / `--cc-warning` / `--cc-danger` | `#16a34a` / `#f59e0b` / `#ef4444` |
| Star / rating | `--cc-star` | `#ffb020` |

Rule: never hardcode a hex value in a component. Every new color need routes through a `--cc-*` token first.

## Typography

Single family: **Inter** (`next/font/google`, variable `--font-inter`), `letter-spacing: -0.01em` on body. Headlines lean extrabold/black with negative tracking. Body copy caps at readable line lengths; no secondary typeface — weight and size carry hierarchy, not font-pairing.

## Spacing & Radii

Generous, consistent radius scale: `--cc-radius-xs` (8px) → `--cc-radius-2xl` (28px) → `--cc-radius-pill` (999px). Home page sections nest inside a `28px`-radius shell. Product cards, drawers, and panels pick from this scale — never an arbitrary radius value.

## Elevation / Shadows

Ambient, colored-tinted shadows rather than flat gray — `--cc-shadow-xs` → `--cc-shadow-lg` (the `lg` tier mixes a blue-tinted glow with a neutral shadow). Focus states use `--cc-shadow-focus` (blue ring), never a plain outline.

## Motion

Two motion systems coexist by design:

- **CSS tokens** (`--cc-ease-out`, `--cc-ease-in-out`, `--cc-ease-spring`, `--cc-ease-spring-soft`, `--cc-duration-instant/fast/normal/slow`) for CSS-only transitions and keyframes (`cc-shimmer`, `cc-float-soft`, `cc-badge-pop`, `cc-assistant-pulse`, `cc-scale-in`, `cc-check-draw`, `fadeSlideUp`).
- **`motion` (JS)** via `apps/store/src/lib/motion.ts` for anything gesture-driven or spring-physics-based: named springs `spring.snappy` / `spring.gentle` / `spring.bouncy`, shared variants `fadeSlideUp`, `staggerContainer`. `MotionConfig reducedMotion="user"` wraps the whole app in the root layout — reduced-motion is automatic for JS-driven animation; CSS keyframes still need an explicit `@media (prefers-reduced-motion: no-preference)` wrap.

Rule: `ease-out` on everything entering the screen, never `ease-in`. Springs only from the three named presets — no ad-hoc stiffness/damping per component. Duration ceilings: 200ms micro-interaction, 300ms drawer/modal, 600ms rare delight moment.

## Components

- **ProductCard** (`components/product/card.tsx`) — the richest component: badges, favorite, hover lift (`-translate-y-[3px]` + shadow), compare action on hover, price + strikethrough, wholesale hint, free-shipping flag.
- **Header / navbar** (`components/layout/navbar.tsx` + `mobile-menu.tsx`) — sticky, blurred backdrop, animated hamburger→X with slide-in drawer on mobile.
- **Drawers** (cart, wishlist) — right-side slide-in panels, currently CSS-only transitions (Bloque 1 migrates these to spring physics + drag-to-dismiss).
- **Floating AI assistant** — fixed FAB with gradient + pulse animation, opens a chat panel.
- **Skeleton** (`components/ui/skeleton.tsx`) — shimmer placeholder over `.cc-skeleton`, variants `text | card | image | avatar | chart`; always match the real content's geometry, never a generic spinner.

## Iconography

`lucide-react`, consistent stroke width, no mixed icon sets.

## Accessibility

WCAG AA target: 4.5:1 text contrast, 44px touch targets, visible focus rings via `--cc-shadow-focus`, reduced-motion respected globally (see Motion section).
