// Declare global property for seed promise
declare global {
  interface GlobalThis {
    __giottoSeedPromise?: Promise<void>;
  }
}

import { DEFAULT_RESTAURANT_PROFILE, DISHES, MENU_CATEGORIES } from "@/lib/menu-data";
import { MANAGER_SEED_ACCOUNTS } from "@/lib/manager-data";
import { WAITER_SEED_ACCOUNTS } from "@/lib/waiter-data";
import { maybeRunStaffBackendMaintenance } from "./maintenance";
import { hashPassword } from "./password";
import { prisma } from "./prisma";
// eslint-disable-next-line no-console
const log = (...args: any[]) => console.log("[seed]", ...args);

function buildDefaultFloorPlan(tableIds: number[]): { tables: any[]; zones: any[] } {
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
  log("Сидируем пользователей (waiters/managers)...");
  const waiters = [];
  for (const account of WAITER_SEED_ACCOUNTS) {
    waiters.push({
      id: account.id,
      role: "waiter" as const,
      name: account.name,
      login: account.login.trim().toLowerCase(),
      passwordHash: await hashPassword(account.password),
      active: account.active,
    });
  }
  const managers = [];
  for (const account of MANAGER_SEED_ACCOUNTS) {
    managers.push({
      id: account.id,
      role: "manager" as const,
      name: account.name,
      login: account.login.trim().toLowerCase(),
      passwordHash: await hashPassword(account.password),
      active: account.active,
    });
  }
  log(`Создано ${waiters.length} официантов и ${managers.length} менеджеров.`);
  return { waiters, managers };
}

async function seedRestaurantProfile(tx: any) {
  if ((await tx.restaurantProfile.count()) === 0) {
    log("Сидируем профиль ресторана...");
    await tx.restaurantProfile.create({ data: { id: 1, ...DEFAULT_RESTAURANT_PROFILE } });
  }
}

async function seedRestaurantSettings(tx: any, defaultFloorPlan: any) {
  if ((await tx.restaurantSettings.count()) === 0) {
    log("Сидируем настройки ресторана...");
    await tx.restaurantSettings.create({
      data: {
        id: 1,
        managerSoundEnabled: true,
        floorPlan: defaultFloorPlan,
      },
    });
  }
}

async function seedMenuCategories(tx: any) {
  if ((await tx.menuCategory.count()) === 0) {
    log("Сидируем категории меню...");
    for (const [index, category] of MENU_CATEGORIES.entries()) {
      await tx.menuCategory.create({
        data: {
          id: category.id,
          labelRu: category.labelRu,
          icon: category.icon,
          sortOrder: index,
        },
      });
    }
  }
}

async function seedDishes(tx: any) {
  if ((await tx.dish.count()) === 0) {
    log("Сидируем блюда...");
    for (const [index, dish] of DISHES.entries()) {
      await tx.dish.create({
        data: {
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
        },
      });
    }
  }
}

async function seedStaffUsers(tx: any, waiters: any[], managers: any[]) {
  if ((await tx.staffUser.count()) === 0) {
    log("Сидируем пользователей (staffUser)...");
    for (const user of [...waiters, ...managers]) {
      await tx.staffUser.create({ data: user });
    }
  }
}

async function seedRestaurantTables(tx: any, tableIds: number[], defaultFloorPlan: any) {
  if ((await tx.restaurantTable.count()) === 0) {
    log("Сидируем столы...");
    for (const tableId of tableIds) {
      await tx.restaurantTable.create({
        data: {
          id: tableId,
          label: `Table ${tableId}`,
          shape: tableId % 3 === 0 ? "round" : tableId % 2 === 0 ? "rect" : "square",
          sizePreset: "md",
          floorX: defaultFloorPlan.tables.find((table: any) => table.tableId === tableId)?.x,
          floorY: defaultFloorPlan.tables.find((table: any) => table.tableId === tableId)?.y,
        },
      });
    }
  }
}

async function seedTableAssignments(tx: any, now: number) {
  if ((await tx.tableAssignment.count()) === 0) {
    log("Сидируем назначения столов официантам...");
    for (const waiter of WAITER_SEED_ACCOUNTS) {
      for (const tableId of waiter.tableIds) {
        await tx.tableAssignment.create({
          data: {
            tableId,
            waiterId: waiter.id,
            createdAt: new Date(now),
          },
        });
      }
    }
  }
}

async function seedTableSessions(tx: any, now: number) {
  if ((await tx.tableSession.count()) === 0) {
    log("Сидируем сессии столов...");
    const startedAtFor = (tableId: number) => {
      if (tableId === 3) return new Date(now - 42 * 60_000);
      if (tableId === 5) return new Date(now - 71 * 60_000);
      if (tableId === 7) return new Date(now - 27 * 60_000);
      return new Date(now - (14 + tableId * 2) * 60_000);
    };
    for (let index = 0; index < 12; index++) {
      const tableId = index + 1;
      await tx.tableSession.create({
        data: {
          id: `seed-session-${tableId}`,
          tableId,
          startedAt: startedAtFor(tableId),
        },
      });
    }
  }
}

