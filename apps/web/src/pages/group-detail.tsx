import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  CopyIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  EMPTY_FILTER_FORM,
  FilterForm,
  FilterSummary,
  filterToFormValue,
  toFilterPayload,
  type FilterFormValue,
} from '@/components/filter-form';
import { EditGroupDialog } from '@/components/edit-group-dialog';
import { ListingCard } from '@/components/listing-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  EmptyState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/misc';
import { formatDateTime, formatRelative } from '@/lib/format';
import {
  useAddFilter,
  useDeleteFilter,
  useFetchGroup,
  useFilterGroup,
  useGroupRuns,
  useListings,
  useUpdateFilter,
} from '@/lib/queries';

export function GroupDetailPage() {
  // Route ids are prefixed by the pathless `protected-layout` route.
  const { groupId } = useParams({ from: '/protected-layout/groups/$groupId' });
  const group = useFilterGroup(groupId);
  const runs = useGroupRuns(groupId);
  const listings = useListings({ groupId, pageSize: 12, sort: 'newest' });
  const fetchGroup = useFetchGroup();
  const deleteFilter = useDeleteFilter(groupId);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  // Seeds the filter dialog: blank, a copy of a row, or the row being edited.
  const [filterDraft, setFilterDraft] = useState<FilterFormValue>(EMPTY_FILTER_FORM);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [isCopy, setIsCopy] = useState(false);

  function openFilterDialog(
    draft: FilterFormValue,
    options: { editingId?: string; copy?: boolean } = {},
  ): void {
    setFilterDraft(draft);
    setEditingFilterId(options.editingId ?? null);
    setIsCopy(options.copy ?? false);
    setFilterDialogOpen(true);
  }

  const openBlankFilterDialog = () => openFilterDialog(EMPTY_FILTER_FORM);

  if (group.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!group.data) {
    return (
      <EmptyState
        title="Nie znaleziono grupy"
        action={
          <Button asChild variant="outline">
            <Link to="/groups">Wróć do listy</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/groups">
          <ArrowLeftIcon />
          Grupy filtrów
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <span
              className="size-3 rounded-full"
              style={{ background: group.data.color ?? 'var(--primary)' }}
            />
            {group.data.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {group.data.description ?? 'Brak opisu'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{group.data.listingCount} ofert</Badge>
            {group.data.newListingCount > 0 ? (
              <Badge variant="success">+{group.data.newListingCount} nowych</Badge>
            ) : null}
            <Badge variant="secondary">
              co {group.data.refreshIntervalMinutes} min
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditGroupOpen(true)}>
            <PencilIcon />
            Edytuj grupę
          </Button>
          <Button variant="outline" onClick={openBlankFilterDialog}>
            <PlusIcon />
            Dodaj filtr
          </Button>
          <Button
            disabled={fetchGroup.isPending}
            onClick={() => fetchGroup.mutate(groupId)}
          >
            <RefreshCwIcon className={fetchGroup.isPending ? 'animate-spin' : undefined} />
            Pobierz teraz
          </Button>
        </div>
      </div>

      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Oferty</TabsTrigger>
          <TabsTrigger value="filters">
            Filtry ({group.data.filters.length})
          </TabsTrigger>
          <TabsTrigger value="runs">Historia pobrań</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="pt-6">
          {listings.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          ) : listings.data && listings.data.items.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.data.items.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {listings.data.total > listings.data.items.length ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/listings" search={{ groupId } as never}>
                    Zobacz wszystkie {listings.data.total} ofert
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Brak ofert w tej grupie"
              description="Uruchom pobieranie, aby zebrać wyniki dla zdefiniowanych filtrów."
            />
          )}
        </TabsContent>

        <TabsContent value="filters" className="space-y-3 pt-6">
          {group.data.filters.map((filter) => (
            <Card key={filter.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium">
                    {filter.name ??
                      [filter.make, filter.model].filter(Boolean).join(' ') ??
                      'Filtr'}
                  </p>
                  <FilterSummary filter={filter} />
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edytuj filtr"
                    title="Edytuj ten filtr"
                    onClick={() =>
                      openFilterDialog(filterToFormValue(filter), {
                        editingId: filter.id,
                      })
                    }
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Duplikuj filtr"
                    title="Utwórz nowy filtr na bazie tego"
                    onClick={() =>
                      openFilterDialog(filterToFormValue(filter), { copy: true })
                    }
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Usuń filtr"
                    onClick={() => deleteFilter.mutate(filter.id)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {group.data.filters.length === 0 ? (
            <EmptyState
              title="Brak filtrów"
              description="Dodaj filtr, aby grupa zaczęła zbierać oferty."
              action={
                <Button onClick={openBlankFilterDialog}>
                  <PlusIcon />
                  Dodaj filtr
                </Button>
              }
            />
          ) : null}
        </TabsContent>

        <TabsContent value="runs" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ostatnie pobrania</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {runs.data && runs.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground text-left text-xs">
                      <tr className="border-b">
                        <th className="py-2 pr-4 font-medium">Start</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Źródło</th>
                        <th className="py-2 pr-4 text-right font-medium">Znalezione</th>
                        <th className="py-2 pr-4 text-right font-medium">Nowe</th>
                        <th className="py-2 text-right font-medium">Czas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.data.map((run) => (
                        <tr key={run.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {formatDateTime(run.startedAt)}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              variant={
                                run.status === 'success'
                                  ? 'success'
                                  : run.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {run.status}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground py-2 pr-4">
                            {run.trigger}
                          </td>
                          <td className="tabular py-2 pr-4 text-right">
                            {run.itemsSeen}
                          </td>
                          <td className="tabular py-2 pr-4 text-right">
                            {run.itemsNew}
                          </td>
                          <td className="tabular text-muted-foreground py-2 text-right">
                            {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)} s` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Brak historii — uruchom pobieranie.
                </p>
              )}
              <p className="text-muted-foreground mt-4 text-xs">
                Ostatnie pobranie: {formatRelative(group.data.lastFetchedAt)}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FilterDialog
        groupId={groupId}
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        initialValue={filterDraft}
        editingId={editingFilterId}
        isCopy={isCopy}
      />

      <EditGroupDialog
        group={group.data}
        open={editGroupOpen}
        onOpenChange={setEditGroupOpen}
      />
    </div>
  );
}

/** Mode is implied by `editingId`: set means edit, absent means create. */
function FilterDialog({
  groupId,
  open,
  onOpenChange,
  initialValue,
  editingId,
  isCopy,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: FilterFormValue;
  editingId: string | null;
  isCopy: boolean;
}) {
  const addFilter = useAddFilter(groupId);
  const updateFilter = useUpdateFilter(groupId);
  const [form, setForm] = useState<FilterFormValue>(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever the dialog opens, so editing and duplicating pick up the
  // source row rather than whatever was last typed.
  useEffect(() => {
    if (open) {
      setForm(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  const pending = addFilter.isPending || updateFilter.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const payload = toFilterPayload(form);
      if (editingId) {
        await updateFilter.mutateAsync({ filterId: editingId, input: payload });
      } else {
        await addFilter.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać filtra');
    }
  }

  const title = editingId
    ? 'Edytuj filtr'
    : isCopy
      ? 'Nowy filtr (kopia)'
      : 'Nowy filtr';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isCopy
              ? 'Kryteria skopiowane z istniejącego filtra — zmień, co trzeba.'
              : 'Puste pole oznacza brak ograniczenia.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FilterForm value={form} onChange={setForm} />

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {editingId ? 'Zapisz zmiany' : 'Dodaj filtr'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
