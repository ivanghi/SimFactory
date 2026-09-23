# Factory Game

A real-time factory-building game on a procedural 64x64 map. You place extractors on
resource nodes, feed processors from a shared stockpile, keep the power grid from
browning out, and unlock the tech chain up to science.

Built with Vite, TypeScript (strict), React for the HUD, and a canvas renderer.

## Features

- 12 resources across raw, intermediate, and final tiers
- 15 buildings: extractors, processors, power, and storage
- Global supply/demand power grid with brownout throttling
- Adjacency bonuses for extractors, solar panels, and water-cooled coal generators
- Milestone unlocks with toast notifications and an objectives panel
- Storage caps that push you toward warehouses
- Science per minute readout in the top right of the screen
- Local autosave with offline catch-up and a return summary
- Settings menu (top right) with a New game button

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build       # production build to dist/
npm run preview     # serve the production build
npm test            # run the Vitest suite
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## How to play

- Click a building in the left build menu to arm it, move over the map to preview,
  then left-click a valid tile to place it. Locked buildings are shown but disabled.
- Drag with the left mouse button to pan; use the mouse wheel to zoom.
- Use **Demolish mode**, then click a placed building to remove it for a 50% refund.
- Use the bottom speed controls to pause or run at 1x, 2x, or 3x.
- Open **Settings** in the top-right corner and choose **New game** to discard the
  current save and start on a fresh map.

Resource nodes are fixed to their terrain: the Iron, Copper, and Coal Miners go on
matching ore nodes, the Pumpjack on oil, and the Water Pump on water. Processors can
be placed on any free grass tile.

## Power

Solar panels produce 2 MW with no fuel; coal generators produce 6 MW and burn 1 coal
every 4 seconds. If demand exceeds supply every consumer runs at `efficiency =
supply / demand`, which throttles extraction and processing. The power gauge under the
map turns yellow and reports the current speed factor.

## Progression

Start unlocked: Iron Miner, Coal Miner, Water Pump, Smelter, Gear Assembler, Solar
Panel, Warehouse.

| Objective | Unlocks |
|---|---|
| Smelt 50 iron ingots | Copper Miner, Copper Smelter, Coal Generator |
| Place your first Coal Generator | Refinery |
| Produce 100 fuel | Chemical Plant |
| Produce 50 gears | Circuit Assembler |
| Produce 100 gears | Pumpjack |
| Produce 50 circuits | Lab |

Milestones are one-way and never revoked. Unlocks achieved while the tab was closed
are applied silently and folded into a single offline summary toast.

## Saves and offline progress

The game autosaves to `localStorage` every 10 seconds, when the tab is hidden, and on
unload. On load, elapsed time is replayed through the same tick function in 60-second
steps, capped at 8 hours; a negative or tampered clock change contributes nothing.

## Project structure

```
src/
  data/     pure data: resources, buildings, recipes, milestones, constants
  sim/      world state, fixed-step tick, power, adjacency, mapgen, milestones, offline
  save/     versioned serialization, localStorage storage, export/import
  render/   canvas rendering and camera
  ui/       React HUD: topbar, build menu, tooltip, power gauge, objectives, speed, toasts, settings
  main.ts   game loop: requestAnimationFrame + accumulator, 10 sim ticks per second
```

`src/sim/` and `src/data/` are DOM-free and deterministic: the same world plus the same
tick sequence always produces the same result. All balance numbers live in `src/data/`
so they can be tuned without touching simulation code.

## Testing

Tests run with Vitest and include `src/sim/tests/playthrough.test.ts`, a headless
end-to-end run that drives the real map generation, power, and tick loop from a fresh
seed through every milestone to steady-state science production. It asserts stage-time
budgets, determinism, brownout recovery, and storage-cap pressure across several seeds.

`doc/balance-notes.md` records the final tuned values and the rationale for them.