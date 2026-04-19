import { DEFAULT_RESTAURANT_PROFILE, DISHES, MENU_CATEGORIES } from "@/lib/menu-data";
import { MANAGER_SEED_ACCOUNTS } from "@/lib/manager-data";
import { WAITER_SEED_ACCOUNTS } from "@/lib/waiter-data";
import { maybeRunStaffBackendMaintenance } from "./maintenance";
import { hashPassword } from "./password";
import { prisma } from "./prisma";

declare global {
  // eslint-disable-next-line no-var
  var __giottoSeedPromise: Promise<void> | undefined;
}

function buildDefaultFloorPlan(tableIds: number[]) {
  const columns = 5;
  const tables = tableIds.map((tableId, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      tableId,
      label: `Table ${tableId}`,
      x: 12 + col * 20,
      y: 16 + row * 17,
      shape: col % 3 === 0 ? "round" : col % 2 === 0 ? "rect" : "square",
      sizePreset: "md",
    } as const;
  });

  return {
    tables,
    zones: [
      { id: "zone-main", label: "Main hall", x: 8, y: 8, width: 62, height: 56 },
      { id: "zone-terrace", label: "Terrace", x: 72, y: 12, width: 22, height: 36 },
    ],
  };
}

async function createSeedUsers() {
  const waiters = await Promise.all(
    WAITER_SEED_ACCOUNTS.map(async (account) => ({
      id: account.id,
      role: "waiter" as const,
      name: account.name,
      login: account.login.trim().toLowerCase(),
      passwordHash: await hashPassword(account.password),
      active: account.active,
    })),
  );
  const managers = await Promise.all(
    MANAGER_SEED_ACCOUNTS.map(async (account) => ({
      id: account.id,
      role: "manager" as const,
      name: account.name,
      login: account.login.trim().toLowerCase(),
      passwordHash: await hashPassword(account.password),
      active: account.active,
    })),
  );

  return { waiters, managers };
}

