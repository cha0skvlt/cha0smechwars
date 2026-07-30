# cha0skvlt UI — Style Canon

**Система:** единый визуальный и UX-язык cha0skvlt (Industrial Console + публичные поверхности).  
**Аудитория:** любой агент или разработчик, строящий UI в проектах Commander’а.  
**Правило:** не изобретать вторую дизайн-систему. Не «улучшать» цвета, радиусы, шрифты, отступы и chrome без Order.  
**Закон:** CSS custom properties с именами и значениями ниже (или идентичные литералы). Токены предпочтительнее one-off hex в компонентах.

Если документ расходится с кодом — сначала свериться с реализованным интерфейсом, затем обновить документ. Источники правды по поверхностям:

| Поверхность | Код |
| ----------- | --- |
| Публичный сайт (piniq.ai) | `site/css/tokens.css`, `site/css/landing.css`, `site/index.html` |
| Console / panel / ops | токены из §16; проектные CSS/HTML по канону ниже |

---

## 0. Две поверхности — одна система

Общий каркас (фон, поверхности, hairline, текст, сетка 4px, радиусы ≤6px, motion, иконки stroke 1.75) **одинаков**.

| | **Site** (маркетинг / лендинг) | **Console** (ops / admin / gate) |
| - | ------------------------------ | -------------------------------- |
| Настроение | Инженерный терминал + аппаратная панель | Production console — плотный, спокойный, операционный |
| Display / бренд | `IBM Plex Mono` (self-hosted) | Wordmark Inter medium uppercase; данные — mono |
| Фирменный акцент | Красный бренд `--brand` | Auth CTA: `--accent` (violet dark / charcoal light); ошибки/alarm: `--signal` |
| Scope | Hero, услуги, контакты, локали | Boards, tables, logs, beacons, auth gate |
| Chrome-язык | Локализованный UI | English operational labels по умолчанию |

Не смешивать: на лендинге не тащить violet auth-accent; в консоли не делать огромный Inter-hero и красные бренд-заливки фоном.

---

## 1. Design posture (non-negotiable)

| Do | Don’t |
| -- | ----- |
| Industrial / metal-switch UI: dense, calm, sharp | Soft SaaS cards, big shadows, glassmorphism |
| Hairline borders + subtle top «edge» highlight | Thick borders, neon glows (кроме status beacons) |
| Uppercase micro-labels, wide tracking | Marketing fluff, Inter как display-hero |
| Dark charcoal + muted gray text (default) | Purple-on-white gradients, cream+serif broadsheet |
| Max radius **6px** | `rounded-full` pills, large-radius «app» look |
| Lucide-style **stroke** icons, stroke **1.75** | Filled emoji icons, icon fonts, CDN icon packs |
| Mono для metrics / logs / status / codes / бренда на сайте | Fancy display type для данных |
| Красный бренд — точечно (сайт) | Большие красные фоновые заливки |

**Mood:** точный инженерный интерфейс с отсылками к терминалам и аппаратным панелям. Brand mark (если есть) + короткий wordmark; контент не перебивает марку.

**Не использовать:** градиентный SaaS, стекло, большие тени, скруглённые плашки, декоративные карточки, emoji, лишние акцентные цвета вне канона.

---

## 2. Theme switch

| Attribute | Values | Default |
| --------- | ------ | ------- |
| `html[data-theme]` | `dark` \| `light` | **dark** |

Сохранять предпочтение в `localStorage` под project-local ключом (например `<app>-theme`). Применять **до first paint** (boot script, без FOUC).

`meta[name="theme-color"]` следует `--bg`:

| Theme | `theme-color` |
| ----- | ------------- |
| dark | `#0b0c0e` |
| light | `#d4cebf` |

---

## 3. Typography

### 3.1 Shared tokens

