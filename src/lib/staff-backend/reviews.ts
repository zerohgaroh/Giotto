import type { Prisma } from "@prisma/client";
import { parseHistoryCursor, serializeHistoryCursor } from "./activity";
import { prisma } from "./prisma";
import type { ReviewAnalytics, ReviewDistribution, ReviewHistoryPage } from "./types";

type ReviewHistoryOptions = {
  waiterId?: string;
  cursor?: string;
  limit?: number;
};

type WaiterReviewMetrics = {
  avgRatingAllTime: number;
  reviewsCountAllTime: number;
  commentsCountAllTime: number;
};

const EMPTY_DISTRIBUTION: ReviewDistribution = {
  rating1: 0,
  rating2: 0,
  rating3: 0,
  rating4: 0,
  rating5: 0,
};

function baseReviewWhere(waiterId?: string): Prisma.GuestReviewWhereInput {
  return waiterId ? { waiterId } : {};
}

function toRoundedRating(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return 0;
  return Number(value.toFixed(2));
}

function toDistribution(
  rows: Array<{
    rating: number;
    _count: { _all: number };
  }>,
): ReviewDistribution {
  const distribution: ReviewDistribution = { ...EMPTY_DISTRIBUTION };
  for (const row of rows) {
    if (row.rating === 1) distribution.rating1 = row._count._all;
    if (row.rating === 2) distribution.rating2 = row._count._all;
    if (row.rating === 3) distribution.rating3 = row._count._all;
    if (row.rating === 4) distribution.rating4 = row._count._all;
    if (row.rating === 5) distribution.rating5 = row._count._all;
  }
  return distribution;
}

export async function getReviewAnalytics(waiterId?: string): Promise<ReviewAnalytics> {
  const where = baseReviewWhere(waiterId);

  const [aggregate, commentsCount, groupedByRating] = await Promise.all([
    prisma.guestReview.aggregate({
      where,
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.guestReview.count({
      where: {
        ...where,
        comment: { not: null },
      },
    }),
    prisma.guestReview.groupBy({
      by: ["rating"],
      where,
      _count: { _all: true },
    }),
  ]);

  return {
    avgRating: toRoundedRating(aggregate._avg.rating),
    reviewsCount: aggregate._count._all,
    commentsCount,
    distribution: toDistribution(groupedByRating),
  };
}

export async function getReviewHistoryPage(options: ReviewHistoryOptions = {}): Promise<ReviewHistoryPage> {
  const limit = Math.max(1, Math.min(50, Math.floor(Number(options.limit ?? 25))));
  const cursor = parseHistoryCursor(options.cursor);
  const cursorDate = cursor ? new Date(cursor.ts) : null;
  const where = baseReviewWhere(options.waiterId);

  const [analytics, rows] = await Promise.all([
    getReviewAnalytics(options.waiterId),
    prisma.guestReview.findMany({
      where: {
        ...where,
        ...(cursor && cursorDate
          ? {
              OR: [
                { createdAt: { lt: cursorDate } },
                {
                  createdAt: cursorDate,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        waiter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const pageItems = rows.slice(0, limit);
  const last = pageItems[pageItems.length - 1];

  return {
    analytics,
    items: pageItems.map((row) => ({
      id: row.id,
      tableId: row.tableId,
      waiterId: row.waiterId ?? undefined,
      waiterName: row.waiter?.name ?? undefined,
      rating: row.rating,
      comment: row.comment ?? undefined,
      createdAt: row.createdAt.getTime(),
    })),
    nextCursor:
      rows.length > limit && last
        ? serializeHistoryCursor({
            ts: last.createdAt.getTime(),
            id: last.id,
          })
        : undefined,
  };
}

export async function getWaiterReviewMetrics(waiterId: string): Promise<WaiterReviewMetrics> {
  const analytics = await getReviewAnalytics(waiterId);
  return {
    avgRatingAllTime: analytics.avgRating,
    reviewsCountAllTime: analytics.reviewsCount,
    commentsCountAllTime: analytics.commentsCount,
  };
}

export async function getWaiterReviewMetricsMap(waiterIds: string[]): Promise<Map<string, WaiterReviewMetrics>> {
  const uniqueWaiterIds = Array.from(new Set(waiterIds.filter((waiterId) => waiterId.trim().length > 0)));
  const emptyMap = new Map<string, WaiterReviewMetrics>();

  if (uniqueWaiterIds.length === 0) {
    return emptyMap;
  }

  const [aggregates, comments] = await Promise.all([
    prisma.guestReview.groupBy({
      by: ["waiterId"],
      where: {
        waiterId: { in: uniqueWaiterIds },
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.guestReview.groupBy({
      by: ["waiterId"],
      where: {
        waiterId: { in: uniqueWaiterIds },
        comment: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const commentsByWaiter = new Map(
    comments
      .filter((row): row is { waiterId: string; _count: { _all: number } } => !!row.waiterId)
      .map((row) => [row.waiterId, row._count._all]),
  );

  for (const waiterId of uniqueWaiterIds) {
    emptyMap.set(waiterId, {
      avgRatingAllTime: 0,
      reviewsCountAllTime: 0,
      commentsCountAllTime: commentsByWaiter.get(waiterId) ?? 0,
    });
  }

  for (const row of aggregates) {
    if (!row.waiterId) continue;
    emptyMap.set(row.waiterId, {
      avgRatingAllTime: toRoundedRating(row._avg.rating),
      reviewsCountAllTime: row._count._all,
      commentsCountAllTime: commentsByWaiter.get(row.waiterId) ?? 0,
    });
  }

  return emptyMap;
}