async function seedServiceRequests(tx: any, now: number) {
  if ((await tx.serviceRequest.count()) === 0) {
    log("Сидируем сервисные запросы...");
    await tx.serviceRequest.create({
      data: {
        id: "seed-rq-w-3",
        tableSessionId: "seed-session-3",
        tableId: 3,
        type: "waiter",
        reason: "Question about a dish",
        createdAt: new Date(now - 3 * 60_000),
      },
    });
    await tx.serviceRequest.create({
      data: {
        id: "seed-rq-b-5",
        tableSessionId: "seed-session-5",
        tableId: 5,
        type: "bill",
        reason: "Guests are ready to pay",
        createdAt: new Date(now - 2 * 60_000),
      },
    });
  }
}

async function seedWaiterTasks(tx: any, now: number) {
  if ((await tx.waiterTask.count()) === 0) {
    log("Сидируем задачи официантов...");
    await tx.waiterTask.create({
      data: {
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
    });
    await tx.waiterTask.create({
      data: {
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
    });
  }
}

async function seedWaiterOrderBatches(tx: any, now: number) {
  if ((await tx.waiterOrderBatch.count()) === 0) {
    log("Сидируем waiterOrderBatch...");
    await tx.waiterOrderBatch.create({
      data: {
        id: "seed-batch-3-1",
        tableSessionId: "seed-session-3",
        tableId: 3,
        waiterId: WAITER_SEED_ACCOUNTS.find((waiter) => waiter.tableIds.includes(3))?.id ?? WAITER_SEED_ACCOUNTS[0].id,
        createdAt: new Date(now - 10 * 60_000),
      },
    });
  }
}

async function seedBillLines(tx: any, now: number) {
  if ((await tx.billLine.count()) === 0) {
    log("Сидируем строки счета...");
    const billLines = [
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
    ];
    for (const line of billLines) {
      await tx.billLine.create({ data: line });
    }
  }
}

async function seedSessionNotes(tx: any) {
  if ((await tx.sessionNote.count()) === 0) {
    log("Сидируем заметки по сессиям...");
    await tx.sessionNote.create({
      data: {
        tableSessionId: "seed-session-3",
        content: "Nut allergy",
      },
    });
    await tx.sessionNote.create({
      data: {
        tableSessionId: "seed-session-5",
        content: "Birthday table",
      },
    });
  }
}

async function seedDatabase() {
  const [userCount, tableCount, profileCount] = await Promise.all([
    prisma.staffUser.count(),
    prisma.restaurantTable.count(),
    prisma.restaurantProfile.count(),
  ]);

  if (userCount > 0 && tableCount > 0 && profileCount > 0) {
    log("Данные уже существуют, сид не требуется.");
    return;
  }

  const { waiters, managers } = await createSeedUsers();
  const now = Date.now();
  const tableIds = Array.from({ length: 20 }, (_, index) => index + 1);
  const defaultFloorPlan = buildDefaultFloorPlan(tableIds);

  await prisma.$transaction(async (tx) => {
    await seedRestaurantProfile(tx);
    await seedRestaurantSettings(tx, defaultFloorPlan);
    await seedMenuCategories(tx);
    await seedDishes(tx);
    await seedStaffUsers(tx, waiters, managers);
    await seedRestaurantTables(tx, tableIds, defaultFloorPlan);
    await seedTableAssignments(tx, now);
    await seedTableSessions(tx, now);
    await seedServiceRequests(tx, now);
    await seedWaiterTasks(tx, now);
    await seedWaiterOrderBatches(tx, now);
    await seedBillLines(tx, now);
    await seedSessionNotes(tx);
  });
  log("Сид завершён успешно.");
}

function shouldAutoSeedRuntime() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return process.env.GIOTTO_SEED_ON_BOOT === "1" || process.env.GIOTTO_RUNTIME_SEED === "1";
}

export async function runStaffBackendSeed() {
  (globalThis as GlobalThis).__giottoSeedPromise = seedDatabase();
  await (globalThis as GlobalThis).__giottoSeedPromise;
}

export async function ensureStaffBackendReady() {
  if (shouldAutoSeedRuntime() && !(globalThis as GlobalThis).__giottoSeedPromise) {
    (globalThis as GlobalThis).__giottoSeedPromise = seedDatabase();
  }

  if ((globalThis as GlobalThis).__giottoSeedPromise) {
    await (globalThis as GlobalThis).__giottoSeedPromise;
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

  (globalThis as GlobalThis).__giottoSeedPromise = undefined;
  await runStaffBackendSeed();
}
