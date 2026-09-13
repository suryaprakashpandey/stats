import Link from "next/link";
import { CardGrid } from "@/components/CardGrid";
import { Button } from "@/components/ui";
import { getProvider } from "@/lib/metrics/catalog";
import { listCards, listConnections } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function Dashboard() {
  const session = await requireSession();
  const [cards, connections] = await Promise.all([listCards(session.user.id), listConnections(session.user.id)]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your cards</h1>
          <p className="mt-1 text-sm text-ink/55">Each card refreshes itself. Open one, hit download, post.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/history" className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink">
            🕰️ History
          </Link>
          <Link href="/app/connections" className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink">
            {connections.length ? (
              <>
                {connections.slice(0, 5).map((c) => (
                  <span key={c.id} title={c.label}>
                    {getProvider(c.provider)?.emoji ?? "🔌"}
                  </span>
                ))}
                <span className="ml-1">{connections.length} connected</span>
              </>
            ) : (
              "No tools connected"
            )}
          </Link>
          <Button href="/app/cards/new" size="md">
            + New card
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="grid gap-6 rounded-[32px] border border-dashed border-line bg-white/50 p-8 text-center sm:p-14">
          <div className="text-5xl">🐣</div>
          <div>
            <h2 className="text-xl font-extrabold">No cards yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink/55">
              {connections.length ? "Make your first card from the tools you connected." : "Connect Stripe, PostHog, GitHub or npm first, then turn a number into a card."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {!connections.length && (
              <Button href="/app/connections" size="lg">
                Connect a tool
              </Button>
            )}
            <Button href="/app/cards/new" size="lg" variant={connections.length ? "primary" : "secondary"}>
              {connections.length ? "Make a card" : "Play with sample data"}
            </Button>
          </div>
        </div>
      ) : (
        <CardGrid cards={cards} connections={connections} />
      )}
    </div>
  );
}
