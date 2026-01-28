import Header from "@/components/ui/header";
import { Card, CardContent } from "@/components/ui/card";

export default function ACPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="mt-6 border border-blue-100/30 dark:border-blue-500/20 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-lg font-semibold">AC Token Release</h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                The Agoracash token is officially released. Each AC token
                represents 1% ownership. Holding more than 50 tokens grants
                full ownership of the domain.
              </p>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                The WS server code is currently not open-sourced.
              </p>
              <div className="mt-5">
                <a
                  className="text-sm text-blue-500 hover:text-blue-600 hover:underline"
                  href="https://cashtab.com/#/token/a532bb3eae19cb4a8548101edf6ffda32f5b0b7dce7037a6b5393ba1a67179df"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buy on Cashtab
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

