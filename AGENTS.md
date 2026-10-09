# Coding instructions

- Preserve Phaser 3, Three.js, TypeScript strict mode, Vite and npm. No React or unnecessary dependencies/infrastructure. Prefer focused modules and direct implementations.
- Support solo and local co-op through player collections and configurable controls. Scenes assemble systems; entities/systems own gameplay. Never hardcode rules around P1.
- Keep domain logic independent of rendering and usable with Node type stripping. Keep product definitions, prices and tuning centralized; avoid `any`, duplicate logic and giant files.
- Phaser owns collision/navigation coordinates. Three.js reads state on the X/Z ground plane, projects labels through its camera and disposes GPU resources/canvases/listeners on shutdown. Preserve the 2D fallback.
- Keep art replaceable through views, cached textures/models and shared product icons. Sort 2D artwork by ground baselines. Bob/tweens affect visual children only; decorations do not block navigation without gameplay intent.
- Co-op uses a shared camera. Solo perspective input may rotate its movement basis, but third-person auto-follow must not rotate a held movement input. Camera/look input stops during modals and SUMMARY.
- Preserve stock conservation, safe integer quantities, shelf capacity and partial remainders. `StoreStorage` owns warehouse stock; crates never generate goods. Shelf consumers use `ShelfInventory.take`; observing views unsubscribe on destruction.
- Keep one held stack per player and claim dropped items synchronously. Never replace carried goods or let multiple actors claim the same stock/job. Preserve packed/expiry metadata through transfer and saves; reject packed goods at shelves. Expiry is an explicit counted stock sink.
- Keep navigation independent of NPC behavior, derived from static footprints with clearance. Replan only when destinations change. Keep customer transitions explicit, consume shelf stock at the taking state and preserve spawn limits.
- Preserve actual customer cart lines through player-triggered checkout. Empty carts never produce sales. Recover abandoned unpaid goods; timeout must not cancel claimed checkout. Queue membership/order is unique and slot advances use navigation, never teleportation.
- `StoreEconomy` owns all money mutation. Use safe integer VND, immutable sales/orders and deduplicated payments/spending/customer IDs. Revenue and expense categories remain separate; profit is revenue minus expenses.
- Validate supplier orders before spending; claim one order synchronously and deliver once. Arrival creates finite truck cargo; unpacking creates warehouse stock. Cancel live callbacks on shutdown and retain paid delivery state in validated saves.
- Validate complete versioned saves before constructing scene objects. Preserve historical costs, deduplication and paid delivery durations. Snapshot recovery returns unpaid customer/employee goods without mutating live inventory or recovering sold goods. Settings use a separate slot.
- Preparation-only upgrades/expansion/decorations use domain APIs and shared money. Preserve stock and already-claimed durations. Rebuild visual/collider/navigation footprints together after validated safe-slot furniture changes.
- Employees share stock/navigation/cleaning/checkout APIs, claim jobs synchronously and bill wages once per day. Record employee sales independently of player IDs.
- `DayManager` owns state and simulation clock. Spawn only during OPEN. Closing waits for customers, processing checkout and paid inbound delivery before SUMMARY. Capture accounting baselines at PREPARATION; keep daily/session stats separate.
- Next Day never resets money, inventory, held/dropped goods or histories. SUMMARY and modals block controls and pause simulation. Time-based gameplay uses delta time, never wall-clock domain behavior.
- Presentation reacts to committed domain notifications and never mutates gameplay through effects. Clean up temporary objects, tweens and subscriptions; respect reduced motion. Audio tolerates missing assets or unavailable playback.
- Before bug fixes, reproduce in the browser as an end user. Inspect layout/visuals and resolve clear defects. Report environment blockers honestly; automated tests/build do not establish browser verification.
- After meaningful changes run `npm run typecheck`, `npm test` and `npm run build`, plus relevant browser checks. Resolve failures/flakiness without weakening tests. Input/physics changes require both modes, independent Shift keys, diagonal normalization, collision corners, scene restarts and focus loss checks.
- Do not implement unrelated gameplay or infrastructure. Reputation, random events, backend, online multiplayer and final art require explicit scope.
- Preserve user files; never manually edit generated files, lockfiles or build output. Never use an em dash or add an agent name as commit co-author.
- Prefer quality, simplicity, robustness and maintainability over development cost. Do not spawn agents without authorization; a large swarm requires explicit approval and an explanation of tradeoffs.

Keep this file concise. Rewrite or prune rules rather than repeating the code.