| Token | Value | Use |
| ----- | ----- | --- |
| `--font-body` | `'Inter', system-ui, sans-serif` | Chrome, buttons, labels, body |
| `--font-mono` | `ui-monospace, 'SF Mono', Menlo, monospace` | Logs, stats, codes (console) |
| `--font-display` | `'IBM Plex Mono', ui-monospace, monospace` | Site: бренд, заголовки, техданные |
| `--font-weight-normal` | `400` | Body |
| `--font-weight-medium` | `500` | Labels, buttons, wordmark |
| `--text-tag` | `10px` | Quiet captions / служебные метки |
| `--text-xs` | `11px` | Buttons, tile titles, mono data, log lines |
| `--text-sm` | `13px` | Default body |
| `--text-base` | `14px` | Header wordmark (console) |
| `--text-md` | `15px` | Auth / page title; enlarged body |
| `--line-height-tight` | `1.45` | Compact rows |
| `--line-height-body` | `1.7` | Auth / long form |
| `--tracking-wide` | `0.12em` | Uppercase labels / titles |
| `--tracking-wider` | `0.14em` | Primary submit CTAs |
| `--tracking-wordmark` | `0.14em` | Header wordmark |

### 3.2 Rules

- Inter **только 400 / 500** (site: self-hosted `site/fonts/`, без Google Fonts; console: допустим swap-load тех же весов).
- Site display: IBM Plex Mono 400/500, self-hosted.
- `html { -webkit-font-smoothing: antialiased; }`
- Section / field / page titles (console): **uppercase** + medium + `--tracking-wide`
- Data lines: mono + `--text-xs` (или `--text-tag` quieter)
- **Never** Inter as huge hero/display face
- Системный mono — запасной для коротких меток

### 3.3 Site scale

| Role | Size |
| ---- | ---- |
| Hero | `clamp(38px, 5.4vw, 68px)`, line-height `1.02` |
| Заголовки услуг | `clamp(24px, 3vw, 36px)` |
| Body | `13px`; enlarged `15px` |
| Служебные метки | `10–11px`, uppercase, tracking `0.12em` |

Заголовки короткие и прямые. Технические метки могут начинаться с `//`.

На китайском, японском, тайском, иврите и арабском uppercase и широкое tracking **не** применять. Для `ar-AE` / `he-IL` — `dir="rtl"`; арабский — MSA; иврит — современный; шрифты `Noto Sans Arabic` / `Noto Sans Hebrew` (и SC/JP/Thai для соответствующих локалей), self-hosted subsets.

### 3.4 Console chrome language

English operational labels по умолчанию (коротко, без маркетинга). `lang` на `<html>` может отличаться; видимый chrome остаётся English, пока Order не скажет иначе.

---

## 4. Spacing & shape

**Base unit: 4px**

| Token | px |
| ----- | -- |
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 24 |
| `--space-6` | 32 |
| `--space-8` | 48 |

**Radii (never exceed 6px)**

| Token | px |
| ----- | -- |
| `--radius-sm` | 3 |
| `--radius-md` | 5 |
| `--radius-lg` | 6 |

**Borders / elevation**

| Token | Value |
| ----- | ----- |
| `--border-hairline` | `0.5px solid var(--hairline)` |
| Metal bevel | часто `border-top: 1px solid var(--edge-light)` |
| `--border-pinned` | `1px solid var(--edge-light)` (light: `1px solid var(--hairline)`) |
| `--card-shadow-light` | `0 1px 2px rgba(60, 50, 30, 0.12)` — только light surfaces |
| `--line-hairline` | `1px` |
| `--ctx-min-width` | `160px` |
| Site content max | `1180px` |

**Controls**

| Token | Value |
| ----- | ----- |
| `--size-tool` | `32px` (icon buttons, input min-height) |
| `--card-pad` | `var(--space-3)` |
| `--icon-stroke` | `1.75` |

---

## 5. Color — dark (`data-theme="dark"`)

### 5.1 Shared foundation

