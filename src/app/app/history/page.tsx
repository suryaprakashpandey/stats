import type { Metadata } from "next";
import Link from "next/link";
import { HistoryTimeline } from "@/components/history/HistoryTimeline";
import { Button } from "@/components/ui";
import { listCards, listConnections } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const session = await requireSession();
  const [cards, connections] = await Promise.all([listCards(session.user.id), listConnections(session.user.id)]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-ink/55">
            Every card you generated, oldest → newest. Pick one to see the card and what the rest of your stack looked like that day.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/app" size="md" variant="secondary">
            ← Cards
          </Button>
          <Button href="/app/cards/new" size="md">
            + New card
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="grid gap-6 rounded-[32px] border border-dashed border-line bg-white/50 p-8 text-center sm:p-14">
          <div className="text-5xl">🕰️</div>
          <div>
            <h2 className="text-xl font-extrabold">No history yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink/55">Generate your first card and it will show up here as the start of your timeline.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button href="/app/cards/new" size="lg">
              Make a card
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs font-bold text-ink/45">
            {cards.length} card{cards.length === 1 ? "" : "s"} · from{" "}
            {new Date([...cards].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0].createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · tip: <Link href="/app/connections" className="underline">connect Stripe, PostHog or GitHub</Link> for a richer “that day” panel.
          </p>
          <HistoryTimeline cards={cards} connections={connections} />
        </>
      )}
    </div>
  );
}
