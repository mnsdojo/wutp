import { execSync } from "child_process";
import type { ProcessInfo, SearchOptions } from "./types";

export async function findProcess(options: SearchOptions): Promise<ProcessInfo[]> {
  const { type, value } = options;

  try {
    if (type === "port") {
      return await findByPort(parseInt(value, 10));
    } else if (type === "pid") {
      return await findByPid(parseInt(value, 10));
    } else if (type === "name") {
      return await findByName(value);
    }
    return [];
  } catch (error) {
    throw new Error(`Failed to find process: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function findByPort(port: number): Promise<ProcessInfo[]> {
  try {
    const lsofOutput = execSync(`lsof -i :${port} -P -n 2>/dev/null`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    });

    const lines = lsofOutput.trim().split("\n").filter(Boolean);
    if (lines.length <= 1) return [];

    const processes: ProcessInfo[] = [];

    for (const line of lines.slice(1)) {
      const parts = line.replace(/\s+/g, " ").trim().split(" ");
      if (parts.length >= 9) {
        const procName = parts[0] || "unknown";
        processes.push({
          pid: parseInt(parts[1] ?? "", 10) || 0,
          name: procName,
          user: parts[2] || "unknown",
          port: port,
          cpu: "0",
          memory: "0",
          status: parts[9] || "LISTEN",
          command: procName,
        });
      }
    }

    const unique = processes.filter((p, i, arr) => arr.findIndex(x => x.pid === p.pid) === i);

    for (let i = 0; i < unique.length; i++) {
      const p = unique[i];
      if (p) {
        const fullInfo = await getProcessInfoByPid(p.pid);
        if (fullInfo) {
          p.cpu = fullInfo.cpu;
          p.memory = fullInfo.memory;
          // Keep the port status like LISTEN if possible, or use fullInfo
          p.status = p.status && p.status !== "unknown" ? p.status : fullInfo.status;
          p.command = fullInfo.command;
          p.started = fullInfo.started;
          p.ppid = fullInfo.ppid;
          p.name = fullInfo.name !== "unknown" ? fullInfo.name : p.name;
        }
      }
    }

    return unique;
  } catch {
    return findByPortFallback(port);
  }
}

async function findByPortFallback(port: number): Promise<ProcessInfo[]> {
  try {
    const netstatOutput = execSync(`netstat -anop 2>/dev/null | grep :${port}`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    });

    const lines = netstatOutput.trim().split("\n").filter(Boolean);
    const processes: ProcessInfo[] = [];

    for (const line of lines) {
      const match = line.match(/(\d+)\/([^\s]+)/);
      if (match) {
        const pid = parseInt(match[1] ?? "", 10);
        const procInfo = await getProcessInfoByPid(pid);
        if (procInfo) {
          procInfo.port = port;
          processes.push(procInfo);
        }
      }
    }

    return processes;
  } catch {
    return [];
  }
}

async function findByPid(pid: number): Promise<ProcessInfo[]> {
  try {
    const output = execSync(
      `ps -ww -p ${pid} -o pid=,ppid=,user=,pcpu=,pmem=,state=,etime=,args= 2>/dev/null | cat`,
      { encoding: "utf-8" }
    );

    const line = output.trim();
    if (!line) return [];

    const parts = line.replace(/\s+/g, " ").trim().split(" ");
    if (parts.length >= 7) {
      const fullCmd = parts.slice(7).join(" ") || parts[7] || "unknown";
      const cmdFirst = parts[7] || "unknown";
      return [{
        pid: parseInt(parts[0] ?? "", 10) || pid,
        ppid: parseInt(parts[1] ?? "", 10) || undefined,
        user: parts[2] || "unknown",
        cpu: parts[3] || "0",
        memory: parts[4] || "0",
        status: parts[5] || "unknown",
        started: parts[6] || undefined,
        name: cmdFirst.split("/").pop() || "unknown",
        command: fullCmd,
      }];
    }

    return [];
  } catch {
    return [];
  }
}

async function findByName(name: string): Promise<ProcessInfo[]> {
  try {
    const pgrepOutput = execSync(`pgrep -f "${name}" 2>/dev/null`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    });

    const pids = pgrepOutput.trim().split("\n").filter(Boolean).map(s => parseInt(s, 10));
    const processes: ProcessInfo[] = [];

    for (const pid of pids) {
      if (!isNaN(pid)) {
        const procInfo = await getProcessInfoByPid(pid);
        if (procInfo) {
          processes.push(procInfo);
        }
      }
    }

    return processes;
  } catch {
    try {
      const psOutput = execSync(`ps aux 2>/dev/null | grep -i "${name}" | grep -v grep`, {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 10,
      });

      const lines = psOutput.trim().split("\n").filter(Boolean);
      const processes: ProcessInfo[] = [];

      for (const line of lines) {
        const parts = line.replace(/\s+/g, " ").trim().split(" ");
        if (parts.length >= 11) {
          const pid = parseInt(parts[1] ?? "", 10);
          if (!isNaN(pid)) {
            const cmdStr = parts.slice(10).join(" ");
            const nameFromCmd = cmdStr.split(" ")[0]?.split("/").pop() || parts[10] || "unknown";
            processes.push({
              pid,
              ppid: parseInt(parts[2] ?? "", 10) || undefined,
              user: parts[0] || "unknown",
              cpu: parts[2] || "0",
              memory: parts[3] || "0",
              status: parts[7] || "unknown",
              started: parts[8] || undefined,
              name: nameFromCmd,
              command: parts.slice(10).join(" ") || parts[10] || "unknown",
            });
          }
        }
      }

      const unique = processes.filter((p, i, arr) => arr.findIndex(x => x.pid === p.pid) === i);
      return unique;
    } catch {
      return [];
    }
  }
}

async function getProcessInfoByPid(pid: number): Promise<ProcessInfo | null> {
  try {
    const output = execSync(
      `ps -ww -p ${pid} -o pid=,ppid=,user=,pcpu=,pmem=,state=,etime=,args= 2>/dev/null | cat`,
      { encoding: "utf-8" }
    );

    const line = output.trim();
    if (!line) return null;

    const parts = line.replace(/\s+/g, " ").trim().split(" ");
    if (parts.length >= 7) {
      const fullCmd = parts.slice(7).join(" ") || parts[7] || "unknown";
      const cmdFirst = parts[7] || "unknown";
      return {
        pid: parseInt(parts[0] ?? "", 10) || pid,
        ppid: parseInt(parts[1] ?? "", 10) || undefined,
        user: parts[2] || "unknown",
        cpu: parts[3] || "0",
        memory: parts[4] || "0",
        status: parts[5] || "unknown",
        started: parts[6] || undefined,
        name: cmdFirst.split("/").pop() || "unknown",
        command: fullCmd,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export interface ProcessTreeNode extends ProcessInfo {
  children: ProcessTreeNode[];
}

export async function getProcessTree(rootPids: number[]): Promise<ProcessTreeNode[]> {
  const allProcs = new Map<number, ProcessTreeNode>();

  try {
    const psOutput = execSync("ps -ww -ax -o pid=,ppid=,user=,pcpu=,pmem=,state=,etime=,args=", {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    });

    for (const line of psOutput.trim().split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 7) {
        const pid = parseInt(parts[0] ?? "", 10);
        const ppid = parseInt(parts[1] ?? "", 10);
        const cmdFirst = parts[7] ?? "unknown";
        const name = cmdFirst.split("/").pop() || "unknown";

        allProcs.set(pid, {
          pid,
          ppid: isNaN(ppid) ? undefined : ppid,
          user: parts[2] || "unknown",
          cpu: parts[3] || "0",
          memory: parts[4] || "0",
          status: parts[5] || "unknown",
          started: parts[6] || undefined,
          name,
          command: parts.slice(7).join(" ") || name,
          children: [],
        });
      }
    }
  } catch {
    return [];
  }

  const roots: ProcessTreeNode[] = [];

  for (const pid of rootPids) {
    const root = allProcs.get(pid);
    if (root) {
      buildTree(root, allProcs);
      roots.push(root);
    }
  }

  return roots;
}

function buildTree(node: ProcessTreeNode, all: Map<number, ProcessTreeNode>) {
  for (const [pid, child] of all) {
    if (child.ppid === node.pid) {
      node.children.push(child);
      buildTree(child, all);
    }
  }
}