import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Receive } from "@/components/node/receive";

export const metadata: Metadata = { title: "Receive" };

export default function ReceivePage(): ReactElement {
  return <Receive />;
}
