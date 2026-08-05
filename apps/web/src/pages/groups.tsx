import { Link } from '@tanstack/react-router';
import {
  ListFilterIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { EmptyState, Skeleton, Textarea } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { formatRelative } from '@/lib/format';
import { MultiCombobox } from '@/components/ui/combobox';
import {
  useCreateGroup,
  useDeleteGroup,
  useFetchGroup,
  useFilterGroups,
  useTaxonomy,
} from '@/lib/queries';

export function GroupsPage() {
  const groups = useFilterGroups();
  const fetchGroup = useFetchGroup();
  const deleteGroup = useDeleteGroup();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Grupy filtrów</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Każda grupa zbiera kilka wyszukiwań w jedną listę wyników — np.
            „Volvo + Toyota” osobno od „Mazda + Kia”.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon />
          Nowa grupa
        </Button>
      </div>

      {groups.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : groups.data && groups.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.data.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: group.color ?? 'var(--primary)' }}
                      />
                      <Link
                        to="/groups/$groupId"
                        params={{ groupId: group.id }}
                        className="truncate hover:underline"
                      >
                        {group.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {group.description ?? 'Brak opisu'}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Pobierz teraz"
                      disabled={fetchGroup.isPending}
                      onClick={() => fetchGroup.mutate(group.id)}
                    >
                      <RefreshCwIcon
                        className={
                          fetchGroup.isPending && fetchGroup.variables === group.id
                            ? 'animate-spin'
                            : undefined
                        }
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Usuń grupę"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Usunąć grupę "${group.name}" wraz z jej filtrami?`,
                          )
                        ) {
                          deleteGroup.mutate(group.id);
                        }
                      }}
                    >
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{group.listingCount} ofert</Badge>
                  {group.newListingCount > 0 ? (
                    <Badge variant="success">+{group.newListingCount} nowych</Badge>
                  ) : null}
                  {group.notifyOnNew ? (
                    <Badge variant="secondary">Powiadomienia</Badge>
                  ) : null}
                  {!group.isActive ? <Badge variant="outline">Wstrzymana</Badge> : null}
                </div>

                <ul className="space-y-1.5 text-sm">
                  {group.filters.map((filter) => (
                    <li
                      key={filter.id}
                      className="bg-muted/50 flex items-center justify-between gap-2 rounded-md px-3 py-2"
                    >
                      <span className="truncate">
                        {filter.name ??
                          [filter.make, filter.model].filter(Boolean).join(' ') ??
                          'Filtr'}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {filter.yearFrom ? `od ${filter.yearFrom}` : ''}
                        {filter.priceTo
                          ? ` · do ${filter.priceTo.toLocaleString('pl-PL')} zł`
                          : ''}
                      </span>
                    </li>
                  ))}
                  {group.filters.length === 0 ? (
                    <li className="text-muted-foreground text-sm">
                      Brak filtrów — dodaj je w szczegółach grupy.
                    </li>
                  ) : null}
                </ul>

                <p className="text-muted-foreground text-xs">
                  Ostatnie pobranie: {formatRelative(group.lastFetchedAt)} · odświeżanie
                  co {group.refreshIntervalMinutes} min
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ListFilterIcon className="size-8" />}
          title="Brak grup filtrów"
          description="Utwórz pierwszą grupę, aby zacząć zbierać oferty."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon />
              Nowa grupa
            </Button>
          }
        />
      )}

      <CreateGroupDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createGroup = useCreateGroup();
  const taxonomy = useTaxonomy();
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#2563eb',
    refreshIntervalMinutes: 60,
    notifyOnNew: true,
    makes: [] as string[],
    yearFrom: '',
    priceTo: '',
  });
  const [error, setError] = useState<string | null>(null);

  const makeOptions =
    taxonomy.data?.makes.map(({ label }) => ({ value: label, label })) ?? [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      // Each selected make becomes its own filter inside the new group.
      await createGroup.mutateAsync({
        name: form.name,
        description: form.description || null,
        color: form.color,
        refreshIntervalMinutes: form.refreshIntervalMinutes,
        notifyOnNew: form.notifyOnNew,
        filters: form.makes.map((make) => ({
          provider: 'otomoto',
          name: make,
          make,
          ...(form.yearFrom ? { yearFrom: Number(form.yearFrom) } : {}),
          ...(form.priceTo ? { priceTo: Number(form.priceTo) } : {}),
          excludeDamaged: true,
        })),
      });
      onOpenChange(false);
      setForm({ ...form, name: '', description: '', makes: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć grupy');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowa grupa filtrów</DialogTitle>
          <DialogDescription>
            Podaj marki po przecinku — dla każdej powstanie osobny filtr w tej
            grupie.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa grupy</Label>
            <Input
              id="name"
              required
              placeholder="Skandynawia i Japonia"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Marki</Label>
            <MultiCombobox
              options={makeOptions}
              values={form.makes}
              placeholder="Wybierz marki…"
              onChange={(makes) => setForm({ ...form, makes })}
            />
            <p className="text-muted-foreground text-xs">
              Dla każdej marki powstanie osobny filtr. Szczegółowe kryteria
              ustawisz później w widoku grupy.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="yearFrom">Rocznik od</Label>
              <Input
                id="yearFrom"
                type="number"
                placeholder="2018"
                value={form.yearFrom}
                onChange={(e) => setForm({ ...form, yearFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceTo">Cena do (zł)</Label>
              <Input
                id="priceTo"
                type="number"
                placeholder="150000"
                value={form.priceTo}
                onChange={(e) => setForm({ ...form, priceTo: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="interval">Odświeżanie (min)</Label>
              <Input
                id="interval"
                type="number"
                min={15}
                value={form.refreshIntervalMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    refreshIntervalMinutes: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Kolor</Label>
              <Input
                id="color"
                type="color"
                className="h-9 p-1"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <Label htmlFor="notify" className="cursor-pointer">
              Powiadamiaj o nowych ofertach
            </Label>
            <Switch
              id="notify"
              checked={form.notifyOnNew}
              onCheckedChange={(v) => setForm({ ...form, notifyOnNew: v })}
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Utwórz grupę
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
