// dockerode surfaces raw daemon/socket errors with no shared error class, so
// every sandbox route previously collapsed all of them into one flat
// "Failed to start sandbox" 502 — a user couldn't tell "Docker Desktop isn't
// running" from "you already have one running" from "the image isn't
// pulled". This maps the handful of error shapes that actually occur into a
// status code + message worth showing.
export function describeDockerError(err: unknown): { status: number; message: string } {
  const code = (err as { code?: string })?.code;
  const statusCode = (err as { statusCode?: number })?.statusCode;
  const rawMessage = err instanceof Error ? err.message : String(err);

  // Node-level connection errors mean the Docker daemon/socket itself is
  // unreachable, not a problem with this specific request.
  if (code === "ENOENT" || code === "ECONNREFUSED" || code === "EACCES") {
    return { status: 503, message: "Docker tidak berjalan atau tidak bisa diakses di server" };
  }
  if (statusCode === 409) {
    return { status: 409, message: "Container sudah berjalan atau sedang diproses, coba lagi sebentar" };
  }
  if (statusCode === 404) {
    return { status: 503, message: "Image Docker tidak ditemukan di server (belum di-pull)" };
  }
  if (statusCode === 500) {
    return { status: 502, message: "Docker daemon mengalami error internal" };
  }
  return { status: 502, message: rawMessage || "Operasi Docker gagal" };
}
