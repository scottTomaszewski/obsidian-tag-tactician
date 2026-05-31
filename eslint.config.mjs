import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
    {
        ignores: [
            "main.js",
            "node_modules/**",
            "esbuild.config.mjs",
            "version-bump.mjs",
            "eslint.config.mjs",
            // JSON files the recommended config does not register a parser for.
            // (manifest.json is validated manually against rules 1-5.)
            "data.json",
            "devbox.json",
            "devbox.lock",
            "package-lock.json",
            "tsconfig.json",
            "versions.json",
            "manifest.json",
        ],
    },
    ...obsidianmd.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        // Type-aware rules cannot run on JSON files (no TypeScript program).
        // The recommended config registers these globally, so disable them here.
        files: ["**/*.json"],
        rules: {
            "obsidianmd/no-plugin-as-component": "off",
            "obsidianmd/no-unsupported-api": "off",
            "obsidianmd/prefer-file-manager-trash-file": "off",
        },
    },
    {
        // `builtin-modules` is part of the standard Obsidian esbuild setup and
        // `js-yaml` is required to round-trip frontmatter with the user's chosen
        // array style (brackets vs. hyphens), which Obsidian's stringifyYaml
        // cannot reproduce. Both dependencies are intentional.
        rules: {
            "depend/ban-dependencies": "off",
        },
    },
);
