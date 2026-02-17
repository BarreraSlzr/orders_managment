import { db } from "@/lib/sql/database";
import {
    DispatchDomainEventParams,
    DomainEventResultMap,
    DomainEventType,
} from "./contracts";
import { domainEventHandlers } from "./handlers";

export async function dispatchDomainEvent<TType extends DomainEventType>(
  params: DispatchDomainEventParams<TType>
): Promise<DomainEventResultMap[TType]> {
  const event = await db
    .insertInto("domain_events")
    .values({
      event_type: params.type,
      payload: JSON.stringify(params.payload),
      status: "pending",
      tenant_id: params.payload.tenantId,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const handler = domainEventHandlers[params.type];

  try {
    const result = await handler({ payload: params.payload });

    await db
      .updateTable("domain_events")
      .set({
        status: "processed",
        result: JSON.stringify(result),
      })
      .where("id", "=", event.id)
      .execute();

    return result;
  } catch (error) {
    await db
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
