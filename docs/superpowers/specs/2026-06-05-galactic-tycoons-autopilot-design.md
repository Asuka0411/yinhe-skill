# Galactic Tycoons Autopilot Design

Date: 2026-06-05

## Goal

Build a stable, fast userscript for a single base and a single ship that supports both outbound selling and inbound resupply through fixed operational flows backed by a lightweight state machine.

The first version is intentionally narrow:
- One base at a time
- One ship reused for both directions
- Two fixed chains: outbound selling and inbound resupply
- Manual buttons for direct control
- Auto mode for wait-and-resume behavior

## Product Direction

The script is not a generic workflow builder in v1. The user wants fixed flows that run reliably and quickly. To keep future extension open, the implementation should use a lightweight step/state model internally, but expose only explicit built-in actions and built-in chain templates.

## User Model

The user operates one configured base at a time and wants to:
- Run outbound selling when the ship is at the base
- Run inbound resupply when the ship is at the exchange
- Let auto mode continue after transport waits
- Use the game's own UI and built-in resupply behavior instead of replacing game logic with custom calculations

## Supported Flows

### Outbound Selling Chain

Intent:
- Move selected finished goods from base to exchange
- Sell them through the exchange UI

Flow:
1. Confirm current base context
2. Confirm ship exists and is usable for outbound work
3. Open base-side outbound workflow
4. Select sellable materials from script-managed whitelist
5. Apply per-material outbound rule
6. Launch transport from base to exchange
7. In manual mode, stop when long transport wait begins
8. In auto mode, poll until arrival and continue
9. Open exchange sell workflow
10. Sell all configured whitelist materials through game UI
11. Record summary and step history

### Inbound Resupply Chain

Intent:
- Use the game's built-in resupply page to calculate shortages
- Convert shortages into wishlist items
- Buy them at exchange
- Bring them back to the base

Flow:
1. Confirm current base context
2. Confirm ship exists and is usable for inbound work
3. Open `Base -> Resupply`
4. Set target resupply days
5. Clear the base-bound default wishlist
6. Select all materials on the current resupply page
7. Trigger the game's `Add to Wishlist`
8. Read wishlist totals
9. If total price or weight exceeds limits, reduce resupply days and rebuild wishlist
10. Navigate to exchange
11. Buy the rebuilt wishlist through game UI
12. Load bought goods onto the ship
13. Launch transport from exchange back to base
14. In manual mode, stop when long transport wait begins
15. In auto mode, poll until arrival and continue
16. Unload at base
17. Record summary and step history

## Execution Modes

### Manual Mode

Manual mode exposes explicit buttons:
- Sell
- Resupply
- Check
- Wait
- Stop

Behavior:
- The user can choose either chain directly
- Long transport waits do not block forever
- When transport starts, the run can end with a recorded "waiting for arrival" state
- The next manual action can resume from the new ship position

### Auto Mode

Auto mode uses the same step engine but adds continuation behavior:
- Read ship location
- If ship is at base, prefer outbound selling first
- If ship is at exchange, prefer inbound resupply first
- If ship is in transit or unavailable, keep polling
- When the ship arrives, resume the next valid chain step
- Continue until the current chain is complete or a critical failure stops the run

## Internal Architecture

### State Machine

The script should internally model execution as explicit states rather than loose async functions.

Representative state groups:
- Context acquisition
- Ship readiness
- Page navigation
- Resupply wishlist preparation
- Budget and capacity validation
- Exchange buying
- Base-to-exchange transport
- Exchange-to-base transport
- Exchange selling
- Wait and resume
- Success
- Failure
- Stopped

Each state should:
- declare its preconditions
- declare its success condition
- return the next state explicitly
- emit structured history entries

### Step Executor

A chain is a known ordered list of states.

Two chain templates are needed:
- `sell_chain`
- `resupply_chain`

The executor should support:
- start from first step
- resume from stored wait state
- stop on user command
- stop on critical failure
- continue past non-critical failure when allowed

### UI Adapter

The automation should separate state reading from action execution.

Read-side:
- Prefer Local API or stable page data when available
- Use page parsing only when structured data is unavailable

