import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export const providerEnum = pgEnum('provider', [
  'otomoto',
  'olx',
  'mobile_de',
  'autoscout24',
]);

export const fuelTypeEnum = pgEnum('fuel_type', [
  'petrol',
  'petrol_lpg',
  'petrol_cng',
  'diesel',
  'hybrid',
  'plugin_hybrid',
  'electric',
  'hydrogen',
  'other',
]);

export const gearboxEnum = pgEnum('gearbox', [
  'manual',
  'automatic',
  'semi_automatic',
  'other',
]);

export const bodyTypeEnum = pgEnum('body_type', [
  'sedan',
  'hatchback',
  'wagon',
  'suv',
  'coupe',
  'convertible',
  'minivan',
  'pickup',
  'van',
  'other',
]);

export const driveTypeEnum = pgEnum('drive_type', [
  'fwd',
  'rwd',
  'awd',
  'other',
]);

export const vehicleConditionEnum = pgEnum('vehicle_condition', [
  'new',
  'used',
  'damaged',
]);

export const sellerTypeEnum = pgEnum('seller_type', [
  'private',
  'dealer',
  'unknown',
]);

export const fetchStatusEnum = pgEnum('fetch_status', [
  'pending',
  'running',
  'success',
  'partial',
  'failed',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'new_listing',
  'price_drop',
  'price_raise',
  'listing_removed',
  'fetch_failed',
  'digest',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'push',
]);

export const digestFrequencyEnum = pgEnum('digest_frequency', [
  'instant',
  'hourly',
  'daily',
  'weekly',
  'off',
]);

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

/* -------------------------------------------------------------------------- */
/*                                    Users                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Case-insensitive uniqueness: nobody registers "Jan@x.pl" over "jan@x.pl".
    uniqueIndex('users_email_lower_unique').on(sql`lower(${t.email})`),
  ],
);

/**
 * Opaque refresh tokens, stored hashed. Rotating a token marks the old row
 * revoked and links to its successor, so a replayed token exposes theft.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedByTokenId: uuid('replaced_by_token_id'),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_unique').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
  ],
);

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  pushEnabled: boolean('push_enabled').notNull().default(false),
  inAppEnabled: boolean('in_app_enabled').notNull().default(true),
  notifyNewListing: boolean('notify_new_listing').notNull().default(true),
  notifyPriceDrop: boolean('notify_price_drop').notNull().default(true),
  notifyListingRemoved: boolean('notify_listing_removed')
    .notNull()
    .default(false),
  notifyFetchFailed: boolean('notify_fetch_failed').notNull().default(false),
  /** Minimum price drop (percent) that is worth a notification. */
  priceDropThresholdPct: numeric('price_drop_threshold_pct', {
    precision: 5,
    scale: 2,
    mode: 'number',
  })
    .notNull()
    .default(1),
  digestFrequency: digestFrequencyEnum('digest_frequency')
    .notNull()
    .default('daily'),
  /** Local-time window in which notifications are suppressed, e.g. 22 -> 7. */
  quietHoursStart: smallint('quiet_hours_start'),
  quietHoursEnd: smallint('quiet_hours_end'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Warsaw'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Web-push endpoints; one user can register several browsers/devices. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_unique').on(t.endpoint),
    index('push_subscriptions_user_idx').on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                            Filter groups & filters                         */
/* -------------------------------------------------------------------------- */

/**
 * A named bundle of searches, e.g. "Skandynawia i Japonia" (Volvo + Toyota)
 * versus "Korea/Japonia budżet" (Mazda + Kia). Fetching runs per group.
 */
export const filterGroups = pgTable(
  'filter_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 20 }),
    icon: varchar('icon', { length: 40 }),
    isActive: boolean('is_active').notNull().default(true),
    notifyOnNew: boolean('notify_on_new').notNull().default(true),
    /** How often the scheduler should refresh this group. */
    refreshIntervalMinutes: integer('refresh_interval_minutes')
      .notNull()
      .default(60),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('filter_groups_user_name_unique').on(t.userId, t.name),
    index('filter_groups_active_idx').on(t.isActive, t.lastFetchedAt),
  ],
);

