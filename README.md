# ⚡ wutp (What's Using This Process?)

A blazing-fast, modern CLI tool written in TypeScript and powered by Bun. **wutp** helps you find, analyze, and terminate stubborn processes efficiently without trying to remember obscure `lsof`, `netstat`, or `ps` commands.

## ✨ Features

- **Instant Search:** Find processes by Port, PID, or Name instantly.
- **Detailed Insights:** See exact CPU, Memory usage, Parent PIDs, and running time.
- **Kill Guides:** Generates ready-to-copy commands to gracefully shutdown or forcefully kill processes.
- **Cross-Platform:** Works seamlessly on macOS and Linux.
- **Standalone Binary:** No Node.js or Bun required for end-users.

---

## 🚀 Installation

### Using the Install Script (macOS / Linux)

Run the following command to automatically download and install the correct binary for your OS and architecture:

```bash
curl -fsSL https://raw.githubusercontent.com/mnsdojo/wutp/main/install.sh | bash
```

*This will download `wutp` and place it securely in your `/usr/local/bin` directory.*

### From Source (Requires Bun)

```bash
git clone git@github.com:mnsdojo/wutp.git
cd wutp
bun install

# Run the tool
bun run src/cli.ts --help
```

---

## 📖 Usage

### Search for Processes
Find what is running on a specific port:
```bash
wutp -p 3000
```

Find a process by its name:
```bash
wutp -n node
```

Find a process by its PID:
```bash
wutp -i 1234
```

### Options & Flags

| Flag | Description |
|------|-------------|
| `-f, --force` | Show aggressive kill options (like `kill -9` or `pkill`) |
| `-t, --tree` | Display the process tree (see parent/child relationships) |
| `-N, --network` | Show active network connections associated with the process |
| `-j, --json` | Output results in JSON format (great for CI/scripts) |
| `-k, --kill` | Enter kill mode directly |
| `-d, --details` | Show extra detailed information |

### Examples

Find all Node.js processes and show their process tree:
```bash
wutp -n node -t
```

Find the process on port `8080` and get forceful kill commands:
```bash
wutp -p 8080 -f
```

---

## 🛠 Development

This project uses [Bun](https://bun.sh/) as a runtime and bundler.

```bash
# Install dependencies
bun install

# Run the script directly
bun run src/cli.ts
```

## 📦 Releases

Releases are automatically compiled into standalone executables using GitHub Actions when a new version tag (e.g., `v1.0.0`) is pushed to the repository.
