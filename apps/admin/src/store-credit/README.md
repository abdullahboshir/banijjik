# Store credit screens (3.8 B2)

The contact detail loads this section dynamically when payment is enabled and the caller may read store credit. The server reads the contact summary balance, organization currency and first history page. History requests are paginated. Adjustments require write access and `payment.storeCredit.adjust`, and use a contact-and-amount-bound PIN approval followed by an idempotent POST. No customer-account or directory-credit dependency is required.