| Role | Hex |
| ---- | --- |
| `--bg` | `#0b0c0e` |
| `--surface-header` / `--surface-1` | `#121316` |
| `--surface-2` | `#16181b` |
| `--surface-3` | `#1b1d21` |
| `--hairline` | `#26282c` |
| `--edge-light` | `#34373d` |
| `--text-primary` | `#e6e6e8` |
| `--text-secondary` | `#9a9ca2` |
| `--text-muted` | `#5d5f65` |

Scrollbar: track `surface-1`, thumb `surface-3`, hover `edge-light`.

### 5.2 Console accents

| Role | Hex |
| ---- | --- |
| `--accent` | `#8b6fd6` |
| `--accent-fg` | `#e6e6e8` |
| `--accent-edge` | `#a98ee8` |
| `--signal` | `#f05551` |
| `--signal-edge` | `#5a2723` |

### 5.3 Site brand

| Role | Hex |
| ---- | --- |
| `--brand` | `#c02b38` |

Красный = бренд, активная деталь или точечный сигнал. Не для больших фоновых заливок. Focus-visible на сайте — brand red.

---

## 6. Color — light (`data-theme="light"`)

Тёплая бумага / khaki desk — **не** чистый белый.

### 6.1 Shared foundation

| Role | Hex |
| ---- | --- |
| `--bg` | `#d4cebf` |
| `--surface-header` | `#ccc6b6` |
| `--surface-1` | `#d2cbb8` |
| `--surface-2` | `#e3ddce` |
| `--surface-3` | `#ece6d8` |
| `--hairline` | `#bdb6a4` |
| `--edge-light` | `#ebe5d6` |
| `--text-primary` | `#3d3a34` |
| `--text-secondary` | `#56524a` |
| `--text-muted` | `#928c7d` |

Scrollbar: track `surface-1`, thumb `hairline`, hover `text-muted`.

### 6.2 Console accents

| Role | Hex |
| ---- | --- |
| `--accent` | `#45413a` |
| `--accent-fg` | `#d4cebf` |
| `--accent-edge` | `#5c5850` |
| `--signal` | `#a8412f` |
| `--signal-edge` | `#6e3028` |

### 6.3 Site brand

| Role | Hex |
| ---- | --- |
| `--brand` | `#981c28` |

---

## 7. Motion

| Token | Value |
| ----- | ----- |
| `--dur-fast` | `120ms` |
| `--dur` | `180ms` |
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` |

Patterns:

- Controls: background + color; `:active` → `scale(0.98)`
- Hover reveals (actions): opacity fade
- Menus: opacity + `scale(0.98→1)`
- Drag / deny: opacity `0.5` + `scale(0.98)`
- Filled CTA hover: `filter: brightness(1.08)`
- Status beacons: единственное место continuous / «loud» animation
- Site: редкие discrete raster/glitch в hero; мерцание пиксельной шкалы

No bounce easings. No long cinematic transitions.  
При `prefers-reduced-motion: reduce` декоративная анимация отключается. Статичный кадр любой анимации остаётся понятным.

---

## 8. Status beacons (console)

Круглые орбы health / alarm — не badges и не pills.

### Sizes

| Token | Value |
| ----- | ----- |
| `--beacon-size` | `var(--space-8) + var(--space-4)` → **72px** |
| Secondary | half → **36px** |
| `--lamp-orb-size` | `var(--space-5)` → **24px** |

### Dark cores

| State | Core | Glow | Animation |
| ----- | ---- | ---- | --------- |
| OK | `#3a8f5c` | soft green | calm pulse ~**2.8s** |
| Warn | `#c9a227` | amber | calmer pulse ~**1.8s** |
| Alarm | `#ff2e1a` | harsh red + halo | siren ~0.42s + flicker ~0.11s |
| Stale / unknown | `--text-muted` | none | opacity **~0.35** |

### Light overrides

