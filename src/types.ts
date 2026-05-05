export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  port?: number;
  cpu: string;
  memory: string;
  status: string;
  command: string;
  started?: string;
  ppid?: number;
}

export interface SearchOptions {
  type: "port" | "pid" | "name";
  value: string;
}