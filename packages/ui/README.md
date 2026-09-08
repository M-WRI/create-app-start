# @repo/ui

Shared design system (shadcn-style atoms owned in-repo). Apps import only from `@repo/ui`.

## Usage

```tsx
import { Button, Card, Input } from "@repo/ui";
import "@repo/ui/styles.css";
```

In the Vite app (Step 6), add Tailwind v4 `@source` for this package so classes are not purged.

## Seed atoms

Button, Input, Textarea, Label, Checkbox, Switch, Card, Badge, Separator, Skeleton, Spinner, Avatar, Dialog, Select, DropdownMenu

Each atom uses the forced unit folders: `component/`, `hooks/`, `utils/`, `types/`, `constants/`.

## Placement rule

Check `@repo/ui` first → create atom here if missing → molecules/organisms only if cross-app.
