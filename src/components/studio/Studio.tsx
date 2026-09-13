"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { saveCard } from "@/lib/actions/cards";
import { copyBlobToClipboard, downloadBlob, renderCard, renderCardPng, slugify, type CardExportFormat, type CardExportScale } from "@/lib/cards/export";
import { fileToLogoDataUrl } from "@/lib/cards/logo";
import { providerForConnection, resolveIdentity } from "@/lib/cards/resolve";
import { describeCard } from "@/lib/cards/describe";
import { SIZES, defaultCardConfig, type CardConfig } from "@/lib/cards/types";
import { DEMO_CONNECTION } from "@/lib/metrics/demo";
import { describeChange, formatValue } from "@/lib/metrics/format";
import { PERIODS, type ClientConnection, type MetricRef } from "@/lib/metrics/types";
import { CardPreview } from "../card/CardPreview";
import { useCardData } from "../card/useCardData";
import { Button, Field, Input, Panel, Segmented, Select, Switch, cn } from "../ui";
import { MetricPicker } from "./MetricPicker";
import { ThemePicker } from "./ThemePicker";

const EMOJI_PICKS = ["🚀", "✨", "📈", "💸", "⭐", "🔥", "🎉", "🌱", "🐣", "💛", "🧑‍🚀", "🍋"];

export interface StudioProps {
  mode: "demo" | "app";
  connections: ClientConnection[];
  initial?: { id?: string; name: string; config: CardConfig };
}

function firstMetricRef(connections: ClientConnection[]): MetricRef {
  const conn = connections[0];
  const provider = providerForConnection(conn);
  if (conn && provider && provider.metrics.length) return { connectionId: conn.id, metric: provider.metrics[0].key, params: {} };
  return { connectionId: DEMO_CONNECTION.id, metric: "mrr", params: {} };
}

