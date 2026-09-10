import { ActivityFeed } from "@/components/market-scout/activity-feed";
import { AhvazCarScout } from "@/components/market-scout/ahvaz-car-scout";
import { MARKET_SCOUT_ACTIVITY_FEED_VERSION } from "@/modules/growth/application/market-scout-activity-read-model";

export default function MarketScoutPage() {
  return <><AhvazCarScout /><ActivityFeed contractVersion={MARKET_SCOUT_ACTIVITY_FEED_VERSION} /></>;
}
