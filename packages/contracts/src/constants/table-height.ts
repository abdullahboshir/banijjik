export const TABLE_HEIGHT_ENUM = ["SMALL", "MEDIUM", "LARGE"] as const;
export type TableHeightType = (typeof TABLE_HEIGHT_ENUM)[number];

export const TABLE_HEIGHT = TABLE_HEIGHT_ENUM.reduce(
  (acc: any, current) => {
    acc[current as TableHeightType] = current;
    return acc;
  },
  {} as { [K in TableHeightType]: K },
);
