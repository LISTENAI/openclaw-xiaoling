/**
 * Agent tools provided by the LSPlatform plugin.
 *
 * Registers tools that give the AI model the ability to interact with the
 * LSPlatform-connected device.
 */

import WebSocket from "ws";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { randomUUID } from "node:crypto";
import { pendingPhotoRequests, waitForPhotoResponse } from "../channel/gateway.js";
import { serializeLSPlatformMessage } from "../protocol.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toolText(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

// ---------------------------------------------------------------------------
// Active WebSocket reference
// ---------------------------------------------------------------------------

/**
 * A reference to the currently active LSPlatform WebSocket instance.
 *
 * Set by the gateway when a connection is established; used by agent tools
 * to send messages back to LSPlatform without going through the full outbound
 * adapter path.
 *
 * TODO: replace with a proper channel-scoped event bus once the gateway is
 * fully wired up.
 */
export const activeWsRef: { ws: import("ws").default | null } = { ws: null };

// ---------------------------------------------------------------------------
// Tool: lsplatform_capture_photo
// ---------------------------------------------------------------------------

/**
 * Ask the LSPlatform-connected device to capture a photo and return the URL.
 *
 * Flow:
 *   1. Tool sends a `photo_request` message over the WebSocket.
 *   2. The device captures a photo and sends a `photo_response` back.
 *   3. `handlePhotoResponse` in gateway.ts resolves the pending Promise.
 *   4. The tool returns the URL to the agent.
 */
function registerCapturePhotoTool(api: OpenClawPluginApi): void {
  api.registerTool(
    () => ({
      name: "lsplatform_capture_photo",
      label: "Capture Photo from Device",
      description:
        "Request the LSPlatform-connected device to capture a photo. " +
        "Returns the URL of the captured image.",
      parameters: Type.Object({
        timeoutMs: Type.Optional(
          Type.Number({
            description:
              "Maximum time to wait for the photo (ms, default 30000).",
          }),
        ),
      }),
      async execute(_id, params) {
        const ws = activeWsRef.ws;
        if (!ws || (ws as unknown as { readyState: number }).readyState !== WebSocket.OPEN) {
          return toolText(
            "LSPlatform is not connected. Make sure the channel is running and paired.",
          );
        }

        const requestId = randomUUID();
        const timeoutMs =
          typeof params.timeoutMs === "number" ? params.timeoutMs : 30_000;

        try {
          ws.send(
            serializeLSPlatformMessage({ type: "photo_request", requestId }),
          );

          const photoUrl = await waitForPhotoResponse(requestId, timeoutMs);
          return toolText(
            `Photo captured successfully. URL: ${photoUrl}`,
          );
        } catch (err) {
          return toolText(
            `Photo capture failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    }),
    { name: "lsplatform_capture_photo" },
  );
}

// ---------------------------------------------------------------------------
// Tool: lsplatform_connection_status
// ---------------------------------------------------------------------------

/**
 * Report the current LSPlatform WebSocket connection status to the agent.
 */
function registerConnectionStatusTool(api: OpenClawPluginApi): void {
  api.registerTool(
    () => ({
      name: "lsplatform_connection_status",
      label: "LSPlatform Connection Status",
      description:
        "Check whether the LSPlatform WebSocket channel is currently connected.",
      parameters: Type.Object({}),
      async execute() {
        const ws = activeWsRef.ws;
        const readyState = ws
          ? (ws as unknown as { readyState: number }).readyState
          : -1;

        const states: Record<number, string> = {
          0: "CONNECTING",
          1: "OPEN",
          2: "CLOSING",
          3: "CLOSED",
        };

        const stateLabel = states[readyState] ?? "NOT INITIALISED";
        const pendingCount = pendingPhotoRequests.size;

        return toolText(
          `LSPlatform WebSocket state: ${stateLabel}` +
            (pendingCount > 0
              ? ` (${pendingCount} pending photo request(s))`
              : ""),
        );
      },
    }),
    { name: "lsplatform_connection_status" },
  );
}

// ---------------------------------------------------------------------------
// Registration entry point
// ---------------------------------------------------------------------------

export function registerTools(api: OpenClawPluginApi): void {
  registerCapturePhotoTool(api);
  registerConnectionStatusTool(api);
}
