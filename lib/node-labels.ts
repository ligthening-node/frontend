export interface KnownNode {
  label: string;
  url: string;
}

/** What the local setup runs when `KNOWN_NODES` is not set. */
const DEFAULT_KNOWN_NODES = "Main node=http://127.0.0.1:3001,Peer node=http://127.0.0.1:3002";

/** Parses `Label=url,Label=url`. Entries without both parts are skipped. */
export function parseKnownNodes(value: string | undefined): KnownNode[] {
  return (value ?? DEFAULT_KNOWN_NODES)
    .split(",")
    .map((entry: string): KnownNode | null => {
      const at = entry.indexOf("=");
      const label = entry.slice(0, at).trim();
      const url = entry.slice(at + 1).trim();
      return at > 0 && label !== "" && url !== "" ? { label, url } : null;
    })
    .filter((node: KnownNode | null): node is KnownNode => node !== null);
}
