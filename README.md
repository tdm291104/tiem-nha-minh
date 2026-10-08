# Tiệm Nhà Mình

A cozy Vietnamese neighborhood grocery game prototype. Buy inventory, carry goods from the kho, stock shelves, and serve customers at the cashier to earn store money. Play alone or share stocking and checkout duties with a friend on the same keyboard.

The playable shop now uses real Three.js 3D models with a low oblique three-quarter camera, a brighter cream/mint/teal/coral palette, soft shadows, and warm lighting. Male/female shopkeepers, five customer variants, fictional grocery packages, shelves, refrigerators, counters, storage cartons, and the supplier desk share this visual style. Phaser continues to run input, ground-plane physics and UI; all Phase 1-6 inventory, customer, checkout, supplier and day rules are preserved. Models are generated locally without downloaded artwork or audio assets.

## Technology

- TypeScript with strict checks
- Phaser 3, Arcade Physics, and Phaser canvas UI
- Three.js with WebGL 2 for the 3D world and generated UI portraits/icons
- Vite and npm
- Plain HTML/CSS for the game host; no React or backend

## Getting started

Use Node.js 22.12+ with npm. An internet connection is required for the first dependency installation. Tests use Node's built-in test runner and TypeScript stripping, so no test framework is installed.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally http://localhost:5173. Choose **Chơi 1 người** or **Chơi 2 người**. The menu also accepts **1** and **2**. Day 1 starts in preparation: stock shelves, then approach the entrance and press E (P1) or Enter (P2) to open. This prototype needs a physical keyboard; touch controls are not implemented. Use a browser with WebGL 2 and hardware acceleration for 3D. If WebGL 2 is unavailable, the game keeps its previous 2D presentation and shows a notice.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`build` runs TypeScript checks before creating `dist/`. Deploy that folder on a static web host. `preview` serves the production build locally.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | WASD | Arrow keys |
| Take stock / stock shelf / checkout / supplier / open store | E | Enter |
| Pick up nearby dropped stack / drop held stack | F | / |
| Sprint (hold) | Left Shift | Right Shift |
| Cycle camera mode (solo, WebGL 2) | C | Shared camera in co-op |
| Look around in first/third person | Hold right mouse button and drag | Shared camera in co-op |
| Close supplier modal / otherwise return to menu | Esc | Esc |
| Adjust order / confirm / close supplier / next day | Mouse | Mouse |

Bindings use physical keyboard codes in `src/game/config/settings.ts`, so each player's Shift key works independently. Click the game if the page does not have keyboard focus. Some keyboards cannot register many simultaneous keys; reduce simultaneous sprint inputs if your keyboard has that limitation.

## Current features

- Boot, menu, and shop scenes, with repeatable transitions between modes.
- Shared PREPARATION, OPEN, CLOSING, and SUMMARY states with revenue goals and five-minute open periods.
- Either player can open the store at the entrance; customer spawning runs only during OPEN.
- End-of-day summaries include sales, expenses, profit, stock failures, and goal results.
- Next Day preserves money, physical goods, player-held stacks, dropped goods, and all accounting/order history.
- Reusable `Player[]` architecture, normalized movement, and sprinting.
- Solid walls, five shelves, two functional checkout counters, and five storage crates.
- Players pass through each other.
- A smooth tilted 3D follow camera for solo play and one adaptive shared camera for co-op.
- Data-driven product catalog with Mì gói, Nước ngọt, Sữa, Bánh quy, and Nước mắm, each with a distinct generated shape and color.
- Storage starts with ten units per product and supplies at most five per pickup; partially depleted crates give their remaining units.
- A supplier desk opens mouse-operated ordering with five-unit increments and a 50-unit limit per product.
- One delivery at a time arrives after five seconds of unpaused gameplay and updates crate quantities immediately.
- Each player carries one independent product stack. Its icon and quantity follow the player; a fixed HUD also displays what each active player is carrying.
- Shelves display current stock and capacity. They reject wrong products and preserve held goods when full. Partial transfers retain every remaining unit.
- Dropped stacks show their product and quantity on the floor. Either player can pick them up with their own pickup key.
- Nearest reachable interactable targeting, with stable ties, obstacle checks, and one interaction per key press.
- Keyboard state resets when focus is lost, avoiding stuck movement.
- Procedural blue-shirt male and coral-shirt female 3D shopkeepers, colorful packages, and Vietnamese signs.
- Five customer visual archetypes, readable projected product request bubbles, and success/failure expressions.
- Automatic customer arrivals, obstacle-aware A* navigation, browsing, real stock consumption, checkout queues, and clean departures.
- Independent player-operated cashiers with processing feedback, payment popups, and customer thanks.
- FIFO queue advancement, capacity limits, and separate overflow waiting positions.
- Integer-VND session money, immutable sale/order records, a SALE/SUPPLIER_PURCHASE money ledger, and revenue/expense/profit/customer/item statistics.
- Immediate shelf labels and product-icon updates driven by stock-change notifications.

## Camera modes

Solo play offers **Góc xiên**, **Thứ nhất** and **Thứ ba**. Click the camera buttons beneath the HUD or press **C** to cycle. Co-op retains the shared oblique camera so both players remain visible. Browsers using the 2D fallback retain the original camera.

