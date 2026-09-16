import { Toaster } from "sonner";

import { useTheme } from "@/lib/theme";

export function ThemedToaster() {
  return (
    <Toaster
      theme={useTheme()}
      position="bottom-right"
      expand
      toastOptions={{ unstyled: true, className: "flex justify-end" }}
    />
  );
}