/**
 * One criteria set inside a group. A group with Volvo and Toyota holds two
 * rows; the fetcher queries each and merges the results under the group.
 */
export const filters = pgTable(
  'filters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => filterGroups.id, { onDelete: 'cascade' }),
    provider: providerEnum('provider').notNull().default('otomoto'),
    name: varchar('name', { length: 120 }),
    isActive: boolean('is_active').notNull().default(true),

    // Vehicle identity
    make: varchar('make', { length: 60 }),
    model: varchar('model', { length: 80 }),
    generation: varchar('generation', { length: 80 }),
    version: varchar('version', { length: 120 }),
    /** Free-text phrase applied on top of the structured criteria. */
    query: varchar('query', { length: 200 }),

    // Ranges
    yearFrom: smallint('year_from'),
    yearTo: smallint('year_to'),
    priceFrom: numeric('price_from', { precision: 12, scale: 2, mode: 'number' }),
    priceTo: numeric('price_to', { precision: 12, scale: 2, mode: 'number' }),
    currency: varchar('currency', { length: 3 }).notNull().default('PLN'),
    mileageFrom: integer('mileage_from'),
    mileageTo: integer('mileage_to'),
    enginePowerFrom: integer('engine_power_from'),
    enginePowerTo: integer('engine_power_to'),
    engineCapacityFrom: integer('engine_capacity_from'),
    engineCapacityTo: integer('engine_capacity_to'),

    // Multi-choice attributes
    fuelTypes: fuelTypeEnum('fuel_types').array(),
    gearboxes: gearboxEnum('gearboxes').array(),
    bodyTypes: bodyTypeEnum('body_types').array(),
    driveTypes: driveTypeEnum('drive_types').array(),

    // Flags
    condition: vehicleConditionEnum('condition'),
    sellerType: sellerTypeEnum('seller_type'),
    excludeDamaged: boolean('exclude_damaged').notNull().default(false),
    onlyWithPhotos: boolean('only_with_photos').notNull().default(false),
    registeredInPl: boolean('registered_in_pl'),
    firstOwner: boolean('first_owner'),

    // Location
    countryOrigin: varchar('country_origin', { length: 60 }),
    region: varchar('region', { length: 80 }),
    city: varchar('city', { length: 120 }),
    radiusKm: integer('radius_km'),

    // Extra attributes backed by the scraped taxonomy
    colors: text('colors').array(),
    doorCounts: smallint('door_counts').array(),
    seatCounts: smallint('seat_counts').array(),
    noAccident: boolean('no_accident'),
    servicedAtAso: boolean('serviced_at_aso'),
    hasVin: boolean('has_vin'),
    vatInvoice: boolean('vat_invoice'),

    /**
     * Required equipment, stored as provider filter ids
     * (e.g. filter_enum_towbar). Kept as raw ids so adding a new option to the
     * taxonomy needs no migration.
     */
    equipment: text('equipment').array(),

    /** Provider-specific params passed through untouched. */
    extraParams: jsonb('extra_params').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('filters_group_idx').on(t.groupId),
    index('filters_provider_idx').on(t.provider, t.isActive),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Listings                                  */
/* -------------------------------------------------------------------------- */

/**
 * A car advert as returned by a provider list endpoint. Deliberately shallow:
 * `url` points back to the provider for the full detail page.
 */
export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: providerEnum('provider').notNull(),
    externalId: varchar('external_id', { length: 120 }).notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),

    make: varchar('make', { length: 60 }),
    model: varchar('model', { length: 80 }),
    generation: varchar('generation', { length: 80 }),
    version: varchar('version', { length: 120 }),

    price: numeric('price', { precision: 12, scale: 2, mode: 'number' }),
    currency: varchar('currency', { length: 3 }).notNull().default('PLN'),
    priceGross: boolean('price_gross'),
    hasVatInvoice: boolean('has_vat_invoice'),

    year: smallint('year'),
    mileageKm: integer('mileage_km'),
    fuelType: fuelTypeEnum('fuel_type'),
    gearbox: gearboxEnum('gearbox'),
    bodyType: bodyTypeEnum('body_type'),
    driveType: driveTypeEnum('drive_type'),
    engineCapacityCm3: integer('engine_capacity_cm3'),
    enginePowerHp: integer('engine_power_hp'),
    doors: smallint('doors'),
    seats: smallint('seats'),
    color: varchar('color', { length: 40 }),

    condition: vehicleConditionEnum('condition'),
    isDamaged: boolean('is_damaged'),
    vin: varchar('vin', { length: 32 }),
    firstRegistrationDate: timestamp('first_registration_date', {
      withTimezone: true,
    }),
    countryOrigin: varchar('country_origin', { length: 60 }),

    sellerType: sellerTypeEnum('seller_type').notNull().default('unknown'),
    sellerName: varchar('seller_name', { length: 200 }),

    city: varchar('city', { length: 120 }),
    region: varchar('region', { length: 80 }),
    country: varchar('country', { length: 60 }),
    latitude: numeric('latitude', { precision: 9, scale: 6, mode: 'number' }),
    longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }),

    thumbnailUrl: text('thumbnail_url'),
    imagesCount: smallint('images_count'),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),

    /** Untouched provider payload - lets us backfill columns without refetching. */
    raw: jsonb('raw').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('listings_provider_external_unique').on(
      t.provider,
      t.externalId,
    ),
    index('listings_make_model_idx').on(t.make, t.model),
    index('listings_price_idx').on(t.price),
    index('listings_year_idx').on(t.year),
    index('listings_last_seen_idx').on(t.lastSeenAt),
    index('listings_active_idx').on(t.isActive, t.publishedAt),
  ],
);

