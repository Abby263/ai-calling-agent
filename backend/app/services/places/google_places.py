from __future__ import annotations

import math
from typing import Any

import httpx

from app.schemas import BusinessCandidate, LocationInput, SearchFilters


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    radius = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return int(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


class GooglePlacesClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/place"

    async def search(
        self,
        *,
        query: str,
        business_type: str,
        location: LocationInput,
        filters: SearchFilters,
    ) -> list[BusinessCandidate]:
        if location.lat is None or location.lng is None:
            return []

        params: dict[str, Any] = {
            "key": self.api_key,
            "location": f"{location.lat},{location.lng}",
            "radius": filters.radius_meters,
            "type": self._place_type_for_business(business_type),
            "keyword": query,
        }
        if filters.open_now:
            params["opennow"] = "true"

        async with httpx.AsyncClient(timeout=12) as client:
            nearby = await client.get(f"{self.base_url}/nearbysearch/json", params=params)
            nearby.raise_for_status()
            results = nearby.json().get("results", [])[:12]

            businesses: list[BusinessCandidate] = []
            for item in results:
                details = await self._details(client, item.get("place_id"))
                merged = {**item, **details}
                business = self._to_business(merged, location)
                if filters.min_rating and business.rating and business.rating < filters.min_rating:
                    continue
                if filters.price_level and business.price_level and business.price_level > filters.price_level:
                    continue
                businesses.append(business)
            return businesses

    async def _details(self, client: httpx.AsyncClient, place_id: str | None) -> dict[str, Any]:
        if not place_id:
            return {}
        params = {
            "key": self.api_key,
            "place_id": place_id,
            "fields": ",".join(
                [
                    "name",
                    "formatted_address",
                    "formatted_phone_number",
                    "website",
                    "rating",
                    "user_ratings_total",
                    "opening_hours",
                    "price_level",
                    "business_status",
                    "url",
                    "geometry",
                    "place_id",
                ]
            ),
        }
        response = await client.get(f"{self.base_url}/details/json", params=params)
        response.raise_for_status()
        return response.json().get("result", {})

    def _to_business(self, item: dict[str, Any], location: LocationInput) -> BusinessCandidate:
        geometry = item.get("geometry", {}).get("location", {})
        lat = geometry.get("lat")
        lng = geometry.get("lng")
        distance = None
        if lat is not None and lng is not None and location.lat is not None and location.lng is not None:
            distance = haversine_meters(location.lat, location.lng, lat, lng)
        return BusinessCandidate(
            id=str(item.get("place_id") or item.get("name")),
            place_id=item.get("place_id"),
            name=item.get("name") or "Unknown business",
            address=item.get("formatted_address") or item.get("vicinity") or "",
            phone=item.get("formatted_phone_number"),
            website=item.get("website"),
            rating=item.get("rating"),
            review_count=item.get("user_ratings_total"),
            opening_hours_json=item.get("opening_hours"),
            price_level=item.get("price_level"),
            distance_meters=distance,
            google_maps_url=item.get("url"),
            business_status=item.get("business_status"),
            open_now=item.get("opening_hours", {}).get("open_now"),
            source="google_places",
        )

    def _place_type_for_business(self, business_type: str) -> str:
        normalized = business_type.lower()
        if "bar" in normalized:
            return "bar"
        if "cafe" in normalized:
            return "cafe"
        if "salon" in normalized:
            return "beauty_salon"
        if "clinic" in normalized:
            return "doctor"
        if "store" in normalized:
            return "store"
        return "restaurant"

