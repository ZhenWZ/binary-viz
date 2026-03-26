import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>
          <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
        </div>
        <Button onClick={() => setLocation("/")} variant="outline" className="gap-2">
          <Home className="w-4 h-4" />
          Go Home
        </Button>
      </div>
    </div>
  );
}
