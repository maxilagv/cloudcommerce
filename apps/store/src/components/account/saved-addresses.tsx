import { MapPin, Plus, Pencil } from "lucide-react";
import { mockAddresses } from "@/lib/mock-account";

export function SavedAddresses() {
  return (
    <div>
      <h2 className="text-[18px] font-bold text-cc-text mb-4">
        Mis direcciones
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mockAddresses.map((addr) => (
          <div
            key={addr.id}
            className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 relative"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-cc-sm bg-cc-primary-soft flex items-center justify-center">
                  <MapPin className="h-3.5 w-3.5 text-cc-primary" strokeWidth={1.8} />
                </span>
                <span className="text-[13px] font-bold text-cc-text">
                  {addr.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {addr.isPrimary && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cc-success-soft text-cc-success">
                    Principal
                  </span>
                )}
                <button
                  type="button"
                  className="h-7 w-7 rounded-cc-sm flex items-center justify-center text-cc-muted hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] cc-focus-ring"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <p className="text-[13px] font-medium text-cc-text">{addr.name}</p>
            <p className="text-[13px] text-cc-secondary mt-0.5">{addr.street}</p>
            <p className="text-[13px] text-cc-muted">{addr.city}</p>
          </div>
        ))}

        {/* Add new */}
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 h-full min-h-[130px] rounded-cc-xl border-2 border-dashed border-cc-border-strong text-cc-muted hover:border-cc-primary hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
        >
          <Plus className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[13px] font-medium">Agregar nueva dirección</span>
        </button>
      </div>
    </div>
  );
}
