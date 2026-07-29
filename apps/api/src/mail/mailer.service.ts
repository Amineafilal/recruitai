import { Injectable, Logger } from "@nestjs/common";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Envoi d'emails via Resend, pour tout ce que l'API expédie : relances de
 * campagne ET emails transactionnels (réinitialisation de mot de passe,
 * invitation d'un collègue).
 *
 * En développement, si RESEND_API_KEY est absent, on n'échoue pas : le
 * contenu est journalisé. Sans ça, tester le parcours « mot de passe oublié »
 * en local imposerait une clé API, et un lien de réinitialisation non
 * délivrable bloquerait complètement le test.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  private expediteur(): string {
    return process.env.OUTREACH_FROM_EMAIL ?? "RecruitAI <onboarding@resend.dev>";
  }

  /** URL publique de l'app, utilisée pour construire les liens des emails. */
  appUrl(): string {
    return (process.env.PUBLIC_APP_URL ?? "http://localhost:3002").replace(/\/$/, "");
  }

  async send(input: SendEmailInput): Promise<{ providerMessageId: string | null }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(`RESEND_API_KEY absent — email non envoyé à ${input.to}. Sujet: ${input.subject}`);
      this.logger.debug(input.html);
      return { providerMessageId: null };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: input.from ?? this.expediteur(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        reply_to: input.replyTo,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend send failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { id: string };
    return { providerMessageId: body.id };
  }

  /**
   * Gabarit commun aux emails transactionnels : même identité visuelle que
   * l'app (crème + corail) pour que le message ne soit pas pris pour du
   * phishing par le destinataire.
   */
  gabarit(titre: string, corps: string, cta?: { libelle: string; url: string }): string {
    const bouton = cta
      ? `<p style="margin:28px 0"><a href="${cta.url}" style="display:inline-block;background:#FB6D4C;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${cta.libelle}</a></p>
         <p style="font-size:13px;color:#9A9CB0;margin:0">Si le bouton ne fonctionne pas, copiez ce lien&nbsp;:<br /><span style="color:#5A5C72;word-break:break-all">${cta.url}</span></p>`
      : "";

    return `<div style="background:#F6F2EB;padding:32px 16px;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #E7E1D5;border-radius:16px;padding:32px">
    <div style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;background:#FB6D4C;color:#fff;font-weight:800;border-radius:10px;font-size:16px">R</div>
    <h1 style="font-size:20px;color:#20223D;margin:20px 0 12px">${titre}</h1>
    <div style="font-size:15px;line-height:1.6;color:#5A5C72">${corps}</div>
    ${bouton}
  </div>
  <p style="text-align:center;font-size:12px;color:#9A9CB0;margin-top:20px">RecruitAI — sourcing et réactivation CVthèque</p>
</div>`;
  }
}
