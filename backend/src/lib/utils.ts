export function formatTemp(tempC: number, unit: "C" | "F" = "C"): string {
  if (unit === "F") {
    const tempF = (tempC * 9) / 5 + 32;
    return `${tempF.toFixed(1)}°F`;
  }
  return `${tempC.toFixed(1)}°C`;
}

export function getFeverStatus(tempC: number, threshold = 38.0): {
  isFever: boolean;
  label: string;
} {
  if (tempC >= threshold) {
    return {
      isFever: true,
      label: "Fever",
    };
  }
  return {
    isFever: false,
    label: "Normal",
  };
}
