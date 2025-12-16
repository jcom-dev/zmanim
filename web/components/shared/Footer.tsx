import Link from 'next/link';

interface FooterProps {
  showDisclaimer?: boolean;
  showBecomePublisher?: boolean;
}

export function Footer({ showDisclaimer = false, showBecomePublisher = false }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="container mx-auto px-4 py-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Shtetl Zmanim - Multi-Publisher Prayer Times Platform
        </p>

        {showDisclaimer && (
          <p className="text-xs text-muted-foreground">
            Times are calculated based on astronomical and halachic methods.
            Consult your local rabbi for practical guidance.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Built using{' '}
          <a
            href="https://github.com/KosherJava/zmanim"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            KosherJava Zmanim
          </a>
          {' '}&{' '}
          <a
            href="https://github.com/hebcal/hebcal-go"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Hebcal
          </a>
        </p>

        {showBecomePublisher && (
          <div className="mt-2">
            <Link
              href="/register"
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Become a Publisher
            </Link>
          </div>
        )}
      </div>
    </footer>
  );
}
