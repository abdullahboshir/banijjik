# Delivery Module

The `delivery` module provides own-rider delivery assignments and cash handover reconciliation for orders with `fulfillmentMethod === "OWN_RIDER"`.

## Responsibilities
- Assign an order to a rider (must be an active organization member assigned to the order's location).
- Optionally ship the order with `OWN_RIDER` dispatch when assigned.
- Record cash handovers from riders to staff with gross amount checking. Staff cannot approve their own cash handovers.
- Reverse cash handovers using approval tokens.
- Emit domain events and audit logs for all operations.
