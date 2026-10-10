/** A postal address in the field names shared with contact addresses (09-DOMAIN-MODEL section 5). */
export interface PostalAddress {
  line1?: string | undefined;
  area?: string | undefined;
  thana?: string | undefined;
  district?: string | undefined;
  postalCode?: string | undefined;
}
