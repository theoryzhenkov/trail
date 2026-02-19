# Trail — Obsidian plugin

set quiet

default:
    @just --list

# Install dependencies
install:
    bun install

# Dev build with watch mode
dev:
    bun run dev

# Production build (grammar + typecheck + bundle)
build:
    bun run build

# Build Lezer grammar only
build-grammar:
    bun run build:grammar

# Run ESLint
lint:
    bun run lint

# Validate documentation links
lint-docs:
    bun run lint:docs

# Run all checks (lint + typecheck + tests)
check: lint typecheck test

# TypeScript type-check (no emit)
typecheck:
    tsc -noEmit -skipLibCheck

# Run tests
test *args:
    vitest run {{ args }}

# Run tests in watch mode
test-watch *args:
    vitest {{ args }}

# Bump version across manifest.json, package.json, versions.json
bump version:
    node version-bump.mjs {{ version }}

# Clean build artifacts
clean:
    rm -f main.js