export function Studio({ mode, connections, initial }: StudioProps) {
  const router = useRouter();
  const [config, setConfig] = useState<CardConfig>(() => initial?.config ?? { ...defaultCardConfig([firstMetricRef(connections)]), appName: "" });
  const [name, setName] = useState(initial?.name ?? "");
  const [cardId, setCardId] = useState(initial?.id);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"download" | "copy" | null>(null);
  const [exportFormat, setExportFormat] = useState<CardExportFormat>("png");
  const [exportScale, setExportScale] = useState<CardExportScale>(2);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { slots, refresh, loading } = useCardData(config, connections);
  const size = SIZES[config.size];
  const identity = resolveIdentity(config, slots);
  const brand = slots.find((s) => s.result?.brand)?.result?.brand;
  const uploadedLogo = config.logoUrl.startsWith("data:");
  const logoFile = useRef<HTMLInputElement>(null);

  const update = useCallback((patch: Partial<CardConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const setTemplate = (template: CardConfig["template"]) => {
    // Single & milestone cards show exactly one metric.
    update({ template, metrics: template === "stack" ? config.metrics : [config.metrics[0]] });
  };

  const exportImage = async (action: "download" | "copy") => {
    const node = cardRef.current;
    if (!node) return;
    setBusy(action);
    try {
      const dimensions = { width: size.w, height: size.h };
      const blob = action === "copy"
        ? await renderCardPng(node, dimensions)
        : await renderCard(node, { ...dimensions, format: exportFormat, pixelRatio: exportScale });
      if (action === "download") {
        const primary = slots[0];
        const fname = `${slugify(identity.name || "howitsgoing")}-${slugify(primary?.def.shortLabel ?? "card")}-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
        downloadBlob(blob, fname);
        setToast("Saved! Go post it 🎉");
      } else {
        const ok = await copyBlobToClipboard(blob);
        setToast(ok ? "Copied — paste it anywhere 📋" : "Clipboard blocked here; downloading instead");
        if (!ok) downloadBlob(blob, "howitsgoing.png");
      }
    } catch (err) {
      setToast(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const copyAltText = async () => {
    try {
      await navigator.clipboard.writeText(describeCard(config, slots));
      setToast("Alt text copied");
    } catch {
      setToast("Couldn't access the clipboard");
    }
  };

  const copyPostText = async () => {
    const s = slots[0];
    if (!s?.result) return;
    const value = formatValue(s.result.value, s.def.format, s.result.currency);
    const change = describeChange(s.result, s.def.kind, s.def.format, config.period);
    const who = identity.name ? `${identity.name} update: ` : "";
    const changeText = change ? ` (${change.text} ${change.context})` : "";
    const text = `${s.def.emoji} ${who}${s.label.toLowerCase()} is at ${value}${changeText}. #buildinpublic`;
    try {
      await navigator.clipboard.writeText(`${text}\n\nAlt: ${describeCard(config, slots)}`);
      setToast("Post text copied ✍️");
    } catch {
      setToast("Couldn't access the clipboard");
    }
  };

  const onSave = async () => {
    setSaving(true);
    const res = await saveCard({ id: cardId, name: name || defaultName(), config });
    setSaving(false);
    if (!res.ok) {
      setToast(res.error);
      return;
    }
    setDirty(false);
    setToast("Card saved ✨");
    if (!cardId) {
      setCardId(res.data.id);
      router.replace(`/app/cards/${res.data.id}`);
    }
  };

  const defaultName = () => {
    const s = slots[0];
    return s ? `${identity.name ? identity.name + " · " : ""}${s.def.shortLabel}` : "Untitled card";
  };

  const onPickLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      update({ logoUrl: await fileToLogoDataUrl(file) });
    } catch (err) {
      setToast((err as Error).message || "Couldn't read that image");
    }
  };

  const setMetric = (i: number, ref: MetricRef & { label?: string }) => {
    const metrics = [...config.metrics];
    metrics[i] = ref;
    update({ metrics });
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6">
      {mode === "demo" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lemon bg-lemon/40 px-4 py-3 text-sm font-semibold text-ink/80">
          <span>🧪 You&apos;re playing with sample numbers. Connect your own tools to make real cards.</span>
          <Button href="/login" size="sm">
            Connect my data →
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
        {/* Controls */}
        <div className="order-2 grid gap-4 lg:order-1">
          <Panel
            title={config.template === "stack" ? "Metrics" : "Metric"}
            action={
              config.template === "stack" && config.metrics.length < 4 ? (
                <Button size="sm" variant="secondary" onClick={() => update({ metrics: [...config.metrics, firstMetricRef(connections)] })}>
                  + Add
                </Button>
              ) : null
            }
          >
            <div className="grid gap-3">
              {config.metrics.map((ref, i) => (
                <MetricPicker
                  key={i}
                  value={ref}
                  index={config.template === "stack" ? i : undefined}
                  connections={connections}
                  onChange={(next) => setMetric(i, next)}
                  onRemove={config.template === "stack" && config.metrics.length > 1 ? () => update({ metrics: config.metrics.filter((_, j) => j !== i) }) : undefined}
                />
              ))}
            </div>
            {mode === "app" && connections.length === 0 && (
              <p className="mt-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-xs font-semibold text-ink/60">
                No tools connected yet.{" "}
                <Link href="/app/connections" className="underline decoration-2 underline-offset-2 hover:text-ink">
                  Connect Stripe, PostHog, GitHub…
                </Link>
              </p>
            )}
          </Panel>

          <Panel title="Layout">
            <div className="grid gap-3">
              <Segmented
                value={config.template}
                onChange={setTemplate}
                options={[
                  { value: "single", label: "Single" },
                  { value: "stack", label: "Stack" },
                  { value: "milestone", label: "Milestone" },
                ]}
              />
              <Segmented
                value={config.size}
                onChange={(size) => update({ size })}
                options={(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => ({ value: k, label: SIZES[k].label, title: SIZES[k].hint }))}
              />
              <Segmented value={config.period} onChange={(period) => update({ period })} options={PERIODS.map((p) => ({ value: p.id, label: p.short }))} />
            </div>
          </Panel>

          <Panel title="Theme">
            <ThemePicker value={config.theme} onChange={(theme) => update({ theme })} />
          </Panel>

          <Panel title="Words">
            <div className="grid gap-3">
              <Field label="App name" help={brand?.name && !config.appName ? `Using “${brand.name}” from your data. Type to override.` : undefined}>
                <Input placeholder={brand?.name ?? "e.g. Pixelfolio"} value={config.appName} onChange={(e) => update({ appName: e.target.value })} maxLength={40} />
              </Field>
              <div>
                <span className="mb-1.5 block text-[13px] font-bold text-ink/80">Logo</span>
                <div className="flex items-center gap-2">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                    {identity.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={identity.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-ink/30">—</span>
                    )}
                  </span>
                  {uploadedLogo ? (
                    <span className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 text-sm">
                      <span className="truncate font-semibold text-ink/70">Uploaded image</span>
                      <button type="button" onClick={() => update({ logoUrl: "" })} className="text-xs font-bold text-ink/50 hover:text-ink">
                        Remove
                      </button>
                    </span>
                  ) : (
                    <Input
                      placeholder={brand?.logoUrl ? "Using the repo's avatar" : "https://…/logo.png"}
                      value={config.logoUrl}
                      onChange={(e) => update({ logoUrl: e.target.value.trim() })}
                      className="min-w-0 flex-1"
                    />
                  )}
                  <Button type="button" size="sm" variant="secondary" onClick={() => logoFile.current?.click()}>
                    Upload
                  </Button>
                  <input ref={logoFile} type="file" accept="image/*" hidden onChange={onPickLogo} />
                </div>
                <span className="mt-1.5 block text-xs text-ink/50">
                  {brand?.logoUrl ? "Defaults to the repo's GitHub avatar. Paste an image URL or upload your own." : "Paste an image URL or upload a file."}
                </span>
              </div>
              <Field label="Headline" help="Overrides the metric name on the card.">
                <Input placeholder={slots[0]?.label ?? "Monthly revenue"} value={config.headline} onChange={(e) => update({ headline: e.target.value })} maxLength={60} />
              </Field>
              {config.template === "milestone" ? (
                <>
                  <div>
                    <span className="mb-1.5 block text-[13px] font-bold text-ink/80">Emoji</span>
                    <div className="flex flex-wrap items-center gap-1">
                      <Input className="mr-1 w-16 text-center text-lg" value={config.emoji} onChange={(e) => update({ emoji: e.target.value })} maxLength={8} placeholder="🎉" />
                      {EMOJI_PICKS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => update({ emoji: config.emoji === e ? "" : e })}
                          className={cn("grid size-8 place-items-center rounded-lg text-lg transition hover:bg-ink/[0.06]", config.emoji === e && "bg-ink/[0.08]")}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <span className="mt-1.5 block text-xs text-ink/50">The big one in the middle of the card.</span>
                  </div>
                  <Field label="Milestone number" help="Leave blank to round down to a nice number automatically.">
                    <Input
                      inputMode="decimal"
                      placeholder={slots[0]?.result ? String(Math.round(slots[0].result.value)) : "1000"}
                      value={config.milestone?.value ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[,\s]/g, ""));
                        update({ milestone: { ...config.milestone, value: e.target.value === "" || Number.isNaN(n) ? undefined : n } });
                      }}
                    />
                  </Field>
                  <Field label="Message">
                    <Input placeholder="Thank you for the support 💛" value={config.milestone?.message ?? ""} onChange={(e) => update({ milestone: { ...config.milestone, message: e.target.value } })} maxLength={100} />
                  </Field>
                </>
              ) : (
                <Field label="Caption">
                  <Input placeholder="e.g. 3 months since launch" value={config.caption} onChange={(e) => update({ caption: e.target.value })} maxLength={140} />
                </Field>
              )}
            </div>
          </Panel>

          <Panel title="Details">
            <div className="grid gap-1">
              {config.template !== "milestone" && (
                <>
                  <Switch checked={config.showChart} onChange={(showChart) => update({ showChart })} label="Chart" description="Trend over the selected period" />
                  {config.showChart && (
                    <div className="px-1 pb-2">
                      <Segmented
                        value={config.chartStyle}
                        onChange={(chartStyle) => update({ chartStyle })}
                        options={[
                          { value: "area", label: "Area" },
                          { value: "line", label: "Line" },
                          { value: "bars", label: "Bars" },
                        ]}
                      />
                    </div>
                  )}
                  <Switch checked={config.showChange} onChange={(showChange) => update({ showChange })} label="Change badge" description="▲ 18% vs previous period" />
                </>
              )}
              <Switch checked={config.showLogo} onChange={(showLogo) => update({ showLogo })} label="Logo" description="The repo's avatar or your own image, next to the name" />
              <Switch checked={config.showDate} onChange={(showDate) => update({ showDate })} label="Today's date" />
              <Switch checked={config.showWatermark} onChange={(showWatermark) => update({ showWatermark })} label="howitsgoing badge" description="A tiny credit in the corner" />
            </div>
          </Panel>
        </div>

        {/* Preview */}
        <div className="order-1 lg:sticky lg:top-20 lg:order-2">
          <div className="rounded-[32px] border border-line bg-white/70 p-4 shadow-soft backdrop-blur sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink/50">
                <span className={cn("size-2 rounded-full", loading ? "animate-pulse bg-amber-400" : "bg-emerald-400")} />
                {loading ? "Fetching fresh numbers…" : `Live · ${size.w * exportScale} × ${size.h * exportScale} px`}
              </div>
              <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
                ↻ Refresh data
              </Button>
            </div>

            <div className="flex justify-center">
              <CardPreview ref={cardRef} config={config} slots={slots} id="studio" />
            </div>

            {slots.some((s) => s.result?.note) && <p className="mt-3 text-center text-[11px] font-semibold text-ink/45">{slots.find((s) => s.result?.note)?.result?.note}</p>}

            <div className="mt-5 flex flex-wrap items-end justify-center gap-2">
              <Field label="Format" className="w-28">
                <Select aria-label="Format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as CardExportFormat)} disabled={busy !== null}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                </Select>
              </Field>
              <Field label="Scale" className="w-24">
                <Select aria-label="Scale" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value) as CardExportScale)} disabled={busy !== null}>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={3}>3×</option>
                </Select>
              </Field>
              <Button size="lg" onClick={() => exportImage("download")} loading={busy === "download"} disabled={loading || busy !== null}>
                ⬇︎ Download {exportFormat.toUpperCase()}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => exportImage("copy")} loading={busy === "copy"} disabled={loading || busy !== null}>
                Copy image
              </Button>
              <Button size="lg" variant="ghost" onClick={copyPostText} disabled={!slots[0]?.result}>
                Copy post text
              </Button>
              <Button size="lg" variant="ghost" onClick={copyAltText}>
                Copy alt text
              </Button>
            </div>

            {mode === "app" && (
              <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
                <Input placeholder={defaultName()} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="sm:flex-1" />
                <Button onClick={onSave} loading={saving} variant={dirty || !cardId ? "primary" : "secondary"}>
                  {cardId ? (dirty ? "Save changes" : "Saved") : "Save card"}
                </Button>
              </div>
            )}

            <div className={cn("pointer-events-none mt-3 text-center text-sm font-bold text-ink transition-opacity", toast ? "opacity-100" : "opacity-0")} aria-live="polite">
              {toast ?? " "}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
