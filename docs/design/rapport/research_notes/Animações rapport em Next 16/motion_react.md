# Motion (`motion/react`) for dashboard animations in Next.js 16 App Router + React 19.2 + Tailwind v4

Research date: 2026-10-23. Project context checked: `web/package.json` pins `next@16.4.2`, `react@19.2.4`, `react-dom@19.2.4`, `tailwindcss@^4`. Motion is **not installed yet** (no `motion` or `framer-motion` entry).

## 1. Current version, compatibility with React 19.2 / Next 16, "use client", React Compiler and Strict Mode

### Takeaway
The current release is `motion@14.6.0` (20 Oct 2026). Its peer range is React `^18 || ^19`, and the React API had no breaking changes from v12 to v14. Every `motion.*` component and hook runs on the client only. Use a `"use client"` file, or import `motion/react-client` from a Server Component. The React Compiler has known bad interactions with layout animations and with Suspense replays. The Suspense case was fixed in 13.4.3. The layout case still needs `layoutDependency` or `"use no memo"`.

### Cited Findings
- The latest npm version is **14.6.0**. Its peerDependencies are `react: ^18.0.0 || ^19.0.0` and `react-dom: ^18.0.0 || ^19.0.0` (both optional). Dependencies are `tslib ^2.4.0` and `framer-motion: 14.6.0`. `motion` is a thin wrapper that re-exports the pinned `framer-motion`. — [npm registry motion/latest](https://registry.npmjs.org/motion/latest)
- Recent releases: 14.6.0 (20 Oct 2026) "Fixes `layoutId` jumping and shared-layout double-applying `scale`/`x`/`y`". 14.5.0 adds `scopeMotion`/`useScopeMotion` and fixes AnimatePresence + `Activity` animation timing. 14.3.1 makes AnimatePresence fire `onExitComplete` after exiting children unmount, fixes `popLayout` for children that don't accept `ref`, and fixes layout animations when `layout` is enabled after mount. 14.3.0 adds `stagger` `grid` and `from: "edges" | "random"`. 14.2.0 adds hardware-accelerated independent transforms (`x`, `y`, `scaleX`…). 14.0.0 (2 Oct 2026) is a major release that only removes internal APIs. — [Motion changelog](https://motion.dev/changelog)
- 13.x highlights: 13.1.1 (18 Aug 2026) "Improved compat with React 19 strict mode" (AnimatePresence). 13.3.0 cuts `useSpring` retargeting time by 80%. 13.4.0 adds `AnimateView` (React `ViewTransition`). 13.4.3 makes animations replay when `Suspense` reveals memoized content. 13.4.6 fixes `mode="wait"` dropping new children when an exit completes during a React transition. 13.5.0 makes `<m>` 20% smaller and strips warning messages from production builds. — [Motion changelog](https://motion.dev/changelog)
- Upgrade guide: v11→v12 (rename) means "swap imports from `"framer-motion"` to `"motion/react"`", and "There are no breaking changes in Motion for React in version 12". In v12→v13, `@emotion/is-prop-valid` is no longer an optional dependency (affects styled-components/Emotion users only). The guide says "There are no breaking changes in Motion for React in version 14." — [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide)
- "Motion is only compatible with React versions `18.2` and higher." For the App Router, either add `"use client"` to the importing file, or "replace the import with `import * as motion from "motion/react-client"`" to reduce client JS. — [Motion installation](https://motion.dev/docs/react-installation)
- **React Compiler + layout animations** ([issue #3416](https://github.com/motiondivision/motion/issues/3416), Nov 2025, closed). The compiler memoizes the element that renders `motion.*`, so the element doesn't re-render and layout animations don't fire. Adding `"use no memo"` fixes it. Matt Perry (maintainer) suggests "passing the items through as the `layoutDependency` prop. This is also good for performance". A commenter asked for this to be documented.
- **React Compiler + Suspense** ([issue #3832](https://github.com/motiondivision/motion/issues/3832), closed 24 Sep 2026). With the compiler, animations interrupted by Suspense did not replay on remount, because the stable `motion.div` reference skipped re-render. This lines up with the 13.4.3 fix "Animations replay when `Suspense` reveals memoized content" ([changelog](https://motion.dev/changelog)).
- **Next 16 + Windows dev server** ([issue #3741](https://github.com/motiondivision/motion/issues/3741), closed 11 Jun 2026). `motion@12.40.0` made the Next.js 16.2.6 Turbopack dev server run out of memory on Windows (React 19.2.4). Switching to `framer-motion` worked around it. The issue was closed without a public comment explaining the fix.
- [Issue #3565](https://github.com/motiondivision/motion/issues/3565) (Feb 2026, closed) reported intermittent "all animations stuck at initial" in Next 16. A temporary fix was deleting `node_modules`, the npm cache and `.next`. This points to stale or duplicated bundles, not to an API bug.

### Inferences
- `motion@14.6.0` fits React 19.2.4 + Next 16.4.2. Pin `^14.6` to pick up the 13.x Strict Mode, Suspense and AnimatePresence fixes and the 14.6 `layoutId` fixes.
- Since `motion` depends on an exact `framer-motion` version, install **only** `motion`. Don't add `framer-motion` alongside it, to avoid two copies and broken shared contexts (`LayoutGroup`, `MotionConfig`).
- This dev machine is Windows, so watch for #3741-style Turbopack memory blowups after install. The issue is closed, but no fix version is stated.
- Practical rule for this repo: put every animated piece in a small leaf client component (`"use client"`). Keep pages and layouts as Server Components. Use `motion/react-client` only for trivial one-off server-rendered entrance animations.
- If the React Compiler is (or will be) enabled: on any `layout` element whose position depends on props or data, set `layoutDependency={items}` (or a version key). Add `"use no memo"` only as a last resort.

### Gaps
- No official Motion page names React Compiler support or lists compiler caveats. The guidance comes only from GitHub issues.
- No official Next.js 16 compatibility statement from Motion was found. Compatibility is inferred from peer ranges plus issue reports.

---

## 2. Shared layout animation: `layoutId` + `LayoutGroup` (nav pill / segmented control, card→modal)

### Takeaway
A sliding pill is one `motion.span` with a fixed `layoutId`, rendered only inside the active item. Wrap each control instance in `<LayoutGroup id>`, because `layoutId` is global. For card→modal, put the same `layoutId` on the card container and on the modal container. Wrap the modal in `AnimatePresence`. Set `borderRadius` through `style` so Motion's scale correction applies. Give children `layout` (or `layout="position"` for text) so they aren't stretched.

### Cited Findings
- `layout` animates any layout change caused by a React render. Layout changes must come from `style`/`className`, not `animate`/`whileHover`. `layout="position"` is suggested for elements that change aspect ratio, "like images or text". — [Motion layout animations](https://motion.dev/docs/react-layout-animations)
- `layoutId`: a newly mounted component with the same `layoutId` animates out from the old one. If both are mounted, they crossfade. Wrap exiting elements in `AnimatePresence`: `<AnimatePresence>{isOpen && <motion.div layoutId="modal" />}</AnimatePresence>`. In a shared transition, the transition of the element being animated **to** is used. — [Motion layout animations](https://motion.dev/docs/react-layout-animations)
- Scale correction: "Border radius and box shadow are corrected automatically, but must be set via `style`, `animate`, or another animation prop", for example `<motion.div layout style={{ borderRadius: 20 }} />`. To fix distorted children, "give them the `layout` prop too". — [Motion layout animations](https://motion.dev/docs/react-layout-animations)
- Other props: `layoutScroll` (scroll containers), `layoutRoot` (`position: fixed` containers), and `layoutAnchor={{ x: 0.5, y: 0.5 }}`. You can set a layout-only transition with `transition={{ layout: { duration: 0.3 } }}`, or an arc path with `transition={{ layout: { path: arc() } }}`. — [Motion layout animations](https://motion.dev/docs/react-layout-animations)
- Troubleshooting: no layout animation if the element is `display: inline`. Layout animations are blocked during horizontal window resize. SVG components aren't supported. Fix scrollbar-induced jumps with `scrollbar-gutter: stable`. Borders stretch, so replace `border` with padding on a parent `layout` wrapper. — [Motion layout animations](https://motion.dev/docs/react-layout-animations)
- `LayoutGroup id` namespaces `layoutId`: "`layoutId` is global across your site". Example underline: `{isSelected ? <motion.div layoutId="underline" /> : null}`. — [Motion LayoutGroup](https://motion.dev/docs/react-layout-group)
- 14.6.0 fixed "`layoutId` jumping and shared-layout double-applying `scale`/`x`/`y`". 14.3.1 fixed layout animations when `layout` is enabled after mount. 14.1.0 allows layout animations inside dragged elements. — [Motion changelog](https://motion.dev/changelog)
- Layout animations need the `domMax` feature bundle when using `LazyMotion` (see section 8). — [Motion reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size)

### Code (a) — segmented control / nav pill

```tsx
"use client"
import { useId } from "react"
import { LayoutGroup, motion } from "motion/react"

type Opt<T extends string> = { value: T; label: string }

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: Opt<T>[]; value: T; onChange: (v: T) => void }) {
  const groupId = useId() // namespaces layoutId per instance
  return (
    <LayoutGroup id={groupId}>
      <div role="tablist" className="inline-flex rounded-full bg-zinc-100 p-1">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className="relative px-3 py-1.5 text-sm font-medium"
            >
              {active && (
                <motion.span
                  layoutId="pill"
                  className="absolute inset-0 bg-white shadow-sm"
                  style={{ borderRadius: 9999 }} // via style => scale-corrected
                  transition={{ type: "spring", visualDuration: 0.3, bounce: 0.15 }}
                />
              )}
              <span className="relative z-10">{o.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
```

### Code (b) — card in grid → modal → back

```tsx
"use client"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

type Card = { id: string; title: string; subtitle: string }

export function CardGrid({ cards }: { cards: Card[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = cards.find((c) => c.id === openId)

  return (
    <>
      <ul className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <motion.li
            key={c.id}
            layoutId={`card-${c.id}`}
            onClick={() => setOpenId(c.id)}
            className="cursor-pointer bg-white p-4"
            style={{ borderRadius: 16 }}
          >
            {/* text: layout="position" + shared layoutId => moves, not stretched */}
            <motion.h3 layoutId={`title-${c.id}`} layout="position" className="font-semibold">
              {c.title}
            </motion.h3>
            <motion.p layoutId={`sub-${c.id}`} layout="position" className="text-sm text-zinc-500">
              {c.subtitle}
            </motion.p>
          </motion.li>
        ))}
      </ul>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenId(null)}
            />
            <div className="pointer-events-none fixed inset-0 grid place-items-center">
              <motion.div
                layoutId={`card-${open.id}`}
                layoutRoot /* fixed container */
                role="dialog"
                aria-modal="true"
                className="pointer-events-auto w-[min(640px,92vw)] bg-white p-6"
                style={{ borderRadius: 24 }}
                transition={{ type: "spring", visualDuration: 0.35, bounce: 0.1 }}
              >
                <motion.h3 layoutId={`title-${open.id}`} layout="position" className="text-xl font-semibold">
                  {open.title}
                </motion.h3>
                <motion.p layoutId={`sub-${open.id}`} layout="position" className="text-zinc-500">
                  {open.subtitle}
                </motion.p>
                {/* modal-only content: fade in, don't layout-animate */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                  …detalhes…
                </motion.div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

### Inferences
- When the modal opens, the grid card is still mounted with the same `layoutId`, so per the docs the two **crossfade**. Most implementations instead hide or unmount the grid card while it is open (e.g. `{openId !== c.id && <motion.li …/>}`, or `style={{ opacity: openId === c.id ? 0 : 1 }}`). This makes it a pure "move" rather than a crossfade. Test both and pick one.
- Text distortion strategy, from cheapest to most robust: (1) `layout="position"` on text nodes, so only translation is animated and size snaps. (2) Shared `layoutId` on the title/subtitle so they travel independently of the stretching container. (3) Content that exists only in the modal fades in after the layout transition with a delay, not via `layout`.
- If the card's `border` stretches, use the padding-wrapper trick from the docs, or a `box-shadow`/`outline` ring, which is scale-corrected when set via `style`.
- Use Tailwind `rounded-*` classes only for elements that are **not** layout-animated. For `layout`/`layoutId` elements, set `borderRadius` through `style` so correction applies.
- For accessibility, the modal needs focus trap, Esc to close and `aria-modal`. Motion provides none of these. Consider pairing with Radix Dialog (render `motion.div` via `asChild` + `forceMount` inside `AnimatePresence`), a common pattern but not verified here.

### Gaps
- The official layout page does not document `layout="size"` / `"preserve-aspect"` or `layoutDependency` (both exist in the types/issues). Treat their behavior as unverified here.
- I did not fetch Emil Kowalski / Josh Comeau / Maxime Heckel posts. The patterns above come from the Motion docs plus standard practice.

---

## 3. Animating the expanded card's background-color (yellow→green) and a stage progress bar

### Takeaway
Motion animates colors between hex/rgba/hsla and also **oklch/oklab/color-mix**, which Tailwind v4 uses by default. It can also target a CSS variable (`animate={{ backgroundColor: "var(--x)" }}`). Animating `background-color` triggers paint, but it is cheap. For a progress bar, animate `scaleX` (compositor) instead of `width`.

### Cited Findings
- "Colors can be freely animated between hex, RGBA and HSLA types". oklch, oklab and color-mix are listed as supported. You can target a CSS variable with `<motion.li animate={{ backgroundColor: "var(--action-bg)" }} />`. Values only animate between the same type. — [Motion React animation](https://motion.dev/docs/react-animation)
- Per-value transitions: `transition: { default: { type: "spring" }, opacity: { ease: "linear" } }`. Spring options are `visualDuration` (overrides `duration`), `bounce` (default 0.25), `stiffness`, and `damping`. 13.5.0 allows negative `bounce` (0 to -1) for overdamped springs. — [Motion transitions](https://motion.dev/docs/react-transitions); [changelog](https://motion.dev/changelog)
- "Changing values like `background-color` and `color` will trigger paint". It is still "cheap compared to animating `mask-image` or `background-image` gradient". `transform`/`opacity` can run entirely on the compositor if the element is its own layer. — [Motion performance tier list (5 Nov 2025)](https://motion.dev/blog/web-animation-performance-tier-list)
- 14.2.0 adds hardware-accelerated independent transforms (`x`, `y`, `scaleX`, …). — [changelog](https://motion.dev/changelog)

### Code

```tsx
"use client"
import { motion } from "motion/react"

type Status = "pendente" | "em_rota" | "entregue"
const BG: Record<Status, string> = {
  pendente: "var(--color-amber-100)",   // Tailwind v4 theme vars are oklch
  em_rota:  "var(--color-sky-100)",
  entregue: "var(--color-emerald-100)",
}

export function StatusCard({ status, stage, total }: { status: Status; stage: number; total: number }) {
  return (
    <motion.div
      layout
      animate={{ backgroundColor: BG[status] }}
      transition={{ backgroundColor: { duration: 0.4, ease: "easeOut" }, layout: { type: "spring", visualDuration: 0.3 } }}
      style={{ borderRadius: 16 }}
      className="p-4"
    >
      {/* Progress bar: animate scaleX, not width */}
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <motion.div
          className="h-full origin-left bg-emerald-500"
          initial={false}
          animate={{ scaleX: stage / total }}
          transition={{ type: "spring", visualDuration: 0.5, bounce: 0 }}
        />
      </div>
      {/* Discrete steps */}
      <ol className="mt-3 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <motion.li
            key={i}
            className="h-2 flex-1 rounded-full"
            animate={{ backgroundColor: i < stage ? "var(--color-emerald-500)" : "var(--color-zinc-200)" }}
            transition={{ duration: 0.25, delay: i < stage ? i * 0.05 : 0 }}
          />
        ))}
      </ol>
    </motion.div>
  )
}
```

### Inferences
- `initial={false}` stops the bar from animating from 0 on first render (e.g. after SSR or a refetch). It only animates on real changes.
- Whether Motion resolves `var(--color-amber-100)` to its oklch value and interpolates it correctly needs a quick test. The docs show CSS-variable targets but don't spell out the case where the variable resolves to oklch. A fallback is literal `oklch(...)` strings, or hex.
- If a real-time board animates many cards at once, `backgroundColor` repaints each card. That's fine for dozens, but can get heavy for hundreds of simultaneous changes.
- A pure-CSS alternative for the color: Tailwind `transition-colors duration-300` on a plain `div` whose class changes. It's cheaper and needs no Motion feature bundle. Use Motion only when it must be coordinated with `layout`/springs.

### Gaps
- No official statement on how CSS variables are resolved and interpolated in oklch space versus sRGB.

---

## 4. Number ticker / count-up with spring, formatted as pt-BR currency, without React re-renders

### Takeaway
Use `useSpring(0)` (or `useMotionValue` + `animate()`), derive a formatted string with `useTransform`, and render that MotionValue as the child of a `motion.span`. Motion writes the text straight to the DOM, so React doesn't re-render each frame. The paid Motion+ `AnimateNumber` is an alternative with built-in `Intl.NumberFormat`.

### Cited Findings
- `useSpring(0)` returns a MotionValue. `.set(v)` springs to `v`, and `.jump(v)` sets it instantly. It can follow another MotionValue (`useSpring(x)`) and takes spring options (`useSpring(0, { stiffness: 300 })`). `skipInitialAnimation: true` jumps on mount. — [Motion useSpring](https://motion.dev/docs/react-use-spring)
- MotionValue updates change the DOM "without triggering a React re-render" and are batched to the next frame. `useTransform(() => x.get() * 2)` derives values. `useMotionValueEvent(x, "change", cb)` subscribes with auto-cleanup. — [Motion motion values](https://motion.dev/docs/react-motion-value)
- A counter example animates `animate(count, 100, { duration: 5 })` and renders `<motion.pre>{count}</motion.pre>`. The component "will render its latest value in the HTML", which "avoids React re-renders entirely". — [Motion React animation](https://motion.dev/docs/react-animation)
- `animate(motionValue, target, options)` updates a React MotionValue automatically. It returns controls with `stop()`, `.finished` and `then()`. — [Motion animate()](https://motion.dev/docs/animate)
- 13.3.0: `springValue`/`useSpring` retargeting time cut by 80%. 13.5.0: `useSpring` is 10% smaller. — [changelog](https://motion.dev/changelog)
- `AnimateNumber` is **Motion+ (paid)**: "Not included in the free motion package". It is imported from `motion-plus/react`, is about 2.5kb, uses `Intl.NumberFormat` for currency/compact formatting, and exposes CSS classes for prefix/integer/fraction/suffix. — [Motion AnimateNumber](https://motion.dev/docs/react-animate-number)

### Code

```tsx
"use client"
import { useEffect } from "react"
import { motion, useInView, useReducedMotion, useSpring, useTransform } from "motion/react"
import { useRef } from "react"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }) // create once, outside render

export function CurrencyTicker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()

  const spring = useSpring(0, { visualDuration: 0.9, bounce: 0 })
  const text = useTransform(spring, (v) => brl.format(v)) // MotionValue<string>

  useEffect(() => {
    if (!inView) return
    if (reduce) spring.jump(value)
    else spring.set(value) // later prop changes re-spring from the current value (retarget)
  }, [inView, reduce, spring, value])

  return (
    <motion.span ref={ref} className="tabular-nums" aria-label={brl.format(value)}>
      {text}
    </motion.span>
  )
}
```

Integer count variant with `animate()`:

```tsx
const count = useMotionValue(0)
const rounded = useTransform(count, (v) => Math.round(v).toLocaleString("pt-BR"))
useEffect(() => {
  const controls = animate(count, target, { duration: 0.8, ease: "easeOut" })
  return () => controls.stop()
}, [target])
return <motion.span className="tabular-nums">{rounded}</motion.span>
```

### Inferences
- Use `tabular-nums` (Tailwind `font-variant-numeric: tabular-nums`) so digits don't jitter in width. For currency, also consider a `min-w-[Nch]` or right alignment, because `R$ 9.999,99` → `R$ 10.000,00` adds characters.
- Put the real value in `aria-label` (or a visually hidden span), so screen readers don't hear intermediate numbers. A `motion.span` text MotionValue updates `textContent` per frame.
- SSR: the server renders the MotionValue's initial value (0 → "R$ 0,00"). For KPI cards that should show the real number without JS, initialize with `useSpring(value)` and only animate on later changes. Or accept the 0→value entrance.
- Formatting each frame with a cached `Intl.NumberFormat` is cheap. Don't build a new formatter inside the transform.

### Gaps
- The `useTransform(mv, fn)` overload and `useInView` were not re-fetched from the docs in this session. They are long-standing APIs and the signatures above match current types, but they weren't verified against a fetched page.

---

## 5. Staggered entrance with blur→sharp (`filter: blur`) using variants and `stagger()`

### Takeaway
Current API: on the parent variant's transition, use `delayChildren: stagger(0.05)`. `staggerChildren`/`staggerDirection` still work but are marked `@deprecated` in the 14.6 types. `stagger()` supports `from`, `startDelay`, `ease` and `grid`. `filter: blur()` is GPU-accelerated but gets expensive with radius and layer size, so keep the blur small (4–8px), short, and on a few small elements.

### Cited Findings
- `stagger(duration, { startDelay, from: "first"|"center"|"last"|"edges"|"random"|index, grid: [cols, rows], ease })`. In React variants: `transition: { delayChildren: stagger(0.1) }`. — [Motion stagger](https://motion.dev/docs/stagger); `grid` and `edges`/`random` were added in 14.3.0 per the [changelog](https://motion.dev/changelog)
- In the `motion-dom@14.6.0` type definitions, `staggerChildren` carries `@deprecated - Use delayChildren: stagger(interval) instead.`, and `staggerDirection` carries `@deprecated - Use delayChildren: stagger(interval, { from: "last" }) instead.` — [unpkg motion-dom@14.6.0 index.d.ts](https://unpkg.com/motion-dom@14.6.0/dist/index.d.ts)
- `when: "beforeChildren" | "afterChildren"` orders parent vs child animations. — [Motion transitions](https://motion.dev/docs/react-transitions)
- Filter animation example: `initial={{ filter: "blur(10px)" }}` → `animate={{ filter: "none" }}`. — [Motion React animation](https://motion.dev/docs/react-animation)
- "`filter: blur()` is hardware accelerated. But that doesn't make it free". Its cost "can escalate sharply with every increased pixel of blur radius, and with larger layers". — [Motion performance tier list](https://motion.dev/blog/web-animation-performance-tier-list)
- Next.js's own view-transition guide uses `filter: blur(3px)` in its fade keyframes. — [Next.js view transitions guide](https://nextjs.org/docs/app/guides/view-transitions)

### Code

```tsx
"use client"
import { motion, stagger, type Variants } from "motion/react"

const list: Variants = {
  hidden: {},
  show: { transition: { delayChildren: stagger(0.05, { startDelay: 0.1 }) } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { type: "spring", visualDuration: 0.4, bounce: 0, filter: { duration: 0.3, ease: "easeOut" } },
  },
}

export function KpiRow({ items }: { items: { id: string; label: string; value: React.ReactNode }[] }) {
  return (
    <motion.ul variants={list} initial="hidden" animate="show" className="grid grid-cols-4 gap-4">
      {items.map((k) => (
        <motion.li key={k.id} variants={item} className="rounded-xl bg-white p-4">
          {k.label}: {k.value}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

### Inferences
- Animate to `blur(0px)` rather than `"none"`, so both keyframes have the same `blur()` function type. The docs show `"none"`, so both likely work. After completion, a residual `filter` can keep the element on its own layer, so ending at `"none"` may be preferable for long-lived elements. Not verified.
- Avoid blur on large containers (full table, full card grid). Apply it per small item, or only on the first viewport of items. For lists of more than ~20 rows, drop the blur and keep only opacity + y.
- `MotionConfig reducedMotion="user"` removes the `y` transform but keeps opacity and filter (section 7). To skip the blur for reduced-motion users, branch with `useReducedMotion()`.
- For grid layouts (KPI cards), `stagger(0.04, { grid: [4, 2], from: "first" })` gives a 2D diagonal wave (14.3.0+).

### Gaps
- No measured numbers (ms/frame) for blur cost were found. The tier list gives qualitative guidance only.

---

## 6. Page/route transitions in Next 16 App Router: AnimatePresence + template.tsx vs layout.tsx, FrozenRouter, and View Transitions

### Takeaway
In Next 16, the officially supported route-transition path is React's `<ViewTransition>`, used inside each `page.tsx` (not layouts) plus `<Link transitionTypes>`. The Next.js docs (updated 2026-10-15) say it works "with no configuration", and Next 16.4.2 ships React `19.3.0-canary` for the App Router. The AnimatePresence + "FrozenRouter" hack (freezing the internal `LayoutRouterContext`) still technically works, because the context is still exported in 16.4.2. It relies on undocumented internals, though, so it is not recommended. A `template.tsx` with Motion gives enter-only animations: it remounts per navigation, so there's no exit.

### Cited Findings
- Next.js guide (lastUpdated 2026-10-15): "View transitions work in the App Router with no configuration. React 19.3 includes the `<ViewTransition>` component and `addTransitionType` API". You import it with `import { ViewTransition } from 'react'`. "In Next.js, route navigations are transitions, so `<ViewTransition>` animations activate automatically". — [Next.js view transitions guide](https://nextjs.org/docs/app/guides/view-transitions)
- Put the wrapper "in each `page.tsx`, not the layout. Layouts persist across navigations, so enter and exit never fire there". `<Link transitionTypes={['nav-forward']}>` and `useRouter().push(href, { transitionTypes })` tag direction. Browser back/forward carries no type. Add `::view-transition { pointer-events: none; }` to keep the page clickable. The guide includes a reduced-motion CSS recipe. Support: "Chromium 125+ and recent Safari and Firefox", and without support "the transitions do not animate". — [Next.js view transitions guide](https://nextjs.org/docs/app/guides/view-transitions)
- `next@16.4.2` vendors React `19.3.0-canary-278794d7-20261002` (`dist/compiled/react`). Its `NavigateOptions` type includes `transitionTypes?: string[]`. — [unpkg next@16.4.2 compiled react](https://unpkg.com/next@16.4.2/dist/compiled/react/cjs/react.production.js); [app-router-context d.ts](https://unpkg.com/next@16.4.2/dist/shared/lib/app-router-context.shared-runtime.d.ts)
- `LayoutRouterContext`, `GlobalLayoutRouterContext` and `TemplateContext` are still exported from `next/dist/shared/lib/app-router-context.shared-runtime` in 16.4.2. That's the internal module the FrozenRouter hack imports. — [unpkg app-router-context d.ts](https://unpkg.com/next@16.4.2/dist/shared/lib/app-router-context.shared-runtime.d.ts)
- Older docs had an `experimental.viewTransition` flag described as "not recommended for production". The current guide says no config is needed. — [WebSearch summary of nextjs.org viewTransition config page](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) (that URL now returns 404); [Next.js view transitions guide](https://nextjs.org/docs/app/guides/view-transitions)
- FrozenRouter background: the App Router unmounts the old route almost immediately, so `AnimatePresence` exit never plays. The workaround snapshots `LayoutRouterContext` and "relies on unexposed Next.js internal methods… can break at any time". — [LogRocket (2023)](https://blog.logrocket.com/advanced-page-transitions-next-js-framer-motion); [technetexperts (Next 16 / framer-motion 12.40 report)](https://www.technetexperts.com/nextjs-framer-motion-exit-animation/) (community sources, unverified)
- Motion's `AnimateView` wraps React `ViewTransition` with Motion transitions (springs, `clipPath`) and adds no DOM wrapper. It "requires React and React DOM 19.3 or later" and is imported from `"motion/react-animate-view"`. Limitations: view transitions "aren't interruptible", each `name` must be unique, and Motion's own benchmarks found them "more memory-intensive and slower than layout measurements". — [Motion AnimateView](https://motion.dev/docs/react-animate-view)
- 14.5.0 fixed AnimatePresence + `Activity` timing. 13.4.6 fixed `mode="wait"` dropping children during React transitions, which is relevant because route navigations are transitions. — [changelog](https://motion.dev/changelog)

### Code — option A (recommended): React ViewTransition per page

```tsx
// app/(app)/quadro/page.tsx  (Server Component)
import { ViewTransition } from "react"
export default async function Page() {
  return (
    <ViewTransition enter="fade-in" exit="fade-out" default="none">
      {/* …server content… */}
    </ViewTransition>
  )
}
```
```css
/* globals.css */
::view-transition-old(.fade-out) { animation: 120ms ease-in both vt-fade reverse; }
::view-transition-new(.fade-in)  { animation: 200ms ease-out 80ms both vt-fade; }
@keyframes vt-fade { from { opacity: 0; filter: blur(2px); transform: translateY(4px); } to { opacity: 1; filter: blur(0); transform: none; } }
::view-transition { pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) { animation-duration: 0s !important; animation-delay: 0s !important; }
}
```

### Code — option B: enter-only with template.tsx (no internals)

```tsx
// app/(app)/template.tsx
"use client"
import { motion } from "motion/react"
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
      {children}
    </motion.div>
  )
}
```

### Code — option C (not recommended): FrozenRouter for exit animations

```tsx
"use client"
import { useContext, useRef } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
// INTERNAL, undocumented, may break on any Next minor:
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"

function FrozenRouter({ children }: { children: React.ReactNode }) {
  const ctx = useContext(LayoutRouterContext)
  const frozen = useRef(ctx).current
  return <LayoutRouterContext.Provider value={frozen}>{children}</LayoutRouterContext.Provider>
}

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  )
}
```

### Inferences
- The project installs `react@19.2.4`, but the App Router runs Next's vendored React 19.3 canary. `import { ViewTransition } from "react"` should therefore work in App Router code. TypeScript types (`@types/react` 19.2) may lack `ViewTransition`, which could need a types bump or a `@ts-expect-error`. Motion's `AnimateView` "requires React 19.3". It is likely usable in the App Router for the same reason, but this is unverified.
- For an operations dashboard (real-time board, frequent navigation), route transitions should be subtle and short (≤200ms) or absent. Spend the motion budget on in-page state changes: card expand, status color, KPI tickers.
- Don't wrap `layout.tsx` content in `AnimatePresence` keyed by pathname without FrozenRouter. The exit would render the *new* route's children, a known glitch.
- Mixing approaches: Motion `layoutId` animations (in-page) and React ViewTransitions (cross-route) can coexist, but don't use both on the same element.

### Gaps
- No official Next.js or Motion statement says FrozenRouter is supported or deprecated in Next 16. I only confirmed the context export still exists in 16.4.2.
- No first-party Motion example of `AnimateView` with Next App Router routes was found.

---

## 7. Reduced motion: `MotionConfig reducedMotion="user"` and `useReducedMotion`

### Takeaway
Wrap the app's client root in `<MotionConfig reducedMotion="user">`. When the OS setting is on, it automatically disables transform and layout animations, while opacity and colors keep animating. Use `useReducedMotion()` to branch on things like blur, tickers and autoplay.

### Cited Findings
- `reducedMotion="user"`: "all `motion` components will **automatically** disable transform and layout animations". Other values such as `opacity`/`backgroundColor` keep animating. `"always"` forces reduced motion (user opt-in via profile), and `"never"` disables it. — [Motion accessibility](https://motion.dev/docs/react-accessibility)
- `useReducedMotion()` returns a boolean and works in any React code. Doc examples: swap `x` for `opacity`, `autoplay={!shouldReduceMotion}`, `style={{ y: shouldReduceMotion ? 0 : y }}`. — [Motion accessibility](https://motion.dev/docs/react-accessibility)
- Motion Studio 2.2.0 added a reduced motion mode (tooling, not runtime). — [changelog](https://motion.dev/changelog)

### Code

```tsx
// app/providers.tsx
"use client"
import { MotionConfig } from "motion/react"
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", visualDuration: 0.3, bounce: 0.1 }}>
      {children}
    </MotionConfig>
  )
}
// app/layout.tsx (Server Component) renders <Providers>{children}</Providers>
```

### Inferences
- `reducedMotion="user"` does **not** stop `filter: blur` or the number-ticker spring. Those aren't transforms, so handle them with `useReducedMotion()` (see the sections 4 and 5 code).
- React ViewTransitions are CSS-driven and ignore `MotionConfig`. They need the `@media (prefers-reduced-motion)` CSS from section 6.
- `MotionConfig` can also set a default `transition` for the whole app (a single motion "token"). That transition prop is standard, but this specific usage was not re-fetched from the docs here.

### Gaps
- None material.

---

## 8. Bundle size: full `motion` vs `LazyMotion` + `m` + `domAnimation` / `domMax`

### Takeaway
The full `motion` component is about 43kb. `LazyMotion` + `m` starts at about 5kb. `domAnimation` adds about 24kb (animations, variants, exit, hover/tap/focus). `domMax` adds about 38kb and is **required for layout animations (`layout`, `layoutId`) and drag/pan**. This dashboard needs `layoutId` (pill, card→modal), so it needs `domMax`. That makes the saving over plain `motion` small, unless the features are loaded asynchronously.

### Cited Findings
- `domAnimation` (+24kb): "animations, variants, exit animations, and tap/hover/focus gestures". `domMax` (+38kb): everything in `domAnimation` "plus pan/drag gestures and layout animations". The initial render with `LazyMotion` is just over 5kb, versus about 43kb for the full `motion` component. `useAnimate` mini is 3.3kb (WAAPI only) and the hybrid is 23kb. — [Motion reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size)
- Usage: `import { LazyMotion, domAnimation } from "motion/react"`, `import * as m from "motion/react-m"`. `features` can be sync (a bundle) or async (`() => import("./features").then(r => r.default)`). The `strict` prop throws if a full `motion` component renders inside. — [Motion LazyMotion](https://motion.dev/docs/react-lazy-motion)
- 13.5.0: "`<m>` is 20% smaller". — [changelog](https://motion.dev/changelog)

### Code

```tsx
// lib/motion-features.ts
import { domMax } from "motion/react"
export default domMax

// app/providers.tsx
"use client"
import { LazyMotion, MotionConfig } from "motion/react"
const loadFeatures = () => import("@/lib/motion-features").then((r) => r.default)
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}

// any client component
"use client"
import * as m from "motion/react-m"
import { AnimatePresence, LayoutGroup, useSpring, useTransform } from "motion/react"
// <m.div layoutId="pill" /> etc.
```

### Inferences
- With `strict`, every component must use `m.*`, not `motion.*`. That includes the `motion.span` used for MotionValue text in section 4.
- Async `domMax` lets the first paint and hydration happen without the 38kb. Layout and `layoutId` animations only work once the chunk loads, which is fine for interactions that happen after a click.
- Hooks (`useSpring`, `useTransform`, `animate`, `stagger`) and `AnimatePresence`/`LayoutGroup` are imported from `motion/react` regardless of `LazyMotion`. `LazyMotion` only gates the component features.
- If only a handful of screens animate, the simpler path is plain `motion` inside leaf client components. Next splits client chunks per route, so the 43kb lands only on routes that import it.

### Gaps
- The docs don't explicitly confirm that `layoutId` (as opposed to `layout`) requires `domMax`. It is inferred, since shared layout is part of the layout-animation feature.
- The kb figures are Motion's own (gzip assumed, method not stated). No independent bundlephobia check was done for 14.6.0.
