import { formatUsd } from "@/lib/utils";

export function PricingTableBlock({
  lineItems,
  lang,
}: {
  lineItems: { id: string; name: string; unit: number; qty: number; optional?: boolean }[];
  lang: "tr" | "en";
}) {
  return (
    <div>
      <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Fiyatlandırma Sayfası" : "Pricing"}</p>
      <table className="w-full text-sm">
      <tbody>
        {lineItems.map((li) => (
          <tr key={li.id} className="border-t border-border first:border-0">
            <td className="py-1.5">
              {li.name} × {li.qty}
              {li.optional && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">({lang === "tr" ? "opsiyonel" : "optional"})</span>
              )}
            </td>
            <td className="py-1.5 text-right tnum">{formatUsd(li.unit * li.qty)}</td>
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
}
