export interface PageRequest {
  readonly page: number;
  readonly limit: number;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly hasNext: boolean;
}
