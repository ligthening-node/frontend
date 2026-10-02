import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CheckId } from "@/lib/types/CheckId";
import type { Status } from "@/lib/types/Status";
import type { ValidationReport } from "@/lib/types/ValidationReport";

const CHECK_NAMES: Record<CheckId, string> = {
  signature: "Signature",
  expected_payee: "Expected payee",
  expiry: "Expiry",
  network: "Network",
  amount: "Amount",
  description_hash: "Description hash",
  required_fields: "Required fields",
  features: "Features",
  field_encoding: "Field encoding",
  unknown_fields: "Unknown fields",
};

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  pass: { label: "Pass", className: "bg-emerald-600 text-white" },
  info: { label: "Info", className: "bg-sky-600 text-white" },
  warn: { label: "Warn", className: "bg-amber-500 text-black" },
  fail: { label: "Fail", className: "bg-red-600 text-white" },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground" },
};

export function CheckList({ report }: { report: ValidationReport }): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checks</CardTitle>
        <CardDescription>
          The verdict comes only from these: a failed signature or required-field check makes the invoice invalid, any
          other failure makes it not payable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {report.checks.map((check) => {
            const badge = STATUS_BADGE[check.status];
            return (
              <li key={check.id} className="flex items-start gap-3 border-b py-2 last:border-b-0">
                <Badge className={`w-16 ${badge.className}`}>{badge.label}</Badge>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{CHECK_NAMES[check.id]}</span>
                  <span className="text-sm text-muted-foreground">{check.message}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
