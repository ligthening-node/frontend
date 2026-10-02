import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Wallet } from "@/components/node/wallet";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage(): ReactElement {
  return <Wallet />;
}
