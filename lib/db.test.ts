import { afterEach, describe, expect, it, vi } from "vitest";
import { databasePoolConfig } from "@/lib/db";

afterEach(() => vi.unstubAllEnvs());

describe("databasePoolConfig", () => {
  it("uses the local PostgreSQL socket for a hostless database URL", () => {
    vi.stubEnv("PGUSER", "local-builder");
    expect(databasePoolConfig("postgresql:///marketing_agent")).toEqual({
      host: "/tmp",
      database: "marketing_agent",
      user: "local-builder",
      max: 5,
    });
  });

  it("leaves hosted PostgreSQL URLs intact", () => {
    const connectionString = "postgresql://app:secret@db.example.com:5432/buildtoreach";
    expect(databasePoolConfig(connectionString)).toEqual({ connectionString, max: 5 });
  });
});
