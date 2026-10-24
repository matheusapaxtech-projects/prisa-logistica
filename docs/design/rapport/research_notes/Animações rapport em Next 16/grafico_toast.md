# Animated revenue chart, Undo toast and small animated widgets (React 19 / Next.js 16, as of Oct 2026)

Research date: 2026-10-23. Versions come from the npm registry (`/latest`) on that date. Sizes come from the bundlephobia API (min / min+gzip of the whole package entry, so they are not tree-shaken figures). Code snippets under "Inferences" are my own synthesis from the cited APIs. They have not been run in the Prisa repo.

**Version and size snapshot (2026-10-23)**

| Package | Latest | Published | React peer | Bundlephobia min / gzip |
|---|---|---|---|---|
| `sonner` | 2.0.8 | 2026-08-09 | `^18 \|\| ^19 \|\| ^19.0.0-rc` | 34.1 kB / 9.4 kB |
| `motion` | 14.6.0 | 2026-10-22 | `^18 \|\| ^19` | 169 kB / 57 kB (whole package) |
| `recharts` | 3.10.1 (3.11 in canary) | 2026-07-25 | `^16.8 … ^19` (+ `react-is`) | 562 kB / 150 kB (whole package) |
| `d3-shape` | 3.2.0 | 2022-12-20 | — | 32.8 kB / 5.7 kB |
| `d3-scale` | 4.0.2 | — | — | 47.3 kB / 16.0 kB |
| `d3-interpolate-path` | 2.3.0 | 2022-08-31 | — | 6.1 kB / 2.5 kB |
| `flubber` | 0.4.2 | 2018-03-01 | — | 52.3 kB / 18.1 kB |
| `@visx/shape` | 4.0.0 | 2026-06-11 | `^18 \|\| ^19` | 35.6 kB / 10.7 kB |
| `@nivo/line` | 0.99.0 | 2025-05-23 | `^16.14 … ^19` | 285 kB / 96 kB |
| `@tremor/react` | 3.18.7 | 2025-01-13 | **`^18.0.0` only** | n/a |

