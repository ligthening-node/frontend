import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Send } from "@/components/node/send";

export const metadata: Metadata = { title: "Send" };

export default function SendPage(): ReactElement {
  return <Send />;
}
