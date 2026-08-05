"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** The real content library lives inside /team — mirrored here so the demo sidebar link goes somewhere instead of dead-ending, same as the real app's redirect. */
export default function DemoContentLibraryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/demo/team");
  }, [router]);

  return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
