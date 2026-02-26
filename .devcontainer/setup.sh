#!/usr/bin/env bash
# Post-create setup for the helkhalfi.github.io devcontainer.
# Runs as the 'vscode' user inside the container after it is first created.
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✓ $*${RESET}"; }

# ---------------------------------------------------------------------------
# 1. Install all Python dependencies declared in pyproject.toml / uv.lock
# ---------------------------------------------------------------------------
step "Installing Python dependencies with uv..."
uv sync
ok "Dependencies installed into .venv"

# ---------------------------------------------------------------------------
# 2. Install the Flex Pelican theme (required by THEME = \"Flex\" in pelicanconf.py)
#    We clone the standalone Flex repo and let pelican-themes register it
#    inside the active virtual environment so 'uv run pelican ...' can find it.
# ---------------------------------------------------------------------------
FLEX_TMP="$(mktemp -d)"
step "Cloning the Flex Pelican theme..."
git clone --depth=1 https://github.com/alexandrevicenzi/Flex.git "$FLEX_TMP/Flex"

step "Installing Flex theme into the uv venv..."
uv run pelican-themes --install "$FLEX_TMP/Flex" --verbose

rm -rf "$FLEX_TMP"
ok "Flex theme installed"

# ---------------------------------------------------------------------------
# 3. Quick smoke-test: build the site once to confirm everything works
# ---------------------------------------------------------------------------
step "Running a one-off build to verify the setup..."
uv run invoke build
ok "Site built successfully into ./output"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Setup complete!${RESET}"
echo ""
echo "Available commands:"
echo -e "  ${CYAN}uv run invoke livereload${RESET}  — watch files and serve with live-reload at http://localhost:8000"
echo -e "  ${CYAN}uv run invoke build${RESET}       — one-off build into ./output"
echo -e "  ${CYAN}uv run invoke rebuild${RESET}     — clean build (deletes old output first)"
echo -e "  ${CYAN}uv run invoke preview${RESET}     — build with production settings (publishconf.py)"
echo -e "  ${CYAN}uv run invoke serve${RESET}       — serve already-built site at http://localhost:8000"
echo ""
echo "Note: the browser auto-open is a no-op inside the container — open"
echo "      http://localhost:8000 in your host browser after starting the server."
