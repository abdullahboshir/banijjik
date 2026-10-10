export function countRawFromConnection(connection: {
  db: { collection(name: string): { countDocuments(): Promise<number> } };
}): Promise<number> {
  return connection.db.collection("orders").countDocuments();
}
