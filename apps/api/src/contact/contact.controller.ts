import { Body, Controller, Post, BadRequestException, Logger } from "@nestjs/common";
import { z } from "zod";
import { Public } from "../tenant/public.decorator.js";
import { MailerService } from "../mail/mailer.service.js";

const ContactSchema = z.object({
  nom: z.string().trim().min(1, "Votre nom est obligatoire.").max(120),
  email: z.string().email("Email invalide."),
  societe: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10, "Détaillez un peu votre demande.").max(4000),
  // Champ piège : invisible pour un humain, souvent rempli par les robots.
  // Volontairement accepté par le schéma — le rejeter ici renverrait une 400,
  // et un robot qui reçoit une erreur réessaie. Le tri se fait plus bas, en
  // répondant 200 sans rien envoyer : le robot croit avoir réussi et passe
  // au suivant.
  siteWeb: z.string().optional(),
});

/** Échappe le HTML : le contenu vient d'un formulaire public. */
function echapper(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

@Controller("contact")
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly mailer: MailerService) {}

  @Public()
  @Post()
  async envoyer(@Body() body: unknown) {
    const parsed = ContactSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { nom, email, societe, message, siteWeb } = parsed.data;

    if (siteWeb) {
      this.logger.warn(`Message de contact rejeté (champ piège rempli) — ${email}`);
      return { ok: true };
    }

    const destinataire = process.env.CONTACT_TO_EMAIL;
    if (!destinataire) {
      this.logger.error("CONTACT_TO_EMAIL absent — message de contact perdu.");
      throw new BadRequestException("Le formulaire de contact n'est pas configuré.");
    }

    await this.mailer.send({
      to: destinataire,
      // replyTo sur l'adresse du prospect : répondre depuis sa boîte mail
      // suffit, sans avoir à recopier l'adresse.
      replyTo: email,
      subject: `Contact RecruitAI — ${nom}${societe ? ` (${societe})` : ""}`,
      html: this.mailer.gabarit(
        "Nouveau message depuis le site",
        `<p><strong>${echapper(nom)}</strong>${societe ? ` — ${echapper(societe)}` : ""}<br />
          <a href="mailto:${echapper(email)}">${echapper(email)}</a></p>
         <p style="white-space:pre-line;border-left:3px solid #E7E1D5;padding-left:12px">${echapper(message)}</p>`,
      ),
    });

    this.logger.log(`Message de contact reçu de ${email}.`);
    return { ok: true };
  }
}
