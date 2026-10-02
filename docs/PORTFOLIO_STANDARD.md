# Deenfoool Portfolio Repository Standard

This document defines how repositories are prepared for `Deenfoool/portfolio`.

## Scope

The standard applies to repositories that should appear in the portfolio. The portfolio repository itself is excluded from normal project auditing unless explicitly requested.

## Canonical portfolio directory

Portfolio-specific metadata and media live on the repository **default branch**:

```text
portfolio/
├── cover.png
├── project.json
└── gallery/
    ├── 01.png
    ├── 02.png
    ├── 03.png
    └── ...
```

Do not store portfolio media in the repository root.

## Cover

`portfolio/cover.png` is required for every repository shown in the portfolio.

Recommended format:
- PNG or high-quality WebP if the portfolio frontend adds support later.
- 16:9 composition.
- Recommended working size: 1600×900.
- Must still read clearly when cropped in a card.
- Should represent the project itself, not a generic GitHub/social preview.

The frontend keeps a GitHub OpenGraph fallback so one broken cover does not break the page, but a missing cover remains a standards violation and should produce a console warning.

## Gallery

`portfolio/gallery/` is recommended for projects where screenshots materially help explain the work: web apps, visual tools, games, editors, 3D projects and mods with meaningful in-game visuals.

Naming is sequential and zero-padded:

```text
portfolio/gallery/01.png
portfolio/gallery/02.png
portfolio/gallery/03.png
```

Guidelines:
- 3–6 strong screenshots are usually better than many repetitive images.
- Do not require a gallery for backend-only services, libraries, tiny utilities or projects with nothing meaningful to show visually.
- Do not copy random working assets into the gallery. Gallery images should be intentionally selected presentation screenshots.

Gallery is not an inclusion gate. A valid project may appear with only `cover.png`; the modal falls back to the cover when no gallery images exist.

## Favicon

A favicon is required only when the repository actually exposes a user-facing web site/app.

The audit must verify both:
1. a favicon/icon asset exists, and
2. the deployed HTML or manifest actually references it.

Acceptable examples include:
- `favicon.ico`
- `favicon.svg`
- `icon.svg` / `icon.png` referenced through `<link rel="icon">`
- PWA icons referenced by `manifest.webmanifest`

A non-web project such as a downloadable Minecraft mod does **not** fail the audit for missing favicon unless it also ships a web frontend/site.

For GitHub Pages projects, inspect the branch that is actually published. Do not declare the favicon missing just because it is absent from the default branch if the deployed site lives on another branch.

## project.json

Every portfolio project must have `portfolio/project.json` validated against:

```text
https://raw.githubusercontent.com/Deenfoool/portfolio/main/schemas/project.schema.json
```

`portfolio/project.json` is the authoritative inclusion gate for the site:

- missing file → repository is hidden;
- invalid metadata → repository is hidden and a console warning is emitted;
- valid metadata → repository can appear in **All Projects**;
- `featured: true` → repository can also appear in **Featured**;
- `featured: false` → repository stays out of **Featured**, regardless of GitHub topics.

Statistics, language filters and the project grid are calculated only from repositories with valid metadata. GitHub topic `featured` is not authoritative once `project.json` is used.

Base example:

```json
{
  "$schema": "https://raw.githubusercontent.com/Deenfoool/portfolio/main/schemas/project.schema.json",
  "version": 1,
  "title": "Safelight",
  "tagline": "Privacy-first browser image toolkit",
  "kind": "web",
  "status": "active",
  "featured": true,
  "tags": ["JavaScript", "Canvas", "PWA"],
  "primaryAction": {
    "type": "website",
    "label": "Открыть сайт",
    "source": "github-pages"
  }
}
```

Downloadable project example:

```json
{
  "$schema": "https://raw.githubusercontent.com/Deenfoool/portfolio/main/schemas/project.schema.json",
  "version": 1,
  "title": "Stone & Banner",
  "tagline": "RTS total-conversion mod for Minecraft",
  "kind": "mod",
  "status": "active",
  "featured": false,
  "tags": ["Minecraft", "RTS", "Java"],
  "primaryAction": {
    "type": "download",
    "label": "Скачать мод",
    "source": "github-release",
    "assetPattern": "*.jar"
  }
}
```

## Primary action rules

Choose the primary action based on what the visitor should actually do:

- `website`: a usable live site/app exists.
- `download`: the project is primarily consumed as a file/program/mod/plugin/archive.
- `github`: repository is the main destination.
- `details`: no better direct action exists; open the project case/details.

For `download` + `github-release`, prefer an asset pattern over a hard-coded release URL so future releases can be discovered automatically.

## Audit severity

Use three levels:

- **Required** — the project is incorrectly represented or cannot use an intended portfolio feature.
- **Recommended** — meaningful presentation improvement.
- **Optional** — polish only.

Typical required findings:
- missing `portfolio/cover.png`
- missing `portfolio/project.json`
- web project has no working favicon reference
- `project.json` points to an invalid/nonexistent primary action

Typical recommended findings:
- visual project has no gallery
- weak/repetitive screenshots
- generic cover that does not explain the project

## Safety for automated changes

An auditor may inspect freely. It must not modify repositories until the user explicitly asks to apply changes.

When applying changes:
- do not alter application source code unless explicitly authorized;
- prefer changes inside `portfolio/` plus favicon wiring when specifically approved;
- preserve existing assets unless they are confirmed obsolete;
- make small, clear commits per repository;
- never fabricate screenshots or claim an image exists when it has not been verified.
