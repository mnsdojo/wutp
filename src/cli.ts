#!/usr/bin/env bun

import { parseArgs } from "util";
import pc from "picocolors";
import { findProcess, getProcessTree } from "./process-finder";
import { displayProcessInfo, displayKillGuide, displayBanner, displayTree, displayNetworkInfo } from "./ui";
import type { ProcessInfo } from "./types";

const args = parseArgs({
  args: Bun.argv,
  options: {
    help: { type: "boolean", short: "h" },
    port: { type: "string", short: "p" },
    pid: { type: "string", short: "i" },
    name: { type: "string", short: "n" },
    force: { type: "boolean", short: "f" },
    json: { type: "boolean", short: "j" },
    tree: { type: "boolean", short: "t" },
    watch: { type: "boolean", short: "w" },
    kill: { type: "boolean", short: "k" },
    network: { type: "boolean", short: "N" },
    details: { type: "boolean", short: "d" },
  },
  allowPositionals: true,
});

if (args.values.help) {
  displayBanner();
  console.log(pc.gray("  Usage:") + " wutp " + pc.cyan("[options]"));
  console.log("");
  console.log(pc.gray("  Search:"));
  console.log("    " + pc.cyan("-p, --port") + " <port>   Find by port (e.g., 3000)");
  console.log("    " + pc.cyan("-i, --pid") + " <pid>     Find by PID");
  console.log("    " + pc.cyan("-n, --name") + " <name>    Find by name");
  console.log("");
  console.log(pc.gray("  Options:"));
  console.log("    " + pc.cyan("-f, --force") + "           Force kill options");
  console.log("    " + pc.cyan("-j, --json") + "            JSON output (for scripts)");
  console.log("    " + pc.cyan("-t, --tree") + "            Show process tree");
  console.log("    " + pc.cyan("-w, --watch") + "           Watch mode (live updates)");
  console.log("    " + pc.cyan("-k, --kill") + "            Kill process (show confirm)");
  console.log("    " + pc.cyan("-N, --network") + "          Show network connections");
  console.log("    " + pc.cyan("-d, --details") + "          Detailed info");
  console.log("    " + pc.cyan("-h, --help") + "            Show help");
  console.log("");
  console.log(pc.gray("  Examples:"));
  console.log("    " + pc.cyan("wutp -p 3000") + "          Find on port 3000");
  console.log("    " + pc.cyan("wutp -n node -t") + "        Process tree for 'node'");
  console.log("    " + pc.cyan("wutp -n node -N") + "        Network connections for node");
  console.log("    " + pc.cyan("wutp -i 1234 -k") + "       Show kill for PID 1234");
  console.log("    " + pc.cyan("wutp -n node -j") + "        JSON for scripts");
  process.exit(0);
}

const { port, pid, name, force, json, tree, watch, kill, network, details } = args.values;

if (!port && !pid && !name) {
  displayBanner();
  console.log("  " + pc.red("✗ Error:") + " Provide -p, -i, or -n");
  console.log("  " + pc.gray("Use:") + " wutp --help");
  process.exit(1);
}

async function run() {
  try {
    let processes: ProcessInfo[] = [];

    if (port) {
      processes = await findProcess({ type: "port", value: port.toString() });
    } else if (pid) {
      processes = await findProcess({ type: "pid", value: pid.toString() });
    } else if (name) {
      processes = await findProcess({ type: "name", value: name.toString() });
    }

    if (processes.length === 0) {
      if (!json) {
        displayBanner();
        console.log("  " + pc.green("✓") + " No processes found");
      } else {
        console.log(JSON.stringify({ processes: [], error: null }));
      }
      process.exit(0);
    }

    if (json) {
      console.log(JSON.stringify({ processes, count: processes.length }, null, 2));
      process.exit(0);
    }

    displayBanner();

    if (tree && processes.length > 0) {
      const pids = processes.map(p => p.pid);
      const treeData = await getProcessTree(pids);
      displayTree(treeData);
    } else {
      for (let i = 0; i < processes.length; i++) {
        const proc = processes[i];
        if (!proc) continue;

        displayProcessInfo(proc, details || false, i + 1, processes.length);
        if (network) {
          displayNetworkInfo([proc.pid]);
        }
        displayKillGuide(proc, force || false);

        if (i < processes.length - 1) {
          console.log("\n  " + pc.gray("─".repeat(40)) + "\n");
        }
      }
    }

    const total = pc.gray("─".repeat(38));
    console.log("\n  " + total);
    console.log("  " + pc.gray("Total: ") + pc.bold(pc.white(processes.length + " process(es)")));

    if (kill && processes.length > 0) {
      console.log("\n  " + pc.yellow("⚠") + " Kill mode - will terminate:");
      for (const p of processes) {
        console.log("    " + pc.red("•") + " " + p.name + " (PID: " + pc.cyan(p.pid) + ")");
      }
      console.log("\n  " + pc.gray("Run with") + " " + pc.cyan("-k") + " to confirm or press " + pc.gray("Ctrl+C") + " to cancel");
    }

    console.log("");
  } catch (error) {
    if (json) {
      console.log(JSON.stringify({ processes: [], error: error instanceof Error ? error.message : "Unknown" }));
    } else {
      console.log("  " + pc.red("✗") + " " + (error instanceof Error ? error.message : "Unknown error"));
    }
    process.exit(1);
  }
}

run();