Write-side:
- Use the game's visible buttons and built-in UI flows for user-equivalent actions
- Avoid inventing custom quantity calculations where the game already provides them

## Configuration Model

Configuration is stored per base.

V1 base configuration:
- outbound whitelist
- per-material minimum outbound amount
- default resupply days

No generic workflow editor is included in v1.

## Resupply Limit Logic

Resupply should use the game's own calculation instead of custom shortage math.

The script should:
1. open the current base resupply page
2. apply target days
3. clear the default wishlist tied to this base
4. select all rows on the page
5. add all rows to wishlist
6. inspect resulting total price and total weight

Constraints:
- total weight must fit the ship's usable cargo capacity
- total price must be affordable with current available credits

If limits are exceeded:
1. estimate a reduced resupply days value proportionally
2. rerun wishlist generation
3. fine-tune downward one day at a time
4. stop once both weight and price fit
5. fail the run if the days value reaches an unusable floor and still does not fit

## Outbound Material Rules

Outbound selling is restricted to user-selected whitelist materials shown in the script panel.

For each material, v1 must support:
- enabled or disabled
- minimum outbound amount

V1 outbound behavior:
- if material is not enabled, skip it
- if current amount is below minimum outbound amount, skip it
- otherwise include it in the outbound batch

V1 does not need stock-reserve logic because the user explicitly wants whitelist-only finished goods handling.

## Wishlist Handling

The script should not create its own wishlist ownership model if the game already binds wishlist behavior to the current base or planet context.

V1 wishlist rules:
- use the game's default base-related wishlist target
- always clear the target wishlist before generating a new resupply batch
- never append old entries from prior runs

## Ship Readiness Rules

The script must distinguish outbound and inbound logistics by location.

Outbound path:
- source is base
- destination is exchange

Inbound path:
- source is exchange
- destination is base

Because v1 uses one shared ship, chain choice depends on current ship position:
- ship at base: outbound selling is the natural first chain
- ship at exchange: inbound resupply is the natural first chain
- ship in transit: only wait/check behavior is valid

## Error Handling

Failures are graded.

Critical failures:
- base context cannot be resolved
- ship cannot be identified
- navigation target cannot be reached
- transport cannot be started
- wishlist cannot be rebuilt into a valid affordable/loadable state
- required confirmation action cannot be found after retries

Critical failure behavior:
- stop current run
- write failure summary
- store step where failure occurred

Non-critical failures:
- one material cannot be sold
- one wishlist item cannot be bought
- optional page details cannot be parsed

Non-critical failure behavior:
- log the failure
- continue when remaining chain steps are still valid

Retries:
- finite retries per UI action
- retries should be bounded and visible in history

## Runtime History

Keep recent run history per base.

Each history record should include:
- run id
- mode: manual or auto
- selected chain
- start time
- end time
- final status
- summary counts and totals
- step-by-step detail entries

The UI should show:
- compact summary list by default
- expandable detail for each run

## Panel Design

The panel remains button-oriented.

Primary controls:
- Sell
- Resupply
- Check
- Wait
- Stop

Panel responsibilities:
- show active base
- show ship location/status
- allow outbound whitelist selection
- allow per-material minimum outbound amount edits
- allow default resupply days edits
- show current run status
- show recent history summaries

## Testing and Verification

V1 verification should focus on repeatability, not only happy-path execution.

Minimum checks:
- manual sell chain from ship-at-base state
- manual resupply chain from ship-at-exchange state
- auto mode continuation through one transport wait
- wishlist clear-and-rebuild behavior
- resupply day reduction when weight exceeds capacity
- resupply day reduction when total price exceeds current funds
- stop action during active run
- history entry generation for success, wait, stop, and failure

## Out of Scope for V1

- Multi-base scheduling
- Multiple ships per base
- Generic workflow editor
- Dynamic reserve-stock logic
- Market-price optimization
- Exportable report formats
- Full direct backend-action replication in place of game UI

## Recommended Implementation Shape

Split future code into focused units:
- state and chain definitions
- page and Local API readers
- UI action helpers
- per-base config storage
- run history storage
- control panel rendering

This keeps the script understandable and makes later extension to additional fixed chains practical without turning one userscript file into an opaque monolith.
