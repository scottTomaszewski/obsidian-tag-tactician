# Changelog

## 1.10.1

- Fixed a missing semicolon in `styles.css` that caused a CSS lint error

## 1.10.0

- Corrected the minimum required Obsidian version to 1.7.2 to match the APIs the plugin actually uses
- Updated all user-facing text (commands, menus, and settings) to sentence case, following Obsidian's style guidelines
- Hardened the codebase: full TypeScript strict checking, ESLint via `eslint-plugin-obsidianmd`, safer DOM rendering for tag and title highlighting, and styles consolidated into `styles.css`

## 0.9.3

- Avoiding errors when frontmatter cache is not yet finished building

## 0.9.2

- Avoids a console error when leaf is null

## 0.9.1

- Attempts to reopen views when updated