/**
 * LSPlatform REST API client.
 *
 * These functions wrap the three LSPlatform pairing endpoints.
 * The concrete request/response shapes are left as TODOs pending
 * the final API specification from the cloud team.
 */

// ---------------------------------------------------------------------------
// Pairing step 1 — OpenClaw requests a pairing code
// ---------------------------------------------------------------------------

export type RequestPairingCodeResult = {
  /** Six-digit numeric pairing code shown to the user. */
  pairingCode: string;
};

/**
 * Request a new 6-digit pairing code from LSPlatform.
 *
 * TODO: implement the real POST /v1/pair/code (or equivalent) request
 * and map the response to `RequestPairingCodeResult`.
 */
export async function requestPairingCode(
  _apiUrl: string,
): Promise<RequestPairingCodeResult> {
  // TODO: POST {apiUrl}/v1/pair/code
  // Expected response shape: { code: "123456" }
  throw new Error(
    "requestPairingCode: LSPlatform API integration not yet implemented",
  );
}

// ---------------------------------------------------------------------------
// Pairing step 3 — OpenClaw polls for the apiToken
// ---------------------------------------------------------------------------

export type PollForTokenResult = {
  /** apiToken when pairing is complete, null while still pending. */
  apiToken: string | null;
};

/**
 * Poll LSPlatform for the apiToken associated with a pairing code.
 *
 * Returns `{ apiToken: null }` while the user has not yet scanned the code.
 * Returns `{ apiToken: "..." }` once the miniProgram has completed pairing.
 *
 * TODO: implement the real GET /v1/pair/token?code=... request
 * and map the response to `PollForTokenResult`.
 */
export async function pollForToken(
  _apiUrl: string,
  _pairingCode: string,
): Promise<PollForTokenResult> {
  // TODO: GET {apiUrl}/v1/pair/token?code={pairingCode}
  // Expected response shapes:
  //   pending  → { token: null }
  //   complete → { token: "eyJ..." }
  throw new Error(
    "pollForToken: LSPlatform API integration not yet implemented",
  );
}