- **Góc xiên:** the existing low three-quarter view and world-aligned movement.
- **Thứ nhất:** a perspective camera at the shopkeeper's eye height. The own character is hidden; carried packaging is visible at the lower right. WASD moves relative to the mouse viewing direction.
- **Thứ ba:** a perspective camera behind the shopkeeper. It follows position and automatically swings behind movement, including left/right movement. A held movement direction keeps its original input basis until release, preventing an automatic camera turn from making the character run in circles. Right-mouse dragging temporarily overrides automatic rotation for 750 ms. The camera retracts at furniture/walls; in very tight spaces it moves above the player, keeping the avatar visible.

Hold the **right mouse button and drag** to look horizontally/vertically in either perspective mode. Vertical look is clamped. Perspective interaction prompts are anchored above the footer; offscreen/behind-camera world labels are hidden. Target selection and E/F actions use the original nearest-reachable rules, not a new aiming or shooting system. Supplier modals, SUMMARY and focus loss preserve gameplay pause/input reset behavior; camera-mode/look inputs are blocked while simulation is paused.

Manual camera checks: cycle all three modes while idle/moving/carrying; walk forward/back/left/right and diagonally; in third person hold A or D and confirm camera rotation without circular movement; release and try another direction; drag the mouse and inspect shelves; approach walls/counters and confirm the character remains visible; test E/F, supplier modal, checkout and Next Day in each mode; return to menu/restart; confirm co-op remains on the shared camera. Browser verification remains required.

## Days and progression

```text
DAY N: PREPARATION -> OPEN -> CLOSING -> SUMMARY
                                         |
                      DAY N+1 PREPARATION <- Next Day
```

`DayManager` owns this single authoritative state, day number, countdown, shared simulation clock, revenue goal, start-of-day accounting snapshot, and out-of-stock departure IDs. It does not perform checkout, delivery, inventory transfers, or customer AI. ShopScene coordinates the existing systems using state changes and domain activity queries.

### Preparation and opening

Every day starts in **CHUẨN BỊ MỞ CỬA**, without a preparation countdown. No customers exist or spawn. Players can move, take/drop/pick up goods, stock shelves, and order stock. Deliveries progress while preparation is unpaused. Preparation expenses already belong to that day.

Approach **MỞ CỬA** at the entrance and press E or Enter. Either player can open the shared store. Opening claims PREPARATION -> OPEN synchronously, so simultaneous attempts cannot start duplicate timers/spawners or replace the accounting baseline. The spawner starts with its normal initial delay on each new opening.

### Open time and revenue goals

The default open duration is **300 seconds**, formatted as `05:00`, `04:59`, and so on without negative values. Edit `src/game/day/DayConfig.ts` to use a short development duration such as `30_000` milliseconds. Tests inject shorter settings without waiting in real time.

| Day | Revenue goal |
| --- | ---: |
| 1 | 50.000đ |
| 2 | 75.000đ |
| 3 | 100.000đ |
| 4 and later | 50.000đ + (day - 1) × 25.000đ |

The top HUD prioritizes day/state, remaining OPEN time, and **today's revenue / today's goal**. Lower compact accounting figures are marked **CẢ PHIÊN** and retain totals across all days. Balance and both players' held goods remain visible. A goal succeeds when daily revenue is at least the target; expenses and store balance never affect goal progress.

The clock uses gameplay delta time, never Date.now(). Preparation, OPEN, and CLOSING advance the shared simulation timestamp used by supplier orders and checkout transactions. Supplier modal and SUMMARY pause all simulation updates. UI remains mouse-operable while gameplay is paused; movement keys must be released/repressed after resuming.

### Closing and summary

At zero time the store enters **ĐANG ĐÓNG CỬA** and stops new spawning immediately. Existing customers continue browsing, taking real stock, queueing, waiting for player checkout, and leaving. Players can move, restock, transfer goods, and operate either cashier. New supplier ordering is disabled.

**Delivery policy: complete paid deliveries before SUMMARY.** Closing continues until active customers are zero, checkout has no processing job, and the active supplier delivery has completed. No customer is destroyed just to end the day, and paid orders are not silently lost. Because checkout is player-operated, closing can wait indefinitely for players to serve remaining customers.

The full-screen summary pauses physics, controls, clock, customers, spawning, checkout, and delivery. Its overlay captures pointer events. It shows daily revenue, expenses, profit, customers served, units sold, customers leaving because of out-of-stock requests, the goal, and **HOÀN THÀNH MỤC TIÊU** or **CHƯA ĐẠT MỤC TIÊU**. Either result allows continuing. Click **NGÀY TIẾP THEO**; a day-specific input guard prevents duplicate or stale clicks from advancing twice. Esc still returns to the menu and discards the session.

### Daily accounting and continuity

Daily statistics are immutable deltas from the accounting snapshot captured at the start of that day's PREPARATION. `SalesStats` and `StoreEconomy` remain session-wide and are never reset by a day transition. Expenses belong to the day an order is confirmed/paid, even if confirmed during preparation. Daily profit is daily sales revenue minus daily purchase expenses, not a balance difference.

Out-of-stock departures are reported by CustomerBrain once when a genuinely failed stock trip despawns. Navigation failures do not count. DayManager also deduplicates customer IDs and clears only the daily departure set on Next Day.

Next Day increments the day, resets its countdown and daily counters, captures the new preparation baseline, and computes the next goal. It keeps the same scene, players, inventory, shelves, dropped items, economy, supplier, and customer manager. Customers have already departed; queues are cleared and cashiers are idle. Customer, sale, and supplier IDs continue rather than restarting. Money, goods, prices, sales, money ledger, and supplier history remain intact. There is no persistence after leaving the session or reloading the browser.

## Customer shopping loop

