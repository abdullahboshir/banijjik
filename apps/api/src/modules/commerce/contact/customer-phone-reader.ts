import { asId, type CustomerAccountId } from "@banijjik/ids";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";
import { MongoCustomerAccountRepository } from "./infrastructure/mongo-customer-account.repository.js";

/** Account phone for directory submission rules (guardian phone must differ). */
export function buildCustomerPhoneReader(): {
  phoneOf(customerAccountId: CustomerAccountId): Promise<string | undefined>;
} {
  const accounts = new MongoCustomerAccountRepository();
  const contacts = new MongoContactRepository();
  return {
    async phoneOf(customerAccountId) {
      const account = await accounts.findById(asId<CustomerAccountId>(customerAccountId));
      if (account === undefined) return undefined;
      const contact = await contacts.findById(account.contactId);
      return contact?.phoneE164;
    },
  };
}