Sources: [npm registry: sonner](https://registry.npmjs.org/sonner), [motion](https://registry.npmjs.org/motion), [recharts](https://registry.npmjs.org/recharts), [d3-shape](https://registry.npmjs.org/d3-shape), [d3-interpolate-path](https://registry.npmjs.org/d3-interpolate-path), [flubber](https://registry.npmjs.org/flubber), [@visx/shape](https://registry.npmjs.org/@visx/shape), [@nivo/line](https://registry.npmjs.org/@nivo/line), [@tremor/react](https://registry.npmjs.org/@tremor/react). Sizes: [bundlephobia sonner@2.0.8](https://bundlephobia.com/package/sonner@2.0.8), [motion@14.6.0](https://bundlephobia.com/package/motion@14.6.0), [recharts@3.10.1](https://bundlephobia.com/package/recharts@3.10.1), [d3-shape@3.2.0](https://bundlephobia.com/package/d3-shape@3.2.0), [d3-interpolate-path@2.3.0](https://bundlephobia.com/package/d3-interpolate-path@2.3.0), [flubber@0.4.2](https://bundlephobia.com/package/flubber@0.4.2), [@visx/shape@4.0.0](https://bundlephobia.com/package/@visx/shape@4.0.0), [@nivo/line@0.99.0](https://bundlephobia.com/package/@nivo/line@0.99.0), [d3-scale@4.0.2](https://bundlephobia.com/package/d3-scale@4.0.2).

---

## (A1) Chart options: which libraries do curves, gradient area, a target line and tooltip well, and which handle morphing between different point counts (6 vs 12 months)?

### Takeaway
Two options fit. The first is hand-rolled SVG: `d3-shape` with `curveMonotoneX`, `d3-scale`, and `d3-interpolate-path` for the `d` morph, plus Motion or CSS for the draw-in. It costs about 25 kB gzip before Motion and gives full control over the pill-style tooltip and the morph. The second is **Recharts 3.9+**, which now has a real API for pairing old and new points (`animationMatchBy`, `matchByDataKey`), a built-in line draw-in (`LineDrawShape`), an area reveal (`AreaRevealShape`), and `prefers-reduced-motion` support. It is much heavier (about 150 kB gzip for the whole package, with Redux Toolkit, immer and reselect as dependencies). Motion's native `d` animation only morphs paths with the same commands, so it cannot handle 6→12 points on its own. `d3-interpolate-path` is the right small tool for line and area charts. Flubber (2018, 18 kB gzip) is for arbitrary shapes and is overkill here.

### Cited Findings
- **d3 curves.** `curveMonotoneX` "Produces a cubic spline that preserves monotonicity in y, assuming monotonicity in x". The doc quotes Steffen: it gives a smooth curve that passes through the data points "without spurious oscillations", and local extrema occur only at data points. `curveCatmullRom` takes an `alpha` from 0 to 1 (default 0.5, centripetal), and centripetal splines "are recommended to avoid self-intersections and overshoot." — [d3js.org d3-shape curves](https://d3js.org/d3-shape/curve)
- The d3 docs site header shows D3 7.9.0. `d3-shape` has been at 3.2.0 since December 2022, so it is stable rather than stale. — [d3js.org](https://d3js.org/d3-shape/curve); [npm registry](https://registry.npmjs.org/d3-shape)
- **Motion `d` morphing.** Motion can animate a path's `d` directly, but only "when both paths are similar", meaning the same number and type of path instructions. For very different shapes the docs point to a third-party interpolator such as Flubber. — [motion.dev SVG animation](https://motion.dev/docs/react-svg-animation)
- **d3-interpolate-path.** A zero-dependency interpolator for `d` that "extends both paths so they have the same number of points" and then interpolates linearly. It splits Béziers with De Casteljau's algorithm. API: `interpolatePath(a, b, excludeSegment?)`, `interpolatePathCommands`, `pathCommandsFromString`. `excludeSegment(a, b)` returns `true` for segments that must not be split. The README notes this is most useful with `d3.area`, for example excluding the closing vertical edge (`a.x === b.x && a.x === maxX`). — [GitHub pbeshai/d3-interpolate-path](https://github.com/pbeshai/d3-interpolate-path)
- d3-interpolate-path is at 2.3.0 (published 2022-08-31), 2.5 kB gzip. — [npm](https://registry.npmjs.org/d3-interpolate-path); [bundlephobia](https://bundlephobia.com/package/d3-interpolate-path@2.3.0)
- Flubber is at 0.4.2 (last published 2018-03-01), 18.1 kB gzip. Its dependencies are earcut, svgpath, d3-array, d3-polygon, topojson-client and svg-path-properties. — [npm](https://registry.npmjs.org/flubber); [bundlephobia](https://bundlephobia.com/package/flubber@0.4.2)
- **Recharts 3.9 animation API.** `animationMatchBy` pairs old and new items:
  - `matchByIndex` (default) pairs by array index and stretches proportionally when lengths differ.
  - `matchAppend` pairs 1:1 and animates extra items in.
  - `matchByDataKey(key)` pairs by a payload key.
  - A custom `(item, index) => key` function is also accepted.
  - `animationInterpolateFn(items, t)` receives items tagged `matched`, `added` or `removed` and can crossfade.
  - The guide recommends `type="linear"` for scrolling timelines because spline types like `monotone` "can still wiggle when points are added or removed."
  — [Recharts animations guide](https://recharts.github.io/en-US/guide/animations/)
- **Recharts Line source.**
  - In the default interpolator, `added` points enter from `next.x - averageShift` and `removed` points exit toward `prev.x + shift`.
  - On first render it returns empty and "stroke-dasharray handles the reveal".
  - Defaults: `animationDuration: 1500`, `animationEasing: 'ease'`, `isAnimationActive: 'auto'`, `animationMatchBy: matchByIndex`.
  - `matchByIndex`, `matchByDataKey`, `matchAppend`, `LineDrawShape` and `AreaRevealShape` are all exported from the package root in v3.10.1.
  — [recharts/src/cartesian/Line.tsx](https://github.com/recharts/recharts/blob/main/src/cartesian/Line.tsx); [recharts v3.10.1 src/index.ts](https://github.com/recharts/recharts/blob/v3.10.1/src/index.ts)
- **Recharts sizing.** Charts have a `responsive?: boolean` prop (default `false`). It is "similar to ResponsiveContainer but without the need for an extra wrapper component" and uses standard CSS sizing rules. — [recharts v3.10.1 src/util/types.ts](https://github.com/recharts/recharts/blob/v3.10.1/src/util/types.ts)
- **Recharts releases.**
  - v3.10.1 (25 Jul) is the latest stable.
  - v3.10.0 added Legend `position`/`offset`, XAxis `height="auto"`, and `accessibilityLayer`/`title`/`desc` on Sankey.
  - The 3.11 canaries (Aug–Oct) bring an experimental theming system (`autoTheme`, `pageBackground`) and an ease-out/ease-in-out mapping fix (canary.6).
  — [GitHub recharts releases](https://github.com/recharts/recharts/releases)
- **Recharts dependencies.** clsx, immer, reselect, es-toolkit, react-redux, eventemitter3, tiny-invariant, victory-vendor, @reduxjs/toolkit, decimal.js-light and use-sync-external-store. Whole-package size is 150 kB gzip on bundlephobia. — [npm](https://registry.npmjs.org/recharts); [bundlephobia](https://bundlephobia.com/package/recharts@3.10.1)
- **shadcn/ui charts** "now uses Recharts v3".
  - `ChartContainer` needs a `min-h-*` or `aspect-*` class so the chart can be measured on first render.
  - `ChartConfig` holds `label`, `icon`, `color` and `theme` (light/dark) per series.
  - `ChartTooltipContent` takes `indicator` (`dot`, `line` or `dashed`) and `hideLabel`.
  - Upgrade note: use `var(--chart-1)` rather than `hsl(var(--chart-1))`.
  — [ui.shadcn.com chart](https://ui.shadcn.com/docs/components/chart)
- **visx 4.0.0** (2026-06-11) adds React 19 support and requires React 18 or 19. It removes prop-types and lodash, moves to d3-shape/d3-path v3, fixes Node ESM output, and makes `@types/react` an optional peer. The release notes say nothing about animation or react-spring. — [GitHub airbnb/visx releases](https://github.com/airbnb/visx/releases)
- **Nivo** `@nivo/line` 0.99.0 (2025-05-23) depends on `@react-spring/web` and `d3-shape` and is 96 kB gzip. — [npm](https://registry.npmjs.org/@nivo/line); [bundlephobia](https://bundlephobia.com/package/@nivo/line@0.99.0)
- **Tremor** `@tremor/react` 3.18.7 was last published 2025-01-13. Its peer dependency is `react: ^18.0.0`, which does not include React 19, and it depends on recharts. — [npm](https://registry.npmjs.org/@tremor/react)

### Inferences
- **Recommendation for Prisa (dark dashboard, one hero chart).** Hand-roll it.
  - The design calls for a custom pill tooltip, a dashed target line, a draw-in on mount, and a 6↔12 morph. That is about 150 lines on `d3-shape` + `d3-scale` + `d3-interpolate-path` (about 24 kB gzip, mostly d3-scale; only `scaleLinear` and `scalePoint` are needed, and tree-shaking should cut that).
  - Recharts makes sense if many more charts follow (bars, pies, synced tooltips), or if the team prefers shadcn's `ChartContainer`.
  - Nivo is heavy and spring-based.
  - Tremor's npm package is effectively stale for React 19: its peer range excludes it.
- **Morph strategy for 6→12 months.** The x-scale domain changes, so every existing point moves and 6 new ones appear.
  - `interpolatePath(prevD, nextD)` handles the different point count by splitting segments.
  - For the area, pass `excludeSegment = (a, b) => a.x === b.x` so the vertical closing edges and baseline are not split. Otherwise the fill "melts" at the edges.
  - Use the same curve for both states. Sampling a spline and re-interpolating is still smooth.
  - Interrupting mid-animation works if you read the *current* `d` from the DOM as the `from` value.
- **In Recharts,** use `animationMatchBy={matchByDataKey('mes')}` so January stays January when going from 6 to 12. With the default `matchByIndex` the old 6 points get stretched across 12 slots. Consider `type="linear"` if the monotone wiggle during the transition is visible, though the static design wants a curve, so test first.
- **Hand-rolled chart (client component), TSX sketch:**

```tsx
'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { area, line, curveMonotoneX } from 'd3-shape'
import { scaleLinear, scalePoint } from 'd3-scale'
import { interpolatePath } from 'd3-interpolate-path'
import { animate, useReducedMotion } from 'motion/react'

export type PontoReceita = { mes: string /* 'YYYY-MM' */; receita: number }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
}) // "R$ 48,5 mil", "R$ 1,2 mi"
const mesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }) // "jan."
const rotuloMes = (iso: string) => mesCurto.format(new Date(`${iso}-01T00:00:00Z`)).replace('.', '')

function useElementSize<T extends Element>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { inlineSize: width, blockSize: height } = entry.contentBoxSize[0]
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** Morphs `d` imperatively; React never owns the attribute, so it never fights the tween. */
function useMorphingPath(nextD: string, opts: { area?: boolean; reduce: boolean }) {
  const ref = useRef<SVGPathElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !nextD) return
    const from = el.getAttribute('d') // the current d, even mid-tween
    if (!from || opts.reduce) { el.setAttribute('d', nextD); return }
    const interp = interpolatePath(from, nextD, opts.area ? (a, b) => a.x === b.x : undefined)
    const controls = animate(0, 1, {
      duration: 0.6, ease: [0.22, 1, 0.36, 1],
      onUpdate: (t) => el.setAttribute('d', interp(t)),
    })
    return () => controls.stop()
  }, [nextD, opts.area, opts.reduce])
  return ref
}

export function GraficoReceita({ dados, meta }: { dados: PontoReceita[]; meta: number }) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const height = 220, m = { t: 16, r: 12, b: 28, l: 12 }
  const reduce = useReducedMotion() ?? false
  const gid = useId()
  const [ativo, setAtivo] = useState<number | null>(null)

  const { x, y, dLinha, dArea } = useMemo(() => {
    const x = scalePoint<string>().domain(dados.map(d => d.mes)).range([m.l, Math.max(m.l, width - m.r)])
    const max = Math.max(meta, ...dados.map(d => d.receita)) * 1.1
    const y = scaleLinear().domain([0, max]).range([height - m.b, m.t])
    const gx = (d: PontoReceita) => x(d.mes)!
    const gy = (d: PontoReceita) => y(d.receita)
    return {
      x, y,
      dLinha: width ? line<PontoReceita>().x(gx).y(gy).curve(curveMonotoneX)(dados) ?? '' : '',
      dArea: width ? area<PontoReceita>().x(gx).y0(y(0)).y1(gy).curve(curveMonotoneX)(dados) ?? '' : '',
    }
  }, [dados, meta, width])

  const linhaRef = useMorphingPath(dLinha, { reduce })
  const areaRef = useMorphingPath(dArea, { area: true, reduce })

  function onPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left + m.l
    let best = 0
    dados.forEach((d, i) => { if (Math.abs(x(d.mes)! - px) < Math.abs(x(dados[best].mes)! - px)) best = i })
    setAtivo(best)
  }
  const p = ativo != null ? dados[ativo] : null

  return (
    <figure ref={wrapRef} className="relative w-full">
      <svg
        width={width} height={height} role="img" aria-labelledby={`${gid}-t ${gid}-d`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setAtivo(i => Math.min((i ?? -1) + 1, dados.length - 1))
          if (e.key === 'ArrowLeft') setAtivo(i => Math.max((i ?? dados.length) - 1, 0))
          if (e.key === 'Escape') setAtivo(null)
        }}
      >
        <title id={`${gid}-t`}>Receita mensal</title>
        <desc id={`${gid}-d`}>{`Meta de ${brl.format(meta)}. Último mês: ${brl.format(dados.at(-1)?.receita ?? 0)}.`}</desc>
        <defs>
          <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path ref={areaRef} fill={`url(#${gid}-g)`} className="chart-area-fade" />
        <path ref={linhaRef} fill="none" stroke="var(--accent)" strokeWidth={2.5}
              strokeLinecap="round" pathLength={1} className="chart-line-draw" />
        <line x1={m.l} x2={width - m.r} y1={y(meta)} y2={y(meta)}
              stroke="var(--muted-fg)" strokeDasharray="4 4" strokeWidth={1} />
        {dados.map(d => (
          <text key={d.mes} x={x(d.mes)} y={height - 8} textAnchor="middle" className="fill-[var(--muted-fg)] text-[11px]">
            {rotuloMes(d.mes)}
          </text>
        ))}
        {p && (<>
          <line x1={x(p.mes)} x2={x(p.mes)} y1={m.t} y2={height - m.b} stroke="var(--muted-fg)" strokeOpacity={0.4} />
          <circle cx={x(p.mes)} cy={y(p.receita)} r={4} fill="var(--bg)" stroke="var(--accent)" strokeWidth={2} />
        </>)}
        <rect x={m.l} y={0} width={Math.max(0, width - m.l - m.r)} height={height} fill="transparent"
              onPointerMove={onPointerMove} onPointerLeave={() => setAtivo(null)} />
      </svg>
      {p && (
        <div aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-full bg-neutral-900 px-3 py-1 text-xs text-white"
             style={{ left: x(p.mes), top: y(p.receita) - 10 }}>
          {rotuloMes(p.mes)} · {brl.format(p.receita)}
        </div>
      )}
      {/* accessible fallback: same data as a real table */}
      <table className="sr-only">
        <caption>Receita mensal (meta {brl.format(meta)})</caption>
        <thead><tr><th scope="col">Mês</th><th scope="col">Receita</th></tr></thead>
        <tbody>{dados.map(d => <tr key={d.mes}><td>{rotuloMes(d.mes)}</td><td>{brl.format(d.receita)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
```

```css
/* draw-in on mount, independent from the d-morph (pathLength=1 normalises the dash units) */
.chart-line-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 900ms cubic-bezier(.22,1,.36,1) forwards; }
.chart-area-fade { opacity: 0; animation: fade 600ms 300ms ease-out forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes fade { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .chart-line-draw, .chart-area-fade { animation: none; stroke-dashoffset: 0; opacity: 1; } }
```

- **Recharts equivalent, TSX sketch (Recharts ≥ 3.9):**

```tsx
'use client'
import { Area, AreaChart, ReferenceLine, Tooltip, XAxis, YAxis, matchByDataKey } from 'recharts'

export function GraficoReceitaRecharts({ dados, meta }: { dados: { mes: string; receita: number }[]; meta: number }) {
  return (
    <div className="h-[220px] w-full">
      <AreaChart data={dados} responsive accessibilityLayer style={{ width: '100%', height: '100%' }}
                 margin={{ top: 16, right: 12, bottom: 0, left: 12 }}>
        <defs>
          <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="mes" tickFormatter={rotuloMes} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, (max: number) => Math.max(max, meta) * 1.1]} />
        <ReferenceLine y={meta} stroke="var(--muted-fg)" strokeDasharray="4 4" />
        <Tooltip cursor={{ stroke: 'var(--muted-fg)', strokeOpacity: 0.4 }}
                 formatter={(v: number) => brl.format(v)} labelFormatter={rotuloMes} />
        <Area type="monotone" dataKey="receita" stroke="var(--accent)" strokeWidth={2.5} fill="url(#gReceita)"
              animationDuration={700} animationEasing="ease-out"
              animationMatchBy={matchByDataKey('mes')} />
      </AreaChart>
    </div>
  )
}
```

### Gaps
- I did not verify how visx 4 or Nivo 0.99 handle path transitions with different point counts. Nivo uses react-spring, according to its dependencies. visx ships no animation and relies on Motion or react-spring added by you. No primary source was fetched for either.
- The current state of Tremor (whether the copy-paste "Tremor Raw" components target Recharts v3 or React 19, and its ownership) was not verified. Only the npm metadata is confirmed.
- Bundlephobia measures whole-package entries. I found no real tree-shaken size for an `AreaChart`-only Recharts import, or for d3-scale with only `scaleLinear`/`scalePoint`. Measuring with `next build` and the bundle analyzer in the Prisa repo would settle it.
- `Tooltip formatter` typing in Recharts 3.10 (whether `value` is `number` or `ValueType`) was not checked. A cast may be needed.

---

## (A2) Stroke-drawing animation, accessibility and responsiveness

### Takeaway
Use `pathLength` with dash offset for the line draw-in. The two ways are Motion's `pathLength` 0→1 or the SVG `pathLength={1}` attribute with a CSS `stroke-dashoffset` animation, which is independent of `d` morphing. Gate both on `prefers-reduced-motion`; Recharts' `isAnimationActive="auto"` and Motion's `MotionConfig reducedMotion="user"` both do this. For accessibility, give the SVG `role="img"` with `title`/`desc`, add an `sr-only` table with the data, and offer keyboard stepping. Recharts' `accessibilityLayer` adds keyboard and screen-reader support. For responsiveness, use a `ResizeObserver` on a wrapper (hand-rolled) or Recharts' `responsive` prop.

### Cited Findings
- Motion: `pathLength` is the drawn length as 0–1 progress. `pathSpacing` is the gap and `pathOffset` is where the visible segment starts. They work on `path`, `circle`, `ellipse`, `line`, `polygon`, `polyline` and `rect`. Pattern: `initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}`. Motion can also animate `viewBox`. SVG transforms originate from the element centre unless you set `transformBox: "view-box"`. — [motion.dev SVG animation](https://motion.dev/docs/react-svg-animation)
- Motion reduced motion: `<MotionConfig reducedMotion="user">` turns off transform and layout animations while keeping opacity and colour. `"always"` and `"never"` override the OS setting. `useReducedMotion()` returns a boolean. — [motion.dev accessibility](https://motion.dev/docs/react-accessibility)
- Recharts: with `isAnimationActive` set to `'auto'` (the default for most components), it "respects `prefers-reduced-motion`". Line entrance uses `LineDrawShape` (progressive `strokeDasharray`). Area entrance uses `AreaRevealShape` (a clipPath rect expanding left to right). Passing a custom `shape` skips the built-in entrance. — [Recharts animations guide](https://recharts.github.io/en-US/guide/animations/)
- Recharts Line measures `getTotalLength()` on the path and guards the previous-points ref until the path is measured. — [recharts Line.tsx](https://github.com/recharts/recharts/blob/main/src/cartesian/Line.tsx)
- shadcn/Recharts: `<LineChart accessibilityLayer />` "adds keyboard access and screen reader support". — [ui.shadcn.com chart](https://ui.shadcn.com/docs/components/chart). Recharts 3.10.0 extended `accessibilityLayer`/`title`/`desc` to Sankey, and 3.11 canary.4 adds the polar cursor during Radar keyboard navigation. — [recharts releases](https://github.com/recharts/recharts/releases)
- Recharts `responsive` prop, as cited in A1. — [recharts types.ts v3.10.1](https://github.com/recharts/recharts/blob/v3.10.1/src/util/types.ts)
- visx 4.0 includes `useParentSize` fixes: callback ref, custom ref support (#1995–#1997). — [visx releases](https://github.com/airbnb/visx/releases)
- **pt-BR formatting, checked locally on Node 24.14 ICU.**
  - `Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(1234567.891)` gives `"R$ 1.234.567,89"`.
  - Compact notation gives `"R$ 1,2 mi"` and `"R$ 48,5 mil"`.
  - Short months give `"jan."` and `"mai."`, with a trailing dot.
  - `{month:'long',year:'numeric'}` gives `"março de 2026"`.
  - The space after `R$` is **U+00A0 (no-break space)**, not a normal space.
  - Source: local `node -e` run during this research. No external URL; reproducible.

### Inferences
- If you use Motion for the draw-in *and* morph `d` imperatively, both work at once: `pathLength` dash offsets are normalised, so changing `d` does not break the draw. I have not verified this for Motion specifically. The CSS `pathLength={1}` approach in A1 is guaranteed by SVG semantics and needs no JS.
- Hide the HTML tooltip from assistive tech (`aria-hidden`) and give an `aria-live="polite"` sr-only region the active point's text when keyboard-stepping. Or rely on the sr-only table only, which is simpler.
- Unit tests that compare formatted BRL strings must use ` ` (or normalise with `.replace(/ /g, ' ')`). This is a common source of failing snapshots.
- When `width` is 0 (first client render), skip rendering paths. This avoids a draw-in from a collapsed path. Use `aspect-*` or a fixed height on the wrapper so the layout does not shift.

### Gaps
- I did not find a primary source (MDN) fetched in this session for the SVG `pathLength` attribute semantics. This is standard SVG 2 behaviour, but cite MDN when writing the report.
- Whether Motion's `pathLength` sets the element's `pathLength` attribute to 1 internally was not confirmed from docs.

---

## (A3) Server Components: what the chart's client boundary needs and how to pass data

### Takeaway
The chart must be a `'use client'` leaf because it uses `useState`, `ResizeObserver`, pointer events and Motion. Fetch and aggregate revenue in the Server Component (page) and pass a **small serialisable array** (`{ mes: 'YYYY-MM', receita: number }[]`) as props. The 6/12-month toggle can be client state over a 12-month array, so switching is instant and morphs without a round-trip. Alternatively, stream a promise and read it with `use()`.

### Cited Findings
- Next docs (lastUpdated 2026-10-05):
  - Use Client Components for state, event handlers, lifecycle, browser APIs and custom hooks.
  - `"use client"` declares a boundary, and "all of its imports and the components it directly renders are included in the client bundle".
  - Put `'use client'` on interactive leaves to reduce JS.
  - "Props passed to Client Components need to be serializable by React."
  - You can stream data with the `use` API.
  - Wrap third-party client-only components in your own `'use client'` file.
  - Use the `server-only` package to keep server code out of client bundles.
  — [nextjs.org Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### Inferences
- Pattern:

```tsx
// app/(app)/inicio/page.tsx  (Server Component)
import { GraficoReceita } from './grafico-receita' // 'use client' inside
import { receitaUltimos12Meses } from '@/lib/receita' // import 'server-only'

export default async function Page() {
  const dados = await receitaUltimos12Meses() // [{ mes: '2025-11', receita: 48500 }, ...]
  return <PainelReceita dados={dados} meta={60000} />
}

// painel-receita.tsx
'use client'
export function PainelReceita({ dados, meta }: { dados: PontoReceita[]; meta: number }) {
  const [periodo, setPeriodo] = useState<6 | 12>(6)
  const visiveis = periodo === 6 ? dados.slice(-6) : dados
  return (<>
    <SegmentedControl value={periodo} onChange={setPeriodo} options={[{ value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }]} />
    <GraficoReceita dados={visiveis} meta={meta} />
  </>)
}
```
- Send numbers as plain `number` (BRL as reais or centavos) and months as ISO strings. Do not send `Date` objects or `Decimal` instances. Format with `Intl` on the client, or in the RSC if the output is just text.

### Gaps
- None material. Next 16-specific caching directives (`'use cache'`, `cacheLife`) for the revenue query were outside scope and not researched.

---

## (B1) Toast: Sonner vs a Motion + AnimatePresence toast for a dark bottom-centre pill with an Undo action

### Takeaway
**Sonner 2.0.8** (Aug 2026) supports React 19 (peer `^18 || ^19`) and is about 9.4 kB gzip. It has `position="bottom-center"`, an `action` with `{ label, onClick }` (call `preventDefault()` to keep the toast open), `unstyled` with `classNames` for Tailwind, `toast.custom(jsx)` for headless JSX, and swipe-to-dismiss. It also has a built-in `aria-live="polite"` region and a hotkey (Alt+T). Its stacking animation is CSS-based, not a spring. If the spring entrance is non-negotiable and only one toast at a time is needed, a ~40-line Motion `AnimatePresence` pill is reasonable, since Motion is already in the bundle. You then own the aria-live region, timers, focus and pause-on-hover yourself.

### Cited Findings
- `sonner` 2.0.8 was published 2026-08-09. Peers: `react`/`react-dom` `^18.0.0 || ^19.0.0 || ^19.0.0-rc`. No runtime dependencies. 34.1 kB min / 9.4 kB gzip. — [npm](https://registry.npmjs.org/sonner); [bundlephobia](https://bundlephobia.com/package/sonner@2.0.8)
- **Release notes.**
  - 2.0.8: custom aria labels, keeps the toaster on top when a react-aria modal is open, dismissing custom toasts fixed, close-button colours as CSS variables.
  - 2.0.7: multiple `<Toaster />` with ids, plus `testId`.
  - 2.0.4: removed the "lift" interaction; custom toasts react to height changes.
  - 2.0.0 (18 Feb, year not shown, presumably 2025): mostly bug fixes. The beta removed deprecated props and added drag damping.
  — [GitHub sonner releases](https://github.com/emilkowalski/sonner/releases)
- **Docs domain.** The official docs live at `sonner.emilkowal.ski`. The URL `sonner.emilkowalski.com` suggested in the brief does not resolve (DNS ENOTFOUND). — [sonner.emilkowal.ski/toast](https://sonner.emilkowal.ski/toast)
- **`toast()` options:** `description`, `closeButton`, `invert`, `duration` (default 4000), `position`, `dismissible`, `icon`, `action`, `cancel`, `id`, `testId`, `toasterId`, `onDismiss`, `onAutoClose`, `containerAriaLabel` (default "Notifications"), `actionButtonStyle`, `cancelButtonStyle`.
  - Action "renders a primary button. Clicking it closes the toast and runs the `onClick` callback". Calling `event.preventDefault()` keeps the toast open.
  - Custom: JSX as the first argument with default styling.
  - Headless: an unstyled toast with a render function that receives the toast.
  — [sonner.emilkowal.ski/toast](https://sonner.emilkowal.ski/toast)
- **Types (source):** `interface Action { label: React.ReactNode; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; actionButtonStyle?: React.CSSProperties }`. `ToastClassnames` includes `actionButton`. `unstyled?: boolean` and `classNames?: ToastClassnames` are available on toast and on `toastOptions`. — [sonner src/types.ts](https://github.com/emilkowalski/sonner/blob/main/src/types.ts)
- **`<Toaster>` props:**
  - `position` (default `bottom-right`, `bottom-center` available), `expand` (false: expands on hover), `visibleToasts` (3), `gap` (14), `offset` (32px), `mobileOffset` (16px under 600px).
  - `theme` (light; can bind to next-themes), `richColors`, `closeButton`, `hotkey` (⌥/Alt+T), `dir`, `swipeDirections`, `invert`, `id`, `icons`.
  — [sonner.emilkowal.ski/toaster](https://sonner.emilkowal.ski/toaster)
- **Styling.** `classNames` overrides need `!important` (Tailwind `!` prefix). `unstyled: true` removes all default styles so classes apply without `!important`. The docs call the headless approach recommended for full control and suggest wrapping `toast()` in your own helper. — [sonner.emilkowal.ski/styling](https://sonner.emilkowal.ski/styling)
- **Accessibility (source).** The container `<section>` has `aria-label={customAriaLabel ?? \`${containerAriaLabel} ${hotkeyLabel}\`}`, `aria-live="polite"`, `aria-relevant="additions text"`, `aria-atomic="false"` and `data-react-aria-top-layer`. Constants: `VISIBLE_TOASTS_AMOUNT = 3`, `TOAST_WIDTH = 356`, `GAP = 14`, `TIME_BEFORE_UNMOUNT = 200`. Toasts get `data-styled={!(toast.jsx || toast.unstyled || unstyled)}` and `data-y-position`. — [sonner src/index.tsx](https://github.com/emilkowalski/sonner/blob/main/src/index.tsx)
- **Motion sizes.**
  - The `motion` component is 43 kB gzip and cannot be tree-shaken smaller.
  - `m` + `LazyMotion` is about 5 kB initially, plus 24 kB for `domAnimation` (animations, variants, exit, tap/hover/focus) or 38 kB for `domMax` (adds drag and layout).
  - `useAnimate` mini is 3.3 kB and hybrid is 23 kB.
  - `m` is imported from `"motion/react-m"`. Webpack tree-shakes less well than Rollup.
  — [motion.dev reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size)
- `motion` 14.6.0 was published 2026-10-22, with peers React `^18 || ^19`. The package re-exports `framer-motion`. Bundlephobia whole-package size is 57 kB gzip. — [npm](https://registry.npmjs.org/motion); [bundlephobia](https://bundlephobia.com/package/motion@14.6.0)

### Inferences
- **Sonner, Prisa-styled (recommended).** Use one `<Toaster>` in the app layout (it is a client component, so render it inside a client provider or directly; Sonner ships `'use client'`-compatible code, but that is unverified here):

```tsx
// app/(app)/toaster.tsx
'use client'
import { Toaster } from 'sonner'
export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      offset={24}
      mobileOffset={16}
      visibleToasts={3}
      gap={8}
      containerAriaLabel="Notificações"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex items-center gap-3 rounded-full bg-neutral-900/95 px-4 py-2.5 text-sm text-white shadow-lg ring-1 ring-white/10 backdrop-blur',
          title: 'font-medium',
          icon: 'text-emerald-400',
          actionButton: 'ml-1 rounded-full px-2.5 py-1 font-semibold text-[var(--accent)] hover:bg-white/10 focus-visible:outline-2',
        },
      }}
    />
  )
}

// usage
import { toast } from 'sonner'
toast.success('Viagem movida para Em trânsito', {
  id: `mover-${viagemId}`,           // de-dupes rapid repeats
  duration: 6000,
  action: { label: 'Desfazer', onClick: () => desfazer() },
})
```
- **Check before relying on it:** whether `icon` is a valid `ToastClassnames` key in 2.0.8. The grep showed `actionButton` but not the full key list.
- Sonner's enter animation is CSS (translate plus opacity). To get a *spring* feel, override the transition on `[data-sonner-toast]` with a `linear()` spring easing in CSS, or use `toast.custom()` with a `motion.div` inside. The outer slot still uses Sonner's CSS transform, so the two could double-animate. Test before committing.
- **Motion-only pill**, if exactly one toast is shown at a time (a new one replaces the old). Give the live region a stable container so screen readers announce changes:

```tsx
'use client'
import { AnimatePresence, motion } from 'motion/react'

export function ToastPill({ toast, onUndo }: { toast: { id: string; texto: string } | null; onUndo: () => void }) {
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: 48, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span aria-hidden>✓</span>
            <span>{toast.texto}</span>
            <span aria-hidden className="text-white/30">·</span>
            <button onClick={onUndo} className="font-semibold text-[var(--accent)]">Desfazer</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```
- **Trade-offs.**
  - Sonner gives stacking, expand-on-hover, pause on hover and when the page is hidden (constants suggest this, but it was not confirmed in this research), swipe, a hotkey, multiple toasters and an aria-live region for about 9 kB.
  - The Motion pill gives a true spring and pixel-perfect control at roughly 0 extra kB, since Motion is already loaded. You must implement the timer, hover pause, Esc, focus management for the Undo button, and stacking.
  - For a logistics ops board where several moves can happen quickly, Sonner's stacking is the safer default.

### Gaps
- `pauseWhenPageIsHidden` and pause-on-hover were not confirmed in the 2.0.8 source (my grep did not match).
- I did not confirm whether `sonner`'s published entry has a `'use client'` banner. If it does not, importing `<Toaster>` into a Server Component layout would fail, and a wrapper file is needed (as in the snippet).
- Exact Sonner enter/exit CSS durations and easing were not extracted.

---

## (B2) Undo pattern with server actions: delay the commit, or run a compensating action?

### Takeaway
For a reversible status move ("Viagem movida para Em trânsito"), **commit immediately and undo with a compensating server action**, shown optimistically with `useOptimistic`. This works when the move has no external side effects and the status history allows "back to previous status". If the move triggers external effects (notifying the driver or client, WhatsApp, fiscal events), **delay the commit** for the toast window (5–8 s) and cancel on Undo, flushing on `pagehide`. Search found no authoritative primary source comparing the two. The guidance below is synthesised from lower-quality blog and aggregator content plus the React docs.

### Cited Findings
- `useOptimistic(value, reducer?)`:
  - Returns `[optimisticState, setOptimistic]`. The optimistic value only shows while an Action is pending.
  - On success, `value` and the optimistic state converge in the same render.
  - If the Action throws, the UI reverts to `value`.
  - The setter must be called inside `startTransition` or an Action prop. Otherwise React warns and the value flashes and reverts.
  — [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic)
- **Delay-commit:** hide the item, show an Undo toast, and call the API only when the timer expires, so Undo just cancels and there is nothing to reverse on the server. **Compensating action:** call the server immediately and have Undo send the inverse; this is required once the effect has left your system ("a payment cannot be unsent; a refund can be issued"). Both claims come from search-result summaries of blog content; the sources are low authority. — [tianpan.co "The Agent Undo Button Is a Saga"](https://tianpan.co/blog/2026-04-27-agent-undo-saga-multi-tool-rollback); [dev.to stacknotice useOptimistic patterns 2026](https://dev.to/stacknotice/react-useoptimistic-optimistic-ui-patterns-that-actually-work-2026-5460); [gooey-toast undo toasts docs](https://www.mintlify.com/a89s/gooey-toast/features/undo-toasts)
- Argument for pessimistic UI on destructive or cascading actions — [dev.to 137foundry](https://dev.to/137foundry/why-pessimistic-ui-is-still-the-right-call-for-destructive-actions-447j)
- Sonner's default duration is 4000 ms — [sonner.emilkowal.ski/toast](https://sonner.emilkowal.ski/toast). An undo window of "6–10 seconds" was mentioned in the search summary without a primary source (Material snackbar guidance was not fetched).

### Inferences
- **Compensating action** (fits a kanban board where the server is the source of truth and realtime updates other viewers):

```tsx
// actions.ts
'use server'
export async function moverViagem(id: string, para: StatusViagem, de: StatusViagem) {
  // UPDATE ... SET status = para WHERE id = $1 AND status = de   (guard against concurrent change)
  // return { ok: true, movimentoId }  → stored in the status history
}
export async function desfazerMovimento(movimentoId: string) {
  // re-applies the previous status only if the trip is still in the status set by that movement
}

// quadro-cliente.tsx
'use client'
const [viagensOtimistas, aplicar] = useOptimistic(viagens, (s, m: { id: string; para: StatusViagem }) =>
  s.map(v => (v.id === m.id ? { ...v, status: m.para } : v)))

function mover(v: Viagem, para: StatusViagem) {
  startTransition(async () => {
    aplicar({ id: v.id, para })
    const r = await moverViagem(v.id, para, v.status)
    if (!r.ok) { toast.error('Não foi possível mover a viagem'); return }
    toast.success(`Viagem movida para ${rotuloStatus[para]}`, {
      id: `mover-${v.id}`, duration: 6000,
      action: { label: 'Desfazer', onClick: () => startTransition(async () => {
        aplicar({ id: v.id, para: v.status })
        await desfazerMovimento(r.movimentoId)
      }) },
    })
  })
}
```
- **Delay-commit variant:**
  - Keep a `Map<id, timeoutId>`.
  - On move: optimistic local state only, then `setTimeout(commit, 6000)`.
  - The Undo `onClick` calls `clearTimeout` and restores local state.
  - Use Sonner's `onAutoClose`/`onDismiss` to commit early.
  - Flush pending commits on `visibilitychange`/`pagehide`, for example with `navigator.sendBeacon` to a route handler, because a server action cannot be guaranteed to finish during unload.
  - Downside: other operators watching the realtime board do not see the move for 6 s, and it is lost if the tab crashes.
- Because `useOptimistic` state only holds while a transition is pending, the delay-commit variant cannot rely on it for the 6 s wait. Use plain `useState` or a local overlay for that window.
- **Guard compensations** with "only if still in the state I set" (compare-and-set). This keeps an Undo from overwriting a later move made by another operator.

### Gaps
- No primary or authoritative UX source (Material Design, Apple HIG, NN/g) was fetched for the recommended undo window or for the delay-vs-compensate trade-off. Treat the 5–8 s window as convention, not a cited standard.
- Prisa's actual status-history model (whether a "movimento" table exists) was not checked in the repo.

---

## (C) Small widgets: animated donut/ring progress (stroke-dasharray) and a segmented control with a sliding background

### Takeaway
**Ring:** a `<circle>` with `pathLength={1}` (or Motion `pathLength` 0→1), rotated −90° so it starts at 12 o'clock, with a `strokeDasharray`/`strokeDashoffset` tween. No circumference math is needed when `pathLength` is normalised. **Segmented control:** a `role="radiogroup"` (or tablist) where the active option renders a `motion.span` with a shared `layoutId`. Motion animates the pill between options. Layout animations need the full `motion` component or `LazyMotion` with `domMax`, not `domAnimation`.

### Cited Findings
- Motion `pathLength`/`pathOffset`/`pathSpacing` work on `circle`, `path`, `rect` and others, as values from 0 to 1. Motion makes SVG transforms originate from the element centre (so `rotate: -90` on a circle rotates around its centre). Use `transformBox: "view-box"` to restore SVG default behaviour. — [motion.dev SVG animation](https://motion.dev/docs/react-svg-animation)
- `layoutId`: when a new element with a matching `layoutId` mounts, it animates from the old element's position. The tab underline example is `{isSelected && <motion.div layoutId="underline" />}`. Use `LayoutGroup` when components that don't re-render together must coordinate layout. The `transition` on the destination element controls the motion. — [motion.dev layout animations](https://motion.dev/docs/react-layout-animations)
- `domMax` (+38 kB) is the LazyMotion feature package that includes layout animations. `domAnimation` (+24 kB) does not. — [motion.dev reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size)
- `MotionConfig reducedMotion="user"` disables transform and layout animations, so the sliding pill jumps instantly under reduced motion. — [motion.dev accessibility](https://motion.dev/docs/react-accessibility)
- `Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:0}).format(0.72)` gives `"72%"` (local Node 24.14 check, no URL).

### Inferences
- **Ring progress:**

```tsx
'use client'
import { motion } from 'motion/react'
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

export function AnelProgresso({ valor, rotulo, size = 72, stroke = 8 }: { valor: number /* 0..1 */; rotulo: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const v = Math.min(1, Math.max(0, valor))
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={rotulo}
         className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
          style={{ rotate: -90 }}                 /* starts at 12 o'clock; Motion rotates around centre */
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums">{pct.format(v)}</span>
    </div>
  )
}
```
  - The CSS-only alternative is `<circle pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 1 - v, transition: 'stroke-dashoffset 700ms cubic-bezier(.22,1,.36,1)' }} transform={`rotate(-90 ${c} ${c})`} />`. It works in a Server Component with no JS, but you lose the mount animation unless you add a keyframe.
  - With `strokeLinecap="round"`, a value of 0 still shows a dot. Hide the progress circle when `v === 0`.
  - Use `role="meter"` for a static KPI and `progressbar` for task progress.
- **Segmented control (6 meses / 12 meses):**

```tsx
'use client'
import { useId } from 'react'
import { motion } from 'motion/react'

type Opcao<T> = { value: T; label: string }
export function SegmentedControl<T extends string | number>({ value, onChange, options, label = 'Período' }:
  { value: T; onChange: (v: T) => void; options: Opcao<T>[]; label?: string }) {
  const layoutId = useId() // unique per instance, so two controls on a page don't share a pill
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10"
         onKeyDown={(e) => {
           const i = options.findIndex(o => o.value === value)
           if (e.key === 'ArrowRight') onChange(options[(i + 1) % options.length].value)
           if (e.key === 'ArrowLeft') onChange(options[(i - 1 + options.length) % options.length].value)
         }}>
      {options.map(o => {
        const ativo = o.value === value
        return (
          <button key={String(o.value)} role="radio" aria-checked={ativo} tabIndex={ativo ? 0 : -1}
                  onClick={() => onChange(o.value)}
                  className={`relative rounded-full px-3 py-1.5 text-sm transition-colors ${ativo ? 'text-neutral-950' : 'text-white/70 hover:text-white'}`}>
            {ativo && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-white"
                           transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
```
  - With `LazyMotion` + `m`, this needs `features={domMax}`.
  - When the control causes neighbouring layout changes (for example the chart height), wrap the related parts in `<LayoutGroup>`.
  - Moving focus with the arrow keys requires a ref and `.focus()` on the newly checked radio. That is omitted for brevity.

### Gaps
- I did not verify whether Motion's `pathLength` animation accepts values below 1 as a target on `circle` when combined with `strokeLinecap="round"` without artefacts. This is common practice but was not documented in the fetched page.
- No measurement was taken of the performance cost of `layoutId` on a dense board with many instances. This is irrelevant for one or two controls.
