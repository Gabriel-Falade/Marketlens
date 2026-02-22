# MarketLens — Web Dashboard Design Specification
### Institutional Pricing Intelligence Platform · B2B

---

## 1. Design Philosophy

This dashboard is infrastructure. Every design decision should reinforce that story.

The target user is not a consumer — they are an analyst at an FMCG company, a credit officer at a development bank, or a procurement lead at an NGO. They open this at 8am, read the numbers, and act on them. The UI should get out of their way.

**Three rules:**
1. One hero number per page — everything else is context
2. Data density without clutter — pack information, but leave space to breathe
3. No decoration — borders, colors, and typography do all the work

---

## 2. Design System

### 2.1 Color Palette

```
Background (deepest)      #0F172A   — Page bg, nav, sidebars
Surface (panels/cards)    #1E293B   — Cards, tables, modals
Surface raised            #263348   — Hover states, active rows
Border                    #334155   — All borders, dividers, table lines
Border muted              #1E2D3F   — Subtle separators within panels

Accent / Brand            #F59E0B   — Brand, CTAs, active tabs, highlights
Accent dim                #F59E0B22 — Background tint for accent areas

Signal — Stable           #22C55E   — Inflation < 10%, STABLE status
Signal — Watch            #F59E0B   — Inflation 10–25%, WATCH status
Signal — Alert            #EF4444   — Inflation > 25%, ALERT status
Signal — Confidence       #22D3EE   — Confidence/density overlays, cyan

Text primary              #F8FAFC   — Headers, metric values, active labels
Text secondary            #CBD5E1   — Body copy, descriptions
Text muted                #64748B   — Metadata, subtitles, axis labels
Text dim                  #475569   — Placeholders, disabled states
```

### 2.2 Typography

```
Font stack: Inter, -apple-system, "Helvetica Neue", sans-serif
Monospace (metrics): "JetBrains Mono", "Fira Code", monospace

Hero metric         56px  weight 900  tracking -2px   monospace   #F8FAFC
Section metric      36px  weight 800  tracking -1px   monospace   #F8FAFC
Card metric         28px  weight 800  tracking -0.5px monospace   #F8FAFC
Inline metric       20px  weight 700  tracking 0      monospace   signal color
Table value         14px  weight 600  tracking 0      monospace   #F8FAFC

Page title          22px  weight 800  tracking -0.3px sans-serif  #F8FAFC
Section title       11px  weight 800  tracking 2px    sans-serif  #64748B  UPPERCASE
Card label          10px  weight 700  tracking 1.5px  sans-serif  #64748B  UPPERCASE
Body copy           14px  weight 400  tracking 0      sans-serif  #CBD5E1
Table header        11px  weight 700  tracking 1px    sans-serif  #64748B  UPPERCASE
Caption / meta      11px  weight 500  tracking 0.3px  sans-serif  #64748B
```

### 2.3 Spacing & Layout

```
Page max-width:    1440px
Page padding:      0 48px
Nav height:        56px
Content top:       32px

Grid:              12-column, 24px gutter
Card padding:      24px
Card radius:       10px
Card border:       1px solid #334155

Row padding:       16px 20px
Row radius:        8px

Section gap:       32px
Card gap:          16px
Inline gap:        8px
```

---

## 3. Core Components

### 3.1 Metric Card

```
┌────────────────────────────────┐
│  INFORMAL INFLATION INDEX      │  ← label  11px muted UPPERCASE
│                                │
│  46.0%                         │  ← hero value  56px weight-900 signal color
│                                │
│  ↑ +2.3pts vs 30d avg          │  ← delta  12px  green/red
│  Balogun Market · Lagos        │  ← context  11px muted
└────────────────────────────────┘
border-left: 3px solid [signal color]
```

### 3.2 Status Pill

