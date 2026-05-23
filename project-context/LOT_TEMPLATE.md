# LOT #NNN — [Short Title]

> Status: PLANNED | IN_PROGRESS | DONE
> Branch: `feature/NNN-slug`
> Author: [name]
> Date: YYYY-MM-DD

## Goal

One paragraph. What problem does this lot solve? What will be true after it's done that is not true before?

## Scope

### In scope
- Bullet list of what this lot explicitly includes

### Out of scope
- Bullet list of what this lot explicitly defers or excludes

## Context

What does the implementer need to know before starting? Reference relevant decisions (D-NNN), traps (T-NNN), and prior lots.

Key files to read first:
- `path/to/file.ts` — why
- `path/to/other.ts` — why

## Approach

Step-by-step implementation plan. Be specific about:
- New files to create (path + purpose)
- Existing files to modify (path + what changes)
- New Prisma models or fields (include proposed schema snippet)
- New endpoints (method, path, auth, DTO shape)
- New env vars required

### Schema changes (if any)

```prisma
// Add to schema.prisma
model NewModel {
  id          String   @id @default(uuid())
  // ...
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### New endpoints (if any)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/resource` | USER | Create resource |

### New env vars (if any)

| Var | Required | Default | Description |
|---|---|---|---|
| `NEW_VAR` | No | `default` | Purpose |

## Validation

How do you know this lot is done? List:
- [ ] Unit tests passing
- [ ] E2E tests covering the happy path
- [ ] E2E tests covering the main error cases
- [ ] Swagger docs updated (if new endpoints)
- [ ] Migration created and tested locally
- [ ] No TypeScript errors (`npm run build`)
- [ ] CI green

## Risks / open questions

- Risk: [describe] → Mitigation: [describe]
- Question: [describe] → Decision needed by: [who]

## Notes

Free-form: discoveries made during implementation, deferred items, follow-up lot suggestions.
