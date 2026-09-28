# 0002. GitHub Flow with a protected main

## Status

Accepted, 2026-09-28

## Context

I wanted to keep my main branch clean from dirty commits. Before merging, I want CI to run so I can be sure my current PR is clean.

## Decision

I first planned a dev branch with dev/* branches under it, but after brainstorming, I realized one prefix didn't fit different kinds of work like features, fixes, CI, tests, and docs. So I went with type-based branch names like feat/*, fix/*, and docs/*, which merge into a protected main through pull requests.

## Consequences

Now every change is tested in a PR before I merge it into main, so main stays clean. Because of that, every change needs its own PR, even a very minor one. The gap is that a feat/* branch with no open PR won't run any CI, so I have to open a draft PR every time.