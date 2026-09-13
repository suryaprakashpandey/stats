import type { MetricDef, ProviderId, ProviderMeta } from "./types";

/**
 * Client-safe catalog of every integration: what to ask for when connecting,
 * and which metrics it offers. Server-side fetching lives in src/lib/providers.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: "stripe",
    name: "Stripe",
    emoji: "💳",
    tagline: "MRR, revenue and customers",
    color: "#E3DEFF",
    docsUrl: "https://dashboard.stripe.com/apikeys/create",
    setupHelp:
      "Create a **restricted key** in Stripe (Developers → API keys → Create restricted key) with *Read* access to Charges, Customers, Subscriptions and Balance. Paste it below. It is encrypted at rest and never shown again.",
    fields: [
      {
        key: "apiKey",
        label: "Restricted API key",
        type: "password",
        placeholder: "rk_live_…",
        required: true,
        secret: true,
        help: "Starts with rk_live_ (or sk_ for a full secret key, though read-only is recommended).",
      },
    ],
    metrics: [
      { key: "mrr", label: "Monthly recurring revenue", shortLabel: "MRR", emoji: "💸", format: "currency", kind: "level", description: "Sum of active subscriptions, normalised to a month." },
      { key: "revenue", label: "Revenue", shortLabel: "Revenue", emoji: "💰", format: "currency", kind: "flow", description: "Successful charges minus refunds.", defaultChart: "bars" },
      { key: "customers", label: "Customers", shortLabel: "Customers", emoji: "🧑‍🤝‍🧑", format: "number", kind: "level" },
      { key: "subscriptions", label: "Active subscriptions", shortLabel: "Subscribers", emoji: "🔁", format: "number", kind: "level" },
      { key: "churn", label: "Subscription churn rate", shortLabel: "Churn", emoji: "📉", format: "percent", kind: "level", description: "Share of subscribers lost in the trailing 30 days." },
    ],
  },
  {
    id: "posthog",
    name: "PostHog",
    emoji: "🦔",
    tagline: "Active users, pageviews, events",
    color: "#FFE8CC",
    docsUrl: "https://app.posthog.com/settings/user-api-keys",
    setupHelp:
      "Create a **personal API key** (Settings → Personal API keys) with the `query:read` scope, pick your project ID (Settings → Project → General) and paste both below.",
    fields: [
      {
        key: "host",
        label: "Region",
        type: "select",
        required: true,
        defaultValue: "https://us.posthog.com",
        options: [
          { value: "https://us.posthog.com", label: "US Cloud (us.posthog.com)" },
          { value: "https://eu.posthog.com", label: "EU Cloud (eu.posthog.com)" },
          { value: "custom", label: "Self-hosted (enter URL)" },
        ],
      },
      { key: "customHost", label: "Self-hosted URL", type: "url", placeholder: "https://posthog.example.com", help: "Only if you picked self-hosted." },
      { key: "projectId", label: "Project ID", type: "text", placeholder: "12345", required: true },
      { key: "apiKey", label: "Personal API key", type: "password", placeholder: "phx_…", required: true, secret: true },
    ],
    metrics: [
      { key: "dau", label: "Daily active users", shortLabel: "Daily actives", emoji: "🔥", format: "number", kind: "level", description: "Distinct users in the last 24h; chart shows each day." },
      { key: "wau", label: "Weekly active users", shortLabel: "Weekly actives", emoji: "📅", format: "number", kind: "level" },
      { key: "mau", label: "Monthly active users", shortLabel: "Monthly actives", emoji: "🌙", format: "number", kind: "level" },
      { key: "pageviews", label: "Pageviews", shortLabel: "Pageviews", emoji: "👀", format: "number", kind: "flow", defaultChart: "bars" },
      { key: "users", label: "Total users", shortLabel: "Users", emoji: "🧑‍🚀", format: "number", kind: "level", description: "Everyone PostHog has ever identified." },
      {
        key: "events",
        label: "Event count",
        shortLabel: "Events",
        emoji: "✨",
        format: "number",
        kind: "flow",
        description: "Count of a specific event, e.g. sign_up.",
        defaultChart: "bars",
        params: [{ key: "event", label: "Event name", placeholder: "sign_up", required: true }],
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    emoji: "⭐",
    tagline: "Stars, forks, release downloads",
    color: "#E6F0FF",
    docsUrl: "https://github.com/settings/tokens?type=beta",
    setupHelp:
      "Public repos need no token, but a **fine-grained personal access token** (no extra permissions required) raises the rate limit so star history loads reliably. If you signed in with GitHub, leave it blank to use that login.",
    fields: [
      { key: "token", label: "Personal access token (optional)", type: "password", placeholder: "github_pat_…", secret: true },
    ],
    metrics: [
      { key: "stars", label: "GitHub stars", shortLabel: "Stars", emoji: "⭐", format: "number", kind: "level", params: [{ key: "repo", label: "Repository", placeholder: "owner/repo", required: true, suggest: "github-repos" }] },
      { key: "forks", label: "Forks", shortLabel: "Forks", emoji: "🍴", format: "number", kind: "level", params: [{ key: "repo", label: "Repository", placeholder: "owner/repo", required: true, suggest: "github-repos" }] },
      { key: "release_downloads", label: "Release downloads", shortLabel: "Downloads", emoji: "⬇️", format: "number", kind: "level", description: "Sum of asset downloads across all releases.", params: [{ key: "repo", label: "Repository", placeholder: "owner/repo", required: true, suggest: "github-repos" }] },
      { key: "followers", label: "GitHub followers", shortLabel: "Followers", emoji: "🫶", format: "number", kind: "level", params: [{ key: "user", label: "Username", placeholder: "octocat", required: true }] },
    ],
  },
  {
    id: "plausible",
    name: "Plausible",
    emoji: "📈",
    tagline: "Visitors and pageviews",
    color: "#E2F5EA",
    docsUrl: "https://plausible.io/settings/api-keys",
    setupHelp: "Create an API key in Plausible (Settings → API keys) and enter the site domain exactly as it appears in Plausible.",
    fields: [
      { key: "host", label: "Plausible URL", type: "url", defaultValue: "https://plausible.io", required: true, help: "Change only if self-hosting." },
      { key: "siteId", label: "Site domain", type: "text", placeholder: "example.com", required: true },
      { key: "apiKey", label: "API key", type: "password", required: true, secret: true },
    ],
    metrics: [
      { key: "visitors", label: "Unique visitors", shortLabel: "Visitors", emoji: "🚶", format: "number", kind: "flow" },
      { key: "pageviews", label: "Pageviews", shortLabel: "Pageviews", emoji: "👀", format: "number", kind: "flow", defaultChart: "bars" },
      { key: "visits", label: "Visits", shortLabel: "Visits", emoji: "🚪", format: "number", kind: "flow" },
    ],
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    emoji: "🍋",
    tagline: "MRR, revenue and customers",
    color: "#FFF7C2",
    docsUrl: "https://app.lemonsqueezy.com/settings/api",
    setupHelp: "Create an API key in Lemon Squeezy (Settings → API) and paste it below.",
    fields: [{ key: "apiKey", label: "API key", type: "password", required: true, secret: true }],
    metrics: [
      { key: "mrr", label: "Monthly recurring revenue", shortLabel: "MRR", emoji: "💸", format: "currency", kind: "level" },
      { key: "revenue", label: "Revenue", shortLabel: "Revenue", emoji: "💰", format: "currency", kind: "flow", defaultChart: "bars" },
      { key: "customers", label: "Customers", shortLabel: "Customers", emoji: "🧑‍🤝‍🧑", format: "number", kind: "level" },
      { key: "subscriptions", label: "Active subscriptions", shortLabel: "Subscribers", emoji: "🔁", format: "number", kind: "level" },
      { key: "churn", label: "Subscription churn rate", shortLabel: "Churn", emoji: "📉", format: "percent", kind: "level", description: "Share of subscribers lost in the trailing 30 days." },
    ],
  },
  {
    id: "npm",
    name: "npm",
    emoji: "📦",
    tagline: "Package downloads",
    color: "#FFE1E1",
    instant: true,
    fields: [],
    metrics: [
      { key: "downloads", label: "npm downloads", shortLabel: "Downloads", emoji: "📦", format: "number", kind: "flow", defaultChart: "bars", params: [{ key: "package", label: "Package name", placeholder: "react", required: true }] },
    ],
  },
  {
    id: "pypi",
    name: "PyPI",
    emoji: "🐍",
    tagline: "Package downloads",
    color: "#DCEBFF",
    instant: true,
    fields: [],
    metrics: [
      { key: "downloads", label: "PyPI downloads", shortLabel: "Downloads", emoji: "🐍", format: "number", kind: "flow", defaultChart: "bars", params: [{ key: "package", label: "Package name", placeholder: "requests", required: true }] },
    ],
  },
  {
    id: "manual",
    name: "Manual",
    emoji: "✍️",
    tagline: "Any number you track yourself",
    color: "#F1F1F1",
    instant: true,
    fields: [],
    metrics: [
      {
        key: "value",
        label: "Custom number",
        shortLabel: "Custom",
        emoji: "✍️",
        format: "number",
        kind: "level",
        description: "Type it once; we remember the history each time you refresh.",
        params: [
          { key: "label", label: "What is it?", placeholder: "Newsletter subscribers", required: true },
          { key: "value", label: "Current value", placeholder: "1204", required: true, type: "number" },
        ],
      },
    ],
  },
];

export const PROVIDER_MAP: Record<string, ProviderMeta> = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: ProviderId | string): ProviderMeta | undefined {
  return PROVIDER_MAP[id];
}

export function getMetricDef(provider: ProviderId | string, metric: string): MetricDef | undefined {
  return PROVIDER_MAP[provider]?.metrics.find((m) => m.key === metric);
}
