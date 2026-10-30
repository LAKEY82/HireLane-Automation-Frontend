"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlagIcon, HomeIcon, SettingsIcon, UsersIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Overview", Icon: HomeIcon },
  { href: "/campaigns", label: "Campaigns", Icon: FlagIcon },
  { href: "/applicants", label: "Applicants", Icon: UsersIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

// Desktop: vertical list in the sidebar
export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, Icon }) => {
        const active = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
            <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-600" : "text-slate-400"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Phones: fixed tab bar at the bottom, within thumb reach
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {LINKS.map(({ href, label, Icon }) => {
        const active = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand-700" : "text-slate-500"}`}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
