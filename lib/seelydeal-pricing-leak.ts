import appConfig from "@/app.config";

/** SeelyDeal's own Lite/Pro/Custom subscription price strings (yearly + monthly), used
 *  to catch the recurring AI-chat mix-up where the "GERÇEK PAKETLERİMİZ" block (meant
 *  only for pitching SeelyDeal itself) gets copied into a company's OWN "Hizmetler ve
 *  Fiyatlandırma" content — e.g. after a user says "ben custom paketim" (about their own
 *  SeelyDeal subscription tier, not what they charge their clients). Two or more of these
 *  price strings appearing verbatim in a company's service-description text is a strong
 *  signal the content is actually SeelyDeal's own pricing, not the company's. */
const ownPriceStrings = appConfig.marketing.pricing.flatMap((p) => [p.price, p.monthlyPrice].filter((v): v is string => !!v));

export function isSeelyDealPricingLeak(content: string): boolean {
  return ownPriceStrings.filter((price) => content.includes(price)).length >= 2;
}
