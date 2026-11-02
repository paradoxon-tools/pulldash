# Pulldash

Fast, filterable GitHub PR review, maintained independently by [paradoxon-tools](https://github.com/paradoxon-tools/pulldash).

## Desktop use

Sign in with a GitHub classic personal access token with the `repo` scope (and `read:user` for profile access), or browse public PRs anonymously. The token is stored locally in the app profile. GitHub requests go directly to GitHub.

This distribution has no automatic updater, analytics collection, shared OAuth app, hosted service dependency, or GitHub Actions workflows. Install updates manually from builds you control.

## Development

```sh
bun install --frozen-lockfile
bun dev
```

Checks: `bun typecheck`, `bun test`, `bun fmt:check`.

Build a Windows x64 installer locally:

```sh
bun run electron:build
bunx electron-builder --config electron-builder.json --win nsis --x64 --publish never
```

Artifacts are written to `release/`. The Windows application ID is `tools.paradoxon.pulldash`. Publishing is disabled in the builder configuration. The T3 Code project provides saved install, build, and check commands.

## License and provenance

AGPL-3.0-only; see [LICENSE](LICENSE). Derived from Coder's Pulldash at source commit `1fd065eb`. Original source history and contributor copyright remain intact. This repository is operated independently and is not affiliated with Coder. See [NOTICE](NOTICE).
