import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

export async function listTrips(userId: string, tripId?: string) {
  return db
    .select({ trip: schema.trips, programName: schema.programs.name })
    .from(schema.trips)
    .leftJoin(schema.programs, eq(schema.programs.id, schema.trips.programId))
    .where(tripId ? and(eq(schema.trips.userId, userId), eq(schema.trips.id, tripId)) : eq(schema.trips.userId, userId))
    .orderBy(sql`${schema.trips.departDate} asc nulls last`, asc(schema.trips.createdAt));
}