```
[ ALERT ]    bg: #EF444418  border: #EF444445  text: #EF4444  8px 800 tracking-wide
[ WATCH ]    bg: #F59E0B18  border: #F59E0B45  text: #F59E0B
[ STABLE ]   bg: #22C55E18  border: #22C55E45  text: #22C55E
```

### 3.3 Supply Disruption Banner

```
┌───────────────────────────────────────────────────────────────┐
│  ●  Lagos — Port congestion affecting rice imports · +11.2%   │
└───────────────────────────────────────────────────────────────┘
bg: #EF444410  border: 1px solid #EF444430  dot: #EF4444
No emoji. Dot indicator only.
```

### 3.4 Trend Arrow (inline)

```
↑↑  Accelerating   #EF4444
↑   Rising         #F59E0B
→   Stable         #64748B
↓   Easing         #22C55E
↓↓  Falling fast   #22C55E
```

### 3.5 Sparkline (mini chart, 80×32px)

```
Used inline in table rows and market cards.
Single line chart, no axes, no labels.
Stroke: signal color, 1.5px, no fill.
```

### 3.6 Confidence Band

```
On full line charts: semi-transparent area fill around the main line.
Color: #22D3EE14 (muted cyan, very low opacity).
Indicates observation density — thicker band = lower confidence.
```

---

## 4. Page Layouts

---

### 4.1 HOME / OVERVIEW DASHBOARD

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MarketLens              Overview   Markets   Analytics   Export        [API]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  INFORMAL INFLATION INDEX — GLOBAL COMPOSITE          [30D][90D][1Y] │   │
│  │                                                                       │   │
│  │  34.2%                           ╭──────────────────                 │   │
│  │  composite deviation             │                                   │   │
│  │                           ───────╯                                   │   │
│  │  ↑ +2.3pts vs prior period   ─────                                   │   │
│  │  3 markets · 847 observations                                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  SUPPLY DISRUPTIONS                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ●  Lagos — Port congestion affecting rice imports · deviation +11%  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ACTIVE INDICES                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────┐  │
│  │ BALOGUN MARKET   ALERT │  │ CHANDNI CHOWK  STABLE  │  │ MARCHÉ METZ  │  │
│  │ Lagos, Nigeria         │  │ Delhi, India           │  │ Metz, France │  │
│  │                        │  │                        │  │              │  │
│  │  46.0%                 │  │   5.0%                 │  │  41.0%       │  │
│  │  deviation             │  │  deviation             │  │  deviation   │  │
│  │                        │  │                        │  │              │  │
│  │  Vol     18.2   ↑↑     │  │  Vol     2.1    →      │  │  Vol   15.8  │  │
│  │  Conf    74%           │  │  Conf    91%           │  │  Conf   68%  │  │
│  │  Items   8             │  │  Items   8             │  │  Items   8   │  │
│  │  Obs     312   [View]  │  │  Obs     289   [View]  │  │  Obs   246   │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Hero chart: full-width, no y-axis gridlines (just subtle horizontal rules), no box border
- Market cards: `border-left: 3px solid [signal color]`, equal height
- Global composite number is the only 56px element on the page
- "Supply Disruptions" only renders if data warrants; never shows empty state
- No market flags, no country emojis in cards — city + country text only
- [View] CTA is a small text link, not a button

---