Customers appear near the entrance about two seconds after a player opens the store, never merely on entering ShopScene. Spawning stops at closing; customers already inside continue shopping and checkout. Further arrivals are randomized between four and eight seconds, with at most five active customers. When the store is at capacity, spawning waits for a free slot and does not accumulate a burst of arrivals. Settings live in `src/game/customers/CustomerConfig.ts`.

Each customer walks to an interior entrance waypoint, chooses one of the five catalog products, and displays **Muốn: Mì gói** or its equivalent. Shelf discovery uses product IDs and supports multiple matching shelves: reachable stocked shelves are preferred, ordered by distance, followed by empty shelves if no stocked option is reachable.

At the shelf's marked standing point, the customer browses for 0.5-1.5 seconds, then takes one unit with the existing `ShelfInventory.take()`. Stock is not reserved during walking or browsing. If two customers target the last unit, the first takes it and the second sees the real empty inventory. Shelf labels and visible product icons update synchronously with stock changes.

Successful customers retain their actual collected goods in an immutable cart and head to checkout. They leave only after a player completes their payment. An empty shelf produces **Hết hàng!**, a 1.2-second wait, and a departure with no invented goods. Failed trips never join a queue, create a sale, or change money or served-customer statistics. The trip tracks `carriedQuantity` and `purchaseIntentFulfilled`. Requests support larger quantities in the model, though the prototype requests one. Customers never choose a substitute product in this phase.

The complete loop is: players buy inventory, delivery replenishes storage, players stock shelves, customers collect goods and queue, players operate cashiers, completed sales earn money, and customers leave. Restocking and checkout can happen simultaneously. Customer shopping and queue selection are independent of which players are active and identical in solo and co-op modes. Customers pass through players and each other intentionally.

### States and ownership

```text
SPAWNING -> ENTERING -> CHOOSING_PRODUCT -> MOVING_TO_SHELF
         -> BROWSING -> TAKING_PRODUCT -> MOVING_TO_CHECKOUT
                           |                 -> QUEUEING -> WAITING_FOR_CHECKOUT
                           |                              -> CHECKOUT -> LEAVING -> DESPAWNED
                           +-> OUT_OF_STOCK -> LEAVING -> DESPAWNED

Full queues: MOVING_TO_CHECKOUT -> WAITING_FOR_QUEUE -> MOVING_TO_CHECKOUT
```

`CustomerBrain` owns this explicit, tested state machine independently of Phaser. `Customer` renders the chibi, request/feedback bubble, carried icon, and separate debug label. Set `CUSTOMERS.debugStates` to `false` to hide state labels. `CustomerManager` owns active entities and removes each container and its children when despawned. Its pure `CustomerSpawner` uses frame elapsed time rather than external timers, and is stopped when the scene shuts down.

Navigation failure ends the shopping attempt and starts a departure. If the exit is unreachable too, the customer despawns. A configurable 45-second patience limit aborts shopping before goods are collected; exit movement can still finish. Customers holding goods wait indefinitely for player checkout, so that timeout cannot bypass payment. Missing shelves and blocked destinations do not throw pathfinding errors.

### Navigation

The navigation grid is built once after store fixtures from the same static rectangles used by player collision. It uses 20-pixel cells and expands obstacles by a 16-pixel customer footprint clearance; cells intersecting that expanded area are blocked. This includes walls, shelves, checkout counters, storage crates, and the supplier desk. The entrance opening sign is non-solid and does not change A*. Customer world coordinates represent feet, and targets are standing points below shelves, never shelf centers.

Internal four-way A* prevents diagonal corner cutting. A pure `NavigationAgent` follows the route with a distance budget derived from speed and elapsed time, consumes multiple waypoints when needed, and stops exactly at the destination. Routes are calculated when entering, choosing a shelf, joining a queue, changing queue slots, or leaving, not every frame. The grid and agent are independent of customer behavior and can be reused for future employees. The current map is static; rebuild the grid if a later milestone adds moving furniture.

The entrance is a waypoint near the existing lower doorway mat. Customers do not cross the bottom wall into an exterior map in this prototype.

## Storage and stocking

Enter the storage area through the central opening at the top of the shop. The five labeled crates draw from one authoritative `StoreStorage`, with ten initial units per product configured in `SupplierConfig.ts`. Each crate displays **Kho: N**, updated by storage notifications after pickup or delivery. Approach a crate from below and press E or Enter. If already carrying a stack, the crate reports **Bạn đang cầm hàng.** and preserves it. Empty-handed pickup takes up to the product max stack: a crate with three units gives a stack of three and becomes empty. At zero, **Hết hàng trong kho.** appears and no goods are created.

Walk to the matching shelf's marked point on its lower side and interact to stock it. All shelves have capacity 20 and start with five units, allowing customers to empty them while players restock. Initial stock, fixture placements, dimensions, and entrance waypoints are configured in `src/game/world/ShopDefinition.ts`.

For example, a stack of five stocked into a shelf at 18/20 fills it to 20/20 and leaves three in your hands. A wrong product reports **Kệ này không dành cho sản phẩm này.** A full matching shelf reports **Kệ đã đầy.** Empty hands cannot add stock.

Press F or / while carrying to drop the entire remaining stack at your feet. With empty hands, the same key picks up the nearest reachable floor stack within 65 world pixels. You can drop and retrieve your own goods, or let the other player pick them up. Picking up while holding is not a swap: the key drops your current stack. There is no stack merging or inventory grid.

Next Day preserves stock, held stacks, dropped goods, money, and histories in the same ShopScene. Returning to the menu and starting a new game resets the entire session. Saves are outside this milestone.

