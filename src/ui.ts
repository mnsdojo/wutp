import pc from "picocolors";
import { execSync } from "child_process";
import type { ProcessInfo } from "./types";
import type { ProcessTreeNode } from "./process-finder";

const W = 75; // Inner width for boxes

// Helper to strip ANSI codes for length calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// Helper to create a perfectly padded line with borders
function padLine(content: string, leftBorder = "│ ", rightBorder = " │"): string {
  const plainContent = stripAnsi(content);
  const padding = Math.max(0, W - plainContent.length);
  return pc.cyan(leftBorder) + content + " ".repeat(padding) + pc.cyan(rightBorder);
}

function row(label: string, val: string, valCol = pc.white) {
  const content = "  " + pc.gray(label.padEnd(10) + "│ ") + valCol(val);
  console.log(padLine(content));
}

function cmd(icon: string, label: string, cmdStr: string, desc: string) {
  const labelCol = pc.yellow(label.padEnd(10));
  const content = `  ${icon}  ${pc.bold(labelCol)} │ ${pc.green(cmdStr.padEnd(32))} ${pc.dim("(" + desc + ")")}`;
  console.log(padLine(content));
}

function getStatusBadge(status: string): string {
  const s = status.toLowerCase();
  const bold = (txt: string, col: any) => pc.bold(col(txt));

  if (s.includes("run") || s === "r") return bold("RUNNING", pc.green);
  if (s.includes("sleep") || s === "s") return bold("SLEEPING", pc.blue);
  if (s.includes("stop") || s === "t") return bold("STOPPED", pc.red);
  if (s.includes("zombie") || s === "z") return bold("ZOMBIE", pc.yellow);
  if (s.includes("listen")) return bold("LISTENING", pc.cyan);
  
  return pc.gray(status.toUpperCase());
}

function statusCol(s: string) {
  const l = s.toLowerCase();
  if (l.includes("run") || l === "r") return pc.green;
  if (l.includes("sleep") || l === "s") return pc.blue;
  if (l.includes("stop") || l === "t") return pc.red;
  if (l.includes("zombie") || l === "z") return pc.yellow;
  if (l.includes("listen")) return pc.cyan;
  return pc.gray;
}

export function displayBanner() {
  const top = "╭" + "─".repeat(W + 2) + "╮";
  const bottom = "╰" + "─".repeat(W + 2) + "╯";
  
  console.log("\n" + pc.cyan(top));
  console.log(padLine(pc.bold(pc.white("wutp")) + " " + pc.dim("⚡") + " " + pc.white("What's Using This Process?"), "│  ", "  │"));
  console.log(padLine(pc.dim("Find, analyze & terminate processes efficiently"), "│    ", "    │"));
  console.log(pc.cyan(bottom) + "\n");
}

export function displayProcessInfo(proc: ProcessInfo, detailed: boolean, index: number = 0, total: number = 1) {
  const cmdFirst = proc.command.split(" ")[0] ?? "";
  let name = cmdFirst.split("/").pop() ?? proc.name ?? "process";
  if (!name || name.length < 2) name = "PID " + proc.pid;
  
  const isSystem = ["kernel_task", "launchd", "WindowServer", "systemd"].includes(name);
  const headerText = total > 1 ? `Process #${index}/${total}` : (isSystem ? "SYSTEM PROCESS" : "PROCESS FOUND");
  const headerCol = isSystem ? pc.yellow : pc.green;

  console.log("  " + headerCol(headerText));

  console.log(pc.cyan("╭" + "─".repeat(W + 2) + "╮"));
  console.log(padLine(pc.bold(pc.white("PROCESS INFO"))));
  console.log(pc.cyan("├" + "─".repeat(W + 2) + "┤"));

  row("Name", pc.bold(name));
  row("PID", pc.cyan(String(proc.pid)));
  row("User", proc.user);
  row("CPU", pc.magenta(proc.cpu + "%"));
  row("Memory", pc.magenta(proc.memory + "%"));
  row("Status", getStatusBadge(proc.status));

  if (proc.port) row("Port", String(proc.port), pc.cyan);
  if (proc.started) row("Started", proc.started);
  if (proc.ppid) row("Parent", String(proc.ppid), pc.cyan);

  console.log(pc.cyan("├" + "─".repeat(W + 2) + "┤"));
  console.log(padLine(pc.bold(pc.white("COMMAND"))));

  const cmdDisp = proc.command?.length > W ? proc.command.slice(0, W - 3) + "..." : (proc.command || "-");
  console.log(padLine(pc.dim(cmdDisp)));

  console.log(pc.cyan("╰" + "─".repeat(W + 2) + "╯"));
}

