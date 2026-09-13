"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CardPreview } from "@/components/card/CardPreview";
import { useCardData } from "@/components/card/useCardData";
import { Badge, Button, Panel, Spinner, cn } from "@/components/ui";
import { providerForConnection } from "@/lib/cards/resolve";
import type { CardConfig } from "@/lib/cards/types";
import { toDateKey } from "@/lib/history";
import { DEMO_CONNECTION } from "@/lib/metrics/demo";
import { formatDate, formatValue } from "@/lib/metrics/format";
import type { ClientConnection } from "@/lib/metrics/types";
import type { SnapshotHero } from "@/app/api/history/snapshot/route";

export interface HistoryCard {
  id: string;
  name: string;
  config: CardConfig;
  createdAt: string;
  updatedAt: string;
}

function cardProviders(card: HistoryCard, connections: ClientConnection[]) {
  const all = connections.some((c) => c.id === DEMO_CONNECTION.id) ? connections : [DEMO_CONNECTION, ...connections];
  const seen = new Map<string, { emoji: string; name: string }>();
  for (const ref of card.config.metrics ?? []) {
    const conn = all.find((c) => c.id === ref.connectionId);
    const provider = providerForConnection(conn);
    if (!provider || seen.has(provider.id)) continue;
    seen.set(provider.id, { emoji: provider.emoji, name: provider.name });
  }
  return [...seen.values()];
}

function cardMetricLabels(card: HistoryCard, connections: ClientConnection[]) {
  const all = connections.some((c) => c.id === DEMO_CONNECTION.id) ? connections : [DEMO_CONNECTION, ...connections];
  return (card.config.metrics ?? []).map((ref, i) => {
    const conn = all.find((c) => c.id === ref.connectionId);
    const def = providerForConnection(conn)?.metrics.find((m) => m.key === ref.metric);
    return ref.label || def?.shortLabel || ref.metric || `Metric ${i + 1}`;
  });
}