| Token | Light |
| ----- | ----- |
| OK core | `#5a8a62` |
| OK glow | `rgba(70, 110, 75, 0.35)` / soft `0.15` |
| Amber core | `#9a7b18` |
| Amber glow | `rgba(154, 123, 24, 0.35)` |
| Alarm core | `#c43828` |
| Alarm glow / halo | `rgba(180, 50, 35, 0.75)` / `rgba(200, 80, 50, 0.4)` |

Label under orb: mono, `--text-xs`, medium, `--text-primary`. Короткие English: Operational / Degraded / Unknown (или столь же сжатые синонимы проекта).

---

## 9. Canonical shells

Паттерны, не обязательные routes. Labels/actions — per product; структура и токены — канон.

### 9.1 App shell (board / console)

```
html[data-theme]
└ body                    /* 100dvh; column flex; overflow hidden; user-select none (inputs override) */
   ├ header               /* surface-header; hairline bottom + top edge; z-index high */
   │  ├ .logo             /* mark + uppercase wordmark */
   │  └ .header-actions
   │     ├ .header-tools  /* icon tools; hairline separator */
   │     └ primary actions /* metal buttons / links */
   ├ main / board wrap    /* flex 1; padded; scrollable work surface */
   └ optional ctx menu    /* fixed; surface-1; hairline + top edge */
```

**Header**

- Padding: `--space-3` / `--space-5` (уже на узких)
- Logo: mark + wordmark; gap ~`--space-3` или 7–12px; uppercase; `--tracking-wordmark`
- Wordmark primary → `--text-primary`; secondary → `--text-secondary`
- Tools: square `--size-tool`
- Primary actions: metal `.btn` — **не** filled accent

**Body**

- Один плотный workspace (grid, table, stream) вместо multi-page chrome
- `user-select: none` на shell; select на inputs / log viewports

### 9.2 Auth / gate

```
body.login-page           /* centered; bg; line-height body */
└ shell                   /* max-width ~360px; gap --space-5 */
   ├ brand                /* mark + uppercase title + mono muted subtitle */
   └ card form            /* surface-2; hairline + top edge; radius-lg; pad --space-5 */
      ├ error strip       /* mono; signal; signal-edge border; tinted bg */
      ├ labeled fields
      └ filled submit     /* ONLY filled accent CTA in the console system */
```

- Title: `--text-md`, medium, uppercase, `--tracking-wide`
- Subtitle: mono, `--text-xs`, muted
- Labels: uppercase micro
- Inputs: min-height tool; `surface-1`; hairline + top edge; focus → `--accent` border + `surface-3`
- Submit: `--accent` fill, `--accent-fg`, uppercase, `--tracking-wider`, radius-sm
- Light: drop top-edge on card; use `--card-shadow-light`

### 9.3 Public landing (site)

```
html[data-theme]
└ body
   ├ sticky header        /* hairline bottom */
   ├ central shell        /* max 1180px; боковые hairline */
   │  ├ hero              /* mono title, short copy, one CTA, optional pixel scale */
   │  ├ sections          /* горизонтальные границы, не карточки */
   │  ├ services          /* индексированные строки / колонки */
   │  └ contacts          /* компактный технический список */
   └ footer / meta
```

- Hero просторный, не декоративный
- Секции разделяются границами, не тенями
- На мобильных колонки → одна; без горизонтального скролла
- Breakpoints site: `900px`, `680px`, `420px`

---

## 10. Components

### Buttons — metal switch

| Property | Value |
| -------- | ----- |
| Height | `--size-tool` (32px) |
| Font | Inter `--text-xs` medium (site buttons: `11px` / 500) |
| Background | `surface-2` |
| Color | `text-secondary` (primary → `text-primary`) |
| Border | hairline + top `1px solid edge-light` |
| Radius | `--radius-md` |
| Hover | `surface-3` (+ text color); без смены геометрии |
| Active | `scale(0.98)` |
| Disabled | opacity `0.4` |