export function displayKillGuide(proc: ProcessInfo, force: boolean) {
  const cmdFirst = proc.command.split(" ")[0]?.split("/").pop() ?? "";
  const name = cmdFirst || proc.name || "process";
  const pid = String(proc.pid);

  console.log("\n" + pc.cyan("╭" + "─".repeat(W + 2) + "╮"));
  const killTitle = "KILL " + name.toUpperCase() + " [" + pid + "]";
  console.log(padLine(pc.bold(pc.white(killTitle))));
  console.log(pc.cyan("├" + "─".repeat(W + 2) + "┤"));

  cmd(pc.red("■"), "SIGTERM", "kill " + pid, "Graceful shutdown");
  cmd(pc.yellow("▶"), "SIGINT", "kill -2 " + pid, "Like Ctrl+C");

  if (force) {
    cmd(pc.red("★"), "SIGKILL", "kill -9 " + pid, "Force kill");
    cmd(pc.magenta("◆"), "pkill", 'pkill -9 "' + name + '"', "Kill all " + name);
  }

  if (proc.port) {
    cmd(pc.cyan("●"), "By Port", "lsof -ti :" + proc.port + " | xargs kill -9", "Kill all on port");
  }

  if (proc.ppid) {
    cmd(pc.blue("⚙"), "Parent", "kill " + proc.ppid, "Kill parent");
  }

  cmd(pc.green("↻"), "Restart", "kill -SIGUSR1 " + pid, "Graceful restart");

  console.log(pc.cyan("╰" + "─".repeat(W + 2) + "╯"));
}

export function displayNetworkInfo(pids: number[], page = 1, perPage = 8) {
  console.log("\n" + pc.cyan("╭" + "─".repeat(W + 2) + "╮"));
  console.log(padLine(pc.bold(pc.white("NETWORK CONNECTIONS"))));
  console.log(pc.cyan("├" + "─".repeat(W + 2) + "┤"));

  for (const pid of pids) {
    try {
      const out = execSync(`lsof -i -a -p ${pid} 2>/dev/null`, { encoding: "utf-8", maxBuffer: 1024 * 1024 });
      const lines = out.trim().split("\n").filter(Boolean);
      const conns = lines.slice(1).filter(l => l.includes("TCP") || l.includes("UDP"));

      if (conns.length > 0) {
        console.log(padLine(pc.bold("PID " + pid)));

        const start = (page - 1) * perPage;
        const pageConns = conns.slice(start, start + perPage);

        for (const line of pageConns) {
          const parts = line.replace(/\s+/g, " ").trim().split(" ");
          const isListen = parts.some(p => p.includes("LISTEN"));
          const isEst = parts.some(p => p.includes("ESTABLISHED"));
          const icon = isEst ? pc.green("●") : isListen ? pc.yellow("◉") : pc.cyan("◉");

          const protoIdx = parts.findIndex(p => p === "TCP" || p === "UDP");
          const proto = protoIdx >= 0 ? (parts[protoIdx] ?? "-") : "-";

          const nameIdx = parts.findIndex(p => p.includes("*:") || p.includes("("));
          const addr = nameIdx >= 0 ? parts.slice(nameIdx).join(" ").replace(/[()]/g, "") : "-";
          
          const entry = `${icon} ${pc.gray(proto.padEnd(4))} ${pc.green(addr.slice(0, W - 10))}`;
          console.log(padLine(entry));
        }

        const totalPages = Math.ceil(conns.length / perPage);
        if (totalPages > 1) {
          console.log(padLine(pc.dim(`Page ${page}/${totalPages} • ${conns.length} total`)));
        }
      } else {
        console.log(padLine(pc.dim("No active connections")));
      }
    } catch {
      console.log(padLine(pc.dim("No connections found")));
    }
  }

  console.log(pc.cyan("╰" + "─".repeat(W + 2) + "╯"));
}

export function displayTree(roots: ProcessTreeNode[]) {
  console.log("\n" + pc.cyan("╭" + "─".repeat(W + 2) + "╮"));
  console.log(padLine(pc.bold(pc.white("PROCESS TREE"))));
  console.log(pc.cyan("├" + "─".repeat(W + 2) + "┤"));

  for (const root of roots) {
    treePrint(root, "", true);
  }

  console.log(pc.cyan("╰" + "─".repeat(W + 2) + "╯"));
}

function treePrint(node: ProcessTreeNode, prefix: string, isLast: boolean) {
  const conn = isLast ? "└─ " : "├─ ";
  const cpuCol = parseFloat(node.cpu) > 50 ? pc.red : parseFloat(node.cpu) > 20 ? pc.yellow : pc.green;

  const entry = `${prefix}${conn}${pc.bold(node.name)} ${pc.gray("(" + node.pid + ")")} ${cpuCol(node.cpu + "%")}`;
  console.log(padLine(entry));

  const childPref = prefix + (isLast ? "   " : "│  ");
  node.children.forEach((c, i) => treePrint(c, childPref, i === node.children.length - 1));
}