### 4.2 MARKET DETAIL

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MarketLens              Overview   Markets   Analytics   Export        [API]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ← Markets    Balogun Market · Lagos, Nigeria                  [Export ↓]  │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ INFLATION INDEX │  │ VOLATILITY      │  │ CONFIDENCE   │  │ TREND    │  │
│  │                 │  │                 │  │              │  │ ACCEL.   │  │
│  │  46.0%          │  │  18.2           │  │  74%         │  │  +2.4    │  │
│  │  deviation      │  │  score          │  │  density     │  │  pts/wk  │  │
│  │                 │  │                 │  │              │  │          │  │
│  │  [ALERT]        │  │  [ELEVATED]     │  │  [MODERATE]  │  │  [↑↑]    │  │
│  └─────────────────┘  └─────────────────┘  └──────────────┘  └──────────┘  │
│                                                                              │
│  PRICE INDEX                                              [Table] [Chart]   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ITEM                  MIN        MEAN       MAX    TREND   OBS      │   │
│  │  ──────────────────────────────────────────────────────────────────  │   │
│  │  Imported Rice (50kg)  ₦32,000   ₦38,500   ₦42,000   ↑↑    124      │   │
│  │  Beef (1kg)            ₦ 4,500   ₦ 5,200   ₦ 6,000    →     89      │   │
│  │  Fresh Tomatoes        ₦ 8,000   ₦11,200   ₦15,000   ↑↑     67      │   │
│  │  Eggs (crate/30)       ₦ 3,200   ₦ 3,800   ₦ 4,500    ↑     54      │   │
│  │  Titus Fish (1kg)      ₦ 2,800   ₦ 3,400   ₦ 4,100    →     48      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  TREND — PRICE DEVIATION OVER TIME         [30D][90D][1Y]  [+Confidence]   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  50% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │                                                          ╭──────     │   │
│  │  30% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╭─────╯           │   │
│  │                                        ─────────╮╯                  │   │
│  │  10% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─╯                             │   │
│  │                                                                       │   │
│  │       Jan          Feb          Mar          Apr          May         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  MARKET CONTEXT                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  AI-generated summary text · updated on each analysis run            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Four metric cards in a 4-col row, uniform height — never stacked on desktop
- Price index table: monospace values, right-aligned numbers, tabular-nums
- Trend arrows colored by signal: ↑↑ = red, ↑ = amber, → = muted, ↓ = green
- [+Confidence] toggle layers the cyan confidence band over the chart
- "Market Context" panel uses smaller, muted text — secondary to data
- [Export ↓] top-right — text link, not prominent button

---

### 4.3 TREND ANALYTICS

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MarketLens              Overview   Markets   Analytics   Export        [API]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Analytics                [Balogun Market ▾]  [All Items ▾]  [30D][90D][1Y] │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  COMPOSITE DEVIATION TREND                         [+Confidence] [↓] │   │
│  │                                                                       │   │
│  │  ── Balogun    ── Chandni Chowk    ── Marché Metz                     │   │
│  │                                                                       │   │
│  │  50%                                                        ╭─────   │   │
│  │     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─╯         │   │
│  │  30%                                                  ╭──────        │   │
│  │     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─╭─────╯             │   │
│  │  10%  ─────────────────────────────────────────╯                    │   │
│  │                                                                       │   │
│  │        Jan       Feb       Mar       Apr       May       Jun          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ITEM-LEVEL SPARKLINES                                 [Sort: deviation ▾]  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ITEM                     30D TREND    DEVIATION   ACCEL    CONF     │   │
│  │  ──────────────────────────────────────────────────────────────────  │   │
│  │  Imported Rice (50kg)     ╱╱╱╱╱╲╱╱↗   +38.5%     +2.4↑↑   74%      │   │
│  │  Fresh Tomatoes           ╱╱╱╱╱╱╱↗↗   +34.1%     +3.1↑↑   61%      │   │
│  │  Beef (1kg)               ╱╱──╱──╱    +12.2%     +0.8↑    83%      │   │
│  │  Titus Fish (1kg)         ─────────    +3.1%      0.0→     79%      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  DEVIATION HEATMAP                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │            Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct │   │
│  │  Lagos     ░░░   ░░░   ▒▒▒   ▒▒▒   ▓▓▓   ███   ███   ▓▓▓   ▒▒▒      │   │
│  │  Delhi     ░░░   ░░░   ░░░   ░░░   ░░░   ░░░   ░░░   ░░░   ░░░      │   │
│  │  Metz      ░░░   ░░░   ▒▒▒   ▒▒▒   ▓▓▓   ▓▓▓   ███   ▓▓▓   ▒▒▒      │   │
│  │                                                                       │   │
│  │  ░ Stable (<10%)  ▒ Watch (10–25%)  ▓ Alert (25–40%)  █ Critical    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Multi-line chart: each market a distinct color (red/amber/green by current status)
- Confidence band toggles as a single action, applies to all visible lines
- Sparklines table: actual mini SVG charts, 80×28px, stroke only
- Heatmap: CSS grid, cell color from `#22C55E` → `#F59E0B` → `#EF4444` gradient
- No axis labels on sparklines — they are directional, not precise
- Legend below heatmap uses dot indicators with text labels, not colored boxes

