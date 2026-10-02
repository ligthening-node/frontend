import type { ReactElement } from "react";

/** The inline message under a form field; renders nothing when the field is fine. */
export function FieldError({ message }: { message: string | null }): ReactElement | null {
  return message === null ? null : (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
