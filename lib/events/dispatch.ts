import { db } from "@/lib/sql/database";
import {
    DispatchDomainEventParams,
    DomainEventResultMap,
    DomainEventType,
} from "./contracts";
import {
  dispatchDomainEventWithDeps,
  DispatchDomainEventDeps,
} from "./dispatchCore";
import { domainEventHandlers } from "./handlers";

const dispatchDomainEventDeps: DispatchDomainEventDeps = {
  db,
  handlers: domainEventHandlers,
};

export async function dispatchDomainEvent<TType extends DomainEventType>(
  params: DispatchDomainEventParams<TType>,
  deps: DispatchDomainEventDeps = dispatchDomainEventDeps,
): Promise<DomainEventResultMap[TType]> {
  return dispatchDomainEventWithDeps(params, deps);
}
