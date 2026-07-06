/**
 * Route template: remounts per navigation so every dashboard page enters
 * with the shared fade-up motion (respects prefers-reduced-motion globally).
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="admin-page-enter">{children}</div>;
}
