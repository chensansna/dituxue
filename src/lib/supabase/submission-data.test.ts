import { describe, expect, it } from "vitest";
import { MAX_MAP_FILE_BYTES, validateMapFileMetadata } from "./submission-data";

describe("map submission validation", () => {
  it("accepts supported map files within the limit", () => {
    expect(() => validateMapFileMetadata("image/png", 1024)).not.toThrow();
    expect(() => validateMapFileMetadata("application/pdf", MAX_MAP_FILE_BYTES)).not.toThrow();
  });

  it("rejects unsupported or oversized files", () => {
    expect(() => validateMapFileMetadata("image/gif", 1024)).toThrow("仅支持 PNG、JPG、PDF");
    expect(() => validateMapFileMetadata("image/jpeg", MAX_MAP_FILE_BYTES + 1)).toThrow("文件大小必须在 50MB 以内");
  });
});
