# AdSpawn Wiki — Schema

This wiki is a structured, interlinked knowledge base for the AdSpawn project. It is maintained by an LLM and designed to be browsed in Obsidian or any markdown viewer.

## Structure

```
wiki/
├── SCHEMA.md          # This file — conventions and workflows
├── index.md           # Content catalog with links and summaries
├── log.md             # Chronological activity log
└── pages/
    ├── architecture/  # System design, tech stack, data flows
    ├── services/      # Backend service documentation
    ├── frontend/      # Frontend pages, components, state
    ├── concepts/      # Domain concepts (Meta Ads, objectives, etc.)
    ├── api/           # Routes, controllers, endpoints
    └── testing/       # Test strategy, coverage, drift detection
```

## Conventions

- **Links**: Use `[[page-name]]` for cross-references between wiki pages.
- **Source references**: Use `file:line` format (e.g. `MetaFieldRegistry.ts:194`) to point to source code.
- **Page format**: Each page starts with a `# Title`, followed by a one-line summary, then sections.
- **Updates**: When new information arrives, update existing pages rather than creating duplicates. Add new pages only for genuinely new topics.
- **Index**: Every page must have an entry in `index.md`.
- **Log**: Every ingest/query/lint operation gets a timestamped entry in `log.md`.

## Workflows

### Ingest a new source
1. Read the source document or code change
2. Discuss key takeaways
3. Create or update relevant wiki pages
4. Update `index.md`
5. Append to `log.md`

### Query the wiki
1. Read `index.md` to find relevant pages
2. Read those pages and synthesize an answer
3. Optionally file the answer as a new wiki page

### Lint / Health check
1. Check for contradictions between pages
2. Find orphan pages with no inbound links
3. Identify stale information
4. Suggest new pages or sources needed
