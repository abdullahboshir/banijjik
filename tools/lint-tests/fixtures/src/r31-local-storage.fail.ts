export function readToken(): string | null {
  return localStorage.getItem("token");
}
