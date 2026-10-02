export interface NodeRole {
  label: string;
  isPeer: boolean;
}

/**
 * Which node this web app talks to. `NODE_LABEL` wins; without it the API url decides, since the
 * local setup puts the main node on :3001 and the peer on :3002. Returns null when no node is
 * configured, as on the public decoder deployment.
 */
export function nodeRole(env: { NODE_LABEL?: string; LN_API_URL?: string; LN_API_TOKEN?: string }): NodeRole | null {
  const label = env.NODE_LABEL?.trim();
  if (label !== undefined && label !== "") {
    return { label, isPeer: /peer/i.test(label) };
  }
  if (env.LN_API_TOKEN === undefined) {
    return null;
  }
  const isPeer = /:3002\/?$/.test(env.LN_API_URL ?? "");
  return { label: isPeer ? "Peer node" : "Main node", isPeer };
}
