from app.schemas import BusinessCandidate, SearchFilters


class RankingAgent:
    def rank(
        self,
        businesses: list[BusinessCandidate],
        filters: SearchFilters,
    ) -> list[BusinessCandidate]:
        ranked: list[BusinessCandidate] = []
        for business in businesses:
            score = 0.0
            if business.distance_meters is not None:
                score += max(0, 35 - (business.distance_meters / max(filters.radius_meters, 1)) * 35)
            if business.rating is not None:
                score += business.rating * 10
            if business.review_count:
                score += min(10, business.review_count / 100)
            if business.open_now:
                score += 12
            if business.phone:
                score += 15
            if business.business_status == "OPERATIONAL":
                score += 5
            if filters.price_level and business.price_level:
                score += max(0, 8 - abs(filters.price_level - business.price_level) * 3)
            business.relevance_score = round(score, 3)
            ranked.append(business)
        return sorted(ranked, key=lambda item: item.relevance_score, reverse=True)

