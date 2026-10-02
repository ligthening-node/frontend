import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CheckList } from "@/components/decoder/check-list";
import { DecodeErrorView } from "@/components/decoder/decode-error-view";

describe("DecodeErrorView", () => {
  it("highlights the offending character after stripping the URI prefix", () => {
    render(
      <DecodeErrorView
        input="  lightning:lnbc2500u1pvjlub"
        error={{ code: "invalid_char", pos: 15, ch: "b" }}
        message="invalid character 'b' at position 15"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot read this invoice");
    expect(screen.getByText("b", { selector: "mark" })).toBeInTheDocument();
  });

  it("shows a hint for checksum failures", () => {
    render(<DecodeErrorView input="lnbc1x" error={{ code: "bad_checksum" }} message="bech32 checksum failed" />);
    expect(screen.getByText(/Copy the whole invoice again/)).toBeInTheDocument();
  });
});

describe("CheckList", () => {
  it("renders every check with its status", () => {
    render(
      <CheckList
        report={{
          verdict: "not_payable",
          checks: [
            { id: "expiry", status: "fail", message: "Expired 2d ago" },
            { id: "signature", status: "pass", message: "Signature verifies" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Expiry")).toBeInTheDocument();
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(screen.getByText("Expired 2d ago")).toBeInTheDocument();
  });
});