export function HistoryTimeline({ cards, connections }: { cards: HistoryCard[]; connections: ClientConnection[] }) {
  const ordered = useMemo(() => [...cards].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)), [cards]);
  const [selectedId, setSelectedId] = useState<string>(ordered[ordered.length - 1]?.id ?? "");
  const selected = ordered.find((c) => c.id === selectedId) ?? ordered[ordered.length - 1];

  if (!selected) return null;
  const dateKey = toDateKey(selected.createdAt);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* Timeline rail */}
      <ol className="relative space-y-0 overflow-hidden rounded-[28px] border border-line bg-white/75 p-3 shadow-soft backdrop-blur">
        <div aria-hidden className="absolute bottom-6 left-[31px] top-6 w-px bg-ink/10" />
        {ordered.map((card, i) => {
          const active = card.id === selected.id;
          const providers = cardProviders(card, connections);
          const prevMonth = i > 0 ? formatDate(ordered[i - 1].createdAt, { month: "long", year: "numeric" }) : null;
          const thisMonth = formatDate(card.createdAt, { month: "long", year: "numeric" });
          return (
            <li key={card.id}>
              {thisMonth !== prevMonth && (
                <div className="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-widest text-ink/40">{thisMonth}</div>
              )}
              <button
                type="button"
                onClick={() => setSelectedId(card.id)}
                aria-current={active}
                className={cn(
                  "relative flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition",
                  active ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border text-base",
                    active ? "border-ink bg-ink text-white" : "border-line bg-white",
                  )}
                  title={providers.map((p) => p.name).join(", ")}
                >
                  {providers[0]?.emoji ?? "🃏"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{card.name || "Untitled card"}</span>
                  <span className="mt-0.5 block text-xs text-ink/50">
                    {formatDate(card.createdAt, { month: "short", day: "numeric", year: "numeric" })} · {(card.config.metrics ?? []).length} metric{(card.config.metrics ?? []).length === 1 ? "" : "s"}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {cardMetricLabels(card, connections)
                      .slice(0, 3)
                      .map((label) => (
                        <Badge key={label}>{label}</Badge>
                      ))}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Selected moment */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Panel
          title={
            <>
              {formatDate(selected.createdAt, { month: "long", day: "numeric", year: "numeric" })} · {selected.name || "Untitled card"}
            </>
          }
          action={
            <Button size="sm" variant="ghost" href={`/app/cards/${selected.id}`}>
              Open in studio →
            </Button>
          }
        >
          <SelectedPreview config={selected.config} connections={connections} cardId={selected.id} />
          <p className="mt-3 text-xs text-ink/50">
            Generated {formatDate(selected.createdAt, { month: "short", day: "numeric", year: "numeric" })}. The numbers on the right are what your
            other tools reported around that day.
          </p>
        </Panel>

        <SnapshotPanel key={selected.id} dateKey={dateKey} />
      </div>
    </div>
  );
}

function SelectedPreview({ config, connections, cardId }: { config: CardConfig; connections: ClientConnection[]; cardId: string }) {
  const { slots, loading } = useCardData(config, connections, { debounceMs: 0 });
  return (
    <div>
      <CardPreview config={config} slots={slots} id={`history-${cardId}`} radius={20} />
      {loading && <p className="mt-2 text-xs text-ink/45">Refreshing this card&apos;s live numbers…</p>}
    </div>
  );
}

function SnapshotPanel({ dateKey }: { dateKey: string }) {
  const [items, setItems] = useState<SnapshotHero[] | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history/snapshot?date=${dateKey}`, { credentials: "same-origin" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        return body as { items: SnapshotHero[]; compareTo: string };
      })
      .then((body) => {
        if (!cancelled) {
          setItems(body.items);
          setCompareTo(body.compareTo);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  return (
    <Panel
      title={<>That day in numbers · {formatDate(dateKey, { month: "short", day: "numeric", year: "numeric" })}</>}
      action={
        <Link href="/app/connections" className="text-xs font-bold text-ink/50 hover:text-ink">
          Manage connections
        </Link>
      }
    >
      {items === null && !error && (
        <div className="flex items-center gap-2 py-10 text-sm text-ink/55">
          <Spinner className="size-4" /> Rewinding every connection to {formatDate(dateKey, { month: "short", day: "numeric" })}…
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
      {items !== null && items.length === 0 && (
        <p className="py-6 text-center text-sm text-ink/55">No numbers found for that day yet — connect a tool or generate a card first.</p>
      )}
      {items !== null && items.length > 0 && (
        <div>
          <dl className="grid grid-cols-2 gap-2.5">
            {items.map((item) => (
              <HeroTile key={item.key} item={item} dateKey={dateKey} />
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
            Arrows compare against {compareTo ? formatDate(compareTo, { month: "short", day: "numeric" }) : "30 days earlier"}. Churn reads inverted: a
            falling churn rate is good.
          </p>
        </div>
      )}
    </Panel>
  );
}

function HeroTile({ item, dateKey }: { item: SnapshotHero; dateKey: string }) {
  const delta = item.value !== null && item.previous !== null ? item.value - item.previous : null;

  // Churn is inverted: down is good, up is bad. Everything else: up is good.
  const good = item.direction === "flat" ? null : item.goodWhenDown ? item.direction === "down" : item.direction === "up";
  const arrow = item.direction === "up" ? "▲" : item.direction === "down" ? "▼" : "–";
  const arrowLabel = item.direction === "up" ? "increased" : item.direction === "down" ? "decreased" : "steady";

  let changeText: string | null = null;
  if (item.value !== null && item.previous !== null) {
    if (item.format === "percent") {
      const pts = Math.round(delta! * 10) / 10;
      changeText = pts === 0 ? "steady" : `${pts > 0 ? "+" : "−"}${Math.abs(pts)} pts`;
    } else if (item.previous === 0) {
      changeText = item.value > 0 ? "new" : "steady";
    } else if (item.changePct !== null) {
      const pct = Math.abs(item.changePct) < 10 ? Math.round(item.changePct * 10) / 10 : Math.round(item.changePct);
      changeText = item.changePct === 0 ? "steady" : `${item.changePct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
    }
  }

  const sameDay = item.atKey === dateKey;

  return (
    <div className="rounded-2xl border border-line/70 bg-cream-50/60 px-3.5 py-3">
      <dt className="flex items-center justify-between gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink/50">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden>{item.emoji}</span>
          <span className="truncate">{item.shortLabel}</span>
        </span>
        {changeText && (
          <span
            aria-label={`${arrowLabel} ${changeText} vs 30 days earlier`}
            title={`${arrowLabel} ${changeText} vs 30 days earlier`}
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5",
              good === null ? "bg-ink/[0.05] text-ink/45" : good ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
            )}
          >
            <span aria-hidden className="text-[9px]">{arrow}</span>
            {changeText}
          </span>
        )}
      </dt>
      <dd className="mt-1 truncate text-xl font-extrabold tracking-tight" title={item.label}>
        {item.value === null ? (
          <span className="text-sm font-bold text-ink/40">no data</span>
        ) : (
          formatValue(item.value, item.format, item.currency)
        )}
      </dd>
      <dd className="mt-0.5 truncate text-[11px] text-ink/45" title={item.source}>
        {item.atKey && !sameDay && item.inWindow ? <>as of {formatDate(item.atKey, { month: "short", day: "numeric" })} · </> : null}
        {item.value !== null && !item.inWindow ? <>closest available · </> : null}
        {item.source}
      </dd>
    </div>
  );
}
