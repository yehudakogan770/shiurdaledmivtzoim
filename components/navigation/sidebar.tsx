import Link from "next/link";
import { BarChart3, History, Home, Map, UserRound, Users, ClipboardList } from "lucide-react";

const links = [
  ["/dashboard", "Dashboard", Home],
  ["/mivtzoim", "My Mivtzoim", ClipboardList],
  ["/groups", "My Groups", Users],
  ["/routes", "Routes", Map],
  ["/history", "History", History],
  ["/profile", "Profile", UserRound],
];

export function Sidebar() {
  return (
    <aside className="border-b border-neutral-200 bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-5 lg:block">
        <div>
          <div className="text-base font-bold">Shiur Daled</div>
          <div className="text-xs text-neutral-500">Mivtzoim</div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:px-3 lg:py-4">
        {links.map(([href, label, Icon]) => {
          const I = Icon as typeof Home;
          return (
            <Link key={href as string} href={href as string}
              className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 lg:mb-1">
              <I size={18} /> {label as string}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