async function seedDatabase() {
  const [userCount, tableCount, profileCount] = await Promise.all([
    prisma.staffUser.count(),
    prisma.restaurantTable.count(),
    prisma.restaurantProfile.count(),
  ]);

  if (userCount > 0 && tableCount > 0 && profileCount > 0) {
    return;
  }

  const { waiters, managers } = await createSeedUsers();
  const now = Date.now();
  const tableIds = Array.from({ length: 20 }, (_, index) => index + 1);
  const defaultFloorPlan = buildDefaultFloorPlan(tableIds);

  await prisma.$transaction(async (tx) => {
    if ((await tx.restaurantProfile.count()) === 0) {
      await tx.restaurantProfile.create({ data: { id: 1, ...DEFAULT_RESTAURANT_PROFILE } });
    }

    if ((await tx.restaurantSettings.count()) === 0) {
      await tx.restaurantSettings.create({
        data: {
          id: 1,
          managerSoundEnabled: true,
          floorPlan: defaultFloorPlan,
        },
      });
    }

    if ((await tx.menuCategory.count()) === 0) {
      await tx.menuCategory.createMany({
        data: MENU_CATEGORIES.map((category, index) => ({
          id: category.id,
          labelRu: category.labelRu,
          icon: category.icon,
          sortOrder: index,
        })),
      });
    }

    if ((await tx.dish.count()) === 0) {
      await tx.dish.createMany({
        data: DISHES.map((dish, index) => ({
          id: dish.id,
          categoryId: dish.category,
          nameIt: dish.nameIt,
          nameRu: dish.nameRu,
          description: dish.description,
          price: dish.price,
          image: dish.image,
          portion: dish.portion,
          energyKcal: dish.energyKcal,
          badgeLabel: dish.badgeLabel,
          badgeTone: dish.badgeTone,
          highlight: !!dish.highlight,
          available: dish.available !== false,
          sortOrder: index,
        })),
      });
    }

    if ((await tx.staffUser.count()) === 0) {
      await tx.staffUser.createMany({
        data: [...waiters, ...managers],
      });
    }

    if ((await tx.restaurantTable.count()) === 0) {
      await tx.restaurantTable.createMany({
        data: tableIds.map((tableId) => ({
          id: tableId,
          label: `Table ${tableId}`,
          shape: tableId % 3 === 0 ? "round" : tableId % 2 === 0 ? "rect" : "square",
          sizePreset: "md",
          floorX: defaultFloorPlan.tables.find((table) => table.tableId === tableId)?.x,
          floorY: defaultFloorPlan.tables.find((table) => table.tableId === tableId)?.y,
        })),
      });
    }

    if ((await tx.tableAssignment.count()) === 0) {
      await tx.tableAssignment.createMany({
        data: WAITER_SEED_ACCOUNTS.flatMap((waiter) =>
          waiter.tableIds.map((tableId) => ({
            tableId,
            waiterId: waiter.id,
            createdAt: new Date(now),
          })),
        ),
      });
    }

    if ((await tx.tableSession.count()) === 0) {
      const startedAtFor = (tableId: number) => {
        if (tableId === 3) return new Date(now - 42 * 60_000);
        if (tableId === 5) return new Date(now - 71 * 60_000);
        if (tableId === 7) return new Date(now - 27 * 60_000);
        return new Date(now - (14 + tableId * 2) * 60_000);
      };

      await tx.tableSession.createMany({
        data: Array.from({ length: 12 }, (_, index) => {
          const tableId = index + 1;
          return {
            id: `seed-session-${tableId}`,
            tableId,
            startedAt: startedAtFor(tableId),
          };
        }),
      });
    }

    if ((await tx.serviceRequest.count()) === 0) {
      await tx.serviceRequest.createMany({
        data: [
          {
            id: "seed-rq-w-3",
            tableSessionId: "seed-session-3",
            tableId: 3,
            type: "waiter",
            reason: "Question about a dish",
            createdAt: new Date(now - 3 * 60_000),
          },
          {
            id: "seed-rq-b-5",
            tableSessionId: "seed-session-5",
            tableId: 5,
            type: "bill",
            reason: "Guests are ready to pay",
            createdAt: new Date(now - 2 * 60_000),
          },
        ],
      });
    }

    if ((await tx.waiterTask.count()) === 0) {
      await tx.waiterTask.createMany({
        data: [
          {
            id: "seed-task-w-3",
            tableSessionId: "seed-session-3",
            tableId: 3,
            waiterId: WAITER_SEED_ACCOUNTS.find((waiter) => waiter.tableIds.includes(3))?.id,
            type: "waiter_call",
            priority: "urgent",
            status: "open",
            sourceRequestId: "seed-rq-w-3",
            title: "Guest needs a waiter",
            subtitle: "Question about a dish",
            createdAt: new Date(now - 3 * 60_000),
          },
          {
            id: "seed-task-b-5",
            tableSessionId: "seed-session-5",
            tableId: 5,
            waiterId: WAITER_SEED_ACCOUNTS.find((waiter) => waiter.tableIds.includes(5))?.id,
            type: "bill_request",
            priority: "urgent",
            status: "open",
            sourceRequestId: "seed-rq-b-5",
            title: "Bring the bill",
            subtitle: "Guests are ready to pay",
            createdAt: new Date(now - 2 * 60_000),
          },
        ],
      });
    }

    if ((await tx.waiterOrderBatch.count()) === 0) {
      await tx.waiterOrderBatch.createMany({
        data: [
          {
            id: "seed-batch-3-1",
            tableSessionId: "seed-session-3",
            tableId: 3,
            waiterId: WAITER_SEED_ACCOUNTS.find((waiter) => waiter.tableIds.includes(3))?.id ?? WAITER_SEED_ACCOUNTS[0].id,
            createdAt: new Date(now - 10 * 60_000),
          },
        ],
      });
    }

    if ((await tx.billLine.count()) === 0) {
      await tx.billLine.createMany({
        data: [
          {
            id: "seed-line-3-1",
            tableSessionId: "seed-session-3",
            tableId: 3,
            title: "Tagliatelle al tartufo",
            dishId: "tagliatelle",
            qty: 1,
            price: 198000,
            source: "guest",
            note: "Steak doneness: medium rare",
            createdAt: new Date(now - 24 * 60_000),
          },
          {
            id: "seed-line-3-2",
            tableSessionId: "seed-session-3",
            tableId: 3,
            title: "Acqua Panna",
            dishId: "panna",
            qty: 2,
            price: 28000,
            source: "waiter",
            createdAt: new Date(now - 10 * 60_000),
            waiterOrderBatchId: "seed-batch-3-1",
          },
          {
            id: "seed-line-5-1",
            tableSessionId: "seed-session-5",
            tableId: 5,
            title: "Risotto ai funghi",
            dishId: "risotto",
            qty: 2,
            price: 132000,
            source: "guest",
            createdAt: new Date(now - 38 * 60_000),
          },
          {
            id: "seed-line-7-1",
            tableSessionId: "seed-session-7",
            tableId: 7,
            title: "Bruschetta al pomodoro",
            dishId: "bruschetta",
            qty: 1,
            price: 89000,
            source: "guest",
            createdAt: new Date(now - 18 * 60_000),
          },
        ],
      });
    }

    if ((await tx.sessionNote.count()) === 0) {
      await tx.sessionNote.createMany({
        data: [
          {
            tableSessionId: "seed-session-3",
            content: "Nut allergy",
          },
          {
            tableSessionId: "seed-session-5",
            content: "Birthday table",
          },
        ],
      });
    }
  });
}

function shouldAutoSeedRuntime() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return process.env.GIOTTO_SEED_ON_BOOT === "1" || process.env.GIOTTO_RUNTIME_SEED === "1";
}

export async function runStaffBackendSeed() {
  globalThis.__giottoSeedPromise = seedDatabase();
  await globalThis.__giottoSeedPromise;
}

export async function ensureStaffBackendReady() {
  if (shouldAutoSeedRuntime() && !globalThis.__giottoSeedPromise) {
    globalThis.__giottoSeedPromise = seedDatabase();
  }

  if (globalThis.__giottoSeedPromise) {
    await globalThis.__giottoSeedPromise;
  }

  await maybeRunStaffBackendMaintenance();
}

export async function resetStaffSeedData() {
  await prisma.$transaction(async (tx) => {
    await tx.serviceActivityEvent.deleteMany();
    await tx.waiterShortcutPreference.deleteMany();
    await tx.guestReview.deleteMany();
    await tx.reviewPrompt.deleteMany();
    await tx.sessionNote.deleteMany();
    await tx.billLine.deleteMany();
    await tx.waiterOrderBatch.deleteMany();
    await tx.waiterTask.deleteMany();
    await tx.serviceRequest.deleteMany();
    await tx.tableSession.deleteMany();
    await tx.tableAssignment.deleteMany();
    await tx.pushDevice.deleteMany();
    await tx.staffRefreshSession.deleteMany();
    await tx.restaurantTable.deleteMany();
    await tx.staffUser.deleteMany();
    await tx.dish.deleteMany();
    await tx.menuCategory.deleteMany();
    await tx.restaurantSettings.deleteMany();
    await tx.restaurantProfile.deleteMany();
  });

  globalThis.__giottoSeedPromise = undefined;
  await runStaffBackendSeed();
}
