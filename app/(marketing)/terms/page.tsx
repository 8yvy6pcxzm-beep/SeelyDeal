"use client";

import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";

/**
 * Terms of service. Placeholder text — replace once the lawyer provides final copy.
 */
export default function TermsPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {lang === "tr" ? "Kullanım Şartları" : "Terms of Service"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "tr" ? "Son güncelleme: [tarih girilecek]" : "Last updated: [date pending]"}
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {lang === "tr"
          ? `Bu sayfa yer tutucudur — ${appConfig.name}'ın nihai Kullanım Şartları metni buraya eklenecek.`
          : `This page is a placeholder — ${appConfig.name}'s final terms of service text goes here.`}
      </div>

      <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-muted-foreground">
        {lang === "tr" ? (
          <>
            <h2>1. Hizmetin Tanımı</h2>
            <p>{appConfig.name}, AI destekli teklif hazırlama ve e-imza hizmeti sunar. [Detaylandırılacak.]</p>

            <h2>2. Kullanıcı Yükümlülükleri</h2>
            <p>
              Sisteme yüklediğiniz üçüncü kişi (müşteri) verileri için kendi KVKK yükümlülüklerinizi yerine
              getirmekten siz sorumlusunuz. [Avukat metniyle netleştirilecek.]
            </p>

            <h2>3. Sorumluluk Sınırlaması</h2>
            <p>[Avukat metniyle netleştirilecek.]</p>

            <h2>4. Fesih</h2>
            <p>[Avukat metniyle netleştirilecek.]</p>
          </>
        ) : (
          <>
            <h2>1. Service Description</h2>
            <p>{appConfig.name} provides AI-assisted proposal drafting and e-signature services.</p>

            <h2>2. User Responsibilities</h2>
            <p>You are responsible for your own compliance obligations regarding any third-party (customer) data you upload.</p>

            <h2>3. Limitation of Liability</h2>
            <p>[Pending final legal text.]</p>

            <h2>4. Termination</h2>
            <p>[Pending final legal text.]</p>
          </>
        )}
      </div>
    </div>
  );
}