## Checkout, queues, and money

Two stations, **QUẦY 1** and **QUẦY 2**, use the same cashier implementation. Customers choose the shortest reachable queue. Queue length includes customers still walking to their slots and the customer currently being processed. Equal lengths prefer the nearest counter, then cashier ID. A customer keeps the chosen queue for the trip.

Each queue has four configured standing positions, spaced 90 world pixels apart above the counter. When a sale completes, the next customers walk toward their new slots using the existing navigation agent. Positions change only when ordering changes; customers are never teleported forward. General NPC collisions remain disabled.

If queues are full, customers use distinct overflow positions and retry every second. Overflow is uncommon with the default five active customers and eight total queue slots. To test it, temporarily set `CHECKOUT.maxQueueLength` to 1. Five overflow positions accommodate the default customer limit; adjust waiting positions if raising that limit.

The front customer shows **Chờ tính tiền...** only after reaching the front slot. Approach the lower side of a counter and press **E** or **Enter** when the prompt says **Tính tiền**. The cashier claims that customer synchronously and processes for one second. Players can walk away immediately. Repeated presses or both players interacting with one cashier cannot create a second checkout. P1 and P2 can operate different counters simultaneously.

On completion, the cashier shows **+5.000đ** or the appropriate total, and the customer says **Cảm ơn!** briefly before leaving. The HUD retains both players' held-item status and displays store money and customers served. Session revenue, items sold, and units sold by product are available in `StoreEconomy.statistics` without a separate analytics screen.

Money starts at **100.000đ**, configured with checkout timing and capacity in `src/game/checkout/CheckoutConfig.ts`. Fictional sell prices are centralized in the catalog:

| Product | Buy price | Sell price |
| --- | ---: | ---: |
| Mì gói | 3.000đ | 5.000đ |
| Nước ngọt | 6.000đ | 10.000đ |
| Sữa | 8.000đ | 12.000đ |
| Bánh quy | 9.000đ | 15.000đ |
| Nước mắm | 15.000đ | 25.000đ |

## Supplier ordering and delivery

The **ĐẶT HÀNG** desk sits in the left aisle and is usable only during PREPARATION or OPEN. New orders are rejected during CLOSING and SUMMARY at the domain boundary, as well as hidden from interaction targeting. Approach its lower side and press E or Enter. The fixed Phaser overlay shows all five products, buy price per unit, quantities, total cost, and available money. Use the mouse **-5 / +5** buttons; quantities start at zero, clamp to 0-50, and update the total immediately. Select **ĐẶT HÀNG** to confirm, or **ĐÓNG** / Esc to cancel without spending. Ordering never modifies either player's held goods.

The modal pauses **both players, physics, the day countdown/shared simulation clock, customer simulation, checkout, spawning, and delivery progress**. Input is cleared on opening/closing to prevent a queued pickup or interaction afterward. Clicks are captured by the overlay. Movement resumes after closing; held movement keys must be released and pressed again. An accepted order closes the panel and resumes the game.

`SupplierSystem` allows **one active delivery**. Additional confirmations report **Đang có đơn hàng được giao.** Orders with zero/invalid quantities are rejected. **Không đủ tiền.** rejects the entire order without spending, partial purchasing, or a delivery. A valid order validates all lines first, snapshots buy prices, then spends through `StoreEconomy.trySpend()` and enters `DELIVERING`. Confirmation tokens and spending references prevent duplicate orders and deductions, including reuse after delivery.

Delivery takes **five seconds of unpaused game time**, configured in `SupplierConfig.ts`; no truck NPC is implemented. The HUD shows order ID and remaining seconds. Completion adds every order line to storage atomically, changes the immutable order snapshot to `DELIVERED`, and shows **Đã giao hàng!** Each order delivers once, including if completion is called repeatedly or reentrantly. Both players use the same store money, storage, and supplier; order records retain the placing `playerId`.

Orders contain ID, player ID, immutable item lines with product/quantity/unit buy price/line total, total cost, creation time, and status. `PENDING` represents the validated quote; accepted orders become `DELIVERING`, then `DELIVERED`. UI draft state is separate from supplier business rules. Closing the panel without confirming creates no order.

### Session accounting

The compact HUD shows **TIỀN**, **DOANH THU**, **CHI PHÍ**, **LỢI NHUẬN**, and **KHÁCH ĐÃ PHỤC VỤ**, while retaining P1/P2 carried stacks. `StoreEconomy.accounting` combines sales statistics with expenses; the existing `statistics` API remains focused on sales. `moneyLedger` contains frozen positive SALE and negative SUPPLIER_PURCHASE entries, references, balances after each entry, and game timestamps.

- Balance starts at 100.000đ and changes on supplier confirmation and completed checkout.
- Revenue records completed customer sales only.
- Expenses record inventory purchases at order confirmation, independently of delivery or later sales.
- Profit is **revenue minus expenses**, and can be negative. Initial balance is not profit.

For example: buy ten noodles for 30.000đ, deliver them, stock five, and sell one for 5.000đ. Balance becomes **75.000đ**, revenue **5.000đ**, expenses **30.000đ**, and profit **-25.000đ**. This is session cash-flow profit, not cost-of-goods-sold accounting. Initial shelf/storage supplies are prototype starting stock and incur no expense.

Delivery uses frame updates, without asynchronous timers. Already-paid delivery continues during closing and must finish before SUMMARY. Next Day retains its order history and delivered goods. Returning to the menu discards unfinished orders, drafts, and the entire session; there is no persistence or refund system. Shutdown stops deliveries, clears subscriptions, and destroys the panel and pointer listeners. A discarded order cannot mutate a new shop session.

