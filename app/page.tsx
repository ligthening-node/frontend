import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Dashboard } from "@/components/node/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Home(): ReactElement {
  return <Dashboard />;
}