- Icon-only: 32×32, padding 0
- **Board / shell actions stay metal.** Filled `--accent` — только auth primary submit (или редкий Ordered CTA того же веса)
- Site: основная CTA в hero — metal; бренд-акцент точечно (wordmark `.ai`, маркеры, focus)

### Cards / panels

- Background `surface-2`
- Hairline + top edge; radius `--radius-md`; pad `--card-pad`
- Light: `--card-shadow-light`; pinned / selected: `--border-pinned`
- Optional head: uppercase micro title + hover-reveal actions
- Site: предпочтительно **без** карточек — структура сеткой и границами

### Lists / indexed rows (site)

- Структура: сетка + границы
- Индексы, ключи, стрелки — mono / display
- Красные квадраты допустимы как маркеры (`--brand`)
- Hover не меняет геометрию

### Tables

- Mono `--text-xs`
- Header: muted, medium
- Body: secondary
- Separators: hairline
- Links: no underline; secondary → primary on hover

### Mono widgets / stats

- Stacked lines; values primary/medium; labels secondary; quiet titles `--text-tag`
- Hairline между items

### Live log / stream

- Inset: hairline, radius-sm, mixed `surface-2`
- Mono `--text-xs`; line-height tight
- Error / critical → `--signal`; debug → muted; default → secondary
- Newest-first; pause-on-scroll при стриме

### Context / overflow menu

- Fixed; `surface-1`; hairline + top edge; radius-md; min-width `--ctx-min-width`
- Items: `--text-xs`, secondary; hover `surface-3` / primary
- Icons 12px muted → secondary on hover
- Open: opacity 1 + scale 1; closed: opacity 0 + scale 0.98

### Icons

- Inline SVG Lucide-style only
- `fill="none"` `stroke="currentColor"` `stroke-width="1.75"` round caps/joins
- Sizes: **14px** tools, **12px** menus, **16px** helpers
- No icon font CDN
- Декоративные SVG: `aria-hidden`; интерактивные — имя через контрол

### Brand mark (site)

- Wordmark: `piniq` primary, `.ai` brand red
- Favicon: пиксельный красный флаг, чёрный флагшток, прозрачный фон; читаем в `16×16`

### Scrollbars

- Thin; theme track/thumb; thumb radius-sm

---

## 11. Optional: snap grid board (console)

| Token | Formula / value |
| ----- | --------------- |
| `--cell` | `3 × --space-8 + --space-2` = **152px** |
| `--grid-gap` | `--space-4` = **16px** |
| `--grid-step` | cell + gap = **168px** |

```
width  = spanW × cell + (spanW − 1) × gap
height = spanH × cell + (spanH − 1) × gap
left   = col × step
top    = row × step
```

- Spans: **1, 2, 4** (и 2×2, 2×4, 4×2, 1×1)
- Desktop: absolute snap; narrow ≈48rem: column stack, no drag
- Default layout **locked**; unlock → drag; pin; persist в project-local `localStorage`
- Drag / deny: opacity 0.5 + `scale(0.98)`

| Kind | Typical footprint | Content |
| ---- | ----------------- | ------- |
| Lamp | 1×1 | Beacon + status key |
| Table | 2×2 (tall 2×4) | Dense mono table / stats |
| Stream | 4×2 | Live log viewport |

Tile IDs, APIs, copy — per project, не часть канона.

---

## 12. Responsive

### Console

| Approx max width | Effect |
| ---------------- | ------ |
| 1280px | Tighten shell padding |
| 1024px | Reduce card pad |
| 768px | Header wrap; smaller wordmark; denser gaps |
| 480px | Minimal padding |
| ~48rem | Board → column stack; full-width tiles; no drag |

### Site

| Breakpoint | Role |
| ---------- | ---- |
| 900px | Колонки / shell |
| 680px | Уплотнение |
| 420px | Mobile stack |

Breakpoints мягкие; плотность через токены, не через другую визуальную систему.

---