/** Append-only price trail; a new row lands only when the price changes. */
export const listingPriceHistory = pgTable(
  'listing_price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 12, scale: 2, mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    /** Difference against the previous observation, for quick "spadek" queries. */
    deltaAmount: numeric('delta_amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }),
    deltaPct: numeric('delta_pct', { precision: 7, scale: 3, mode: 'number' }),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('listing_price_history_listing_idx').on(t.listingId, t.recordedAt)],
);

/** Which filter surfaced which listing - the group view reads through this. */
export const listingMatches = pgTable(
  'listing_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    filterId: uuid('filter_id')
      .notNull()
      .references(() => filters.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => filterGroups.id, { onDelete: 'cascade' }),
    /** Position in the provider's result page - useful for relevance sorting. */
    rank: integer('rank'),
    firstMatchedAt: timestamp('first_matched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMatchedAt: timestamp('last_matched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('listing_matches_listing_filter_unique').on(
      t.listingId,
      t.filterId,
    ),
    index('listing_matches_group_idx').on(t.groupId, t.firstMatchedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*                              Favourites & notes                            */
/* -------------------------------------------------------------------------- */

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    note: text('note'),
    /** Personal 1-5 rating, independent of the provider. */
    rating: smallint('rating'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    index('favorites_user_idx').on(t.userId, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                Notifications                               */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    channel: notificationChannelEnum('channel').notNull().default('in_app'),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    listingId: uuid('listing_id').references(() => listings.id, {
      onDelete: 'cascade',
    }),
    groupId: uuid('group_id').references(() => filterGroups.id, {
      onDelete: 'cascade',
    }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    readAt: timestamp('read_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('notifications_user_unread_idx').on(t.userId, t.readAt, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*                            Provider plumbing                               */
/* -------------------------------------------------------------------------- */

/**
 * Cached OAuth2 tokens per provider. Otomoto issues short-lived access tokens
 * plus a refresh token; keeping them here survives restarts.
 */
export const providerTokens = pgTable('provider_tokens', {
  provider: providerEnum('provider').primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: varchar('token_type', { length: 20 }).notNull().default('Bearer'),
  scope: text('scope'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  obtainedAt: timestamp('obtained_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One row per filter execution - the audit trail behind "ostatnie pobranie". */
export const fetchRuns = pgTable(
  'fetch_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: providerEnum('provider').notNull(),
    groupId: uuid('group_id').references(() => filterGroups.id, {
      onDelete: 'cascade',
    }),
    filterId: uuid('filter_id').references(() => filters.id, {
      onDelete: 'cascade',
    }),
    status: fetchStatusEnum('status').notNull().default('pending'),
    trigger: varchar('trigger', { length: 20 }).notNull().default('manual'),
    pagesFetched: integer('pages_fetched').notNull().default(0),
    itemsSeen: integer('items_seen').notNull().default(0),
    itemsNew: integer('items_new').notNull().default(0),
    itemsUpdated: integer('items_updated').notNull().default(0),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  (t) => [
    index('fetch_runs_group_idx').on(t.groupId, t.startedAt),
    index('fetch_runs_status_idx').on(t.status, t.startedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Relations                                 */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many, one }) => ({
  filterGroups: many(filterGroups),
  favorites: many(favorites),
  notifications: many(notifications),
  refreshTokens: many(refreshTokens),
  pushSubscriptions: many(pushSubscriptions),
  notificationPreferences: one(notificationPreferences, {
    fields: [users.id],
    references: [notificationPreferences.userId],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const filterGroupsRelations = relations(filterGroups, ({ one, many }) => ({
  user: one(users, { fields: [filterGroups.userId], references: [users.id] }),
  filters: many(filters),
  matches: many(listingMatches),
  fetchRuns: many(fetchRuns),
}));

export const filtersRelations = relations(filters, ({ one, many }) => ({
  group: one(filterGroups, {
    fields: [filters.groupId],
    references: [filterGroups.id],
  }),
  matches: many(listingMatches),
  fetchRuns: many(fetchRuns),
}));

export const listingsRelations = relations(listings, ({ many }) => ({
  matches: many(listingMatches),
  priceHistory: many(listingPriceHistory),
  favorites: many(favorites),
}));

export const listingPriceHistoryRelations = relations(
  listingPriceHistory,
  ({ one }) => ({
    listing: one(listings, {
      fields: [listingPriceHistory.listingId],
      references: [listings.id],
    }),
  }),
);

export const listingMatchesRelations = relations(listingMatches, ({ one }) => ({
  listing: one(listings, {
    fields: [listingMatches.listingId],
    references: [listings.id],
  }),
  filter: one(filters, {
    fields: [listingMatches.filterId],
    references: [filters.id],
  }),
  group: one(filterGroups, {
    fields: [listingMatches.groupId],
    references: [filterGroups.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  listing: one(listings, {
    fields: [favorites.listingId],
    references: [listings.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  listing: one(listings, {
    fields: [notifications.listingId],
    references: [listings.id],
  }),
  group: one(filterGroups, {
    fields: [notifications.groupId],
    references: [filterGroups.id],
  }),
}));

export const fetchRunsRelations = relations(fetchRuns, ({ one }) => ({
  group: one(filterGroups, {
    fields: [fetchRuns.groupId],
    references: [filterGroups.id],
  }),
  filter: one(filters, {
    fields: [fetchRuns.filterId],
    references: [filters.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/*                                Inferred types                              */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type FilterGroup = typeof filterGroups.$inferSelect;
export type NewFilterGroup = typeof filterGroups.$inferInsert;
export type Filter = typeof filters.$inferSelect;
export type NewFilter = typeof filters.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingMatch = typeof listingMatches.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type FetchRun = typeof fetchRuns.$inferSelect;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
