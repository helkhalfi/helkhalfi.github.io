Title: OpenClaw - Your Self-Hosted AI Assistant Running Locally with Qwen Coder
Date: 2026-02-02
Status: published
Tags: openclaw, ai, qwen, qwen-coder, ollama, self-hosted, open-source, assistant, local-llm
Author: Hichame El Khalfi


If you have been looking for an AI assistant that you actually own and run on your own hardware,
[OpenClaw](https://openclaw.ai/) is worth your attention.

OpenClaw (formerly known as Clawdbot, then Moltbot) is an open-source, self-hosted personal AI
assistant with 68,000+ GitHub stars. It connects to the messaging platforms you already use
(WhatsApp, Telegram, Slack, Discord, Signal, Teams, iMessage, and more) and can execute real-world
tasks on your behalf: browser automation, file operations, shell commands, cron jobs, and 50+
integrations.

What makes it particularly interesting is that you can run it **fully offline** with local models via
[Ollama](https://ollama.com/) -- no API keys, no token costs, your data stays on your machine.

This article walks through installing OpenClaw and configuring it to work with
[Qwen3-Coder](https://ollama.com/library/qwen3-coder) running locally.

# Install Ollama

First, install Ollama which will serve as the local model runtime.

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

Start the Ollama server:

```bash
ollama serve
```

# Pull Qwen3-Coder

Qwen3-Coder is the most agentic code model in the Qwen series. It is a Mixture of Experts model
optimized for software engineering tasks and tool calling.

```bash
# 30B variant (3.3B active parameters) - runs on most machines with 16GB+ RAM
ollama pull qwen3-coder:30b
```

For machines with more memory, the full 480B parameter model is also available:

```bash
# 480B variant - requires 250GB+ of memory
ollama pull qwen3-coder:480b
```

## Fix the context window

By default, Ollama caps the context window at 4096 tokens regardless of what the model supports.
Qwen3-Coder supports up to 262k tokens, so you will want to increase this.

```bash
# Start an interactive session
ollama run qwen3-coder:30b

# Inside the session, set the context window
/set parameter num_ctx 32768

# Save as a new variant
/save qwen3-coder-32k:30b
```

Alternatively, set these environment variables before starting `ollama serve`:

```bash
export OLLAMA_CONTEXT_LENGTH=32768
export OLLAMA_FLASH_ATTENTION=1
```

# Install OpenClaw

OpenClaw requires Node.js 22 or higher.

```bash
npm install -g openclaw@latest
```

Run the onboarding wizard which installs the Gateway daemon (launchd on macOS, systemd on Linux)
so it stays running in the background:

```bash
openclaw onboard --install-daemon
```

The wizard walks you through configuring the gateway, workspace, channels, and skills.

## Build from source (optional)

If you prefer building from source:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build
pnpm build
pnpm openclaw onboard --install-daemon
```

# Configure OpenClaw to use Qwen Coder via Ollama

Edit the OpenClaw configuration file at `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://localhost:11434/v1",
        "apiKey": "ollama-local",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen3-coder-32k:30b",
            "name": "Qwen3-Coder-30B",
            "contextWindow": 32768,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agent": {
    "model": "ollama/qwen3-coder-32k:30b"
  }
}
```

A few things to note:

1. **Use `openai-completions` for the `api` field**, not `openai-responses`. The latter causes silent empty responses with Ollama models.
2. The `apiKey` can be any non-empty string (Ollama does not authenticate by default).
3. Match the `contextWindow` value to what you configured in the Ollama model variant.

## Auto-discovery (simpler alternative)

If you do not want to manually define models, OpenClaw can auto-discover Ollama models. Just set
the API key without defining a provider block:

```bash
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

OpenClaw will discover all models from the local Ollama instance at `http://127.0.0.1:11434`
and set all costs to 0.

# Configure tool permissions

For the AI agent to actually do useful work, enable the tool permissions:

```json
{
  "tools": {
    "allow": ["read", "exec", "write", "edit"],
    "exec": {
      "ask": "off",
      "security": "full"
    }
  }
}
```

The `read` permission is essential -- without it, the agent cannot access skill files or read
your local files.

Set `exec.ask` to `"on"` if you want to approve each command before execution (recommended
when you are first getting started).

# Run it

Start the gateway:

```bash
openclaw gateway --port 18789 --verbose
```

Send a test message:

```bash
openclaw agent --message "list the files in my home directory"
```

You can also check that everything is configured correctly:

```bash
openclaw doctor
```

# What can it do ?

Once running, OpenClaw with Qwen Coder can:

1. **Triage and draft emails** from your inbox.
2. **Manage your calendar** -- schedule, reschedule, summarize upcoming events.
3. **Run developer workflows** -- execute tests, debug code, deploy updates.
4. **Automate browser tasks** -- fill forms, scrape data, interact with web apps.
5. **Control smart home devices** via integrations.
6. **Run cron jobs** -- schedule recurring tasks.
7. **Self-improve** -- write new skills to handle tasks it could not handle before.

All of this runs locally on your machine. No data leaves your network when using Ollama.

# Cost

The software is MIT licensed and free. When running with Ollama and a local model like Qwen Coder,
there are no API costs at all -- just your electricity bill.

If you choose to use cloud providers (Claude, GPT) instead of local models, expect $5-10 daily for
light use, or $30-50+ for heavy use.

# Resources

- [OpenClaw website](https://openclaw.ai/)
- [Documentation](https://docs.openclaw.ai/)
- [GitHub repository](https://github.com/openclaw/openclaw)
- [Qwen3-Coder on Ollama](https://ollama.com/library/qwen3-coder)
- [Ollama provider docs](https://docs.openclaw.ai/providers/ollama)
