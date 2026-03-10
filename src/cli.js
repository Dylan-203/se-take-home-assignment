#!/usr/bin/env node
"use strict";

/**
 * cli.js — Simulates the McDonald's order controller and writes result.txt.
 *
 * Scenario:
 *   1. Add Bot #1
 *   2. Add Normal Order #1  → Bot #1 picks it up immediately
 *   3. Add Normal Order #2  → queued (PENDING)
 *   4. Add Normal Order #3  → queued (PENDING)
 *   5. Add VIP Order #4     → jumps ahead of normals in PENDING
 *   6. Add Bot #2           → picks up VIP Order #4
 *   7. Remove Bot #2 (5 s after creation, mid-processing) → VIP #4 returns to PENDING
 *   8. Wait for Bot #1 to finish Order #1 (t=10 s)        → Bot #1 picks up VIP #4 next
 *   9. Add VIP Order #5     → queued behind VIP #4 still in PENDING? No — #4 is being
 *      processed, so #5 goes to the front of remaining normals.
 *  10. Add Bot #3           → processes Order #5 (next VIP)
 *  11. Wait for all orders to complete.
 */

const fs = require("fs");
const path = require("path");
const { OrderController, ORDER_TYPE } = require("./OrderController");

const OUTPUT_FILE = path.join(process.cwd(), "scripts", "result.txt");
const LINES = [];

function ts() {
  const d = new Date();
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function log(message) {
  const line = `[${ts()}] ${message}`;
  console.log(line);
  LINES.push(line);
}

function printState(ctrl) {
  const pending = ctrl.pendingOrders
    .map((o) => `#${o.id}(${o.type})`)
    .join(", ") || "(empty)";
  const processing = ctrl.bots
    .filter((b) => !b.isIdle)
    .map((b) => `Bot${b.id}→#${b.currentOrder.id}`)
    .join(", ") || "(none)";
  const complete = ctrl.completeOrders
    .map((o) => `#${o.id}`)
    .join(", ") || "(none)";
  log(`  PENDING=[${pending}]  PROCESSING=[${processing}]  COMPLETE=[${complete}]`);
}

// ─── Simulation ──────────────────────────────────────────────────────────────

// Use 10 s for realistic output; pass --fast to use 1 s per order for quick CI runs.
const FAST = process.argv.includes("--fast");
const PROC_MS = FAST ? 1_000 : 10_000;

log(`=== McDonald's Order Controller Simulation (${FAST ? "FAST" : "NORMAL"} mode) ===`);

const ctrl = new OrderController({
  processingTimeMs: PROC_MS,
  onEvent(event, data) {
    switch (event) {
      case "ORDER_ADDED":
        log(`ORDER ADDED   → #${data.order.id} [${data.order.type}]`);
        break;
      case "ORDER_PROCESSING":
        log(`ORDER PICKUP  → Bot#${data.bot.id} picked up Order#${data.order.id} [${data.order.type}]`);
        break;
      case "ORDER_COMPLETE":
        log(`ORDER DONE    → Order#${data.order.id} [${data.order.type}] is COMPLETE`);
        break;
      case "ORDER_RETURNED":
        log(`ORDER RETURNED→ Order#${data.order.id} [${data.order.type}] back to PENDING`);
        break;
      case "BOT_ADDED":
        log(`BOT ADDED     → Bot#${data.bot.id} created`);
        break;
      case "BOT_REMOVED":
        log(`BOT REMOVED   → Bot#${data.bot.id} destroyed`);
        break;
    }
    printState(ctrl);
  },
});

// Step 1 — Add first bot
ctrl.addBot();

// Step 2-4 — Three normal orders
ctrl.addOrder(ORDER_TYPE.NORMAL);
ctrl.addOrder(ORDER_TYPE.NORMAL);
ctrl.addOrder(ORDER_TYPE.NORMAL);

// Step 5 — VIP order (cuts in line)
ctrl.addOrder(ORDER_TYPE.VIP);

// Step 6 — Second bot (picks up VIP #4)
ctrl.addBot();

// Step 7 — Remove Bot#2 halfway through processing → VIP order returns to PENDING
const HALF = Math.floor(PROC_MS / 2);
setTimeout(() => {
  log("--- Removing Bot#2 mid-process ---");
  ctrl.removeBot();
  printState(ctrl);
}, HALF);

// Step 9 — Another VIP order arrives
setTimeout(() => {
  log("--- New VIP customer arrives ---");
  ctrl.addOrder(ORDER_TYPE.VIP);
}, HALF + 500);

// Step 10 — Add third bot
setTimeout(() => {
  log("--- Adding Bot#3 ---");
  ctrl.addBot();
}, HALF + 600);

// Step 11 — Give enough time for all orders to complete, then write result.txt
const TOTAL_WAIT = PROC_MS * 5;
setTimeout(() => {
  log("");
  log("=== Final State ===");
  printState(ctrl);
  log("=== Simulation Complete ===");

  fs.writeFileSync(OUTPUT_FILE, LINES.join("\n") + "\n", "utf8");
  console.log(`\nResults written to: ${OUTPUT_FILE}`);
}, TOTAL_WAIT);
