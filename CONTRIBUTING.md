# Contributing

Tinkjam is a shared whiteboard for product teams, built on a fork of
[T3 Code](https://github.com/pingdotgg/t3code). Read [AGENTS.md](AGENTS.md) first, its Tinkjam
section above all: it says what the product is, which rules cannot be loosened, and where the code
lives. If you work with a coding agent, it reads that file too.

## Developer setup

See the [development runbook](docs/operations/development.md#first-checkout) for the first checkout,
development commands and tests.

- The working branch is `multiplayer-guest-rooms`. Branch from it and open pull requests against it.
- You need no production credentials. Sign-in uses a development instance; AGENTS.md says how to
  make a test account.

<a id="prior-approval"></a>

## Agree on the problem first

Talk to a maintainer before you start anything larger than a small fix: say what is wrong or
missing, for whom, and what you intend to change. Work that was not agreed may be closed or redone.

A change to who can send what to whose agent always needs a maintainer's agreement first. See the
Send rule in AGENTS.md.

<a id="one-problem"></a>

## One problem per pull request

A pull request solves one problem. Leave unrelated cleanup, renames and reformatting out; send
them separately if they are worth doing.

<a id="verification"></a>

## Show that it works

- Run `vp run check:changed` before you push. Do not skip the commit hooks.
- Behavior that can break gets a focused test. AGENTS.md says which changes need one and which do
  not.
- A change someone can see needs before and after images, in light and in dark mode. Motion needs
  a short video.
- Say what you ran and what you saw. Say what you did not check.

<a id="closure-and-reconsideration"></a>

## Review

A maintainer reviews every pull request before it merges, and may ask for a smaller scope, change
it, or close it. A closed pull request can be reopened when the reason it was closed no longer
holds.
