import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import { db, pool } from './client.js';
import { filterGroups, filters, notificationPreferences, users } from './schema.js';
import { runGroup } from '../modules/fetching/fetcher.service.js';

const DEMO_EMAIL = 'demo@cars-fetcher.local';
const DEMO_PASSWORD = 'Demo1234';

/**
 * Creates a demo account with the two filter groups from the brief -
 * "Skandynawia i Japonia" (Volvo + Toyota) and "Korea i Japonia" (Mazda + Kia) -
 * then runs a fetch so the UI has data on first launch.
 */
async function seed(): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)
    .limit(1);

  let userId = existing?.id;

  if (!userId) {
    const [created] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
        firstName: 'Jan',
        lastName: 'Kowalski',
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    if (!created) throw new Error('Nie udało się utworzyć użytkownika demo');
    userId = created.id;

    await db
      .insert(notificationPreferences)
      .values({ userId, pushEnabled: true, quietHoursStart: 22, quietHoursEnd: 7 })
      .onConflictDoNothing();

    logger.info({ email: DEMO_EMAIL }, 'Demo user created');
  } else {
    logger.info({ email: DEMO_EMAIL }, 'Demo user already exists');
  }

  type SeedFilter = {
    name: string;
    make: string;
    yearFrom?: number;
    priceTo?: number;
    mileageTo?: number;
    fuelTypes?: NonNullable<(typeof filters.$inferInsert)['fuelTypes']>;
    gearboxes?: NonNullable<(typeof filters.$inferInsert)['gearboxes']>;
  };

  const groupDefinitions: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    refreshIntervalMinutes: number;
    filters: SeedFilter[];
  }> = [
    {
      name: 'Skandynawia i Japonia',
      description: 'Bezpieczne kombi i SUV-y - Volvo oraz Toyota',
      color: '#2563eb',
      icon: 'snowflake',
      refreshIntervalMinutes: 60,
      filters: [
        {
          name: 'Volvo XC60 / V60',
          make: 'Volvo',
          yearFrom: 2018,
          priceTo: 180_000,
          mileageTo: 160_000,
          fuelTypes: ['diesel', 'hybrid', 'plugin_hybrid'],
          gearboxes: ['automatic'],
        },
        {
          name: 'Toyota RAV4 / Corolla',
          make: 'Toyota',
          yearFrom: 2019,
          priceTo: 150_000,
          mileageTo: 140_000,
          fuelTypes: ['hybrid', 'plugin_hybrid'],
        },
      ],
    },
    {
      name: 'Korea i Japonia - budżet',
      description: 'Tańsza alternatywa: Mazda i Kia',
      color: '#059669',
      icon: 'wallet',
      refreshIntervalMinutes: 180,
      filters: [
        {
          name: 'Mazda CX-5 / 6',
          make: 'Mazda',
          yearFrom: 2017,
          priceTo: 120_000,
          mileageTo: 180_000,
        },
        {
          name: 'Kia Sportage / Ceed',
          make: 'Kia',
          yearFrom: 2017,
          priceTo: 110_000,
          mileageTo: 180_000,
        },
      ],
    },
  ];

  const groupIds: string[] = [];

  for (const [index, definition] of groupDefinitions.entries()) {
    const [existingGroup] = await db
      .select({ id: filterGroups.id })
      .from(filterGroups)
      .where(eq(filterGroups.name, definition.name))
      .limit(1);

    if (existingGroup) {
      groupIds.push(existingGroup.id);
      continue;
    }

    const [group] = await db
      .insert(filterGroups)
      .values({
        userId,
        name: definition.name,
        description: definition.description,
        color: definition.color,
        icon: definition.icon,
        refreshIntervalMinutes: definition.refreshIntervalMinutes,
        position: index,
      })
      .returning({ id: filterGroups.id });

    if (!group) throw new Error(`Nie udało się utworzyć grupy ${definition.name}`);

    await db.insert(filters).values(
      definition.filters.map((f) => ({
        groupId: group.id,
        provider: 'otomoto' as const,
        name: f.name,
        make: f.make,
        yearFrom: f.yearFrom ?? null,
        priceTo: f.priceTo ?? null,
        mileageTo: f.mileageTo ?? null,
        fuelTypes: f.fuelTypes ?? null,
        gearboxes: f.gearboxes ?? null,
        excludeDamaged: true,
        onlyWithPhotos: true,
      })),
    );

    groupIds.push(group.id);
    logger.info({ group: definition.name }, 'Filter group created');
  }

  for (const groupId of groupIds) {
    const result = await runGroup(groupId, userId, 'seed');
    logger.info(
      { group: result.groupName, seen: result.totalSeen, created: result.totalNew },
      'Seed fetch finished',
    );
  }

  logger.info(
    `Seed complete. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
  );
}

try {
  await seed();
  await pool.end();
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'Seed failed');
  await pool.end();
  process.exit(1);
}