### Ownership and payment invariants

- `CustomerBrain` owns shopping and a cart of product/quantity lines. The current request is one unit of one product; the cart and transaction models support multiple lines.
- `CheckoutQueue` owns FIFO ordering. `CashierStation` owns `IDLE`, `HAS_CUSTOMER`, and `PROCESSING` states and the elapsed-time job.
- `CheckoutSystem` owns unique queue membership, overflow assignment, readiness, synchronous checkout claiming, and completion coordination. `Cashier` renders the counter and implements the existing `Interactable` contract.
- `StoreEconomy` alone commits balance changes. `SalesStats` owns session totals. Both reject invalid or unsafe integer arithmetic; VND never uses fractional units.
- Each deeply frozen transaction records its ID, customer ID, cashier ID, initiating player ID, completion game time, and item lines with quantity, unit price, and line total. The total equals the sum of line totals.
- A sale requires a nonempty registered purchase. Duplicate transaction IDs and previously served customer IDs cannot credit money or statistics again, including after the customer's lifecycle record is removed.

Checkout jobs run from frame updates, without asynchronous timers. Scene shutdown cancels jobs, clears queues and customer references, removes subscriptions, and destroys temporary UI. No abandoned job can credit a later session. Between days, queue references are cleared only when idle, preserving sale IDs, served-customer guards, listeners, and accounting history.

## Product and inventory architecture

`ProductCatalog.ts` centrally defines IDs, Vietnamese names, categories, placeholder styles, maximum carried stack sizes, and integer-VND `buyPrice` and `sellPrice` values. Supplier orders snapshot buy prices; checkout transactions snapshot sell prices.

`StoreStorage` owns all back-room quantities. Crates only observe it; `retrieveStorageStack` is the pure transfer rule used by `InventorySystem`. Storage validates nonnegative safe integer quantities and entire delivery batches before mutation. Taking, dropping, picking up, stocking, and customer collection transfer goods rather than generating them. Supplier delivery is a legitimate source; a completed sale moves goods out of physical store inventory while retaining the sale receipt.

`transferToShelf` is pure and validates integer quantities and capacity. `ShelfInventory` owns stock changes and exposes `take(quantity)`, returning only the quantity actually available. Both player stocking and customer taking notify subscribed shelf views; there is no duplicate customer inventory or frame-by-frame label polling. Shelf views unsubscribe when destroyed. `InventorySystem` continues to handle storage retrieval, shelf transfers, floor drops, and pickup for every `Player`. Held stacks are validated immutable values; successful transfers clear the held stack or retain its exact remainder.

Dropped items have unique IDs. Pickup removes the item from the registry synchronously before the next player's action, preventing two players from claiming one stack. Player input is edge-triggered, so holding an interaction or pickup key does not repeat actions. New world items live in a world container excluded from the fixed HUD camera, and newly spawned customers are also excluded from that camera.

## Project structure

```text
src/
  main.ts
  style.css
  game/
    config/        # Game configuration, controls, tuning values
    scenes/        # BootScene, MenuScene, ShopScene
    entities/      # Player, Shelf, StorageCrate, WorldItem, Customer, Cashier, SupplierTerminal, StoreDoor
    presentation/  # Theme, feedback, generated 2D fallback textures
      three/       # 3D models, camera, labels, environment, shared model resources, UI art
    audio/         # Safe named audio events, settings, Phaser adapter without required assets
    day/           # Day config, state/clock manager, daily snapshot deltas, pure goal/time rules
    customers/     # Config, state machine, shopping requests, manager, spawner
    checkout/      # Config, FIFO queues, cashier state, coordinator, sale model
    economy/       # Integer VND, store balance, sales stats, expense/ledger accounting
    inventory/     # Authoritative finite StoreStorage and pure retrieval transfer
    supplier/      # Config, immutable order/pricing, UI draft, delivery coordinator
    navigation/    # Pure grid, A*, path follower; Phaser collider-to-grid adapter
    components/    # PlayerController and ShopCamera
    interactions/  # Interactable contract and nearest-target InteractionSystem
    products/      # Product types, central catalog, pure stock-transfer rules
    systems/       # Shared InventorySystem
    world/         # Pure ShopDefinition, layout rendering, obstacle checks, textures
    ui/            # InteractionPrompt, HeldItemView, ShopHud, SupplierOrderPanel, DaySummaryPanel
    types/         # Shared player, control, and scene types
tests/
  three-presentation.test.mjs # 3D coordinates, camera, projection, geometry, density and motion
  visual-redesign.test.mjs # Packaging/display mapping, identity, direction, scale, depth, invariant configs
  presentation.test.mjs # Facing, archetypes, ratios, real checkout progress, goal latch, motion/audio
  day.test.mjs        # Day lifecycle, clock, goals, daily accounting, closing, continuity
  supplier.test.mjs   # Storage, ordering, expenses, deliveries, conservation, integration
  checkout.test.mjs   # Queues, claims, transactions, economy, co-op simulation
  inventory.test.mjs  # Transfer invariants and stock-change notifications
  customers.test.mjs  # Discovery, requests, lifecycle, contention, spawn timing
  navigation.test.mjs # Paths, movement, footprint clearance, real shop geometry
```

