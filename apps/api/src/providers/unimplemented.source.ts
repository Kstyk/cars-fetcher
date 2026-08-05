import type {
  ListingSource,
  ProviderName,
  SearchCriteria,
  SearchOptions,
  SearchResult,
} from './types.js';

/**
 * Placeholder for a provider that is registered in the UI but has no adapter
 * yet. It reports itself as unconfigured, so `runFilter` marks the run failed
 * with a readable reason instead of silently returning nothing.
 */
export class UnimplementedSource implements ListingSource {
  constructor(
    readonly provider: ProviderName,
    private readonly label: string,
  ) {}

  isConfigured(): boolean {
    return false;
  }

  async search(
    _criteria: SearchCriteria,
    _options: SearchOptions,
  ): Promise<SearchResult> {
    throw new Error(`Adapter dla ${this.label} nie jest jeszcze zaimplementowany`);
  }
}
