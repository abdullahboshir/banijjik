import { escapeRegExp } from "@banijjik/validation";
import type { ContactListRequest, ContactSearch } from "../application/ports/contact-repository.js";

type Condition = Record<string, unknown>;

function prefixOf(text: string): { $regex: string } {
  return { $regex: `^${escapeRegExp(text)}` };
}

/** Each branch is backed by its own index; an unindexed branch would turn the whole `$or` into a collection scan. */
function searchBranches(search: ContactSearch): Condition[] {
  const branches: Condition[] = [
    { nameSearch: prefixOf(search.namePrefix) },
    { customFieldSearch: { $elemMatch: { value: prefixOf(search.valuePrefix) } } },
  ];
  if (search.phonePrefix !== undefined) branches.push({ phoneE164: prefixOf(search.phonePrefix) });
  return branches;
}

/** The query of `GET /contacts` (the tenant plugin adds the organization). */
export function buildContactFilter(request: ContactListRequest): Condition {
  const conditions: Condition[] = [{ status: request.status }];
  if (request.role !== undefined) conditions.push({ contactRoles: request.role });
  if (request.tag !== undefined) conditions.push({ tagKeys: request.tag });
  if (request.search !== undefined) conditions.push({ $or: searchBranches(request.search) });
  return { $and: conditions };
}