The scene assembles the world and delegates movement, targeting, inventory, and HUD behavior to focused modules. New interactables implement `Interactable`, including contextual prompt text; they do not require changes to the player controller. Texture keys separate rendering from behavior. Replace generated textures with sprite assets in the boot scene and adjust collider dimensions as needed. The layout configures fixtures; crates, shelves, counters, and the supplier desk own their rendering and colliders. Navigation includes the desk obstacle, and the real-layout tests verify access to its standing point.

## Manual browser checklist

Browser gameplay has not been verified in the agent environment. Run these checks on a machine that permits a local Vite server:

1. Start single-player, prepare shelves, and open at the entrance with E.
2. Wait for a customer to obtain a product; confirm request and shelf match and stock decreases by one.
3. Confirm the customer goes to checkout instead of exiting.
4. Confirm the customer joins the shortest queue, with predictable ties.
5. Leave customers waiting and confirm multiple customers form a visibly spaced queue.
6. After serving the front customer, confirm the remaining customers walk forward rather than teleport.
7. Approach a cashier from its lower side.
8. Confirm **E - Tính tiền** appears when the front customer is ready.
9. Press E to start checkout.
10. Confirm **Đang tính tiền...** and progress feedback; walk away during processing and confirm movement remains responsive.
11. Confirm money increases exactly once by the product price and served customers increases by one. Hold or repeatedly press E to check duplicate prevention.
12. Confirm the customer says **Cảm ơn!**, leaves, and despawns.
13. Confirm the next queued customer advances, waits at the front, and does not automatically pay.
14. Let a shelf become empty. Lower configured initial stock temporarily for a focused test.
15. Confirm an out-of-stock customer shows **Hết hàng!** and leaves without queueing, revenue, or a served-customer increment. Restock and confirm future shopping succeeds.
16. Start two-player mode.
17. Have P1 operate Cashier 1 with E.
18. Have P2 operate Cashier 2 with Enter.
19. Confirm simultaneous checkouts produce two independent payments.
20. Try both players interacting with the same cashier almost simultaneously.
21. Confirm only one checkout, payment, and served-customer increment occurs.
22. Confirm multiple customers still navigate around shelves, crates, walls, and counters without jitter or destination oscillation.
23. Confirm both players can still retrieve, stock, drop, pick up, and hand off goods while customers shop. Check partial transfers, wrong products, full shelves, and storage rejection while holding.
24. Temporarily lower queue capacity to one. Confirm overflow customers use separate positions, retry, and enter a queue when a slot opens.
25. Return to the menu during processing and reopen the shop. Confirm money resets to 100.000đ, statistics reset, and there are no delayed payments or leftover queues/customers.
26. Recheck movement, normalized diagonals, independent Shift keys, collision corners, focus loss, and edge-triggered input. Resize the browser and separate the players; HUD and world labels should remain readable without duplicate rendering.

## Phase 5 manual browser checklist

These checks remain required in addition to the earlier checkout checklist:

1. Start the game.
2. Confirm all storage crates show finite quantities, initially **Kho: 10**.
3. Take products from a crate with empty hands.
4. Confirm storage decreases by the carried quantity and the label updates immediately.
5. Empty a crate; temporarily configure three initial units to verify a partial pickup.
6. Confirm **Hết hàng trong kho.** and no new held products at zero.
7. Approach **ĐẶT HÀNG** in the left aisle and open the supplier panel with E.
8. Click quantity buttons; confirm steps of five, minimum zero, maximum fifty.
9. Confirm the total and affordability color update immediately.
10. Attempt an order costing more than the balance.
11. Confirm **Không đủ tiền.**, unchanged money, and no delivery.
12. Place an affordable order, such as ten noodles for 30.000đ.
13. Confirm money decreases exactly once, including repeated/double-click confirmation attempts.
14. Confirm the panel closes and **Đơn hàng đang được giao...** / delivery status appears.
15. Wait five unpaused gameplay seconds.
16. Confirm **Đã giao hàng!** and storage increases exactly once by each ordered quantity.
17. Retrieve delivered stock.
18. Stock the matching shelf and verify partial/full/wrong-product rules still preserve goods.
19. Open at the entrance if still in preparation, then let a customer take one product.
20. Operate the cashier to complete checkout.
21. Confirm revenue and balance increase exactly once.
22. Confirm expenses stay separate and unchanged by checkout or delivery.
23. Confirm profit equals revenue minus expenses, including a negative result.
24. Repeat in two-player mode.
25. Confirm either player can open and place an order with their own interaction key.
26. Confirm money/storage are shared, while held stacks stay independent.
27. Confirm existing independent and simultaneous cashier checkout still works.
28. Confirm empty shelves produce the existing out-of-stock reaction and departure without payment.
29. Open the panel while carrying stock and while a customer/checkout/delivery is active. Confirm both players and all simulation timers pause, held goods remain intact, and nothing acts behind the overlay.
30. Close without ordering using the button and Esc. Confirm no spending, no accidental interaction/pickup, and responsive controls after releasing/repressing keys.
31. During delivery, attempt a second order. Confirm **Đang có đơn hàng được giao.** and no extra spending; after delivery, confirm a new order is allowed.
32. Return to the menu during an active delivery and reopen. Confirm initial money/storage/statistics return with no old delivery, panel, or delayed inventory change.
33. Check mouse targets, Vietnamese text, economy HUD, and ordering panel at the existing resolution and when the browser is resized; verify no duplicate HUD/world rendering.

## Phase 6 manual browser checklist

Use a short configured open duration for faster closing tests, then restore 300 seconds:

