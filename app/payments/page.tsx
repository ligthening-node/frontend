import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Payments } from "@/components/node/payments";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage(): ReactElement {
  return <Payments />;
}
