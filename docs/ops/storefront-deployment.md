# Storefront deployment (M.6 amendment 1)

Required settings for `apps/storefront` behind a reverse proxy:

- **`TRUSTED_PROXY_HOPS` on the API** must count the storefront as one more hop in front of the API. The storefront's proxy forwards the `X-Forwarded-For` header it received from the internet (its own chain, ending with the peer address) and adds no value of its own. Set `TRUSTED_PROXY_HOPS` to the number of reverse proxies between the internet and the API, including the storefront server, so the API's per-address limits see the customer's address.
- **`STOREFRONT_API_ORIGIN`** on the storefront: the API origin the server calls (server to server).
- **`STOREFRONT_BASE_DOMAIN`** on the API: the base domain of the business hosts (`<slug>.<base>`).

Without the forwarded address, every customer looks like the storefront server, and per-address limits are shared by all customers.
