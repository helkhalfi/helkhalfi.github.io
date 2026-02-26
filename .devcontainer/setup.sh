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
# 1. Python — install all deps declared in pyproject.toml / uv.lock
# ---------------------------------------------------------------------------
step "Installing Python dependencies with uv..."
uv sync
ok "Python dependencies installed into .venv"

# ---------------------------------------------------------------------------
# 2. Pelican — install the Flex theme (required by THEME = "Flex")
# ---------------------------------------------------------------------------
FLEX_TMP="$(mktemp -d)"
step "Cloning the Flex Pelican theme..."
git clone --depth=1 https://github.com/alexandrevicenzi/Flex.git "$FLEX_TMP/Flex"

step "Registering Flex theme inside the uv venv..."
uv run pelican-themes --install "$FLEX_TMP/Flex" --verbose

rm -rf "$FLEX_TMP"
ok "Flex theme installed"

# ---------------------------------------------------------------------------
# 3. Python smoke-test — build the site once to confirm Pelican is working
# ---------------------------------------------------------------------------
step "Running a one-off Pelican build to verify the Python setup..."
uv run invoke build
ok "Pelican site built successfully into ./output"

# ---------------------------------------------------------------------------
# 4. Node.js / TypeScript — install deps for the Temporal examples
# ---------------------------------------------------------------------------
EXAMPLES_DIR="examples/temporal-api-polling"
if [[ -f "$EXAMPLES_DIR/package.json" ]]; then
    step "Installing Node.js dependencies for the Temporal examples..."
    npm install --prefix "$EXAMPLES_DIR"
    ok "Node.js dependencies installed"

    step "Type-checking the Temporal example TypeScript sources..."
    npm run --prefix "$EXAMPLES_DIR" typecheck
    ok "TypeScript type-check passed"
fi

# ---------------------------------------------------------------------------
# Done — print a welcome cheat-sheet
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║  Setup complete — here's how to run things                  ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${BOLD}Pelican blog (Python):${RESET}"
echo -e "  ${CYAN}uv run invoke livereload${RESET}   live-reload dev server → http://localhost:8000"
echo -e "  ${CYAN}uv run invoke build${RESET}        one-off build into ./output"
echo -e "  ${CYAN}uv run invoke rebuild${RESET}      clean build (deletes old output first)"
echo ""
echo -e "${BOLD}Temporal API-polling example (TypeScript):${RESET}"
echo -e "  Open ${CYAN}examples/temporal-api-polling/${RESET} and run in 4 separate terminals:"
echo ""
echo -e "  1) ${CYAN}temporal server start-dev${RESET}          Temporal dev server (UI at http://localhost:8233)"
echo -e "  2) ${CYAN}npm run mock-api   --prefix examples/temporal-api-polling${RESET}"
echo -e "  3) ${CYAN}npm run worker     --prefix examples/temporal-api-polling${RESET}"
echo -e "  4) ${CYAN}npm run client     --prefix examples/temporal-api-polling${RESET}"
echo ""
echo "Note: the browser auto-open from Pelican/Temporal is a no-op inside the"
echo "      container — open the URLs above in your host browser instead."
