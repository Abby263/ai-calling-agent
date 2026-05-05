import type { LocationInput } from "../types/domain";

export async function getBrowserLocation(): Promise<LocationInput> {
  if (!("geolocation" in navigator)) {
    throw new Error("Browser location is not available.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Current location"
        });
      },
      () => reject(new Error("Location permission was denied.")),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

