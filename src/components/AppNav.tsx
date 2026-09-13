"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Logo } from "./Logo";
import { Button, cn } from "./ui";

const LINKS = [
  { href: "/app", label: "Cards" },
  { href: "/app/history", label: "History" },
  { href: "/app/connections", label: "Connections" },
];

export function AppNav({ user }: { user: { name: string; email: string; image?: string | null } }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-cream-50/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/app" />
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => {
              const active = l.href === "/app" ? pathname === "/app" || pathname.startsWith("/app/cards") : pathname.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className={cn("rounded-xl px-3 py-1.5 text-sm font-bold transition", active ? "bg-ink/[0.07] text-ink" : "text-ink/55 hover:text-ink")}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/app/cards/new" size="sm">
            + New card
          </Button>
          <div className="ml-1 flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-6 rounded-full" />
            ) : (
              <span className="grid size-6 place-items-center rounded-full bg-peach text-[11px] font-black text-ink">{user.name.slice(0, 1).toUpperCase()}</span>
            )}
            <span className="hidden max-w-[120px] truncate text-xs font-bold text-ink/70 sm:block">{user.name}</span>
            <button type="button" onClick={signOut} className="text-xs font-bold text-ink/45 hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </div>
      <nav className="flex gap-1 px-4 pb-2 sm:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={cn("rounded-xl px-3 py-1.5 text-sm font-bold", pathname === l.href ? "bg-ink/[0.07] text-ink" : "text-ink/55")}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