## 13. Interaction defaults

| Concern | Default |
| ------- | ------- |
| Theme | Dark; toggle + persist |
| Auth gate | Centered card; filled accent submit; signal error strip |
| Session loss on API | Redirect / return to login |
| Destructive / rare ops | Explicit control; danger chrome только через `--signal` |
| Dense data | Mono + hairlines; no card-in-card |
| Charts / heavy viz | Отдельная поверхность — не pill clusters |
| Focus-visible | Заметный (site: brand; console: accent/system) |
| Meaning | Не кодировать смысл одним цветом |

---

## 14. Text & localization (site)

- Locales: `en`, `es`, `ja`, `zh-Hans`, `ru`, `th`, `he-IL`, `ar-AE`
- Автовыбор: RFC 4647 Lookup по `navigator.languages` (BCP 47 via `Intl.Locale`), без `localStorage`, без timezone для языка. Fallback: `en`. Слушатель `languagechange` — пока нет ручного клика.
- Китайский: только `zh-Hans` (`zh` / `zh-CN` / `zh-SG` / `Hans`). `zh-Hant` / `zh-TW` / `zh-HK` / `zh-MO` → следующий preference или `en`.
- Иврит `he-IL`: только если в предпочтениях `he`/`iw` **и** TZ `Asia/Jerusalem`. Арабский: `ar-AE`, MSA, RTL.
- Кнопка языка: цикл `en → es → ja → zh-Hans → ru → th → he-IL → ar-AE → en → …`. Бейдж = текущая локаль. Явный клик = session override (без persistence). `aria-label` = текущий и следующий.
- Display: IBM Plex Mono (en/es/ru); Noto Sans SC / JP / Thai / Hebrew / Arabic 900 для соответствующих локалей.
- Тон: профессиональный, короткий, технически конкретный. Без маркетинговых штампов, превосходных степеней и лишних восклицаний.
- Перевод не меняет структуру страницы; RTL через `dir` + logical CSS.

---

## 15. Anti-patterns (reject)

1. Inter как huge display/hero font  
2. Purple→indigo gradient backgrounds  
3. Cream `#F4F1EA` + terracotta + serif newspaper look  
4. Soft multi-layer shadows / glow UI chrome (beacons exempt)  
5. Pill clusters, stat strips, emoji status  
6. Decorative cards-in-cards  
7. Radius > 6px  
8. Filling shell primary buttons с accent violet (auth submit only, unless Ordered)  
9. CDN icon fonts или filled emoji icons  
10. Новые accent colors вне brand / accent / signal / beacon set  
11. «Модернизация» в generic SaaS (glass, oversized radius, soft purple)  
12. Большие красные brand-заливки фона  
13. Подмена console violet accent на site brand red и наоборот без Order  

---

## 16. Token cheat-sheet (copy into `:root`)

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;

  --radius-sm: 3px;
  --radius-md: 5px;
  --radius-lg: 6px;

  --text-tag: 10px;
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-md: 15px;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, monospace;
  --font-display: 'IBM Plex Mono', ui-monospace, monospace;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --line-height-tight: 1.45;
  --line-height-body: 1.7;
  --tracking-wide: 0.12em;
  --tracking-wider: 0.14em;
  --tracking-wordmark: 0.14em;

  --dur-fast: 120ms;
  --dur: 180ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);

  --size-tool: 32px;
  --icon-stroke: 1.75;
  --card-pad: var(--space-3);
  --ctx-min-width: 160px;
  --card-shadow-light: 0 1px 2px rgba(60, 50, 30, 0.12);
  --content-max: 1180px;
}

