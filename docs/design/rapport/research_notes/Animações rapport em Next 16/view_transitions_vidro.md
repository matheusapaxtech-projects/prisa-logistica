# View Transitions in Next.js 16 / React 19.x and a performant warm "glass" dashboard look (as of Oct 2026)

## 1. Next.js 16 + React View Transitions: status, browser support, blur/fade + stagger route transitions, coexistence with Motion

### Takeaway
As of October 2026 React's `<ViewTransition>` and `addTransitionType` are **stable in React 19.3** (released 9 Sep 2026). The current Next.js docs say view transitions "work in the App Router with no configuration": the old `experimental.viewTransition` flag was removed as inert in a 16.3 canary, and its docs page now returns 404. Same-document View Transitions run in Chrome/Edge 111+, Safari 18+ and Firefox 144+ (~93% global usage). Browsers without support just skip the animation, so for route transitions the native approach is now the default choice. Motion is still useful for in-page micro-interactions, but no source documents running both on the same route change.

### Cited Findings

**Release status and timeline**
- React Labs (23 Apr 2025) presented View Transitions and Activity as "experimental features that are ready to try today". — [React blog index](https://react.dev/blog)
- React 19.2 (1 Oct 2025) shipped Activity, Performance Tracks and `useEffectEvent`. It did **not** ship ViewTransition as stable. — [React blog index](https://react.dev/blog)
- React 19.3 (9 Sep 2026): "We shared it as an experimental API last year, and in 19.3 it's stable and ready to use". The post says View Transitions and Fragment Refs "are now stable in React 19.3". Import: `import { ViewTransition } from 'react'` (no `unstable_` prefix). The changelog also lists "Fix a `<ViewTransition>` crash in Mobile Safari". — [React 19.3 post](https://react.dev/blog/2026/09/09/react-19-3)
- Caveat: the Sandpack examples on react.dev still pin `19.3.0-canary-f1f7ed2a-20260904`. That is only a docs artifact, but check the installed `react` version anyway. — [React 19.3 post](https://react.dev/blog/2026/09/09/react-19-3); [react.dev ViewTransition reference](https://react.dev/reference/react/ViewTransition)
- Third-party coverage says 19.3 has no breaking changes, which is why it is not React 20. — [devx.com](https://www.devx.com/coding/19-3-view-transitions-fragment-refs/); [codercops](https://blog.codercops.com/blog/react-19-3-view-transitions-fragment-refs-2026)
- Next.js 16 was released 21 Oct 2025 at Next.js Conf. View transitions were not among its headline features (third-party source). — [luckymedia.dev](https://www.luckymedia.dev/blog/nextjs-16-an-early-look-and-release-date)
- Next.js 16.2.x docs (around April 2026) required `experimental.viewTransition: true` and called it "experimental and subject to change, it is not recommended for production". They also said the App Router bundles React canary, which contains `ViewTransition`. — [search summary of nextjs.org viewTransition config page, 16.2.x](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) (this URL now returns **HTTP 404**, checked 23 Oct 2026)
- Next.js v16.3.0-canary.95 (23 Jul 2026) changelog: "Remove inert experimental.viewTransition flag: #96098". — [releases.sh](https://releases.sh/release/rel_eHrDQECWkdHXLAOj-k6Wq) (aggregator; not a primary source)
- Current Next.js guide "Designing view transitions" (lastUpdated 2026-10-15): "View transitions work in the App Router with no configuration. React 19.3 includes the `<ViewTransition>` component and `addTransitionType` API used in this guide." It also says: "In Next.js, route navigations are transitions, so `<ViewTransition>` animations activate automatically during navigation." — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Conflict: I found no Next.js 16.3 stable release blog post. The flag's removal comes from the canary changelog plus the 404 and the "no configuration" wording in the current guide. A copy of the guide also ships in the `next@16.3.8` package. — [unpkg next@16.3.8 docs](https://app.unpkg.com/next@16.3.8/files/dist/docs/01-app/02-guides/view-transitions.md)

**API mechanics (React)**
- Only Transitions (`startTransition`), `<Suspense>` reveals and `useDeferredValue` activate `<ViewTransition>`. A plain `setState` does not. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- Props: `name` is only for shared elements. The class props `enter`, `exit`, `update`, `share` and `default` each accept `"auto"`, `"none"`, a class string, or an object keyed by transition type. "If `default` is `"none"` then all other triggers are turned off unless explicitly listed." Event props: `onEnter`, `onExit`, `onUpdate` and `onShare` receive `(instance, types)` and return a cleanup function. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- Pitfalls: enter/exit only fire if the `<ViewTransition>` sits before any DOM node (a wrapping `<div>` above it breaks this). A `flushSync` mid-sequence skips the transition. Legacy `popstate` back navigation skips animations. React waits up to 500 ms for fonts and visible images. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- `addTransitionType('x')` is called inside `startTransition`. React exposes each type as a browser view-transition type, so CSS can target it with `:active-view-transition-type(x)`. — [React 19.3 post](https://react.dev/blog/2026/09/09/react-19-3)
- React docs recommend using View Transition Classes (`::view-transition-old(.my-class)`) rather than raw `::view-transition-*(my-name)` selectors. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- Reduced motion: "React doesn't automatically disable animations for this case. We recommend always using the `@media (prefers-reduced-motion)` media query". — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)

**Next.js-specific integration**
- `<Link transitionTypes={['nav-forward']}>`, and `useRouter().push/replace` also accept `transitionTypes`. "The transition type is not automatic". Browser back/forward and swipe gestures carry no type. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Put the directional wrapper in each `page.tsx`, **not in the layout**: "Layouts persist across navigations, so enter and exit never fire there." — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Fixed header: give it `viewTransitionName: 'site-header'` and set `::view-transition-group(site-header){animation:none; z-index:100}`, `::view-transition-old(site-header){display:none}` and `::view-transition-new(site-header){animation:none}`. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Interactivity during a transition: `::view-transition { pointer-events: none; }`. "Hit-testing still skips named participants … for the transition's duration, so keep transitions short". — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Official blur/fade recipe (the guide's own code). Exit 150 ms, enter fade 210 ms delayed by 150 ms, slide 400 ms:
  ```css
  @keyframes fade { from { filter: blur(3px); opacity: 0 } to { filter: blur(0); opacity: 1 } }
  @keyframes slide-y { from { transform: translateY(10px) } to { transform: translateY(0) } }
  ::view-transition-old(.slide-down){ animation: 150ms ease-out both fade reverse, 150ms ease-out both slide-y reverse; }
  ::view-transition-new(.slide-up){ animation: 210ms ease-in 150ms both fade, 400ms ease-in both slide-y; }
  ```
  Directional nav uses a 60px `translate` offset. The guide's rationale: "Old content should leave quickly … New content should arrive more gently". — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Reduced-motion block from the guide: inside `@media (prefers-reduced-motion: reduce)`, set `animation-duration: 0s !important; animation-delay: 0s !important` on `::view-transition-old(*)`, `-new(*)` and `-group(*)`. The guide suggests a more refined approach that keeps crossfades and removes positional motion. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Same-route crossfade, for tabs and filters: `<ViewTransition key={slug} name="collection-content" share="auto" enter="auto" default="none">` inside `<Suspense>`. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Vercel publishes an agent skill: `npx skills add vercel-labs/agent-skills --skill vercel-react-view-transitions`. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)

**Browser support (same-document View Transitions)**
- Chrome 111+, Edge 111+, Safari 18.0+, Firefox 144+ (143 had it disabled by default). Global usage is 92.9%. — [caniuse view-transitions](https://caniuse.com/view-transitions)
- React's integration also uses transition types and `view-transition-class`, "available in Chromium 125+ and recent Safari and Firefox versions. Some animations may behave differently in Safari. Without browser support, your application works normally; the transitions do not animate." — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)

**Motion (motion/react) coexistence**
- With AnimatePresence in the App Router, Next unmounts the old route almost immediately, so exit animations don't run. The usual workaround is a persistent layout wrapper keyed on `usePathname()`, `mode="wait"`, and often a "FrozenRouter" hack. — [technetexperts](https://www.technetexperts.com/nextjs-framer-motion-exit-animation/); [dev.to](https://dev.to/nayankyada/how-i-use-framer-motion-with-nextjs-app-router-without-layout-shift-4378); [LogRocket](https://blog.logrocket.com/advanced-page-transitions-next-js-framer-motion)
- The Motion AnimatePresence docs do not mention View Transitions or the Next.js App Router. `mode="wait"` supports only one child. `mode="popLayout"` uses `position:absolute` and requires custom-component children to forward refs. — [motion.dev AnimatePresence](https://motion.dev/docs/react-animate-presence)
- The Next.js guide frames `<ViewTransition>` as the replacement for "complex animation libraries that manage mount/unmount lifecycles, track element positions across routes, and coordinate timing manually". — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)

### Inferences
- **Recommendation:** use native `<ViewTransition>` for route-level transitions (crossfade, blur→sharp fade, directional slide, card→detail morph) in Next 16.3+ with React 19.3. It is now stable, needs no config, and degrades gracefully. That removes the main reason to use Motion for page transitions, which was the App Router's lack of exit-animation support.
- Keep Motion, if at all, for component-level micro-interactions: hover/press springs, drag, number tickers, list reorders inside one page, `layout` animations within a page. Avoid using both on the same element during a navigation, because a View Transition snapshots the DOM and Motion's in-flight transforms would get captured mid-animation. This is my inference; no source covers it.
- **Stagger:** CSS cannot target `nth-child` of view-transition pseudo-elements, so staggering cards needs one `<ViewTransition>` per card (each gets an auto-generated unique name) plus a per-item `animation-delay`. Two ways to set the delay: (a) an inline `style={{ viewTransitionName }}` with a CSS rule per name, or (b) the `onEnter` callback with `instance.new.animate([...], {delay: i*40})`, which the React docs show. Option (b) is the cleanest per-item stagger. This is inferred from the API description; I found no official stagger recipe.
- If the project is on Next 16.0–16.2, it still needs `experimental.viewTransition: true` and React canary (bundled by Next). Upgrading to 16.3+ avoids the experimental label.

### Gaps
- I found no official Next.js 16.3 release post confirming the exact stable version where the flag was dropped. The evidence is the canary changelog, the 404 on the config page and the current guide wording.
- I found no primary source on combining Motion's `AnimatePresence` or `layout` with native view transitions on the same navigation, and no Motion API for view transitions ("animateView") was confirmed.
- I found no official stagger example for `<ViewTransition>`.

---

## 2. Shared element (card → detail) via `name` / `view-transition-name`: feasibility and pitfalls

### Takeaway
A card→detail morph is fully supported and is the first pattern in the official Next.js guide. Give both elements the same `<ViewTransition name={\`card-${id}\`}>`. The main pitfalls are duplicate names (two mounted at once is an error), the destination suspending before it renders (then no pair forms), elements outside the viewport (no pair), and forgetting `share` when `default="none"` is set.

### Cited Findings
- Pattern: wrap the grid thumbnail and the detail hero in `<ViewTransition name={\`photo-${photo.id}\`}>`. "React finds elements with the same name on the old and new pages, then animates between their size and position automatically." — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- "The morph plays when the destination content renders in the same commit as the navigation, which is the case with prefetched (cached) pages. If the destination suspends into a fallback first, no pair forms". — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- To customize: `share="morph" default="none"`. Without `default="none"`, "every named `<ViewTransition>` animates whenever any transition runs on the page". With `default="none"` and no `share`, "the pair silently stops morphing". — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Morph blur recipe: `::view-transition-group(.morph){animation-duration:400ms}`, `::view-transition-image-pair(.morph){animation-name:via-blur}`, `@keyframes via-blur{30%{filter:blur(3px)}}`. "The blur hides pixel-level interpolation artifacts". — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Uniqueness: "only one thing with the same name mounted at a time in the entire app". Dev error: "There are two `<ViewTransition name=%s>` components with the same name mounted at the same time. This is not supported and will cause View Transitions to error." The fix is to include the item id in the name. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- Lists: use `key` for reorder animations, not `name`. A parent `<ViewTransition>` would cross-fade instead. "If either the mounted or unmounted side of a pair is outside the viewport, then no pair is formed." — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- `onShare` takes precedence over `onEnter`/`onExit`, and only one event fires per `<ViewTransition>` per Transition. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)

### Inferences
- In a dashboard where the same entity can appear in two places at once (for example a trip in both a "queue" list and a "late" panel), names like `trip-${id}` collide. Scope the name by context (`queue-trip-${id}`) and only use the shared name on the instance the user clicked.
- Real-time boards that re-render often (Supabase realtime pushes) should not wrap live rows in named `<ViewTransition>`s. Each update inside a Transition could animate. Use `default="none"` and opt in explicitly.
- Detail pages that fetch data will often suspend and lose the morph. Prefetching via `<Link>` (default in production) or rendering a cached shell with the named element synchronously keeps the pair.

### Gaps
- I found no measurements of the cost of many simultaneous named elements (for example 50+ cards each with a name).

---

## 3. `backdrop-filter: blur()` performance, best practices, and animating `filter: blur()` vs opacity/transform

### Takeaway
`backdrop-filter` is among the most expensive common CSS effects. Cost scales mainly with blurred **area** and with how often the backdrop changes (scrolling content behind a sticky blurred header is the worst common case). Limit glass to a few modest-size panels, avoid nesting and full-viewport blurs, and do not animate `filter: blur()` continuously or on large surfaces. Short, small, one-shot blur→sharp entrances are acceptable, as the official Next.js recipes use `blur(3px)`. Animate `opacity`/`transform` for anything large.

### Cited Findings
- Area beats count: one full-screen blurred panel costs more than six small ones. A blurred sticky header over a scrolling page is the worst common case. The compositor must sample everything behind the element and blur it every frame the element or its backdrop moves. — [21st.dev liquid-glass article](https://21st.dev/blog/liquid-glass-react-components)
- Radius cost is disputed. 21st.dev says cost scales with radius and that "beyond roughly 20px" the difference is imperceptible. Grida's render-cost model says the cost is roughly constant with radius in Skia-style downsample pipelines. Neither publishes a benchmark. — [21st.dev](https://21st.dev/blog/liquid-glass-react-components); contradicted by [Grida render-cost doc](https://grida.co/docs/wg/feat-2d/render-cost-prediction)
- React Doctor lint rule `no-large-animated-blur`: keep blur under 10px or shrink the blurred element. Large blurs multiply GPU memory with layer size. Apply backdrop-filter to a small overlay rather than a full-viewport pane. — [react.doctor rule](https://www.react.doctor/docs/rules/react-doctor/no-large-animated-blur)
- Flutter guidance (same GPU principles): an unclipped backdrop filter can cover the whole screen and make scrolling janky. Many blur effects in one scene need extra framebuffers or save layers. — [thelinuxcode Flutter guide](https://thelinuxcode.com/flutter-backdropfilter-widget-deep-guide-to-glass-ui-performance-and-realworld-patterns/); [inspire_blur](https://pub.dev/packages/inspire_blur)
- Chrome team experiment ("Animating a blur"): even pre-blurred copies promoted with `will-change: transform`, animating only opacity, gave sub-60fps frames of about 90 ms on the GPU. Blur stayed expensive. — [Chrome for Developers](https://developer.chrome.com/blog/animated-blur/)
- Only `transform` and `opacity` are compositor-only properties, and the element should be on its own layer. Manage layer count. — [web.dev](https://web.dev/stick-to-compositor-only-properties-and-manage-layer-count/)
- Overusing `will-change` raises memory and GPU overhead. Remove it after the animation. — [dev.to will-change](https://dev.to/softheartengineer/mastering-the-will-change-css-property-optimize-your-web-animations-and-filters-3i3h)
- UI skill rule set (secondary): keep animated blur ≤8px, only for short one-time effects, never continuous or on large surfaces. — [tessl fixing-motion-performance](https://tessl.io/registry/skills/github/popey/claude-code-skills/fixing-motion-performance)
- Compositor promotion isn't guaranteed. A Firefox bug shows an opacity animation not running on the compositor. Verify in DevTools. — [Mozilla bug 1218620](https://bugzilla.mozilla.org/show_bug.cgi?id=1218620)
- Official Next.js recipes use `filter: blur(3px)` in short (150–400 ms) view-transition keyframes. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions)
- Tailwind v4.3 default blur scale (`--blur-*`, used by `blur-*` and `backdrop-blur-*`): xs 4px, sm 8px, md 12px, lg 16px, xl 24px, 2xl 40px, 3xl 64px. — [Tailwind theme docs](https://tailwindcss.com/docs/theme)

### Inferences
- **Recommended radii:**
  - Panels and cards: `backdrop-blur-md`/`lg` (12–16px).
  - Dialog page-blur scrim: 8–12px.
  - Entrance blur→sharp: 3–8px over ≤300–400 ms.
  - Never above about 20px on large areas. Past that point blur looks the same and only costs more, per 21st.dev.
- **Dialog that blurs the page:** use one fixed scrim, for example `dialog::backdrop { backdrop-filter: blur(8px); background: rgb(22 24 24 / .25) }`, rather than blurring each panel. Animate only the scrim's `opacity` in and out, not the blur radius.
- **Warm gradient + glass:** because the background is static, keep it `position: fixed` (or on a fixed pseudo-element) so the panels' backdrop does not change on scroll. Avoid sticky blurred headers over long scrolling lists, or make the header opaque or near-opaque with a tiny blur.
- **Avoid nested glass**, a blurred panel inside a blurred panel. Each one samples and blurs again. Use plain semi-transparent fills (`bg-white/60`) for inner surfaces.
- **Fallback:** `@supports not (backdrop-filter: blur(1px)) { .glass { background: rgb(255 250 240 / .92) } }`, plus a higher-opacity fill for `prefers-reduced-transparency` (see section 6).
- **Low-end laptops:** with integrated GPUs, several large glass panels over a fixed gradient plus a realtime board refreshing often is the risk scenario. Profile with Chrome DevTools > Rendering > "Frame rendering stats" and Layers panel before adding more glass.

### Gaps
- I found no rigorous public benchmark (fps vs area vs radius) for `backdrop-filter` on low-end hardware in 2025–2026. The thresholds above are rules of thumb from tooling and blog sources.
- I did not retrieve MDN pages this session for `backdrop-filter`, `::backdrop` or `@supports` syntax, so the fallback snippets are standard CSS but uncited.

---

## 4. Warm mesh / radial-gradient backgrounds: construction, banding, fixed vs scrolling

### Takeaway
Build the "mesh" from 3–5 stacked `radial-gradient()` layers over a warm base color, then add a faint noise layer to dither banding. Use a small tiled noise PNG or WebP, or an SVG `feTurbulence` that renders once, at low opacity. Keep the background static and fixed so it rasterizes once and does not force the glass panels to re-blur on scroll.

### Cited Findings
- Banding comes from screens' limited color levels. Noise breaks up the steps, a dithering technique used in film and games. — [instantgradient](https://instantgradient.com/blog/grainy-gradients); [CSSmatic noise generator](https://cssmatic.com/gen-noise-texture.html)
- Starting settings: noise frequency about 0.6–1.0 at 0.2–0.4 opacity. Above about 0.5 opacity it looks like static. — [CSSmatic](https://cssmatic.com/gen-noise-texture.html)
- `feTurbulence` `baseFrequency` must be positive, integer values give a blank result, and higher values give finer grain. `numOctaves` >1 improves the noise, but the author rarely goes beyond 3–4 for performance. Use `color-interpolation-filters="sRGB"` for cross-browser consistency (linearRGB is the default). — [Frontend Masters "Grainy Gradients"](https://frontendmasters.com/blog/grainy-gradients/)
- Layering noise can shift gradient brightness and saturation. Lowering opacity to avoid that weakens the anti-banding effect. Frontend Masters favors edge-focused grain, while other sources use uniform low-opacity grain. — [Frontend Masters](https://frontendmasters.com/blog/grainy-gradients/); [CSSmatic](https://cssmatic.com/gen-noise-texture.html)
- A full-screen SVG turbulence filter is expensive to rasterize. A tiny tiled image at low opacity is cheaper. — [21st.dev background patterns](https://21st.dev/blog/react-background-pattern-components)
- The filter rasterizes once and then behaves like a normal background. Avoid continuous repainting. — [CSSmatic](https://cssmatic.com/gen-noise-texture.html)
- Tailwind v4 `@theme` can hold the palette as `--color-*` tokens (example `--color-mint-500: oklch(...)`), which generates `bg-*`, `text-*` and `fill-*` utilities. — [Tailwind theme docs](https://tailwindcss.com/docs/theme)

### Inferences
- Example structure (uncited, standard CSS):
  ```css
  body::before{content:"";position:fixed;inset:0;z-index:-1;
    background:
      radial-gradient(60% 50% at 15% 10%, oklch(0.86 0.12 85 / .9), transparent 70%),   /* mustard glow */
      radial-gradient(50% 45% at 85% 20%, oklch(0.70 0.16 40 / .55), transparent 70%),  /* rust */
      radial-gradient(70% 60% at 70% 95%, oklch(0.45 0.06 165 / .35), transparent 70%), /* forest */
      #f4e6cf;}                                                                         /* warm base */
  body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
    background:url(/noise-128.webp);opacity:.06;mix-blend-mode:soft-light;}
  ```
- A fixed pseudo-element is preferable to `background-attachment: fixed`, which historically causes repaints on scroll, especially on mobile. This is a widely held practitioner view, but I did not cite it this session.
- Interpolating gradients in `oklch` (`linear-gradient(in oklch, …)`) reduces muddy mid-tones between warm hues. Browser support was not verified this session.

### Gaps
- I found no measured comparison of fixed vs scrolling gradient backgrounds under backdrop-filter.
- `background-attachment: fixed` repaint behavior in 2026 browsers was not verified with a primary source.

---

## 5. Tailwind v4 specifics: @theme tokens, backdrop-blur, custom keyframes, motion-safe/motion-reduce

### Takeaway
Tailwind (docs show v4.3) defines design tokens in CSS through `@theme` namespaces. Each namespace auto-generates utilities, including `--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*`, `--ease-*` and `--animate-*`. Custom keyframes go inside `@theme` next to their `--animate-*` variable.

### Cited Findings
- Namespaces and the utilities they generate: `--color-*` (bg/text/fill), `--radius-*` (`rounded-*`), `--shadow-*` (`shadow-*`), `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*` (`blur-*`), `--ease-*` (`ease-*`), `--animate-*` (`animate-*`), `--spacing-*`, `--breakpoint-*`, `--container-*`, `--font-*`, `--text-*` and others. Docs version: v4.3. — [Tailwind theme docs](https://tailwindcss.com/docs/theme)
- Keyframes inside `@theme`:
  ```css
  @theme {
    --animate-fade-in-scale: fade-in-scale 0.3s ease-out;
    @keyframes fade-in-scale { 0% { opacity:0; transform:scale(0.95) } 100% { opacity:1; transform:scale(1) } }
  }
  ```
  To always emit keyframes even without an `--animate-*` variable, define them outside `@theme`. — [Tailwind theme docs](https://tailwindcss.com/docs/theme)
- Default `--blur-*` scale: xs 4, sm 8, md 12, lg 16, xl 24, 2xl 40, 3xl 64 (px). — [Tailwind theme docs](https://tailwindcss.com/docs/theme)

### Inferences
- Suggested tokens for this look (uncited composition):
  ```css
  @theme {
    --color-mostarda: #e7c14b; --color-floresta: #2c5a4d; --color-ferrugem: #c4411d; --color-grafite: #161818;
    --radius-panel: 1.25rem;
    --shadow-glass: 0 1px 0 rgb(255 255 255 / .5) inset, 0 8px 32px rgb(60 30 0 / .12);
    --ease-out-soft: cubic-bezier(.22,1,.36,1);
    --animate-surgir: surgir 360ms var(--ease-out-soft) both;
    @keyframes surgir { from { opacity:0; filter:blur(6px); transform:translateY(8px) } to { opacity:1; filter:blur(0); transform:none } }
  }
  ```
  Usage: `class="motion-safe:animate-surgir backdrop-blur-lg bg-white/55 rounded-panel shadow-glass"`, with stagger through an inline `style={{ animationDelay: \`${i*40}ms\` }}`.
- `backdrop-blur-*` is assumed to read the same `--blur-*` scale. The theme page lists `--blur-*` → `blur-md`, but I did not retrieve the backdrop-blur docs page to confirm.
- `motion-safe:`/`motion-reduce:` variants map to `prefers-reduced-motion: no-preference/reduce`. This is long-standing Tailwind behavior, but I did not fetch it this session.

### Gaps
- I did not retrieve the Tailwind pages for `backdrop-filter-blur`, the `motion-safe`/`motion-reduce` variants, or any built-in `contrast-more:` / reduced-transparency variant. I could not confirm whether Tailwind v4.3 ships a `prefers-reduced-transparency` variant. A custom `@custom-variant reduce-transparency (@media (prefers-reduced-transparency: reduce));` would work regardless.

---

## 6. Accessibility: contrast on translucent panels and saturated cards; reduced motion and reduced transparency

### Takeaway
Computed with the WCAG 2.x relative-luminance formula (my own calculation):
- **Mustard #e7c14b:** near-black text only. #161818 gives 10.30:1 (AAA). White gives 1.73:1 and fails.
- **Forest #2c5a4d:** white or cream text. White gives 7.85:1 (AAA).
- **Rust #c4411d:** white text. White gives 5.10:1 (AA, normal text). Near-black gives 3.50:1, which passes for large/bold text only.
- **Near-black #161818:** white or cream text, 17.8:1.

Light glass panels (≥40% white over the warm background) keep near-black text far above AA. Respect `prefers-reduced-motion` explicitly, since React doesn't do it for you. `prefers-reduced-transparency` works only in Chromium (118+). Safari and Firefox don't support it.

### Cited Findings
- React does not auto-disable view-transition animations for reduced motion. Use `@media (prefers-reduced-motion)`. — [react.dev ViewTransition](https://react.dev/reference/react/ViewTransition)
- Next.js guide: directional slides are "the most common trigger for motion sensitivity", while crossfades and opacity carry less risk. It provides a zero-duration override and suggests keeping fades while removing movement. — [Next.js guide](https://nextjs.org/docs/app/guides/view-transitions); [CSS-Tricks, linked from the guide](https://css-tricks.com/nuking-motion-with-prefers-reduced-motion/)
- `prefers-reduced-transparency` support: Chrome 118+, Edge 118+. Firefox 113–161 has it "disabled by default". Safari through 27.2 has no support. Global usage is 74.16%. — [caniuse prefers-reduced-transparency](https://caniuse.com/mdn-css_at-rules_media_prefers-reduced-transparency)

**Computed WCAG contrast ratios** (sRGB relative luminance; thresholds: AA normal 4.5:1, AA large/UI 3:1, AAA normal 7:1):

| Background | Luminance | White #fff | Near-black #161818 | Black #000 | Cream #fbf3e4 | Pass for body text |
|---|---|---|---|---|---|---|
| Mustard #e7c14b | 0.556 | 1.73 ✗ | **10.30** AAA | 12.13 | 1.57 ✗ | Dark text only |
| Forest #2c5a4d | 0.084 | **7.85** AAA | 2.27 ✗ | 2.68 ✗ | 7.11 AAA | Light text only |
| Rust #c4411d | 0.156 | **5.10** AA | 3.50 (large only) | 4.12 (large only) | 4.62 AA | White or cream; dark text fails at normal size |
| Near-black #161818 | 0.009 | **17.83** AAA | n/a | 1.18 | 16.17 AAA | Light text |

Translucent white panels, composited (worst-case opaque result of a white fill at alpha α over the given color, ignoring blur):

| Panel | Composite | Near-black text | White text |
|---|---|---|---|
| white 40% over mustard | #f1da93 | 12.90 | 1.38 ✗ |
| white 60% over mustard | #f5e6b7 | 14.33 | 1.24 ✗ |
| white 40% over rust | #dc8d77 | 6.89 (AA) | 2.59 ✗ |
| white 60% over rust | #e7b3a5 | 9.67 | 1.84 ✗ |
| white 40% over warm base #f2d9b8 | #f7e8d4 | 14.81 | 1.20 ✗ |

### Inferences
- On rust cards, use white (not cream, and not near-black) for small text. Rust with near-black is fine only for ≥24px regular or ≥18.66px bold text, or for icons (3:1).
- On a mustard card, white text or icons fail even for large text (1.73:1). Mustard needs dark text. Muted grey text on mustard should be checked separately; anything lighter than about #4a4a40 will drop quickly.
- On glass panels, contrast depends on what passes behind. Measure against the most saturated, darkest region the panel can sit over: the rust glow is the worst case. At 40% white over rust, near-black still gets 6.89:1. Muted secondary text (for example 60% near-black) should be checked against that worst case. Keep panel fill ≥50–60% white for secondary text.
- For `prefers-reduced-transparency: reduce` (Chromium only), raise panel fill to about 90–95% opacity and drop `backdrop-filter`. Since Safari and Firefox users can't signal it, keep the default design legible without relying on blur.
- For reduced motion, keep opacity crossfades (short, ≤200 ms). Remove translate, scale and blur keyframes in view transitions and in `motion-safe:` utilities. In Motion, use `MotionConfig reducedMotion="user"`. I did not verify this on the fetched Motion page, which did not mention it.

### Gaps
- The contrast ratios are my own calculation, and the "composite" rows ignore blur and the gradient's spatial variation. Real values on glass vary by position.
- I did not evaluate WCAG 3 / APCA scores.
- Tailwind support for a reduced-transparency variant is unconfirmed (see section 5).
