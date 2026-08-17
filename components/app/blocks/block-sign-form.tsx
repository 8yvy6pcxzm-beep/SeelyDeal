"use client";

import { CheckCircle2, Loader2, PenLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Shared signing state/handlers a public-page block (Legal, ContractSignOff) needs
 *  to sign itself independently of the whole-proposal "Accept & Sign" flow. Name/
 *  email/OTP fields are the SAME ones the caller uses for the final proposal sign —
 *  one identity per visit, verified once, reused across every block + the final sign. */
export type BlockSignState = {
  signature: { signerName: string; signedAt: string } | null;
  signerName: string;
  onSignerNameChange: (v: string) => void;
  requiresOtp: boolean;
  otpEmail: string;
  onOtpEmailChange: (v: string) => void;
  otpSent: boolean;
  requestingOtp: boolean;
  onRequestOtp: () => void;
  otpCode: string;
  onOtpCodeChange: (v: string) => void;
  signing: boolean;
  onSign: () => void;
  error?: string | null;
};

export function BlockSignForm({ lang, state }: { lang: "tr" | "en"; state: BlockSignState }) {
  if (state.signature) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-[11px] text-success">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          {lang === "tr" ? "İmzalandı — " : "Signed — "}
          <span className="font-medium">{state.signature.signerName}</span>
          {" · "}
          {new Date(state.signature.signedAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-dashed border-border p-2">
      <Input
        value={state.signerName}
        onChange={(e) => state.onSignerNameChange(e.target.value)}
        placeholder={lang === "tr" ? "Ad Soyad" : "Full name"}
        className="h-8 text-[12px]"
      />
      {state.requiresOtp && (
        <div className="flex gap-1.5">
          <Input
            type="email"
            value={state.otpEmail}
            onChange={(e) => state.onOtpEmailChange(e.target.value)}
            placeholder={lang === "tr" ? "email@ornek.com" : "email@example.com"}
            disabled={state.otpSent}
            className="h-8 text-[12px]"
          />
          {!state.otpSent ? (
            <Button variant="outline" size="sm" onClick={state.onRequestOtp} disabled={state.requestingOtp} className="h-8 shrink-0 text-[11px]">
              {state.requestingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : lang === "tr" ? "Kod gönder" : "Send code"}
            </Button>
          ) : (
            <Input
              value={state.otpCode}
              onChange={(e) => state.onOtpCodeChange(e.target.value)}
              placeholder={lang === "tr" ? "6 haneli kod" : "6-digit code"}
              className="h-8 w-28 shrink-0 text-[12px]"
            />
          )}
        </div>
      )}
      <Button
        size="sm"
        onClick={state.onSign}
        disabled={state.signing || (state.requiresOtp && !state.otpSent)}
        className="h-8 w-full gap-1.5 text-[11.5px]"
      >
        {state.signing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
        {lang === "tr" ? "İmzala" : "Sign"}
      </Button>
      {state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
    </div>
  );
}

/** State/handlers for the authenticated "sign on behalf of the company" affordance
 *  the proposal editor shows on Legal/ContractSignOff blocks — a `signer_role:
 *  "company"` row in block_signatures, no OTP (the caller is already logged in).
 *  See app/api/proposals/[id]/blocks/[blockId]/company-sign/route.ts. */
export type CompanySignState = {
  signature: { signerName: string; signedAt: string } | null;
  signing: boolean;
  onSign: () => void;
  error?: string | null;
};

export function CompanySignBadge({ lang, state }: { lang: "tr" | "en"; state: CompanySignState }) {
  if (state.signature) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-[11px] text-success">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>
          {lang === "tr" ? "Şirket adına imzalandı — " : "Signed on behalf of the company — "}
          <span className="font-medium">{state.signature.signerName}</span>
          {" · "}
          {new Date(state.signature.signedAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <Button variant="outline" size="sm" onClick={state.onSign} disabled={state.signing} className="h-8 gap-1.5 text-[11.5px]">
        {state.signing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
        {lang === "tr" ? "Şirket Adına İmzala" : "Sign on Behalf of Company"}
      </Button>
      {state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
    </div>
  );
}