1. Start the game.
2. Confirm **NGÀY 1 · CHUẨN BỊ MỞ CỬA** with no countdown.
3. Wait and confirm no customers spawn during preparation.
4. Order supplier stock.
5. Confirm expenses count toward Day 1 even before opening.
6. Stock shelves; verify movement, held goods, and floor transfers still work.
7. Approach the entrance and open with P1's E.
8. Confirm OPEN and the countdown begin.
9. Confirm customer arrivals begin after the configured initial delay.
10. Serve customers and confirm daily revenue goal progress changes only after real payment.
11. Open supplier UI during OPEN. Confirm day countdown, customers, spawn delay, checkout, and delivery all pause and resume consistently.
12. Let the timer reach zero.
13. Confirm CLOSING, no new customers, and no supplier ordering prompt; verify the day clock never shows a negative time.
14. Confirm existing customers continue shopping and navigating normally.
15. Complete final checkout with either cashier while closing.
16. Confirm SUMMARY appears only after every customer has departed and checkout is idle. Place a delivery near closing and confirm it finishes before SUMMARY too.
17. Verify daily revenue, expenses, profit, served customers, items sold, out-of-stock departures, target, and goal result. Check genuine stock failure counts once while navigation failures do not.
18. Click **NGÀY TIẾP THEO**; also try a double click.
19. Confirm Day 2 PREPARATION, no customers, and no countdown.
20. Confirm money persists.
21. Confirm storage persists.
22. Confirm shelf stock persists; also check held and dropped goods survive unchanged.
23. Confirm daily statistics reset while session accounting/history remains cumulative.
24. Confirm the goal rises from 50.000đ to 75.000đ and a Day 2 preparation purchase belongs to Day 2.
25. Repeat the flow in two-player mode, with simultaneous cashier service and stocking.
26. Have both players try opening together using E/Enter.
27. Confirm one opening transition and one customer spawning schedule.
28. Finish a day below goal and confirm continuing is still allowed.
29. During SUMMARY, press movement/interaction/drop keys and click outside the next-day button. Confirm no gameplay action, clock change, or click-through occurs.
30. Exit to the menu during OPEN, CLOSING, and SUMMARY in separate runs. Restart and confirm clean Day 1 preparation, default inventory/money, and no leftover timer, customer, delivery, or overlay.
31. Check HUD/summary Vietnamese text, mouse targets, day/time/goal readability, and both camera modes at the existing game resolution and after resizing.

## 3D visual direction and architecture

The store is a bright, cozy **real 3D** Vietnamese grocery shop, viewed through an orthographic camera about 28 degrees above the floor and 27 degrees diagonally to the shelf fronts. This reveals character faces, shelf front/side faces and the packages on all three levels. Products sit near the shelf lip so the frame does not hide their front labels. Cream tiles, mint-painted shelves, warm wood, teal and coral shopkeeper clothes, and colorful fictional packaging replace the previous muted presentation. A hemisphere light, one warm directional light and a bounded soft shadow map ground furniture and characters. Cutaway walls reveal the interior. Calendar, fan, clock, red stools, plants, broom, cartons and entrance shutters remain non-colliding decoration.

P1 remains a young male shopkeeper with short dark hair, teal shirt and apron. P2 remains a young female shopkeeper with a ponytail, coral shirt and apron. Five customer archetypes share their semi-chibi model language. Heads, hair, faces, clothes, limbs and carried products are actual geometry. Facing rotates the model to show real side/back views; walking animates limbs and visual bob only. Emotion and interaction animations read existing presentation state.

- `ShopThreeView` observes players, customers, shelves, storage, dropped items, cashier progress and day state. It never transfers goods, charges money, chooses AI paths or advances gameplay timers.
- `ThreeRules` maps existing Phaser X/Y coordinates to Three X/Z at 0.01 world units per gameplay pixel. Height belongs exclusively to presentation. Every original static collider, queue slot, interaction position and A* footprint is retained.
- `ShopCamera3D` follows solo players smoothly and uses the shared center/distance in co-op. Its projection also anchors prompts, stock labels, held-item labels and customer bubbles in the Phaser overlay. Nearby customer bubbles are shifted upward when they overlap.
- `ModelFactory` caches shared geometry/materials. `CharacterModel`, `ProductModel`, `FurnitureModels` and `ShopEnvironment` can later be replaced by authored models without modifying domain systems. Floor tiles use instancing; shelf goods are capped at fifteen decorative package models, never one physics item per inventory unit.
- `ShelfModel` uses the existing stock-density rules and the real shelf quantity. Milk and soft drinks use glass-front refrigerator presentation on the same logical shelf. Empty crates visibly hide packages and show their authoritative warehouse quantity.
- `MenuArt` generates cached menu portraits and Phaser product icons from the same 3D models used for carried goods, shelf stock, customer purchases and dropped items. Supplier rows and request bubbles therefore retain consistent packaging.
- Phaser renders the warm cream HUD, ordering sheet and receipt-style day summary over a transparent canvas. Only the presentation world is replaced. The existing 2D scene is retained as a WebGL 2 fallback.

Supplier modals and SUMMARY pause both gameplay and 3D animation. Checkout bars read the real station progress, with no second timer. Existing committed-domain feedback produces projected floating text and model pops; presentation never changes inventory or accounting. GPU resources, shadow maps, UI labels, renderer/context listeners, resize listeners and the separate canvas are cleaned up when leaving ShopScene.

### Audio and reduced motion

