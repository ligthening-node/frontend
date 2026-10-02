import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Channels } from "@/components/node/channels";

export const metadata: Metadata = { title: "Channels" };

export default function ChannelsPage(): ReactElement {
  return <Channels />;
}
