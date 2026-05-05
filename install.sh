#!/usr/bin/env bash

set -e

REPO="mnsdojo/wutp"

echo "wutp installer ⚡"
echo "────────────────────────────────────"

# Determine OS
OS="$(uname -s)"
case "${OS}" in
  Linux*)     OS_NAME="linux" ;;
  Darwin*)    OS_NAME="darwin" ;;
  *)          echo "✗ Unsupported OS: ${OS}"; exit 1 ;;
esac

# Determine architecture
ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64)   ARCH_NAME="x64" ;;
  amd64)    ARCH_NAME="x64" ;;
  arm64)    ARCH_NAME="arm64" ;;
  aarch64)  ARCH_NAME="arm64" ;;
  *)        echo "✗ Unsupported architecture: ${ARCH}"; exit 1 ;;
esac

BINARY_NAME="wutp-${OS_NAME}-${ARCH_NAME}"

echo "Detecting latest release for ${OS_NAME} ${ARCH_NAME}..."

# Use grep and sed to parse the latest release JSON
LATEST_RELEASE_URL=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep "browser_download_url.*${BINARY_NAME}\"" | cut -d : -f 2,3 | tr -d \" | tr -d ' ')

if [ -z "$LATEST_RELEASE_URL" ]; then
    echo "✗ Could not find a release binary for your platform (${BINARY_NAME})."
    echo "Please check https://github.com/${REPO}/releases/latest"
    exit 1
fi

TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

echo "Downloading wutp..."
curl -q -L -o wutp "${LATEST_RELEASE_URL}"
chmod +x wutp

# Determine installation directory
INSTALL_DIR="/usr/local/bin"

if [ ! -d "$INSTALL_DIR" ]; then
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

echo "Installing to ${INSTALL_DIR}..."

if [ -w "$INSTALL_DIR" ]; then
    mv wutp "$INSTALL_DIR/wutp"
else
    echo "Sudo privileges are required to install to ${INSTALL_DIR}"
    sudo mv wutp "$INSTALL_DIR/wutp"
fi

# Cleanup
cd - > /dev/null
rm -rf "$TMP_DIR"

echo "────────────────────────────────────"
echo "✅ wutp installed successfully!"
echo "Run 'wutp --help' to get started."
