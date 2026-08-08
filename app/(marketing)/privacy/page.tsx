"use client";

import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";

/**
 * KVKK-compliant privacy policy. The actual legal text below is a placeholder —
 * replace the TR/EN bodies once the company's lawyer provides the final copy
 * (aydınlatma metni + gizlilik politikası).
 */
export default function PrivacyPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {lang === "tr" ? "Gizlilik Politikası ve KVKK Aydınlatma Metni" : "Privacy Policy"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "tr" ? "Son güncelleme: [tarih girilecek]" : "Last updated: [date pending]"}
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {lang === "tr"
          ? `Bu sayfa yer tutucudur — ${appConfig.name}'ın nihai KVKK Aydınlatma Metni ve Gizlilik Politikası buraya eklenecek.`
          : `This page is a placeholder — ${appConfig.name}'s final privacy policy text goes here.`}
      </div>

      <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-muted-foreground">
        {lang === "tr" ? (
          <>
            <h2>1. Veri Sorumlusu</h2>
            <p>[{appConfig.name} tüzel kişi bilgileri buraya gelecek.]</p>

            <h2>2. İşlenen Kişisel Veriler</h2>
            <p>
              Hesap bilgileri (ad, e-posta), şirket bilgileri, yüklenen teklif/sözleşme dokümanları, AI sohbet
              geçmişi, kullanım kayıtları. [Kesin liste avukat metniyle güncellenecek.]
            </p>

            <h2>3. İşleme Amaçları</h2>
            <p>Teklif taslaklarının AI ile hazırlanması, hesap yönetimi, ürün içi analitik. [Detaylandırılacak.]</p>

            <h2>4. Aktarılan Üçüncü Taraflar</h2>
            <p>
              Barındırma için Supabase, AI işleme için Anthropic (yurt dışı aktarım dahil). [KVKK md. 9 kapsamında
              netleştirilecek.]
            </p>

            <h2>5. Haklarınız (KVKK m.11)</h2>
            <p>
              Verilerinize erişim, düzeltme, silme ve aktarım taleplerinizi hesap ayarlarından veya{" "}
              {appConfig.name}'a e-posta ile iletebilirsiniz.
            </p>
          </>
        ) : (
          <>
            <h2>1. Data Controller</h2>
            <p>[{appConfig.name} entity details go here.]</p>

            <h2>2. Data We Process</h2>
            <p>
              Account info (name, email), company info, uploaded proposal/contract documents, AI chat history,
              usage logs. [Final list pending legal text.]
            </p>

            <h2>3. Purpose of Processing</h2>
            <p>AI-assisted proposal drafting, account management, in-product analytics. [To be expanded.]</p>

            <h2>4. Third Parties</h2>
            <p>Supabase for hosting, Anthropic for AI processing (including cross-border transfer).</p>

            <h2>5. Your Rights</h2>
            <p>You can request access, correction, deletion, and export of your data from account settings.</p>
          </>
        )}
      </div>
    </div>
  );
}
