import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

/**
 * Legal Notice / disclosure under Austrian law (ECG, Media Act). Presented in
 * English; the underlying legal references remain the applicable Austrian ones.
 */
export default function ImpressumPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Legal Notice</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Disclosure pursuant to § 5 of the Austrian E-Commerce Act (ECG) and § 25 of the Austrian
            Media Act.
          </p>

          <section className="mt-10 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Service provider / media owner</h2>
            <p className="leading-relaxed text-muted-foreground">
              The party responsible for operating the USki application is:
            </p>
            <address className="not-italic leading-relaxed">
              <span className="font-medium text-foreground">Leon Erwin Huber</span>
              <br />
              Franz Peyerl Strasse 16a
              <br />
              5082 Groedig
              <br />
              Austria
            </address>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Contact</h2>
            <p className="leading-relaxed text-muted-foreground">
              Email:{" "}
              <a
                href="mailto:support.uski@huberleon.com"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                support.uski@huberleon.com
              </a>
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Purpose of the service</h2>
            <p className="leading-relaxed text-muted-foreground">
              Providing a web and app application for creating, managing, and studying digital
              flashcards (decks), together with related features for learning with spaced-repetition
              systems.
            </p>
          </section>

          <hr className="my-10 border-border/60" />

          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Disclaimer</h2>
            <p className="leading-relaxed text-muted-foreground">
              The following provisions apply to the fullest extent permitted by law. Liability is
              excluded only to the extent that such exclusion can be validly agreed under mandatory law
              (in particular, liability for intent and gross negligence, and for injury to life, body,
              or health, cannot be excluded).
            </p>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">Liability for content</h3>
              <p className="leading-relaxed text-muted-foreground">
                The contents of this application were created with the greatest possible care. However,
                no guarantee is given for the accuracy, completeness, or timeliness of the content
                provided. As a service provider, we are responsible for our own content under general
                law, but are not obliged to monitor transmitted or stored third-party information.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">Liability for links (external links)</h3>
              <p className="leading-relaxed text-muted-foreground">
                This application may contain references (links) to external third-party websites over
                whose content we have no control. No guarantee is given for such third-party content.
                The respective provider or operator of the linked pages is always responsible for their
                content. Should we become aware of any legal violations, such links will be removed
                without delay.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">Copyright</h3>
              <p className="leading-relaxed text-muted-foreground">
                The content and works created by the operator are subject to Austrian copyright law.
                Reproduction, editing, distribution, and any kind of use beyond the limits of copyright
                law require the written consent of the operator. Content created by users remains the
                property of the respective authors.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">
                Liability for use of the application and user-generated content
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                Flashcards, decks, and other content created by users are produced at their own
                responsibility. The operator assumes no responsibility for the accuracy, suitability,
                or lawfulness of such user-generated content. Use of the application and of the learning
                content created with it is at your own risk.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">
                No warranty of availability or freedom from errors
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                No warranty is given for the constant availability, uninterrupted operation, or
                error-free functioning of the application. Maintenance work, technical faults, or
                circumstances beyond our control may lead to temporary restrictions or outages.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">Liability for data loss</h3>
              <p className="leading-relaxed text-muted-foreground">
                To the extent permitted by law, any liability for the loss, damage, or unavailability of
                data is excluded. Users are advised to back up important content themselves. Any further
                liability exists only within the scope of mandatory statutory provisions.
              </p>
            </div>

            <p className="leading-relaxed text-muted-foreground">
              Information on the processing of personal data can be found in our{" "}
              <Link
                to="/privacy"
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </motion.article>
      </main>
    </div>
  );
}
