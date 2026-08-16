import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import { HeroCoverBlock } from "@/components/app/blocks/hero-cover-block";
import { RichSectionBlock } from "@/components/app/blocks/rich-section-block";
import { PricingTableBlock } from "@/components/app/blocks/pricing-table-block";
import { ContractSignOffBlock } from "@/components/app/blocks/contract-sign-off-block";

export type BlockRenderContext = {
  title: string;
  client: string;
  value: number;
  lineItems: { id: string; name: string; unit: number; qty: number; optional?: boolean }[];
  lang: "tr" | "en";
};

/** Single render engine every proposal surface (editor preview now, public/
 *  signing page and chat editor in later phases) is meant to converge on —
 *  swap the JSX-per-surface duplication for one `blocks[]` → UI mapping. */
export function BlockRenderer({ blocks, ctx }: { blocks: ProposalBlock[]; ctx: BlockRenderContext }) {
  let sectionIndex = 0;
  let sawSection = false;
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "HeroCover":
            return <HeroCoverBlock key={block.id} title={ctx.title} client={ctx.client} value={ctx.value} lang={ctx.lang} />;
          case "RichSection": {
            const isFirst = !sawSection;
            sawSection = true;
            return (
              <div key={block.id} className={isFirst ? "" : "-mt-3.5"}>
                {isFirst && <p className="label-mono pb-2 text-muted-foreground">{ctx.lang === "tr" ? "Bölümler" : "Sections"}</p>}
                <RichSectionBlock index={sectionIndex++} label={block.label} body={block.body} />
              </div>
            );
          }
          case "PricingTable":
            return ctx.lineItems.length > 0 ? <PricingTableBlock key={block.id} lineItems={ctx.lineItems} lang={ctx.lang} /> : null;
          case "ContractSignOff":
            return <ContractSignOffBlock key={block.id} contractText={block.contractText} lang={ctx.lang} />;
          default:
            return null;
        }
      })}
    </>
  );
}
