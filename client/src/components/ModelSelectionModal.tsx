import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ModelSelectionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: string;
  selectedModel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isChanging: boolean;
}

export function ModelSelectionModal({
  isOpen,
  onOpenChange,
  currentModel,
  selectedModel,
  onConfirm,
  onCancel,
  isChanging
}: ModelSelectionModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch AI Model?</AlertDialogTitle>
          <AlertDialogDescription>
            You are switching from <strong>{currentModel}</strong> to <strong>{selectedModel}</strong>. 
            This will restart the application and apply the change immediately. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isChanging}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isChanging}>
            {isChanging ? "Applying..." : "Confirm & Restart"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}