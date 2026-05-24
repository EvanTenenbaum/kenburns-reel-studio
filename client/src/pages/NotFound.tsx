import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-6">
        <div className="flex size-20 items-center justify-center rounded-2xl border border-border bg-card">
          <Compass className="size-9 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-5xl font-bold tracking-tight">404</h1>
          <h2 className="font-display text-xl font-semibold">Page not found</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sorry, the page you are looking for doesn&apos;t exist. It may have
            been moved or deleted.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={handleGoHome}
          className="h-12 w-full gap-2 transition-transform active:scale-[0.97]"
        >
          <Home className="size-5" />
          Go Home
        </Button>
      </div>
    </div>
  );
}
