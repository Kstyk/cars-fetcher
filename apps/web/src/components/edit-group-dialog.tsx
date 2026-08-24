import { Loader2Icon } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useUpdateGroup } from '@/lib/queries';
import type { FilterGroup } from '@/lib/types';

interface GroupDraft {
  name: string;
  description: string;
  color: string;
  refreshIntervalMinutes: number;
  notifyOnNew: boolean;
  isActive: boolean;
}

function toDraft(group: FilterGroup): GroupDraft {
  return {
    name: group.name,
    description: group.description ?? '',
    color: group.color ?? '#007d7e',
    refreshIntervalMinutes: group.refreshIntervalMinutes,
    notifyOnNew: group.notifyOnNew,
    isActive: group.isActive,
  };
}

/**
 * Edits a group's own settings. Filters live in the group detail view - this
 * only covers the name, colour, schedule and notification switches.
 */
export function EditGroupDialog({
  group,
  open,
  onOpenChange,
}: {
  group: FilterGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateGroup = useUpdateGroup(group.id);
  const [draft, setDraft] = useState<GroupDraft>(() => toDraft(group));
  const [error, setError] = useState<string | null>(null);

  // Reopening on a different group must not show the previous group's values.
  useEffect(() => {
    if (open) {
      setDraft(toDraft(group));
      setError(null);
    }
  }, [open, group]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await updateGroup.mutateAsync({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        color: draft.color,
        refreshIntervalMinutes: draft.refreshIntervalMinutes,
        notifyOnNew: draft.notifyOnNew,
        isActive: draft.isActive,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj grupę</DialogTitle>
          <DialogDescription>
            Filtry tej grupy edytujesz w zakładce „Filtry".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Nazwa</Label>
            <Input
              id="group-name"
              required
              minLength={2}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">Opis</Label>
            <Textarea
              id="group-description"
              rows={2}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="group-interval">Odświeżanie (min)</Label>
              <Input
                id="group-interval"
                type="number"
                min={15}
                max={10080}
                value={draft.refreshIntervalMinutes}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    refreshIntervalMinutes: Number(event.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-color">Kolor</Label>
              <Input
                id="group-color"
                type="color"
                className="h-9 p-1"
                value={draft.color}
                onChange={(event) => setDraft({ ...draft, color: event.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-base border-2 border-border px-3 py-2.5">
            <div>
              <Label htmlFor="group-notify" className="cursor-pointer">
                Powiadamiaj o nowych ofertach
              </Label>
            </div>
            <Switch
              id="group-notify"
              checked={draft.notifyOnNew}
              onCheckedChange={(value) => setDraft({ ...draft, notifyOnNew: value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-base border-2 border-border px-3 py-2.5">
            <div>
              <Label htmlFor="group-active" className="cursor-pointer">
                Grupa aktywna
              </Label>
              <p className="text-muted-foreground text-xs">
                Wstrzymana grupa jest pomijana przez harmonogram
              </p>
            </div>
            <Switch
              id="group-active"
              checked={draft.isActive}
              onCheckedChange={(value) => setDraft({ ...draft, isActive: value })}
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={updateGroup.isPending}>
              {updateGroup.isPending ? <Loader2Icon className="animate-spin" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
