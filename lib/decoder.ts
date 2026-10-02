import type { DecodeContext } from "@/lib/types/DecodeContext";
import type { DecodeResult } from "@/lib/types/DecodeResult";

type WasmModule = typeof import("@/lib/invoice-wasm/invoice_wasm");

let wasmPromise: Promise<WasmModule> | null = null;

// Loaded on first use and cached: the module is ~350 KB, so it only downloads when someone decodes.
function loadWasm(): Promise<WasmModule> {
  if (wasmPromise === null) {
    wasmPromise = import("@/lib/invoice-wasm/invoice_wasm").then(async (wasm): Promise<WasmModule> => {
      await wasm.default();
      return wasm;
    });
    wasmPromise.catch((): void => {
      wasmPromise = null;
    });
  }
  return wasmPromise;
}

/** Decodes an invoice with the Rust decoder compiled to WebAssembly. */
export async function decodeInvoice(input: string, ctx: DecodeContext): Promise<DecodeResult> {
  const wasm = await loadWasm();
  return JSON.parse(wasm.decode(input, JSON.stringify(ctx))) as DecodeResult;
}

export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}
