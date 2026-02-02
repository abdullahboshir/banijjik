export const TABLE_HEIGHT_ENUM = ["SMALL", "MEDIUM", "LARGE"];
export const TABLE_HEIGHT = TABLE_HEIGHT_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=table-height.js.map