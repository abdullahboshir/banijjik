import { useRouter } from "next/navigation";
import { announceSuccess } from "./announce-success";

/**
 * What follows a write that worked: the page reloads its data (the server components read the new state),
 * a toast confirms, and the sheet closes.
 */
export function useFinishAction(onClose: () => void): (successMessage: string) => Promise<void> {
  const router = useRouter();
  return async (successMessage) => {
    router.refresh();
    onClose();
    await announceSuccess(successMessage);
  };
}