---

### 4.4 EXPORT / API REQUEST

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MarketLens              Overview   Markets   Analytics   Export        [API]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Data Export & API Access                                                    │
│  Programmatic access to the MarketLens pricing index.                        │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌────────────────────────────────┐    │
│  │                                 │  │  ENDPOINT PREVIEW              │    │
│  │  DATASET                        │  │                                │    │
│  │  ● Full Price Index             │  │  GET /v1/market/{id}/prices    │    │
│  │  ○ Deviation Trends             │  │                                │    │
│  │  ○ Volatility Series            │  │  {                             │    │
│  │  ○ Raw Observations             │  │    "market": "lagos",          │    │
│  │                                 │  │    "items": [...],             │    │
│  │  MARKETS                        │  │    "period": "2024-01",        │    │
│  │  ☑ Balogun Market (Lagos)       │  │    "deviation": 46.0,          │    │
│  │  ☑ Chandni Chowk (Delhi)        │  │    "confidence": 0.74          │    │
│  │  ☑ Marché de Metz               │  │  }                             │    │
│  │                                 │  │                                │    │
│  │  DATE RANGE                     │  │  SCHEMA [↗]                    │    │
│  │  [Jan 2024    ] → [Today    ]   │  │                                │    │
│  │                                 │  └────────────────────────────────┘    │
│  │  FORMAT                         │                                        │
│  │  ● JSON    ○ CSV    ○ Parquet   │  ┌────────────────────────────────┐    │
│  │                                 │  │  YOUR API KEY                  │    │
│  │  GRANULARITY                    │  │  ml_live_••••••••••••••••k9x2  │    │
│  │  ● Daily   ○ Weekly  ○ Monthly  │  │                          [Copy]│    │
│  │                                 │  │                                │    │
│  │  [Generate Export]              │  │  Rate limit: 1,000 req/day     │    │
│  │                                 │  │  Tier: Research                │    │
│  └─────────────────────────────────┘  └────────────────────────────────┘    │
│                                                                              │
│  RECENT EXPORTS                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  full_index_lagos_2024-05.json      1.2 MB    May 12, 2024   [↓]    │   │
│  │  deviation_trends_all_q1.csv        340 KB    Apr 01, 2024   [↓]    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Two-column layout: config left, preview/key right — no full-width form
- API key masked with `••••` by default, [Copy] is the only CTA in that panel
- [Generate Export] is the one prominent button on this page — `C.accent` background
- Radio buttons and checkboxes styled as minimal custom components (no browser defaults)
- Endpoint preview: monospace, dark panel (`#0F172A`), syntax-highlighted lightly
- "Recent Exports" table: no checkbox, just filename + size + date + download icon

---

## 5. Navigation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MarketLens    Overview   Markets   Analytics   Export             [API Key] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Fixed top nav, `56px` height, `#0F172A` background, `1px solid #334155` bottom border
- **MarketLens** wordmark: 20px, weight 900, `#F59E0B`, `letter-spacing: -0.5px`
- Nav links: 13px, weight 600, `#64748B` default → `#F8FAFC` active
- Active page: no underline, no pill — just text color change + `#F59E0B` 2px bottom border
- `[API Key]` button: minimal — `border: 1px solid #334155`, transparent bg, text `#94A3B8`
- No sidebar on desktop. No hamburger below 768px — collapse to bottom tab bar

