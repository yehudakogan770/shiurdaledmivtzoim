import type { LucideIcon } from "lucide-react";

export function StatCard({
  label, value, icon: Icon
}: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-neutral-100 p-3">
          <Icon size={22} strokeWidth={1.8} />
        </div>
        <span className="text-sm font-medium text-neutral-500">{label}</span>
      </div>
      <div className="mt-5 text-4xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">All time</div>
    </div>
  );
}
