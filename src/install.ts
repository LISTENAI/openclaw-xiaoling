#!/usr/bin/env node
/**
 * Interactive install CLI for the LSPlatform OpenClaw plugin.
 *
 * Usage:
 *   npx -y @listenai/openclaw-lsplatform install
 *
 * The script guides the user through the device-pairing flow:
 *   1. Requests a 6-digit pairing code from LSPlatform.
 *   2. Displays the code and instructs the user to enter it in the mini-program.
 *   3. Polls LSPlatform until the apiToken is available.
 *   4. Persists the token via the OpenClaw config API.
 *   5. Optionally restarts the OpenClaw gateway.
 */

import { intro, outro, text, confirm, spinner, log, cancel } from "@clack/prompts";
import { execSync } from "node:child_process";
import { requestPairingCode, pollForToken } from "./api/client.js";
import { DEFAULT_API_URL } from "./channel/types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often to poll LSPlatform for a token (ms). */
const POLL_INTERVAL_MS = 3_000;

/** Maximum time to wait for the user to scan the code (ms). */
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persist a config value via the `openclaw config set` CLI.
 * Throws if the command is not found.
 */
function ocConfigSet(key: string, value: string): void {
  execSync(`openclaw config set ${key} ${JSON.stringify(value)}`, {
    stdio: "inherit",
  });
}

// ---------------------------------------------------------------------------
// Main install flow
// ---------------------------------------------------------------------------

async function runInstall(): Promise<void> {
  intro("LSPlatform × OpenClaw — 配对安装向导");
  log.step("请按下面的步骤：");

  // Resolve the API URL (allow override via env var for testing)
  const apiUrl = process.env["LSPLATFORM_API_URL"] ?? DEFAULT_API_URL;

  // ── Step 1: obtain a pairing code ───────────────────────────────────────
  const pairingSpinner = spinner();
  pairingSpinner.start("正在从 LSPlatform 获取配对码…");

  let pairingCode: string;
  try {
    const result = await requestPairingCode(apiUrl);
    pairingCode = result.pairingCode;
    pairingSpinner.stop(`配对码获取成功`);
  } catch (err) {
    pairingSpinner.stop("获取配对码失败");
    log.error(err instanceof Error ? err.message : String(err));
    cancel("安装已取消。");
    process.exit(1);
  }

  // ── Step 2: display instructions ────────────────────────────────────────
  log.info("1. 在「小聆AI」微信小程序中点开设备");
  log.info("2. 找到 OpenClaw 功能");
  log.info("3. 输入以下配对码：");
  log.message(`\n    ${pairingCode}\n`);

  // ── Step 3: poll for the token ──────────────────────────────────────────
  const pollSpinner = spinner();
  pollSpinner.start("正在等待您在小程序中完成配对…");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let apiToken: string | null = null;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const result = await pollForToken(apiUrl, pairingCode);
      if (result.apiToken) {
        apiToken = result.apiToken;
        break;
      }
    } catch (err) {
      pollSpinner.stop("轮询失败");
      log.error(err instanceof Error ? err.message : String(err));
      cancel("安装已取消。");
      process.exit(1);
    }
  }

  if (!apiToken) {
    pollSpinner.stop("配对超时");
    log.error("等待时间过长，配对未完成。请重新运行安装向导重试。");
    cancel("安装已取消。");
    process.exit(1);
  }

  pollSpinner.stop("配对成功！");

  // ── Step 4: persist the token ──────────────────────────────────────────
  const saveSpinner = spinner();
  saveSpinner.start("正在保存 API Token…");

  try {
    ocConfigSet("channels.lsplatform.apiToken", apiToken);
    saveSpinner.stop("API Token 已保存");
  } catch (err) {
    saveSpinner.stop("保存失败");
    log.error(
      `无法写入 OpenClaw 配置：${err instanceof Error ? err.message : String(err)}\n` +
        `请手动运行：openclaw config set channels.lsplatform.apiToken ${JSON.stringify(apiToken)}`,
    );
    // Don't exit — the user can save manually
  }

  // ── Step 5: offer to restart the gateway ──────────────────────────────
  const shouldRestart = await confirm({
    message: "安装成功！要现在重启 Gateway 吗？",
    initialValue: true,
  });

  if (shouldRestart === true) {
    const restartSpinner = spinner();
    restartSpinner.start("正在重启 Gateway…");
    try {
      execSync("openclaw gateway restart", { stdio: "inherit" });
      restartSpinner.stop("Gateway 已重启");
    } catch {
      restartSpinner.stop("重启失败 — 请手动运行 `openclaw gateway restart`");
    }
  }

  outro("LSPlatform 插件安装完成！🎉");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const [, , command] = process.argv;

if (command !== "install") {
  console.error(`Usage: npx -y @listenai/openclaw-lsplatform install`);
  process.exit(1);
}

runInstall().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
