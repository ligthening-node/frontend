import type { ReactElement } from "react";

import type { ApiError } from "@/lib/api";

export function ApiErrorNotice({ error }: { error: ApiError }): ReactElement {
  const offline = error.code === "node_unreachable";
  return (
    <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <p className="font-semibold">{offline ? "The node is offline" : "Something went wrong"}</p>
      <p>{error.message}</p>
      {offline && (
        <p className="mt-1 opacity-80">
          Start the API with <code className="font-mono">cargo run -p api-server</code> and make sure bitcoind is running.
        </p>
      )}
    </div>
  );
}
