import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

/**
 * Privacy Policy (GDPR / Austrian data protection law). Presented in English;
 * the underlying legal references remain the applicable GDPR/DSG ones.
 */
export default function DatenschutzPage() {
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Back to home">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <motion.article
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-prose px-4 py-12 sm:py-16"
        >
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Information on the processing of personal data under the General Data Protection Regulation
            (GDPR) and the Austrian Data Protection Act (DSG).
          </p>

          <section className="mt-10 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">1. Controller</h2>
            <p className="leading-relaxed text-muted-foreground">
              The controller responsible for data processing within the meaning of Art 4(7) GDPR is:
            </p>
            <address className="not-italic leading-relaxed">
              <span className="font-medium text-foreground">Leon Erwin Huber</span>
              <br />
              Franz Peyerl Strasse 16a
              <br />
              5082 Groedig
              <br />
              Austria
              <br />
              Email:{" "}
              <a
                href="mailto:support.uski@huberleon.com"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                support.uski@huberleon.com
              </a>
            </address>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">2. What data we process</h2>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
              <li>
                <span className="font-medium text-foreground">Email address</span> for passwordless
                login via one-time code (OTP) and for contacting you.
              </li>
              <li>
                <span className="font-medium text-foreground">Data from social login providers</span>{" "}
                (Google, GitHub, Discord) if you sign in via one of these services. Typically your email
                address and a provider identifier are transmitted.
              </li>
              <li>
                <span className="font-medium text-foreground">Content data</span> such as the
                flashcards, decks, and learning progress you create.
              </li>
              <li>
                <span className="font-medium text-foreground">Technical data</span> such as server logs,
                IP address, and timestamps that arise in order to provide and secure the service.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">3. Purpose and legal basis</h2>
            <p className="leading-relaxed text-muted-foreground">
              Processing takes place for the following purposes on the basis of Art 6 GDPR:
            </p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
              <li>
                Providing the user account and learning features, and performing the contract
                (Art 6(1)(b) GDPR).
              </li>
              <li>
                Authentication and ensuring stable, secure operation on the basis of our legitimate
                interest (Art 6(1)(f) GDPR).
              </li>
              <li>
                Compliance with legal obligations, where applicable (Art 6(1)(c) GDPR).
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">4. Retention period</h2>
            <p className="leading-relaxed text-muted-foreground">
              Personal data is stored only for as long as necessary for the stated purposes or as
              required by statutory retention obligations. Account and content data are processed until
              your account is deleted. After deletion of the account, the associated data is removed
              unless a statutory retention obligation applies. Technical logs are kept only for a short
              period.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">5. Processors and recipients</h2>
            <p className="leading-relaxed text-muted-foreground">
              To provide the service we use carefully selected providers with whom data processing
              agreements pursuant to Art 28 GDPR are in place:
            </p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
              <li>
                <span className="font-medium text-foreground">Supabase</span> as the provider for
                database, authentication, and storage.
              </li>
              <li>
                <span className="font-medium text-foreground">Resend</span> for sending transactional
                emails (in particular login codes).
              </li>
            </ul>
            <p className="leading-relaxed text-muted-foreground">
              Where data is transferred to third countries, this is done on the basis of appropriate
              safeguards within the meaning of Art 44 et seq. GDPR (such as standard contractual
              clauses).
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">6. Cookies and local storage</h2>
            <p className="leading-relaxed text-muted-foreground">
              USki uses exclusively technically necessary local storage. Only the following information
              is stored in your browser's local storage:
            </p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
              <li>Your session token, to keep you logged in.</li>
              <li>Your chosen appearance (e.g. light or dark mode).</li>
              <li>The status of your acknowledgement of the cookie notice.</li>
            </ul>
            <p className="leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">No</span> tracking, analytics, or marketing
              cookies and no third-party advertising cookies are used. As only technically necessary
              storage is used, no separate consent is required; the notice is for your information.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">7. Your rights</h2>
            <p className="leading-relaxed text-muted-foreground">
              Under the GDPR you have the following rights regarding your personal data:
            </p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
              <li>Right of access (Art 15 GDPR)</li>
              <li>Right to rectification (Art 16 GDPR)</li>
              <li>Right to erasure (Art 17 GDPR)</li>
              <li>Right to restriction of processing (Art 18 GDPR)</li>
              <li>Right to data portability (Art 20 GDPR)</li>
              <li>Right to object (Art 21 GDPR)</li>
            </ul>
            <p className="leading-relaxed text-muted-foreground">
              To exercise your rights, a message to{" "}
              <a
                href="mailto:support.uski@huberleon.com"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                support.uski@huberleon.com
              </a>{" "}
              is sufficient.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">8. Right to lodge a complaint</h2>
            <p className="leading-relaxed text-muted-foreground">
              If you believe that the processing of your data violates data protection law, you may lodge
              a complaint with the Austrian Data Protection Authority (DSB):
            </p>
            <address className="not-italic leading-relaxed text-muted-foreground">
              Austrian Data Protection Authority (Datenschutzbehoerde)
              <br />
              Barichgasse 40-42, 1030 Vienna
              <br />
              Web:{" "}
              <a
                href="https://www.dsb.gv.at"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                www.dsb.gv.at
              </a>
            </address>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">9. Contact for privacy matters</h2>
            <p className="leading-relaxed text-muted-foreground">
              For questions about data protection or to exercise your rights, you can reach us at{" "}
              <a
                href="mailto:support.uski@huberleon.com"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                support.uski@huberleon.com
              </a>
              . Further details about the operator can be found in the{" "}
              <Link
                to="/legal"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Legal Notice
              </Link>
              .
            </p>
          </section>
        </motion.article>
      </main>
    </div>
  );
}