---

## 6. Component Simplification Recommendations

### Remove entirely:
- Flag emojis everywhere (replace with ISO country code text: `NG`, `IN`, `FR`)
- `GougingBadge` pill component — replaced by metric number + status pill
- Any decorative background patterns or gradients on cards
- "tapHint" / instructional text in the data views
- Full-bleed colored hero backgrounds — use `border-left` signals only

### Simplify:
- Market cards: remove icon entirely, let the number speak
- Price bars: keep mean dot only, remove the full range fill (too much visual noise)
- Status pills: reduce to 3 states only (STABLE / WATCH / ALERT)
- Section titles: 10px, uppercase, muted — never bold or colored

### Elevate:
- Primary metric number: always the largest, most contrasty element in its panel
- Confidence score: always visible alongside deviation (paired metric)
- Trend direction: always paired with the metric value as an inline indicator

---

## 7. Analytical Microcopy Guide

### Metrics

| Consumer language (avoid) | Institutional language (use) |
|---|---|
| Price gouging | Price deviation |
| Gouging rate | Deviation index |
| Prices went up | Accelerating inflation |
| Bad prices | Elevated volatility |
| Reports | Observations |
| Submit a report | Contribute observation |
| Check price | Validate price point |
| Score | Index value |
| High inflation | Deviation > threshold |
| Supply problem | Supply disruption |
| Market is bad | Market flagged for review |

### Status Labels

| Status | Threshold | Label | Color |
|---|---|---|---|
| Low deviation | < 10% | `STABLE` | `#22C55E` |
| Moderate deviation | 10–25% | `WATCH` | `#F59E0B` |
| High deviation | > 25% | `ALERT` | `#EF4444` |
| No data | — | `NO DATA` | `#475569` |

### Chart Axis & Tooltip Labels

```
Y-axis:   "Deviation (%)"        not "Gouging" or "% above normal"
X-axis:   "Period"               date formatted as "Jan 2024"
Tooltip:  "46.0% deviation       not "Prices 46% above fair value"
           124 observations
           Confidence: 74%"

Hero caption:  "Composite deviation across 3 active markets"
Empty state:   "No observations recorded for this period"
Loading:       "Retrieving index data..."  (no spinner emoji)
Error:         "Index data unavailable. Retry or contact support."
```

### Page Titles & Headers

```
Home page:        "Market Overview"         not "Dashboard" or "Home"
Market page:      "[Market Name] · [City]"  e.g. "Balogun Market · Lagos"
Analytics page:   "Trend Analytics"         not "Charts" or "Graphs"
Export page:      "Data Export & API"       not "Download" or "Get Data"
```

---

## 8. Responsive Breakpoints

```
Desktop     ≥1280px    Full layout, 4-col metric row, sidebar chart
Tablet       768–1279px  3-col market cards, 2-col metric row, scrollable table
Mobile       <768px     Stack all panels, bottom tab nav, hero metric prominent
```

Mobile-specific:
- Bottom nav: Overview / Markets / Analytics / Export (4 tabs, no labels except active)
- Hero metric: stays full-width at top of scroll
- Tables: horizontal scroll, sticky first column (item name)
- Charts: full-width, no confidence toggle (too dense)

---

## 9. Implementation Stack Recommendation

For the web dashboard implementation:

```
Framework:      Next.js 14 (App Router)
Styling:        Tailwind CSS  (utility classes map directly to this spec)
Charts:         Recharts or Tremor  (both support custom color props cleanly)
Heatmap:        D3.js  (most control over cell colors and scaling)
Icons:          Lucide React  (consistent, minimal, no emojis)
Fonts:          next/font with Inter + JetBrains Mono
Tables:         TanStack Table  (sorting, filtering, virtualization)
API layer:      tRPC or plain fetch  (depends on backend setup)
```

---

*MarketLens Design Specification v1.0*
*Prepared for Hackalytics 2025*
