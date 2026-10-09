# Development guide

## Boundaries

Phaser owns gameplay, physics and UI. Three.js renders the same state on an X/Z ground plane; it must not change inventory, collision or navigation. Scenes assemble systems. Pure domain modules remain testable with Node's TypeScript stripping, without Phaser or WebGL mocks.

Generated art is replaceable through presentation views and shared product models. `VisualTheme.ts` owns world colors/scales; `UiTheme.ts` owns UI tokens. Keep 2D fallback assets. Decorations are non-colliding, and visual animation never changes physics coordinates.

## Configuration

| Area | Source |
| --- | --- |
| Resolution, controls, movement | `src/game/config/settings.ts` |
| Furniture and interaction positions | `src/game/world/ShopDefinition.ts` |
| Products, integer-VND prices | `src/game/products/ProductCatalog.ts` |
| Day duration and goal growth | `src/game/day/DayConfig.ts` |
| Customer spawning | `src/game/customers/CustomerConfig.ts` |
| Checkout duration and queue limits | `src/game/checkout/CheckoutConfig.ts` |
| Supplier order limits and delivery | `src/game/supplier/SupplierConfig.ts` |
| Cleaning, employees, logistics | `src/game/operations/OperationsConfig.ts` |
| Upgrades | `src/game/upgrades/UpgradeSystem.ts` |
| Camera and render scale | `src/game/presentation/three/ThreeRules.ts` |

## Session behavior

- PREPARATION has no countdown or customer spawning. Orders paid here count toward the current day's expenses.
- OPEN counts down simulation time and permits customer spawning. Revenue, rather than balance or profit, advances the goal.
- CLOSING stops spawning; customers, checkout and already-paid inbound deliveries finish before SUMMARY.
- SUMMARY pauses simulation. Next Day preserves money, stock, carried/dropped goods, arrived cargo and history.
- Modals pause player input, camera input and all simulation timers. No domain timer uses wall-clock time.
- Supplier arrival adds truck cargo. Only unpacking at the receiving point adds warehouse stock.
- Save checkpoints recover unpaid customer and employee goods without mutating the live shop. Paid sales are never recovered. Partial cleaning jobs restart after loading.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Run the relevant browser checks after changes. Automated geometry/domain tests cannot verify GPU rendering, occlusion, animation or layout. Record socket or browser-access restrictions honestly; do not claim visual verification from a successful build.

### Gameplay checklist

- Start solo and co-op. Check independent Shift keys, normalized diagonals, obstacle corners, focus loss and nearest interaction prompts.
- Take finite stock, empty a crate, perform a partial shelf transfer, reject wrong/packed products, and hand off a dropped stack between players.
- Order with insufficient and sufficient funds. Verify one deduction, one truck arrival, partial unloading and exact warehouse quantities after unpacking.
- Watch multiple customers navigate, collect mixed/partial carts, queue and advance. Test final-stock competition and out-of-stock departures.
- Serve both cashiers simultaneously, then compete for one cashier. Verify payment exactly once; waiting timeout returns unpaid goods and never cancels a claimed checkout.
- Clean with both tools, cancel by walking away, and compete for one dirt spot. Hire each employee role; check wages, unpaid rest and shared jobs.
- Swap shelves, reject occupied positions, expand the shop and check routes. Advance days with dated goods in warehouse, shelves, held stacks, floor and truck.
- Verify preparation accounting, goal progress, closing drain and summary. Next Day resets daily stats while retaining session totals, money and stock.
- Save/Continue with pending delivery, partial cargo, unpaid carts, employees, expansion and summary. Verify no duplicated goods, payments or wages.

### Visual checklist

- Inspect menu with/without a save, solo/co-op HUD and every modal. Check long Vietnamese text, large balances, hover/disabled states and click capture.
- Cycle all cameras. Walk in four directions, carry products, inspect shelves and approach walls. Third-person auto-follow must keep held movement stable and the avatar visible.
- Rotate around floor seams, wall trim, product packaging and the annex. Check flicker, shadows, depth sorting, product visibility and character scale.
- Verify request bubbles, checkout progress, floating feedback and goal feedback once per day.
- Repeat with reduced motion and the 2D fallback. Return to menu/re-enter repeatedly; inspect alignment and confirm no leftover canvases, listeners or overlapping audio.

## Design references

Interface research drew on the public descriptions of [Tiny Bookshop](https://tinybookshopgame.com/), [Minami Lane](https://store.steampowered.com/app/2678990/Minami_Lane/) and [Supermarket Simulator](https://supermarketsimulator.com/). Artwork, models, logos and fonts are original procedural assets; no assets from those games are included.
