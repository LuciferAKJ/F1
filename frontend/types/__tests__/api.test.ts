import { describe, it, expect } from "vitest";
import { toCircuitData, toDriverMeta } from "../api";
import { SAMPLE_CIRCUIT_DTO, SAMPLE_DRIVER_DTOS } from "@/lib/__tests__/fixtures";

describe("api DTO converters", () => {
  it("converts CircuitDataDTO to CircuitData", () => {
    const circuit = toCircuitData(SAMPLE_CIRCUIT_DTO);
    expect(circuit).toEqual({
      x: SAMPLE_CIRCUIT_DTO.x,
      y: SAMPLE_CIRCUIT_DTO.y,
      minX: SAMPLE_CIRCUIT_DTO.minX,
      maxX: SAMPLE_CIRCUIT_DTO.maxX,
      minY: SAMPLE_CIRCUIT_DTO.minY,
      maxY: SAMPLE_CIRCUIT_DTO.maxY,
    });
  });

  it("converts DriverMetaDTO to DriverMeta", () => {
    const driver = toDriverMeta(SAMPLE_DRIVER_DTOS[0]);
    expect(driver).toEqual({
      abbreviation: "VER",
      teamName: "Red Bull Racing",
      teamColor: "#3671C6",
      driverNumber: "1",
    });
  });
});
