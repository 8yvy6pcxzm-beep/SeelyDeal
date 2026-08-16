"use client";

import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";

export default function PrivacyPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {lang === "tr" ? "Gizlilik Politikası ve KVKK Aydınlatma Metni" : "Privacy Policy"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "tr" ? "Son güncelleme: 16 Ağustos 2026" : "Last updated: August 16, 2026"}
      </p>

      <div className="prose prose-sm mt-8 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-muted-foreground">
        {lang === "tr" ? (
          <>
            <h2>1. Veri Sorumlusu</h2>
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, {appConfig.name} markası
              altında sunulan hizmetlere ilişkin kişisel verileriniz, veri sorumlusu sıfatıyla Ş.Ö. tarafından
              işlenmektedir. {appConfig.name} için şirket kuruluş süreci devam etmektedir; kuruluş tamamlandığında
              veri sorumlusu bilgileri ilgili tüzel kişilik unvanı ve ticaret sicil bilgileriyle güncellenecektir.
            </p>
            <p>
              Adres: Yeşilyurt / Bakırköy, İstanbul (kuruluş sonrası kesinleşecek tüzel kişilik adresi).
              <br />
              E-posta: {appConfig.contactEmail}
            </p>

            <h2>2. İşlenen Kişisel Veriler</h2>
            <p>
              <strong>Kimlik ve İletişim Bilgileri:</strong> ad-soyad, e-posta adresi, telefon numarası, şirket
              unvanı;
              <br />
              <strong>Müşteri İşlem Bilgileri:</strong> hazırladığınız tekliflerde yer verdiğiniz kendi
              müşterilerinize ait ad, e-posta, şirket bilgileri ve teklif/fiyatlandırma içerikleri;
              <br />
              <strong>İşlem Güvenliği Bilgileri:</strong> IP adresi, oturum açma kayıtları, log kayıtları,
              tarayıcı/cihaz bilgileri;
              <br />
              <strong>Finansal Bilgiler:</strong> abonelik planı, fatura bilgileri ve ödeme işlem kayıtları (kart
              bilgileriniz {appConfig.name} sunucularında saklanmaz, doğrudan ödeme altyapı sağlayıcımız tarafından
              işlenir);
              <br />
              <strong>Teklif ve Yapay Zekâ Taslak Verileri:</strong> Seely'e ilettiğiniz brief metinleri, yüklediğiniz
              dosyalar ve yapay zekâ ile üretilen teklif taslak içerikleri;
              <br />
              <strong>E-imza Verileri:</strong> imza, zaman damgası ve imza sürecine ait denetim izi (IP, cihaz
              bilgisi).
            </p>

            <h2>3. İşleme Amaçları ve Hukuki Sebepleri</h2>
            <p>
              Kişisel verileriniz; hesabınızın oluşturulması ve yönetimi ile aboneliğinizin yürütülmesi amacıyla
              <em> bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması</em>; ürün güvenliğinin sağlanması,
              hataların tespiti ve hizmet kalitesinin iyileştirilmesi amacıyla <em>veri sorumlusunun meşru
              menfaati</em>; yasal yükümlülüklerimizin (örn. fatura düzenleme) yerine getirilmesi amacıyla{" "}
              <em>kanunlarda açıkça öngörülmüş olması ve hukuki yükümlülüğün yerine getirilmesi</em> hukuki
              sebeplerine dayanılarak işlenmektedir. Tarafınıza ticari elektronik ileti (bülten, kampanya
              duyurusu vb.) gönderilmesi ise ayrıca verdiğiniz <em>açık rızaya</em> dayanmaktadır ve dilediğiniz
              zaman geri alınabilir.
            </p>

            <h2>4. Aktarılan Üçüncü Taraflar ve Yurt Dışı Aktarım</h2>
            <p>
              Hizmetin sunulabilmesi amacıyla kişisel verileriniz, sınırlı ve amaçla bağlantılı şekilde şu hizmet
              sağlayıcılarla paylaşılabilir: barındırma, kimlik doğrulama ve veritabanı hizmeti için Supabase;
              ödeme işlemlerinin yürütülmesi için Stripe; e-imza süreçlerinin yürütülmesi için Dropbox Sign; yapay
              zekâ destekli teklif taslağı üretimi için Anthropic. Bu hizmet sağlayıcıların sunucuları yurt
              dışında bulunabileceğinden, söz konusu aktarımlar KVKK'nın 9. maddesi kapsamında, yeterli korumayı
              sağlayan sözleşmesel güvencelerle ve gerektiğinde açık rızanıza dayanılarak gerçekleştirilir.
            </p>

            <h2>5. Kendi Müşterilerinize Ait Veriler Hakkında</h2>
            <p>
              {appConfig.name}'ı kullanırken kendi müşterilerinize ait kişisel verileri (ad, e-posta, şirket
              bilgisi, fiyatlandırma vb.) teklif içeriklerine eklemeniz halinde, bu veriler bakımından{" "}
              {appConfig.name} <em>veri işleyen</em>, siz ise <em>veri sorumlusu</em> konumundasınız. Bu kapsamda,
              kendi müşterilerinizi KVKK'nın 10. maddesi uyarınca aydınlatma ve gerekmesi halinde açık rızalarını
              alma yükümlülüğü tarafınıza aittir; {appConfig.name}'ın bu üçüncü kişilere karşı doğrudan bir
              sorumluluğu bulunmamaktadır.
            </p>

            <h2>6. Kişisel Veri Toplama Yöntemi</h2>
            <p>
              Kişisel verileriniz; kayıt formu, hesap ayarları, Seely sohbet arayüzü ve uygulama içi kullanım
              üzerinden, elektronik ortamda otomatik yollarla toplanmaktadır.
            </p>

            <h2>7. İlgili Kişinin Hakları (KVKK m.11)</h2>
            <p>
              KVKK'nın 11. maddesi kapsamında; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse
              buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
              yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini
              isteme, silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini
              isteme haklarına sahipsiniz. Bu taleplerinizi hesap ayarlarınızdan veya {appConfig.contactEmail}{" "}
              adresine e-posta göndererek {appConfig.name}'a iletebilirsiniz.
            </p>
          </>
        ) : (
          <>
            <h2>1. Data Controller</h2>
            <p>
              Under Turkish Law No. 6698 on the Protection of Personal Data ("KVKK"), personal data processed
              through services offered under the {appConfig.name} brand is processed by Ş.Ö. acting as data
              controller. Company incorporation for {appConfig.name} is in progress; once complete, the data
              controller details will be updated with the legal entity's name and trade registry information.
            </p>
            <p>
              Address: Yeşilyurt / Bakırköy, Istanbul, Türkiye (the legal entity's address, to be finalized after
              incorporation).
              <br />
              Email: {appConfig.contactEmail}
            </p>

            <h2>2. Data We Process</h2>
            <p>
              <strong>Identity and contact data:</strong> name, email address, phone number, company name;
              <br />
              <strong>Customer/transaction data:</strong> your own clients' name, email, company details, and
              pricing/proposal content that you include in proposals;
              <br />
              <strong>Security data:</strong> IP address, login records, log data, browser/device information;
              <br />
              <strong>Financial data:</strong> subscription plan, billing details, and payment records (your card
              details are never stored on {appConfig.name}'s servers — they are processed directly by our payment
              provider);
              <br />
              <strong>Proposal and AI draft data:</strong> briefs you send to Seely, files you upload, and AI-generated
              proposal draft content;
              <br />
              <strong>E-signature data:</strong> signature, timestamp, and audit trail (IP, device information) of
              the signing process.
            </p>

            <h2>3. Purpose of Processing and Legal Basis</h2>
            <p>
              We process your personal data for account creation and management and to operate your subscription,
              based on <em>the necessity for the performance of a contract</em>; for product security, bug
              detection, and service quality improvement, based on <em>our legitimate interest</em>; and to meet
              statutory obligations (e.g. invoicing), based on <em>explicit legal provision and compliance with a
              legal obligation</em>. Sending you marketing communications (newsletters, campaign updates) is based
              on your separate, revocable <em>explicit consent</em>.
            </p>

            <h2>4. Third Parties and Cross-Border Transfer</h2>
            <p>
              To provide the service, your data may be shared, on a limited and purpose-bound basis, with: Supabase
              (hosting, authentication, and database); Stripe (payment processing); Dropbox Sign (e-signature);
              and Anthropic (AI-assisted proposal drafting). As these providers' servers may be located outside
              Türkiye, such transfers are carried out under KVKK Article 9, relying on adequate contractual
              safeguards and, where required, your explicit consent.
            </p>

            <h2>5. About Your Own Clients' Data</h2>
            <p>
              If you add your own clients' personal data (name, email, company details, pricing, etc.) into
              proposals while using {appConfig.name}, {appConfig.name} acts as the <em>data processor</em> for
              that data, and you act as the <em>data controller</em>. You are responsible for informing your own
              clients under KVKK Article 10 and, where required, obtaining their explicit consent — {appConfig.name}{" "}
              bears no direct responsibility toward those third parties.
            </p>

            <h2>6. How We Collect Your Data</h2>
            <p>
              Your personal data is collected electronically, through automated means, via the signup form,
              account settings, the Seely chat interface, and general in-app usage.
            </p>

            <h2>7. Your Rights (KVKK Article 11)</h2>
            <p>
              Under Article 11 of KVKK, you have the right to learn whether your data is being processed, request
              information about it, learn its purpose and whether it's used accordingly, know the third parties
              to whom it's transferred domestically or abroad, request correction of incomplete or inaccurate
              data, request its deletion or destruction, and request that these actions be notified to third
              parties to whom your data was transferred. You can exercise these rights from your account settings
              or by emailing {appConfig.contactEmail}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
