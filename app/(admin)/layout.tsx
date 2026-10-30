import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/app/actions";
import { Logo } from "@/components/brand";
import { LogoutIcon } from "@/components/icons";
import { SideNav, TabBar } from "@/components/nav";
import { initials } from "@/lib/format";

async function UserChip({ compact = false }: { compact?: boolean }) {
  const user = (await auth())?.user;
  const identity = user?.email ?? user?.name ?? "Signed in";
  return (
    <form action={logout} className="flex min-w-0 items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
        {initials(identity.split("@")[0].replace(/[._-]+/g, " "))}
      </span>
      {!compact && <span className="min-w-0 flex-1 truncate text-sm text-slate-600" title={identity}>{identity}</span>}
      <button aria-label="Sign out" title="Sign out" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <LogoutIcon className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <Link href="/" className="px-2"><Logo /></Link>
        <div className="mt-8 flex-1"><SideNav /></div>
        <div className="border-t border-slate-200 pt-4"><UserChip /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/"><Logo /></Link>
          <UserChip compact />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