The existing AudioManager and all named sound events are preserved. No audio assets are added, so playback safely no-ops and the game remains silent. Master/music/SFX flags remain available without a settings screen. Set `VISUAL_SETTINGS.reducedMotion = true` in `VisualTheme.ts` to disable bobbing, limb/secondary animation, pops, shakes, and upward floating feedback. Facing, stock indicators, readable fades, and all game rules remain active. Supplier modals and SUMMARY retain the existing simulation/presentation pause semantics.

## Manual 3D visual QA

These browser checks remain required. Use the existing 1100x800 resolution first, then inspect resized solo/co-op views:

1. Confirm P1 reads as a young male shopkeeper with short hair and a work apron.
2. Confirm P2 reads as a young female shopkeeper with a ponytail and apron.
3. Confirm both belong to the same semi-chibi illustrated art style.
4. Face all four directions; inspect front, back straps/hair, and distinct side profiles.
5. Walk/sprint; inspect alternating legs, arm swing, apron/hair motion, and neutral idle recovery.
6. Compare character scale with shelves, refrigerators, counters, cartons, and doors.
7. Carry products in every direction; confirm held packages and quantities are recognizable and unobscured.
8. Compare all five product icons in world, bubbles, and supplier UI.
9. Confirm packets/cans/cartons/boxes/bottles read as groceries rather than plain blocks.
10. Walk around shelves; inspect tops, sides, frames, price strips, and contact shadows.
11. Compare empty, sparse, half-full, and full shelves after real transfers/consumption.
12. Confirm milk and beverage displays read as refrigerators with glass doors and handles.
13. Inspect cashier surface, register, scanner, bag area, station labels, and actual processing bar.
14. Confirm back-stock cartons and quantity labels differ from retail shelves.
15. Inspect the supplier desk, laptop, notebook, and phone at gameplay scale.
16. Inspect floor grout, wall depth, baseboards, warm palette, and material highlights.
17. Inspect Vietnamese fan/calendar/stool/broom/helmet/plant details without caricature or excessive clutter.
18. Confirm props do not block players or change NPC paths.
19. Compare customer art and proportions with shopkeepers.
20. Observe all five customer variations; verify accessories remain readable.
21. Inspect product bubbles, **Ôi, hết hàng rồi!**, and **Cảm ơn nhé!** near shelves and queues.
22. Leave several customers queueing and verify spacing and readability.
23. Move above, beside, and below every shelf/counter; confirm natural depth ordering.
24. Confirm shadows stay grounded while characters bob, sprint, turn, and carry items.
25. Inspect HUD readability and coverage of the playable area in preparation/open/closing.
26. Inspect supplier quantities, unit/line costs, balance, buttons, and mouse/pause semantics.
27. Inspect receipt-style summary hierarchy, goal result, totals, and Next Day.
28. Inspect solo composition and camera follow near every map edge.
29. Inspect co-op composition with players together and far apart; test each player's prompt/target marks.
30. Recheck unchanged gameplay: stocking/partial transfers, drops/handoff, customer paths, checkout/queues, deliveries, economy, and multi-day continuity.

Also repeat movement and feedback with reduced motion enabled, and exit/re-enter the scene during feedback or a modal to check cleanup. Restore the desired visual setting afterward. Generated shapes still need browser approval for small-scale readability, occlusion, and animation feel; pure tests cannot establish artistic quality.

## Next milestone

Verify the 3D presentation in-browser before adding gameplay: test solo/co-op movement in all four directions, inspect character and furniture scale, walk behind/in front of shelves, carry/drop/handoff goods, restock empty shelves/crates, serve both cashiers simultaneously, open/close the supplier modal, and finish a day. Resize the window and return to the menu several times; confirm 3D canvas alignment, readable labels, stable camera framing, and no leftover canvases. Repeat with `VISUAL_SETTINGS.reducedMotion = true`. Check the WebGL 2 fallback separately if available.

Art remains procedural low-poly 3D rather than final authored meshes, textures or character animation clips. The next visual improvement should follow browser feedback, through the existing model/view boundaries. No upgrades or additional gameplay systems are included in this conversion.

## Validation status

Three.js and its TypeScript definitions were installed by the project owner. Existing generated lockfile changes are retained; the agent did not edit the lockfile manually.

| Command | Actual result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0 |
| `npm test` | PASS, 221 tests, 0 failures, exit 0 |
| `npm run build` | PASS, exit 0; nonblocking Vite warning about the Phaser/Three bundle size |
| `npm run dev` | Blocked: `listen EPERM` on `0.0.0.0:5173`, exit 1 |

All 187 existing tests remain. Seventeen 3D tests cover ground-plane mapping, all four 3D facing rotations, frame-rate-independent camera smoothing, projected label anchors, keyboard orientation, co-op viewport bounds, pause behavior, empty player lists, bounded stock density, scale configuration, finite product geometry, distinct male/female silhouettes, carried goods without ground movement, reduced-motion bobbing, low oblique camera angles, shelf-front sightlines across all five product types and three rows, and diagonal co-op corner framing. Another 17 camera-mode tests cover solo/co-op eligibility, mode idempotence, eye anchors, third-person framing, camera obstacle retraction, look clamps, relative/normalized movement, projection clipping, paused camera position, sideways tracking, automatic rotation, stable held movement, manual override and tight-wall avatar visibility. Geometry tests execute without a WebGL renderer; they do not establish visual quality.

Browser rendering has **not** been verified: this environment blocks the local listening socket and has no connected browser. The manual visual and gameplay checklists remain required, particularly camera composition, overlay alignment, occlusion, shadow quality, animation feel, scene restarts and both modes.

## License

No license has been selected yet.
