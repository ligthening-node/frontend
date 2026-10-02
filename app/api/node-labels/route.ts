import { parseKnownNodes } from "@/lib/node-labels";
import type { KnownNode } from "@/lib/node-labels";

/** Asks one node for its id. Unreachable nodes are left out rather than failing the page. */
async function nodeId(node: KnownNode, token: string): Promise<[string, string] | null> {
  try {
    const response = await fetch(`${node.url}/node/status`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const status = (await response.json()) as { node_id?: string };
    return typeof status.node_id === "string" ? [status.node_id, node.label] : null;
  } catch {
    return null;
  }
}

/** Maps node ids to the names of the nodes this setup runs, so the UI can tell them apart. */
export async function GET(): Promise<Response> {
  const token = process.env.LN_API_TOKEN;
  if (token === undefined) {
    return Response.json({});
  }
  const found = await Promise.all(parseKnownNodes(process.env.KNOWN_NODES).map((node) => nodeId(node, token)));
  return Response.json(Object.fromEntries(found.filter((pair): pair is [string, string] => pair !== null)));
}
