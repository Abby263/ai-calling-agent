from __future__ import annotations

from uuid import uuid4

from app.core.config import Settings
from app.schemas import BusinessCandidate, LocationInput, ParsedIntent, SearchFilters
from app.services.places.google_places import GooglePlacesClient


class SearchAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def search(
        self,
        *,
        intent: ParsedIntent,
        location: LocationInput,
        filters: SearchFilters,
    ) -> list[BusinessCandidate]:
        if intent.task_kind == "direct_calls":
            return self._direct_call_targets(intent)
        if self.settings.google_places_enabled and location.lat is not None and location.lng is not None:
            client = GooglePlacesClient(self.settings.google_places_api_key or "")
            results = await client.search(
                query=self._keyword(intent, filters),
                business_type=intent.business_type,
                location=location,
                filters=filters,
            )
            if results:
                return results
        return self._demo_results(intent, location, filters)

    def _direct_call_targets(self, intent: ParsedIntent) -> list[BusinessCandidate]:
        return [
            BusinessCandidate(
                id=f"direct_{uuid4().hex[:10]}",
                name=f"Contact {index}",
                address="User-provided phone number",
                phone=phone,
                business_status="CALLABLE",
                open_now=True,
                source="user_provided_number",
                relevance_score=100 - index,
            )
            for index, phone in enumerate(intent.direct_phone_numbers, start=1)
        ]

    def _keyword(self, intent: ParsedIntent, filters: SearchFilters) -> str:
        parts = [intent.search_target]
        if "happy" in intent.search_target.lower() or "happy hour" in str(intent.constraints).lower():
            parts.append("happy hour")
        if filters.cuisine:
            parts.append(filters.cuisine)
        if filters.dietary_preference:
            parts.append(filters.dietary_preference)
        return " ".join(parts)

    def _demo_results(
        self,
        intent: ParsedIntent,
        location: LocationInput,
        filters: SearchFilters,
    ) -> list[BusinessCandidate]:
        if intent.business_type == "clinic":
            return self._demo_clinic_results(intent, location, filters)

        names = [
            ("Juniper Social", "Mediterranean small plates", 430, 4.6, 412, 2, True),
            ("North Market Bar", "Pub fare and late happy hour", 690, 4.3, 289, 2, True),
            ("Casa Verde Kitchen", "Plant-forward Mexican", 920, 4.7, 631, 2, True),
            ("Harbor Noodle House", "Asian fusion", 1250, 4.2, 177, 1, True),
            ("Elm & Rye", "Modern bistro", 1600, 4.5, 520, 3, False),
            ("The Copper Room", "Cocktail bar", 2100, 4.1, 94, 3, True),
            ("Garden Table", "Vegetarian cafe", 2600, 4.8, 301, 2, True),
            ("Station Grill", "Casual grill", 3100, 3.9, 146, 1, True),
        ]
        businesses: list[BusinessCandidate] = []
        for index, (name, category, distance, rating, reviews, price, open_now) in enumerate(names):
            if distance > filters.radius_meters:
                continue
            if filters.min_rating and rating < filters.min_rating:
                continue
            if filters.price_level and price > filters.price_level:
                continue
            if filters.open_now and not open_now:
                continue
            businesses.append(
                BusinessCandidate(
                    id=f"demo_{uuid4().hex[:10]}",
                    place_id=f"demo-place-{index}",
                    name=name,
                    address=f"{100 + index} King Street, {location.label or 'Nearby'}",
                    phone=f"+14165550{index:03d}",
                    website=f"https://example.com/{name.lower().replace(' ', '-')}",
                    rating=rating,
                    review_count=reviews,
                    distance_meters=distance,
                    opening_hours_json={"open_now": open_now, "weekday_text": ["Mon-Sun 11:00-22:00"]},
                    price_level=price,
                    google_maps_url="https://maps.google.com",
                    business_status="OPERATIONAL",
                    open_now=open_now,
                    source="demo_places",
                    relevance_score=0,
                )
            )
        return businesses

    def _demo_clinic_results(
        self,
        intent: ParsedIntent,
        location: LocationInput,
        filters: SearchFilters,
    ) -> list[BusinessCandidate]:
        names = [
            (
                "Appletree Medical Centre - Harbourfront",
                "88 Harbour Street, Toronto, ON",
                360,
                4.2,
                184,
                True,
                "+14165551010",
            ),
            (
                "Appletree Medical Centre - Downtown",
                "123 Front Street West, Toronto, ON",
                980,
                4.0,
                256,
                True,
                "+14165551011",
            ),
            (
                "Harbour Street Family Practice",
                "15 Harbour Street, Toronto, ON",
                520,
                4.4,
                92,
                True,
                "+14165551012",
            ),
            (
                "Lakeside Walk-In Clinic",
                "210 Queens Quay West, Toronto, ON",
                1200,
                3.9,
                141,
                True,
                "+14165551013",
            ),
        ]
        businesses: list[BusinessCandidate] = []
        for index, (name, address, distance, rating, reviews, open_now, phone) in enumerate(names):
            if distance > filters.radius_meters:
                continue
            if filters.min_rating and rating < filters.min_rating:
                continue
            if filters.open_now and not open_now:
                continue
            relevance = 20
            if "apple tree" in intent.search_target.lower() and "appletree" in name.lower():
                relevance += 35
            if "harbour" in intent.search_target.lower() and "harbour" in address.lower():
                relevance += 25
            businesses.append(
                BusinessCandidate(
                    id=f"demo_clinic_{uuid4().hex[:10]}",
                    place_id=f"demo-clinic-{index}",
                    name=name,
                    address=address,
                    phone=phone,
                    website=f"https://example.com/{name.lower().replace(' ', '-').replace('/', '-')}",
                    rating=rating,
                    review_count=reviews,
                    distance_meters=distance,
                    opening_hours_json={"open_now": open_now, "weekday_text": ["Mon-Fri 08:00-18:00"]},
                    google_maps_url="https://maps.google.com",
                    business_status="OPERATIONAL",
                    open_now=open_now,
                    source="demo_places",
                    relevance_score=relevance,
                )
            )
        return businesses
