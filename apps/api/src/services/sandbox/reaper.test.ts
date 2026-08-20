import { describe, it, expect, vi, beforeEach } from "vitest";

const listContainers = vi.fn();
const listNetworks = vi.fn();
const getContainer = vi.fn();
const getNetwork = vi.fn();

vi.mock("./docker-client.js", () => ({
  docker: {
    listContainers: (...args: unknown[]) => listContainers(...args),
    listNetworks: (...args: unknown[]) => listNetworks(...args),
    getContainer: (...args: unknown[]) => getContainer(...args),
    getNetwork: (...args: unknown[]) => getNetwork(...args),
  },
}));

const { reapStaleContainers } = await import("./reaper.js");

const NOW_SECONDS = Date.now() / 1000;
const FIVE_HOURS_AGO = NOW_SECONDS - 5 * 3600;
const TEN_MINUTES_AGO = NOW_SECONDS - 10 * 60;

function fakeContainer() {
  const stop = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(undefined);
  return { stop, remove };
}

describe("reapStaleContainers", () => {
  beforeEach(() => {
    listContainers.mockReset();
    listNetworks.mockReset();
    getContainer.mockReset();
    getNetwork.mockReset();
    listNetworks.mockResolvedValue([]);
  });

  it("removes cybersim containers older than the age threshold", async () => {
    listContainers.mockResolvedValue([
      { Id: "old1", Names: ["/cybersim-sandbox-abc"], Created: FIVE_HOURS_AGO },
      { Id: "old2", Names: ["/cybersim-dvwa-abc"], Created: FIVE_HOURS_AGO },
    ]);
    const c1 = fakeContainer();
    const c2 = fakeContainer();
    getContainer.mockImplementation((id: string) => (id === "old1" ? c1 : c2));

    const result = await reapStaleContainers();

    expect(c1.stop).toHaveBeenCalled();
    expect(c1.remove).toHaveBeenCalled();
    expect(c2.stop).toHaveBeenCalled();
    expect(c2.remove).toHaveBeenCalled();
    expect(result.removed).toEqual(["/cybersim-sandbox-abc", "/cybersim-dvwa-abc"]);
  });

  it("leaves recently-created cybersim containers alone", async () => {
    listContainers.mockResolvedValue([{ Id: "fresh", Names: ["/cybersim-sandbox-abc"], Created: TEN_MINUTES_AGO }]);

    const result = await reapStaleContainers();

    expect(getContainer).not.toHaveBeenCalled();
    expect(result.removed).toEqual([]);
  });

  it("never touches containers outside the cybersim naming prefix, no matter how old", async () => {
    listContainers.mockResolvedValue([{ Id: "unrelated", Names: ["/some-other-app"], Created: FIVE_HOURS_AGO }]);

    const result = await reapStaleContainers();

    expect(getContainer).not.toHaveBeenCalled();
    expect(result.removed).toEqual([]);
  });

  it("removes an orphaned DVWA network with no attached containers", async () => {
    listContainers.mockResolvedValue([]);
    listNetworks.mockResolvedValue([{ Id: "net1", Name: "cybersim-dvwa-net-abc" }]);
    const remove = vi.fn().mockResolvedValue(undefined);
    const inspect = vi.fn().mockResolvedValue({ Containers: {} });
    getNetwork.mockReturnValue({ inspect, remove });

    const result = await reapStaleContainers();

    expect(remove).toHaveBeenCalled();
    expect(result.removed).toContain("cybersim-dvwa-net-abc");
  });

  it("leaves a DVWA network alone while a container is still attached to it", async () => {
    listContainers.mockResolvedValue([]);
    listNetworks.mockResolvedValue([{ Id: "net1", Name: "cybersim-dvwa-net-abc" }]);
    const remove = vi.fn().mockResolvedValue(undefined);
    const inspect = vi.fn().mockResolvedValue({ Containers: { c1: {} } });
    getNetwork.mockReturnValue({ inspect, remove });

    const result = await reapStaleContainers();

    expect(remove).not.toHaveBeenCalled();
    expect(result.removed).not.toContain("cybersim-dvwa-net-abc");
  });

  it("collects per-item errors instead of aborting the whole sweep", async () => {
    listContainers.mockResolvedValue([
      { Id: "bad", Names: ["/cybersim-sandbox-bad"], Created: FIVE_HOURS_AGO },
      { Id: "good", Names: ["/cybersim-sandbox-good"], Created: FIVE_HOURS_AGO },
    ]);
    getContainer.mockImplementation((id: string) => {
      if (id === "bad") throw new Error("boom");
      return fakeContainer();
    });

    const result = await reapStaleContainers();

    expect(result.errors.length).toBe(1);
    expect(result.removed).toEqual(["/cybersim-sandbox-good"]);
  });
});