[data-theme="dark"] {
  --bg: #0b0c0e;
  --surface-header: #121316;
  --surface-1: #121316;
  --surface-2: #16181b;
  --surface-3: #1b1d21;
  --hairline: #26282c;
  --edge-light: #34373d;
  --text-primary: #e6e6e8;
  --text-secondary: #9a9ca2;
  --text-muted: #5d5f65;
  /* console */
  --accent: #8b6fd6;
  --accent-fg: #e6e6e8;
  --accent-edge: #a98ee8;
  --signal: #f05551;
  --signal-edge: #5a2723;
  /* site */
  --brand: #c02b38;
  --border-hairline: 0.5px solid var(--hairline);
  --border-pinned: 1px solid var(--edge-light);
  --scrollbar-track: var(--surface-1);
  --scrollbar-thumb: var(--surface-3);
  --scrollbar-thumb-hover: var(--edge-light);
  --beacon-ok-core: #3a8f5c;
  --beacon-ok-glow: rgba(80, 160, 110, 0.45);
  --beacon-ok-glow-soft: rgba(60, 120, 85, 0.2);
  --beacon-amber-core: #c9a227;
  --beacon-amber-glow: rgba(201, 162, 39, 0.4);
  --beacon-alarm-core: #ff2e1a;
  --beacon-alarm-glow: rgba(255, 55, 30, 0.95);
  --beacon-alarm-halo: rgba(255, 90, 40, 0.55);
  --beacon-stale-core: var(--text-muted);
}

[data-theme="light"] {
  --bg: #d4cebf;
  --surface-header: #ccc6b6;
  --surface-1: #d2cbb8;
  --surface-2: #e3ddce;
  --surface-3: #ece6d8;
  --hairline: #bdb6a4;
  --edge-light: #ebe5d6;
  --text-primary: #3d3a34;
  --text-secondary: #56524a;
  --text-muted: #928c7d;
  /* console */
  --accent: #45413a;
  --accent-fg: #d4cebf;
  --accent-edge: #5c5850;
  --signal: #a8412f;
  --signal-edge: #6e3028;
  /* site */
  --brand: #981c28;
  --border-hairline: 0.5px solid var(--hairline);
  --border-pinned: 1px solid var(--hairline);
  --scrollbar-track: var(--surface-1);
  --scrollbar-thumb: var(--hairline);
  --scrollbar-thumb-hover: var(--text-muted);
  --beacon-ok-core: #5a8a62;
  --beacon-ok-glow: rgba(70, 110, 75, 0.35);
  --beacon-ok-glow-soft: rgba(70, 110, 75, 0.15);
  --beacon-amber-core: #9a7b18;
  --beacon-amber-glow: rgba(154, 123, 24, 0.35);
  --beacon-alarm-core: #c43828;
  --beacon-alarm-glow: rgba(180, 50, 35, 0.75);
  --beacon-alarm-halo: rgba(200, 80, 50, 0.4);
  --beacon-stale-core: var(--text-muted);
}
```

---

## 17. Agent checklist before shipping UI

- [ ] Токены совпадают с §§3–8 / §16 (или идентичные литералы)
- [ ] Inter 400/500; mono / display по поверхности
- [ ] Dark default; light = warm khaki
- [ ] Hairline + optional top edge bevel на chrome
- [ ] Radii ≤ 6px; tool controls 32px
- [ ] Uppercase micro-labels + wide tracking (где локаль позволяет)
- [ ] Stroke icons 1.75
- [ ] Motions ≤ 180ms (beacons excepted), ease канона
- [ ] Shell actions metal; filled accent только auth-weight CTAs
- [ ] Site: `--brand` точечно; console: `--accent` / `--signal` / beacons
- [ ] Нет второй палитры и «tasteful» redesign
- [ ] Product copy/routes/APIs не протекли в новые visual rules
- [ ] Dark + light проверены; desktop + mobile breakpoints
- [ ] Hover, focus-visible, reduced motion работают
- [ ] Site: локали / RTL / автовыбор языка по канону §14

---

Этот документ — стилистический закон **cha0skvlt UI**. Product APIs, домены и feature inventories — elsewhere.  
`PANEL_STYLE.md` поглощён этим каноном и не ведётся отдельно.
