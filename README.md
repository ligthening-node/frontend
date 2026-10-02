# Lightning Tool: web frontend

Next.js (App Router) frontend for the Lightning Tool. The MVP is the BOLT11 decoder at `/decode`, which runs the Rust
decoder (`backend/crates/invoice-core`) in the browser through WebAssembly. No invoice is sent to a server.

## Commands

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm test         # Vitest, including tests against the real .wasm
pnpm build
```

## Generated code

These folders are generated from the Rust backend and committed, so the frontend builds without a Rust toolchain:

- `lib/types/`: TypeScript types for the decoder output (ts-rs)
- `lib/invoice-wasm/`: the WebAssembly decoder (wasm-pack)

After changing the Rust types or decoder, regenerate both:

```bash
../backend/scripts/build-wasm.sh
```

## Layout

- `app/decode/page.tsx`: decoder page
- `components/decoder/`: decoder UI (anatomy highlighter, fields, checks, errors, options)
- `components/ui/`: shadcn/ui components
- `lib/decoder.ts`: loads the WebAssembly module on first use
- `lib/field-info.ts`: learning explanations for every part of an invoice
- `lib/samples.ts`: example invoices from the BOLT11 spec
