import { db } from "@/lib/sql/database";
import {
  DispatchDomainEventParams,
  DomainEventResultMap,
  DomainEventType,
} from "./contracts";
import { domainEventHandlers } from "./handlers";

export interface DispatchDomainEventDeps {
  db: typeof db;
  handlers: typeof domainEventHandlers;
}

export async function dispatchDomainEventWithDeps<TType extends DomainEventType>(
  params: DispatchDomainEventParams<TType>,
  deps: DispatchDomainEventDeps,
): Promise<DomainEventResultMap[TType]> {
  const event = await deps.db
    .insertInto("domain_events")
    .values({
      event_type: params.type,
      payload: JSON.stringify(params.payload),
      status: "pending",
      tenant_id: params.payload.tenantId,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const handler = deps.handlers[params.type];

  try {
    const result = await handler({ payload: params.payload });

    await deps.db
      .updateTable("domain_events")
      .set({
        status: "processed",
        result: JSON.stringify(result),
      })
      .where("id", "=", event.id)
      .execute();

    return result;
  } catch (error) {
    await deps.db
      .updateTable("domain_events")
      .set({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .where("id", "=", event.id)
      .execute();

    throw error;
  }
}
