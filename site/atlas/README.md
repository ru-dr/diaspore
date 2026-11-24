# Diaspore Atlas

An interactive whiteboard map of every Diaspore component. Click a box to see what it takes, what
it gives, what it uses, its code, and an input and output example.

Live at <https://ru-dr.github.io/diaspore/atlas/>. The `Pages` workflow deploys it whenever
`site/` or `docs/assets/` changes on `main`.

## Editing

- All content (positions, text, code, links) is in [`data.js`](data.js). `index.html` only draws it.
- `code.real: true` means the snippet is copied from `main`. Update it when that code changes.
  Everything else is a proposed sketch and is labelled as one on the page.
- Links marked `main: 1` are drawn by default. The rest appear when a connected box is selected or
  "All links" is on.

## Preview locally

The logo files are copied in from `docs/assets` at deploy time, so copy them once for a local
preview:

```sh
mkdir -p site/atlas/assets
cp docs/assets/favicon.svg docs/assets/logo-lockup-color*.svg site/atlas/assets/
xdg-open site/atlas/index.html   # or: open site/atlas/index.html on macOS
```

`site/atlas/assets/` is ignored by Git.
