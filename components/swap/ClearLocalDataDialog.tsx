"use client";

import { Eraser, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ClearLocalDataDialogProps {
  open: boolean;
  deleteCountdown: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const ClearLocalDataDialog: React.FC<ClearLocalDataDialogProps> = ({
  open,
  deleteCountdown,
  onOpenChange,
  onConfirm,
}) => {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5" />
            Clear all local data
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will delete all locally stored data, including your orders and wallet recovery phrase.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={deleteCountdown > 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4" />
            Delete all data{" "}
            {deleteCountdown > 0 ? `(${deleteCountdown}s)` : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ClearLocalDataDialog;


