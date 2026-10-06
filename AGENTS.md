# Coding instructions

- Preserve Phaser 3, TypeScript strict mode, Vite, and npm. Do not introduce React without explicit instruction.
- Avoid unnecessary dependencies, wrappers, and infrastructure. Prefer small focused modules and direct implementations.
- Support both solo and local co-op through player collections and configurable controls. Never hardcode gameplay around Player 1.
- Keep interaction behavior outside scenes. Scenes assemble systems; entities and systems own their behavior.
- Keep artwork replaceable through presentation views and cached texture keys. Share product icons across world/UI and centralize visual tokens/scales. Furniture artwork rises above unchanged footprints; sort by ground baselines, not artwork height. Visual bob/tweens transform visual children only, never physics or navigation coordinates.
- Keep tuning values centralized where appropriate. Avoid `any`, duplicated movement logic, and giant files.
- Before bug fixes, reproduce the issue in the browser as an end user would. Inspect visuals and fix clear layout issues.
- After meaningful changes, run `npm run typecheck` and `npm run build`, plus appropriate runtime checks. Resolve failures and flakiness; report environmental blockers honestly.
- Verify both modes, independent Shift keys, normalized diagonals, collision corners, interactions, scene restarts, and focus loss when changing input or physics.
- Keep product definitions central and inventory rules pure. Preserve stock conservation, validated integer quantities, shelf capacity, and exact partial-transfer remainders. All shelf consumers must use `ShelfInventory.take`; views observe stock changes and unsubscribe on destruction.
- Keep `StoreStorage` authoritative for back-room quantities. Crates only observe it and never generate goods. Validate complete deliveries before mutation; preserve nonnegative integer quantities and stock conservation through every transfer.
- Keep one held stack per player and claim dropped items synchronously by ID. Never replace a carried stack when taking from storage or allow multiple players to claim one dropped item.
- Keep NPC navigation independent of customer behavior. Derive the grid from static collision geometry with footprint clearance; plan routes when destinations change, not every frame.
- Keep customer transitions explicit. Do not reserve or copy shelf stock while navigating; consume it only at the taking state. Preserve spawn limits and clean up entities, labels, and lifecycle references on scene shutdown.
- Preserve customer goods in cart lines from shelf consumption through player-triggered payment. Out-of-stock trips never queue or produce sales. Never auto-pay waiting customers.
- Keep queue ordering and unique membership in checkout domain logic; move NPCs to changed slots with navigation, never by teleporting. Claim processing synchronously before another player can interact, and cancel jobs and references on scene shutdown.
- Keep all money mutation in `StoreEconomy`. Use safe integer VND and immutable sales/orders; keep sale revenue separate from supplier expenses and derive profit from revenue minus expenses. Preserve payment, spending-reference, and served-customer deduplication.
- Supplier confirmation must validate before spending, claim one active order synchronously, and deliver exactly once before notifying observers. Scene shutdown discards session orders and prevents later inventory mutation. Modal ordering must block gameplay inputs without modifying carried goods.
- Keep `DayManager` authoritative for day state and clock. Spawn customers only during OPEN; closing must let existing customers finish and wait for checkout and paid delivery before SUMMARY.
- Capture daily accounting baselines at PREPARATION, including preparation expenses. Keep daily and session stats separate; never reset store money, stock, held/dropped goods, or histories on Next Day.
- SUMMARY blocks controls and pauses simulation. All time-based gameplay follows the same delta-time pause semantics; never introduce wall-clock-dependent domain behavior.
- Run `npm test` for inventory, customer, navigation, checkout, economy, storage, supplier, and day changes. Tests use Node's built-in runner against pure TypeScript modules; keep those modules usable with Node type stripping.
- Presentation reacts to committed domain notifications, never infers or mutates gameplay from HUD changes. Clean up temporary views, tweens, and subscriptions on destruction/shutdown; respect reducedMotion. Audio calls must tolerate missing assets and unavailable playback. Decorative props must not become navigation blockers without explicit gameplay intent.
- Do not implement unrelated gameplay or infrastructure. Upgrades, employees, reputation, random events, saves, backend, online multiplayer, and final art require a later explicit scope.
- Preserve user files. Never manually edit generated files, including dependency lockfiles and build output.
- Never use an em dash. Never add an agent name as a commit co-author.
- Prefer quality, simplicity, robustness, scalability, and long-term maintainability over development cost.
- Ask for explicit approval before a large swarm of agents; explain its tradeoffs first.

Keep this file concise and broadly useful. Rewrite or prune rules instead of duplicating what the code already makes clear.
