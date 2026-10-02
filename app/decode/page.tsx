import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Decoder } from "@/components/decoder/decoder";

export const metadata: Metadata = {
  title: "BOLT11 Decoder",
  description: "Decode and validate Lightning invoices, and see what every character means.",
};

export default function DecodePage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">BOLT11 invoice decoder</h1>
        <p className="text-muted-foreground">
          Decodes and validates Lightning invoices with a Rust decoder compiled to WebAssembly. Everything runs in your
          browser: the invoice is never sent to a server.
        </p>
      </div>
      <Decoder />
    </div>
  );
}
