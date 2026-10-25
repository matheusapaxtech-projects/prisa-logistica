# Animated kanban drag in React 19 / Next.js 16 (lift, column highlight, reflow, color change, optimistic and rollback), October 2026

Context checked in the repo (2026-10-23): `web/package.json` has `next 16.4.2`, `react`/`react-dom 19.2.4`, and neither Motion nor dnd-kit. The board (`web/src/app/(app)/quadro/`) uses native HTML5 DnD: `cartao.tsx` sets `draggable`, `dataTransfer.setData("text/plain", viagem_id)` and `effectAllowed="move"`; `coluna.tsx` handles `onDragOver`/`onDragLeave`/`onDrop` and keeps a `sobre` flag for the highlight. `quadro-cliente.tsx` `executar()` runs a hand-rolled optimistic map (`pendentes[id] = para`). It calls `moverViagem` (server action), removes the key on rejection ("o cartão volta"), and reloads through a Supabase realtime subscription. Some moves open a "passagem" form dialog before calling the server, and a "Mover" menu already gives a non-drag path. Moves change the column (status), not the order inside a column.

Package versions below come from `registry.npmjs.org` (dist-tags and publish times), queried 2026-10-23: [npm registry @dnd-kit/react](https://registry.npmjs.org/@dnd-kit/react), [@dnd-kit/core](https://registry.npmjs.org/@dnd-kit/core), [@dnd-kit/sortable](https://registry.npmjs.org/@dnd-kit/sortable), [@atlaskit/pragmatic-drag-and-drop](https://registry.npmjs.org/@atlaskit/pragmatic-drag-and-drop), [@hello-pangea/dnd](https://registry.npmjs.org/@hello-pangea/dnd), [motion](https://registry.npmjs.org/motion).

| Package | latest | Published | React peer |
|---|---|---|---|
| `@dnd-kit/react` (new) | 0.5.1 | 2026-10-15 | `^18 \|\| ^19` |
| `@dnd-kit/dom` (new) | 0.5.1 | 2026-10-15 | n/a |
| `@dnd-kit/core` (classic) | 6.3.1 | 2024-12-05 | `>=16.8.0` |
| `@dnd-kit/sortable` (classic) | 10.0.0 | 2024-12-04 | `>=16.8.0` |
| `@atlaskit/pragmatic-drag-and-drop` | 4.0.0 | 2026-09-24 | none (framework-agnostic) |
| `@atlaskit/pragmatic-drag-and-drop-react-drop-indicator` | 4.2.4 | 2026-09-24 | `^18.2 \|\| ^19` |
| `@atlaskit/pragmatic-drag-and-drop-auto-scroll` | 3.2.1 | 2026-09-24 | none |
| `@hello-pangea/dnd` | 18.0.1 | 2025-02-09 | `^18 \|\| ^19` |
| `motion` (import from `motion/react`) | 14.6.0 | 2026-10-22 | `^18 \|\| ^19` |

---

## dnd-kit in 2026: classic `@dnd-kit/core` + `@dnd-kit/sortable` vs new `@dnd-kit/react` (DragOverlay, sensors, collision, a11y)

### Takeaway
The classic packages have not shipped since December 2024, and the docs now label them "legacy". The new `@dnd-kit/react` is under active development (0.5.1 on 2026-10-15) and officially supports React 19, but it is still pre-1.0. It is the most complete option for a multi-column board: multiple sortable lists, built-in sibling reflow animation, keyboard sensor, screen-reader announcements and a drop animation. It drives styles on the dragged element with `!important`, which matters for the "lift" styling and for any Motion combination.

### Cited Findings
**Status and versions**
- `@dnd-kit/react` latest is 0.5.1, published 2026-10-15, with a parallel `beta` tag. Its peer deps are `react`/`react-dom` `^18.0.0 || ^19.0.0`, and it depends on `@dnd-kit/abstract`, `@dnd-kit/dom` and `@dnd-kit/state` `^0.5.1`. — [npm registry](https://registry.npmjs.org/@dnd-kit/react); [package.json @0.5.1](https://unpkg.com/@dnd-kit/react@0.5.1/package.json)
- Classic `@dnd-kit/core` latest is 6.3.1 (2024-12-05) and `@dnd-kit/sortable` latest is 10.0.0 (2024-12-04). Their peers are `react >=16.8.0`, so both install on React 19, but neither has had a release in about 22 months. — [npm registry core](https://registry.npmjs.org/@dnd-kit/core); [npm registry sortable](https://registry.npmjs.org/@dnd-kit/sortable)
- The legacy install page on dndkit.com shows a banner saying a new version of @dnd-kit is available and recommending it. The classic docs now live under `/legacy/`. — [dndkit.com legacy install](https://dndkit.com/legacy/introduction/installation)
- 0.5.1 release notes (15 Oct):
  - `useSortable` now preserves `transition: null` instead of replacing it with the default. The fix adds a `resolveSortableTransition` helper in `@dnd-kit/dom/sortable`.
  - `KeyboardSensor` matches shortcuts on `event.key`, so layouts and OS remaps work, and legacy `Key_`/`Digit_` configs keep working.
  - The Accessibility plugin no longer sets `aria-pressed` on activators whose role is not `button`.
  - The page gives no stable/beta label. The version is 0.x.
  — [GitHub releases](https://github.com/clauderic/dnd-kit/releases)

**API surface (new)**
- `@dnd-kit/react` exports `DragDropProvider`, `DragOverlay`, `useDraggable`, `useDroppable`, `useDragOperation`, `useDragDropMonitor`, `useDragDropManager` and `useInstance`. It re-exports `KeyboardSensor`, `PointerSensor` and the event types `BeforeDragStartEvent`, `DragStartEvent`, `DragMoveEvent`, `DragOverEvent`, `DragEndEvent` and `CollisionEvent`. `DragDropProvider` accepts `onBeforeDragStart`, `onDragStart`, `onDragMove`, `onDragOver`, `onDragEnd` and `onCollision`. — [index.d.ts @0.5.1](https://unpkg.com/@dnd-kit/react@0.5.1/index.d.ts)
- `useSortable` inputs:
  - Required: `id` and `index`.
  - Optional: `group`, `type`, `accept`, `transition` (`{duration?, easing?, idle}` or `null`), `plugins`, `sensors`, `collisionDetector`, `collisionPriority`, `modifiers`, `disabled` (boolean or `{draggable?, droppable?}`), `data`, and `element`/`handle`/`target`.
  - It returns `ref`, `targetRef`, `sourceRef`, `handleRef`, `isDragging`, `isDropping` (in drop animation), `isDragSource` and `isDropTarget`.
  — [dndkit.com useSortable](https://dndkit.com/react/hooks/use-sortable)
- The default sortable transition is `{ duration: 250, easing: "cubic-bezier(0.25, 1, 0.5, 1)", idle: false }`. — [sortable.js @0.5.1 (defaultSortableTransition)](https://unpkg.com/@dnd-kit/dom@0.5.1/sortable.js)
- The feedback type is `'default' | 'move' | 'clone' | 'none'`, configured with a plugin (e.g. `Feedback.configure({ feedback: 'clone' })`). — [dom index.d.ts @0.5.1](https://unpkg.com/@dnd-kit/dom@0.5.1/index.d.ts); [dndkit.com useSortable](https://dndkit.com/react/hooks/use-sortable)

**Multi-column kanban recipe (official guide)**
- The "multiple sortable lists" guide:
  - Uses `DragDropProvider`, with `useSortable({ id, index, type, accept, group })` on items and `useDroppable` on columns.
  - Sets `collisionPriority: CollisionPriority.Low` on columns so item collisions win over column collisions.
  - Uses `move()` from `@dnd-kit/helpers` to rewrite a `Record<columnId, itemId[]>` state.
  - Updates item positions in `onDragOver` (`setItems((items) => move(items, event))`) and column order in `onDragEnd` (skipped if `event.canceled`).
  - Handles cancel by snapshotting `previousItems.current = items` in `onDragStart` and restoring it in `onDragEnd` if `event.canceled`.
  - Notes that dnd-kit automatically reverts its own optimistic DOM updates on cancel, so the manual restore only covers your React state.
  — [dndkit.com multiple sortable lists](https://dndkit.com/react/guides/multiple-sortable-lists)

**DragOverlay**
- `DragOverlay` is rendered once per provider. Its children (a node, or a function of `source`) render only during a drag. Props are `tag` (default `div`), `disabled`, `className`, `style` and `dropAnimation`.
- `dropAnimation`:
  - `undefined` gives the default 250 ms ease.
  - `null` disables it.
  - `{duration, easing}` customizes it.
  - A function `({element, feedbackElement, translate}) => Promise | void` runs custom logic.
  — [dndkit.com DragOverlay](https://dndkit.com/react/components/drag-overlay)

**How the dragged element is styled internally (relevant to "lift" styling)**
- The Feedback plugin promotes the dragged element (it imports `showPopover`/`supportsPopover`) and injects CSS on `[data-dnd-dragging]`:
  - `position: fixed !important`, `pointer-events: none !important`, `z-index: calc(infinity)`.
  - `transform: var(--dnd-transform, none) !important`, `transition: var(--dnd-transition) !important`.
  - `translate: var(--dnd-translate) !important` (not while `data-dnd-dropping`).
  - `scale` with `!important` only when the library sets a scale variable.
- The placeholder gets `[data-dnd-placeholder]`. The state attributes are `data-dnd-dragging`, `data-dnd-dropping` and `data-dnd-placeholder`.
— [dom index.js @0.5.1 (CSS_RULES)](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js)

**Sibling reflow is built in (FLIP on `translate`)**
- During a sort, the OptimisticSortingPlugin moves real DOM nodes with `insertAdjacentElement`. Each displaced sortable is then animated with WAAPI (`element.animate`) on the `translate` property, from its old position to its new one, using the sortable `transition`.
- Before animating, it cancels any running CSS transitions on `transform`, `translate` or `scale`.
- If `prefers-reduced-motion` is set, the duration is forced to 0.
— [sortable.js @0.5.1 (reorder / animateTransform)](https://unpkg.com/@dnd-kit/dom@0.5.1/sortable.js)

**Sensors (defaults)**
- Default preset sensors are `[PointerSensor, KeyboardSensor]`. — [dom index.js @0.5.1 (defaultPreset)](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js)
- `PointerSensor` default activation constraints:
  - Mouse on a drag handle: immediate.
  - Touch: `Delay { value: 250, tolerance: 5 }`. A separate TouchSensor is not needed because it is pointer-events based.
  - Text input: `Delay { 200, tolerance 0 }`.
  - Otherwise: `Delay { 200, tolerance 10 }` plus `Distance { 5 }`.
  - `preventActivation` blocks drags that start on nested interactive elements unless they are the element or handle (relevant to the card's `<Link>`).
  — [dom index.js @0.5.1 (PointerSensor defaults)](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js)
- `KeyboardSensor` default `keyboardCodes`: start `["Space","Enter"]`, cancel `["Escape"]`, end `["Space","Enter","Tab"]`. Arrow keys move the item. — [dom index.js @0.5.1 (KeyboardSensor)](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js)

**Accessibility (built-in)**
- The Accessibility plugin:
  - Sets `role="button"` and `aria-roledescription="draggable"` by default.
  - Adds `aria-describedby` instructions: "To pick up a draggable item, press the space bar. While dragging, use the arrow keys to move the item… Press space again to drop… or press escape to cancel."
  - Announces in a live region on `dragstart`/`dragover`/`dragend` (e.g. "Draggable item {id} was moved over droppable target {target.id}").
  - Exposes both `announcements` and `screenReaderInstructions` for override.
  - The defaults are English and use raw ids.
  — [dom index.js @0.5.1 (defaultAnnouncements)](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js)

### Inferences
- For the "lift" look, do not set `transform`/`scale` on the element that carries `ref`. The library overrides `transform` (and `scale` when it sets one) with `!important`. Put the visual lift on an inner wrapper keyed off `[data-dnd-dragging] > .card-inner`, or on `isDragging`. The CSS individual property `rotate` is not in the injected rules, so it should also work on the outer element. This is unverified in a browser.
- The default announcements say "Draggable item a3f9-…", which is useless in Portuguese. Override them with `announcements` using the card's label (`Viagem #123`) and column labels (`rotuloDe(status)`).
- Because the app only changes columns and never reorders within one, `useDroppable` per column plus `useDraggable` per card (no sortable) is enough if no in-column insertion preview is wanted. Use `useSortable` with `group = column` only if siblings should part to show where the card will land.
- Pre-1.0 risk: there were API changes between 0.x versions (e.g. the `transition: null` semantics in 0.5.1). Pin the exact version.

Minimal TSX sketch (new API, column-change board, optimistic plus rollback described in the optimistic section):
```tsx
"use client";
import { DragDropProvider, DragOverlay, useDraggable, useDroppable, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { CollisionPriority } from "@dnd-kit/abstract";

function Coluna({ id, rotulo, children }: { id: StatusCampo; rotulo: string; children: React.ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id, type: "coluna", accept: "cartao", collisionPriority: CollisionPriority.Low });
  return (
    <section ref={ref} data-sobre={isDropTarget || undefined} className="quadro-coluna" aria-label={rotulo}>
      {children}
    </section>
  );
}

function Cartao({ c }: { c: Cartao }) {
  const { ref, isDragging, isDropping } = useDraggable({ id: c.viagem_id!, type: "cartao", data: { de: c.status_campo } });
  return (
    <article ref={ref} className="quadro-cartao" data-status={c.status_campo}>
      {/* the lift lives on the inner wrapper: dnd-kit owns transform/translate on the outer */}
      <div className="cartao-corpo" data-erguido={isDragging && !isDropping ? "" : undefined}>…</div>
    </article>
  );
}

// CSS
// .cartao-corpo { transition: scale .18s, rotate .18s, box-shadow .18s, background-color .3s; }
// .cartao-corpo[data-erguido] { scale: 1.04; rotate: -1.5deg; box-shadow: 0 12px 28px rgb(0 0 0 / .18); }
// .quadro-coluna[data-sobre] { outline: 2px solid var(--acento); background: var(--acento-suave); }
// @media (prefers-reduced-motion: reduce) { .cartao-corpo { transition: none; } .cartao-corpo[data-erguido] { scale: 1; rotate: 0deg; } }

<DragDropProvider
  sensors={[PointerSensor, KeyboardSensor]}
  onDragEnd={(e) => {
    if (e.canceled) return;
    const { source, target } = e.operation;
    if (!source || !target || target.id === source.data.de) return;
    mover(source.id as string, source.data.de, target.id as StatusCampo); // optimistic + server
  }}
>
  …columns…
  <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
    {(source) => <CartaoVisual id={source.id} erguido />}
  </DragOverlay>
</DragDropProvider>
```
(The `CollisionPriority` import path `@dnd-kit/abstract` is inferred from the dependency list. The guide shows `CollisionPriority.Low` without the import line. Verify before use.)

### Gaps
- The official accessibility concept page URL returned 404, so the a11y details above come from the 0.5.1 source, not prose docs.
- No changelog was found that states when (or if) `@dnd-kit/react` will reach 1.0.
- The default collision detector for the new API (and how it behaves with tall, scrolling columns) was not documented on the pages fetched. The "Customizing feedback" guide and the "collision detection" guide were not read.
- I did not confirm whether the classic `@dnd-kit/core` 6.3.1 shows React 19 warnings (e.g. StrictMode or `findDOMNode`-style deprecations). Its peer range allows React 19.

---

## Alternatives: pragmatic-drag-and-drop, Motion `Reorder`/drag, @hello-pangea/dnd for a multi-column kanban

### Takeaway
- Pragmatic DnD (Atlassian, core 4.0.0, Sep 2026) is a thin, framework-agnostic wrapper over native HTML5 DnD. It is tiny and actively released, but because it is native, the dragged preview is a browser snapshot. You get no live scale/rotate during the drag and no built-in drop animation.
- @hello-pangea/dnd gives the most "beautiful" kanban out of the box (lift, drop animation, keyboard and screen-reader support) and accepts React 19. Its last release was February 2025, it has no grid support, and it is community-maintained.
- Motion `Reorder` is for a single list and is not a cross-column solution.

### Cited Findings
- Pragmatic DnD:
  - Enables "safe and successful usage of the browsers built in drag and drop functionality", with a "~4.7kB core".
  - Works with any view layer and claims "Full feature support in Firefox, Safari, and Chrome, iOS and Android".
  - Some optional packages depend on emotion, react or @atlaskit/tokens.
  — [GitHub atlassian/pragmatic-drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop)
- Pragmatic element adapter:
  - Exposes `draggable({ element, dragHandle, canDrag, getInitialData, … })`, `dropTargetForElements()` (default `dropEffect` "move") and `monitorForElements()`.
  - Draggable events are `onGenerateDragPreview`, `onDragStart`, `onDrag`, `onDropTargetChange` and `onDrop`.
  - The preview image "is collected only at the start of the drag (in `onGenerateDragPreview()`)".
  - Preview helpers are `setCustomNativeDragPreview`, `pointerOutsideOfPreview`, `centerUnderPointer`, `preserveOffsetOnSource` and `disableNativeDragPreview` ("if you want to use your own custom drag preview or have no drag preview").
  — [atlassian.design element adapter](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/adapters/element/about)
- Pragmatic package versions: `pragmatic-drag-and-drop` 4.0.0, `react-drop-indicator` 4.2.4 (peer React `^18.2 || ^19`) and `auto-scroll` 3.2.1, all published 2026-09-24. — [npm registry](https://registry.npmjs.org/@atlaskit/pragmatic-drag-and-drop)
- @hello-pangea/dnd:
  - Fork of react-beautiful-dnd. The creator is "no longer personally maintaning this project" and other maintainers carry it forward.
  - Supports movement between lists, mouse, keyboard and touch, and "powerful keyboard and screen reader support" (English out of the box, customizable).
  - Supports virtual lists. A list can be a scroll container only if it has no scrollable parent.
  - "grid layouts are not supported (yet)".
  - Has a guide on customizing or skipping the drop animation.
  — [GitHub hello-pangea/dnd](https://github.com/hello-pangea/dnd)
- @hello-pangea/dnd latest is 18.0.1 (2025-02-09), with peer React `^18.0.0 || ^19.0.0`. — [npm registry](https://registry.npmjs.org/@hello-pangea/dnd)
- Motion `Reorder`:
  - `Reorder.Group` takes `as` (default `ul`), `axis` (`"x"`, `"y"`, or `"xy"` for grids and wrapped layouts), `values` and `onReorder`.
  - `Reorder.Item` takes `value` and `as` (default `li`) and accepts all `motion` props.
  - The docs page does not mention multi-list or cross-group dragging.
  — [motion.dev Reorder](https://motion.dev/docs/react-reorder)
- `motion` latest is 14.6.0 (2026-10-22), with peer React `^18 || ^19`. — [npm registry](https://registry.npmjs.org/motion)

### Inferences
- Motion `Reorder` is driven by one `values` array per `Group` and has no documented cross-group transfer, so it cannot move a card from "Carregando" to "Em trânsito" on its own. It suits reordering columns or reordering within a column, not this board's status moves.
- Pragmatic DnD gives roughly what the app already has (native DnD), plus better ergonomics (monitor, auto-scroll, drop indicator, cross-browser fixes). The visual requirements (lift with scale/rotation that follows the pointer, smooth drop) still need extra work: `disableNativeDragPreview` plus a hand-rendered pointer-following clone, which re-implements part of dnd-kit.
- @hello-pangea/dnd matches the brief visually (lift, drop animation, a11y) with the least code. But a library with about 20 months without a release, on React 19.2 and Next 16, is a maintenance risk, and its `Draggable` controls `transform` (so Motion `layout` on the same node would conflict, as with dnd-kit).

### Gaps
- Pragmatic's "Drag previews" doc page returned 404, so official wording on native preview limitations (translucency, max size, Safari quirks) was not retrieved.
- The Pragmatic "flourish" (post-move flash) and "live-region"/accessibility packages are known from training data (e.g. `@atlaskit/pragmatic-drag-and-drop-flourish`), but versions and status were not verified this session.
- Pragmatic's accessibility guidance (Atlassian recommends action menus instead of keyboard dragging) was not confirmed from a fetched page. The README only says it offers a toolchain for "assistive technology friendly flows".
- I found no React 19 or Next 16 specific issues for @hello-pangea/dnd. Absence of evidence is not proof of compatibility.

---

## Combining dnd-kit with Motion (`motion/react`) layout animations for reflow

### Takeaway
Both libraries animate position through transforms. Motion `layout` uses CSS `transform`. New dnd-kit uses the `translate` property (WAAPI) on siblings and forces `transform`/`translate` with `!important` on the dragged node. Letting both animate the same node gives double or fighting movement. The safe pattern is "each library owns a different node": either let dnd-kit do the reflow and use Motion only for effects on an inner wrapper, or turn dnd-kit's sortable transition off (`transition: null`) and let Motion animate.

### Cited Findings
- Motion `layout` "measures the layout change, then animates using CSS `transform`" (translate and scale). Layout changes should go through `style`/`className`.
- `layout="position"` animates position only, which suits elements whose aspect ratio changes.
- Matching `layoutId` animates a new element out of the old one (a crossfade if both are mounted).
- `LayoutGroup` syncs layout changes across components that do not re-render together.
- Border radius and box shadow are scale-corrected only if set via `style`/animation props.
— [motion.dev layout animations](https://motion.dev/docs/react-layout-animations)
- New dnd-kit animates displaced sortables via WAAPI on `translate` after moving DOM nodes, and cancels running transitions on `transform`/`translate`/`scale` first. — [sortable.js @0.5.1](https://unpkg.com/@dnd-kit/dom@0.5.1/sortable.js)
- On the dragged element, dnd-kit injects `transform: var(--dnd-transform) !important` and `translate: var(--dnd-translate) !important`. — [dom index.js @0.5.1](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js)
- Since 0.5.1, `useSortable({ transition: null })` really disables the sortable transition. Before, it was replaced by the default. — [GitHub releases](https://github.com/clauderic/dnd-kit/releases)
- A real-world kanban (xNet PR #681) uses the wrapper pattern:
  - For the "Kanban drop settle (BoardView)", Motion animates a wrapper while dnd-kit or native HTML5 drag keeps the inner element.
  - `reducedMotion` is set to `'user'` in Motion config because a global CSS reduced-motion rule cannot reach Motion's inline transforms.
  — [GitHub crs48/xNet PR #681](https://github.com/crs48/xNet/pull/681)

### Inferences
- Recommended pattern A (simplest with dnd-kit): keep dnd-kit's own reflow (default 250 ms `cubic-bezier(0.25,1,0.5,1)`). Use Motion only on an inner `motion.div` for the lift (scale/rotate/shadow, via `animate={{ scale: isDragging ? 1.04 : 1 }}`) and for the post-drop color change. No `layout` prop on the node that holds `ref`.
- Recommended pattern B (cross-column moves animated by Motion): give each card a stable `layoutId={viagem_id}` on an outer `motion.div` wrapper inside a `LayoutGroup` that spans all columns. Put dnd-kit's `ref` on an inner element. When the optimistic state moves the card to another column, React unmounts it in one column and mounts it in the other, and the matching `layoutId` animates between them.
  - The `DragOverlay` (or the dnd-kit drop animation) handles the in-flight card. Disable `dropAnimation` (`null`) if Motion's `layoutId` is doing the landing, to avoid two landing animations.
  - This is unverified. Test for a one-frame jump when the overlay unmounts.
- For this app, which only moves between columns, dnd-kit's sortable sibling animation does not fire unless `useSortable` is used. With `useDraggable`/`useDroppable` only, all reflow (gap closing in the source column, room opening in the target) has to come from Motion `layout`. The conflict then shrinks to the dragged node alone, and the wrapper rule covers it.
- Set `<MotionConfig reducedMotion="user">`, since CSS media queries do not stop Motion's inline transforms (per the xNet note).

### Gaps
- I found no official dnd-kit or Motion documentation addressing their combination. The only concrete source is one third-party PR.
- I found no benchmark of Motion `layout` cost on large columns (e.g. 50+ cards). `layout` measures every flagged element on each render that changes layout.

---

## Keeping native HTML5 DnD but adding the visuals (drag image, FLIP reflow, touch)

### Takeaway
Native DnD can deliver the column highlight, smooth reflow (Motion `layout` with `LayoutGroup`/`layoutId`, or manual FLIP) and the drop color change with modest changes to the current code. It cannot deliver a "lifted" card that animates (scale or rotation transitions) while following the pointer. The drag image is a bitmap taken at `dragstart` that the browser renders (translucent by default), and `setDragImage` only works inside `dragstart`. To get a true animated lift you must hide the native preview and draw your own pointer-following element. At that point you are rebuilding a pointer-based library.

### Cited Findings
- `DataTransfer.setDragImage(image, x, y)`:
  - Accepts an `<img>`, a `<canvas>` or "any other visible element".
  - For non-images, the browser generates "an image generated from the given element (the exact mechanism… is not currently specified)".
  - An existing element must be "visible in the viewport", or you can create an off-screen element "specifically for this purpose".
  - It "can only be used in the handler for the `dragstart` event… Calling it from any other drag event does nothing".
  - By default "a translucent image is generated from the drag target… and follows the mouse pointer".
  — [MDN setDragImage](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage)
- Pragmatic (native-based) confirms the preview is captured once: "collected only at the start of the drag (in `onGenerateDragPreview()`)". Resizing the element mid-drag does not change the image. — [atlassian.design element adapter](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/adapters/element/about)
- Pragmatic claims full iOS and Android support for native DnD in its wrapper. — [GitHub atlassian/pragmatic-drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop)
- Motion `layout`, `layoutId` and `LayoutGroup` behave as in the previous section. `LayoutGroup` is needed so sibling columns that re-render separately animate together. — [motion.dev layout animations](https://motion.dev/docs/react-layout-animations)
- The xNet kanban uses Motion on a wrapper with native HTML5 drag keeping the inner element. — [GitHub crs48/xNet PR #681](https://github.com/crs48/xNet/pull/681)

### Inferences
- What works with native DnD:
  - The lifted look of the preview. In `dragstart`, clone the card, apply `rotate(-2deg) scale(1.04)` and a shadow, append it off-screen, call `e.dataTransfer.setDragImage(clone, offsetX, offsetY)`, and remove it on the next frame. The snapshot is static (no easing into the lift), and browsers may apply their own translucency and may or may not honor transforms or shadows in the bitmap. This is unspecified, so test Chrome, Safari and Firefox.
  - A "ghost" look for the source card while it is dragged (`opacity: .35` via the existing `aoArrastar(true)` state).
  - The column highlight (already in place via `sobre`). Animate it with a CSS `background-color`/`outline` transition.
  - Reflow after drop with Motion `layout` and a shared `layoutId`.
- What does not work with native DnD: smooth scale-up in hand, a lift that follows the pointer with spring physics, a custom drop "settle" from the cursor position (native DnD gives no drop-animation hook, and the browser shows its own snap-back on cancel), and consistent touch on all devices without testing.
- Touch: native DnD on iOS Safari and Android Chrome exists (Pragmatic claims full support), but long-press timing and preview rendering differ by OS. A pointer-events library (dnd-kit default: 250 ms delay and 5 px tolerance for touch) behaves more predictably.

TSX sketch, native DnD plus Motion reflow (fits the existing `cartao.tsx`/`coluna.tsx`):
```tsx
"use client";
import { LayoutGroup, MotionConfig, motion } from "motion/react";

<MotionConfig reducedMotion="user">
  <LayoutGroup id="quadro">
    {colunas.map((col) => (
      <Coluna key={col.id} /* existing onDragOver/onDrop/sobre */>
        {cartoesDa(col.id).map((c) => (
          <motion.div
            key={c.viagem_id}
            layoutId={c.viagem_id!}           // same id in source and target column -> animates between them
            layout="position"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          >
            <CartaoQuadro cartao={c} /* native draggable stays on the inner <article> */ />
          </motion.div>
        ))}
      </Coluna>
    ))}
  </LayoutGroup>
</MotionConfig>

// in CartaoQuadro onDragStart (static "lifted" snapshot as drag image):
onDragStart={(e) => {
  e.dataTransfer.setData("text/plain", c.viagem_id ?? "");
  e.dataTransfer.effectAllowed = "move";
  const r = e.currentTarget.getBoundingClientRect();
  const clone = e.currentTarget.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, { position: "fixed", top: "-1000px", left: "0", width: `${r.width}px`,
    transform: "rotate(-2deg) scale(1.04)", boxShadow: "0 12px 28px rgb(0 0 0 / .2)" });
  document.body.appendChild(clone);
  e.dataTransfer.setDragImage(clone, e.clientX - r.left, e.clientY - r.top);
  requestAnimationFrame(() => clone.remove());
  aoArrastar(true);
}}
```
Color change on landing: drive the background from the column (`data-status={c.status_campo}` with CSS `transition: background-color .3s`), or use `<motion.article animate={{ backgroundColor: corDe(status) }}>`. Because the card re-renders in its new column, the color animates at the same time as the `layoutId` move.

### Gaps
- I found no authoritative per-browser statement on whether CSS transforms and box-shadow on the `setDragImage` element are preserved in the bitmap, or on the translucency each browser applies. The Pragmatic drag-preview doc that likely covers this returned 404.
- No current (2026) browser-compat source was fetched for native HTML5 DnD on iOS Safari and Android Chrome beyond Pragmatic's own claim.

---

## Optimistic update with React 19 `useOptimistic` / `startTransition`, and rollback animation when the server rejects

### Takeaway
`useOptimistic(value, reducer)` shows the moved card in its new column only while an async Transition is pending. When the Transition ends, React renders whatever `value` (server/realtime state) is. On rejection the card falls back to its old column automatically, with no extra code. With Motion `layoutId`, that fallback re-render becomes a visible "slide back" animation. Pair it with a toast and, optionally, a brief shake or flash.

### Cited Findings
- Signature: `const [optimisticState, setOptimistic] = useOptimistic(value, reducer?)`. The reducer must be pure.
- `optimisticState` "is equal to `value` unless an Action is pending".
- "Optimistic state is temporary… otherwise `value` is rendered", and the optimistic and real state converge in the same commit when the Transition completes. — [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic)
- Failure: "If the Action throws an error, the Transition still ends, and React renders with whatever `value` currently is… a failure means `value` hasn't changed, so the UI shows what it showed before." Catch the error to show a message. — [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic)
- If the base `value` changes mid-Action, "React will re-run your `reducer` with the new" value. This fits the app's realtime reloads. — [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic)
- The setter must run inside `startTransition` or an Action prop. Otherwise React warns "An optimistic state update occurred outside a Transition or Action", and the optimistic state only briefly renders. Calling it during render throws "Cannot update optimistic state while rendering". — [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic)
- Canonical pattern: `startTransition(async () => { setOptimistic('b'); const v = await saveChanges('b'); setValue(v); })`. — [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic)
- dnd-kit guide: on cancel, restore your own React state from a `previousItems` ref captured in `onDragStart`. dnd-kit reverts its own DOM changes itself. — [dndkit.com multiple sortable lists](https://dndkit.com/react/guides/multiple-sortable-lists)

### Inferences
- `useOptimistic` maps cleanly onto the current `executar()`:
  - The base value is `dados` (server and realtime).
  - The reducer applies `{ id, para }` moves.
  - The pending `{[id]: para}` map, the `semChave` cleanup and the manual rollback all go away.
  - Pending per card can be derived (`otimista.status !== real.status`) to keep `aria-busy`/`.movendo`.
- Caveat 1, the "passagem" dialog: the optimistic move should start only when the transition starts (after the dialog is confirmed). Between drop and confirm, the card stays in the source column (or shows a local "awaiting form" state). If the user cancels the dialog, nothing needs rolling back.
- Caveat 2, success path: the optimistic value disappears when the Transition ends. The real data must already include the move by then (await `recarregar()` inside the transition, as the code does today), or the card flickers back and then forward.
- Caveat 3, dnd-kit with `onDragOver` live `move()`: the dnd-kit guide mutates `useState` during the drag (outside any transition). For a server-validated board, keep the live preview in local state, then on `onDragEnd` run the server call. On rejection, `setItems(previousItems.current)`. Alternatively, skip live `onDragOver` state, let only `onDragEnd` start the `useOptimistic` transition, and leave the in-drag preview to dnd-kit's own DOM-level optimistic sorting.
- Rollback animation: with `layoutId` on cards, the revert render moves the card back with the same spring. Add a short `animate={{ x: [0, -6, 6, -3, 0] }}` keyed on a "recusado" counter, or a red flash, plus the existing toast. Announce the refusal in an `aria-live` region (see the accessibility section).

TSX sketch:
```tsx
"use client";
import { startTransition, useOptimistic } from "react";

type Movimento = { id: string; para: StatusCampo };

const [quadro, aplicarOtimista] = useOptimistic(dados, (atual: Dados, m: Movimento) => ({
  ...atual,
  cartoes: atual.cartoes.map((c) => (c.viagem_id === m.id ? { ...c, status_campo: m.para } : c)),
}));

function mover(c: Cartao, de: StatusCampo, para: StatusCampo, extra: Record<string, unknown> = {}) {
  startTransition(async () => {
    aplicarOtimista({ id: c.viagem_id!, para });          // card jumps to target (Motion layoutId animates it)
    const r = await moverViagem(c.viagem_id!, de, para, extra).catch(() => ({ ok: false as const, erro: MSG_SEM_REDE }));
    if (!r.ok) {
      toast(r.erro, "alert-circle");
      anunciar(`Não foi possível mover a viagem #${c.numero}: ${r.erro}. Ela voltou para ${rotuloDe(de)}.`);
      marcarRecusado(c.viagem_id!);                       // triggers shake/flash on the card
      return;                                              // transition ends -> UI shows `dados` -> card slides back
    }
    await recarregar();                                    // `dados` now contains the move before optimistic state drops
  });
}
```

### Gaps
- react.dev's page does not list React 19.1 or 19.2 specific changes to `useOptimistic`. I found no version-specific behavior changes.
- I found no source testing `useOptimistic` together with dnd-kit's internal DOM-level optimistic sorting (possible double-move on drop). This needs a spike.

---

## Keyboard and screen-reader accessibility for moving cards between columns

### Takeaway
dnd-kit (new) gives keyboard dragging (Space/Enter to pick up, arrows to move, Space/Enter/Tab to drop, Escape to cancel) and live-region announcements out of the box. The defaults are English and id-based, so they must be localized. @hello-pangea/dnd also ships strong keyboard and screen-reader support. Pragmatic and native DnD provide none by default, so you need an alternative control. The app already has one: the "Mover" menu, which is the most robust pattern for a status board and should stay regardless of library.

### Cited Findings
- dnd-kit `KeyboardSensor` defaults: start `Space`/`Enter`, cancel `Escape`, end `Space`/`Enter`/`Tab`. Since 0.5.1 it matches on `event.key`, which respects keyboard layouts. — [dom index.js @0.5.1](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js); [GitHub releases](https://github.com/clauderic/dnd-kit/releases)
- dnd-kit Accessibility plugin defaults:
  - `role="button"` and `aria-roledescription="draggable"`.
  - `aria-describedby` instructions text.
  - Live announcements for `dragstart`/`dragover`/`dragend` (including cancel), customizable via `announcements` and `screenReaderInstructions`.
  - In 0.5.1, `aria-pressed` is no longer set on non-button roles.
  — [dom index.js @0.5.1](https://unpkg.com/@dnd-kit/dom@0.5.1/index.js); [GitHub releases](https://github.com/clauderic/dnd-kit/releases)
- @hello-pangea/dnd: "powerful keyboard and screen reader support", "for english screen readers out of the box", customizable and internationalizable. — [GitHub hello-pangea/dnd](https://github.com/hello-pangea/dnd)
- Pragmatic: provides "a toolchain to allow you to quickly wire up performant assistive technology friendly flows", based on the Atlassian Design System. — [GitHub atlassian/pragmatic-drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop)

### Inferences
- Localized dnd-kit announcements for this board:
```tsx
const announcements = {
  dragstart: ({ operation: { source } }) => source && `Viagem ${rotuloCartao(source.id)} pega. Use as setas para escolher a coluna; Espaço para soltar, Esc para cancelar.`,
  dragover:  ({ operation: { source, target } }) => source && target && `Sobre a coluna ${rotuloColuna(target.id)}.`,
  dragend:   ({ operation: { source, target }, canceled }) =>
    !source ? undefined : canceled ? `Movimento cancelado. A viagem ficou em ${rotuloColuna(source.data.de)}.`
      : target ? `Viagem solta em ${rotuloColuna(target.id)}. Gravando…` : undefined,
};
// passed via Accessibility.configure({ announcements, screenReaderInstructions: { draggable: "Para mover, pressione Espaço…" } }) in plugins
```
(The exact plugin wiring, `Accessibility.configure(...)` in `DragDropProvider plugins`, is inferred from the exported `Accessibility` plugin and the `Plugin.configure()` pattern in the useSortable docs. Verify before use.)
- Server outcome must be announced separately (success or refusal), since the drag `dragend` fires before the server responds. Use the app's own `aria-live="polite"` region (or the toast if it is live).
- Keep the "Mover" menu (button, then list of destination columns) as the primary keyboard and SR path. Arrow-key dragging across wide boards with off-screen columns is slow, and some moves need the "passagem" form anyway.
- The card's `<Link>` inside the draggable conflicts with keyboard pickup on the card (Enter both opens and picks up). Use a dedicated drag handle (`handleRef`) or keep the whole card non-focusable as a draggable, with the menu button as the focus target. dnd-kit's `preventActivation` already blocks pointer drags starting on nested interactive elements.
- Honor reduced motion. dnd-kit zeroes durations under `prefers-reduced-motion` (cited above). Set Motion's `MotionConfig reducedMotion="user"`, and drop the scale and rotate lift under the media query.

### Gaps
- dnd-kit's prose accessibility guide (URL 404) was not read. The behavior is taken from the source.
- I found no source evaluating NVDA, JAWS or VoiceOver with dnd-kit 0.5.x specifically.

---

### Overall comparison (for the report writer)

| Option | Lift (scale/rotate/shadow) that follows the pointer | Column highlight | Reflow animation | Drop animation | Touch | Keyboard / SR | Maintenance (Oct 2026) | Fit with server-validated moves |
|---|---|---|---|---|---|---|---|---|
| `@dnd-kit/react` 0.5.1 | Yes (inner wrapper or `DragOverlay`) | `isDropTarget` | Built-in sortable FLIP (`translate`, 250 ms), or Motion | `DragOverlay dropAnimation` | Pointer events, 250 ms delay | Built-in, must localize | Active, pre-1.0 | `onDragEnd` + `useOptimistic`; cancel restore documented |
| `@dnd-kit/core` 6.3.1 + sortable 10 | Yes (`DragOverlay`) | `isOver` | `useSortable` transitions | Yes | Pointer/Touch sensors | Built-in | Legacy, last release Dec 2024 | Same |
| Pragmatic DnD 4.0.0 | No (static native snapshot) unless a custom preview is drawn | Yes | Bring your own (Motion) | None built-in (unverified flourish pkg) | Native, claims iOS/Android | Toolchain, not automatic | Active (Sep 2026) | `onDrop` + `useOptimistic` |
| @hello-pangea/dnd 18.0.1 | Yes, built-in | `snapshot` (from training data, unverified) | Built-in | Built-in, customizable | Yes | Built-in, English | Slow (last release Feb 2025) | `onDragEnd` + state |
| Native HTML5 + Motion (current) | Static snapshot via `setDragImage` only | Yes (exists) | Motion `layout`/`layoutId` | Browser default only | Platform-dependent | None, use the "Mover" menu | n/a | Already in place; swap to `useOptimistic` |
| Motion `Reorder` | Yes (`whileDrag`) | Manual | Built-in | Built-in | Yes | No | Active | Single list only, no cross-column |
