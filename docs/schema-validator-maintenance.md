# Plugin-Schema Validator Maintenance

Moved out of `AGENTS.md` — only needed when touching `skills/vinela-plugin-schema/` or the generated validator modules.

## What ships where

- `skills/vinela-plugin-schema/scripts/validate-plugin-schema.mjs` is both the public Node CLI and an importable, side-effect-free plain-JavaScript core.
- `structural-validator.generated.mjs` and `semantic-validator.generated.mjs` are committed generated snapshots from `schema/plugin-schema.schema.json` and the canonical application validators.
- `skills/vinela-plugin-schema/THIRD_PARTY_NOTICES.md` attributes bundled Ajv/ajv-formats code in the structural module.
- Application validation stays in `src/shared/lib/schema-validation.ts` and `src/features/lua-generator/utils/schema-shape-invariants.ts`.

**Never edit generated validator modules or notices by hand.**

## Regeneration

```sh
bun run schema:validator:build   # regenerate
bun run schema:validator:check   # drift check (dual independent generations, no writes)
```

Canonical producer is Linux x64 with Bun `1.3.14`.

## Guarantees the build enforces

- Semantic bundling proves closure through one production `validateSemanticBuildGraph` over Bun's canonicalized metafile graph (importer-aware edges, exactly two temp exclusions, empty `output.imports`); digest input is the validator's returned set only.
- Pair replacement registers every `.stage-*`/`.rollback-*` path in one verified cleanup registry, stages all changed candidates before rename with exactly one close attempt per opened stage handle, preserves present destination modes, and records primary, rollback, committed, and verification facts monotonically so established outcomes survive exceptions from later awaited phases.
- Cleanup remove failures are reported even when absence is subsequently verified; relevant Bun lock keys bind to exact resolution tuples; dependency/lock/license/notice preflight runs before generation.
- Production transaction tests cover acceptance rows A1-A10, B1-B13, and C1-C7 with exact primary/rollback/verification/cleanup outcomes, destination bytes and modes, operation ownership/order/counts, cleanup diagnostics, and residue checks.
- Generated and installed modules enforce exact export namespaces in AST, isolated runtime import, and CLI loading.
