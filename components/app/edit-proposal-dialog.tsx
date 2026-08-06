"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";

type BillingOption = { key: string; label: { tr: string; en: string }; price: number; paymentLink?: string };
type LineItem = { name: string; qty: number; unit: number; optional?: boolean; included?: boolean };

export function EditProposalDialog({
  proposalId,
  onClose,
  onSaved,
}: {
  proposalId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [billingOptions, setBillingOptions] = useState<BillingOption[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!proposalId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/proposals/${proposalId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setPaymentLink(data.proposal.payment_link ?? "");
        setBillingOptions(data.proposal.billing_options ?? []);
        setLineItems(data.proposal.line_items ?? []);
      })
      .catch(() => setError(lang === "tr" ? "Teklif yüklenemedi." : "Couldn't load the proposal."))
      .finally(() => setLoading(false));
  }, [proposalId, lang]);

  if (!proposalId || !mounted) return null;

  function addBillingOption(key: string, trLabel: string, enLabel: string) {
    if (billingOptions.some((o) => o.key === key)) return;
    setBillingOptions((opts) => [...opts, { key, label: { tr: trLabel, en: enLabel }, price: 0 }]);
  }

  function updatePrice(key: string, price: number) {
    setBillingOptions((opts) => opts.map((o) => (o.key === key ? { ...o, price } : o)));
  }

  function updateOptionPaymentLink(key: string, paymentLink: string) {
    setBillingOptions((opts) => opts.map((o) => (o.key === key ? { ...o, paymentLink } : o)));
  }

  function removeOption(key: string) {
    setBillingOptions((opts) => opts.filter((o) => o.key !== key));
  }

  function toggleItemOptional(i: number) {
    setLineItems((items) => items.map((it, idx) => (idx === i ? { ...it, optional: !it.optional, included: it.optional ? undefined : it.included ?? false } : it)));
  }

  function toggleItemIncludedByDefault(i: number) {
    setLineItems((items) => items.map((it, idx) => (idx === i ? { ...it, included: !it.included } : it)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentLink, billingOptions, lineItems }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || (lang === "tr" ? "Kaydedilemedi." : "Couldn't save."));
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-semibold">{lang === "tr" ? "Teklifi düzenle" : "Edit proposal"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {lineItems.length > 0 && (
                <div className="space-y-2">
                  <Label>{lang === "tr" ? "Kalemler — ekle/çıkar" : "Line items — add/remove"}</Label>
                  {lineItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                      <span className="flex-1 truncate text-sm">{it.name}</span>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" checked={!!it.optional} onChange={() => toggleItemOptional(i)} />
                        {lang === "tr" ? "Opsiyonel" : "Optional"}
                      </label>
                      {it.optional && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input type="checkbox" checked={!!it.included} onChange={() => toggleItemIncludedByDefault(i)} />
                          {lang === "tr" ? "Varsayılan işaretli" : "Included by default"}
                        </label>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    {lang === "tr"
                      ? "Opsiyonel işaretlenen kalemleri müşteri teklifi görüntülerken açıp kapatabilir."
                      : "The client can toggle optional items on or off while viewing the proposal."}
                  </p>
                </div>
              )}

              {billingOptions.length === 0 && (
                <div className="space-y-1.5">
                  <Label>{lang === "tr" ? "Ödeme linki" : "Payment link"}</Label>
                  <Input
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    placeholder={lang === "tr" ? "Ödeme linki (Ruul, Stripe, iyzico) ya da IBAN" : "Payment link (Ruul, Stripe, iyzico) or IBAN"}
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{lang === "tr" ? "Aylık / Yıllık seçenekleri" : "Monthly / Annual options"}</Label>
                  {billingOptions.length === 0 && (
                    <button
                      onClick={() => {
                        addBillingOption("monthly", "Aylık", "Monthly");
                        addBillingOption("annual", "Yıllık", "Annual");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      {lang === "tr" ? "Ekle" : "Add"}
                    </button>
                  )}
                </div>
                {billingOptions.map((o) => (
                  <div key={o.key} className="space-y-1.5 rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-sm font-medium">{lang === "tr" ? o.label.tr : o.label.en}</span>
                      <Input
                        type="number"
                        value={o.price}
                        onChange={(e) => updatePrice(o.key, Number(e.target.value) || 0)}
                        className="flex-1"
                        placeholder="$"
                      />
                      <Button variant="outline" size="icon" onClick={() => removeOption(o.key)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={o.paymentLink ?? ""}
                      onChange={(e) => updateOptionPaymentLink(o.key, e.target.value)}
                      placeholder={
                        lang === "tr"
                          ? `${o.label.tr} için ödeme linki`
                          : `Payment link for ${o.label.en}`
                      }
                      className="text-sm"
                    />
                  </div>
                ))}
                {billingOptions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {lang === "tr"
                      ? "Müşteri hangi seçeneği seçip imzalarsa, o seçeneğin linkine yönlendirilir."
                      : "Whichever option the client picks and signs, they're redirected to that option's link."}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>

        <div className="border-t border-border p-4">
          <Button onClick={save} disabled={loading || saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {lang === "tr" ? "Kaydet" : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
