# Dues screens (3.8 B2)

`/{orgSlug}/payments/dues` reads the payment API, checks `payment.due.read`, and renders mobile cards. Contact search supplies a bounded set of contact choices; request type and contact filters reset pagination. Dues pages use a fixed limit of 20 and preserve selected filters when paging.
