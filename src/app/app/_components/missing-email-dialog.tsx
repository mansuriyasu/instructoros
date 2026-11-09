import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Student } from "@/lib/types";
import { useStudents } from "@/hooks/use-students";

interface MissingEmailDialogProps {
  isOpen: boolean;
  student: Student | null;
  /** What the email is for, e.g. "payment receipt". */
  purpose: string;
  onCancel: () => void;
  onSuccess: (updatedStudent: Student) => void;
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function MissingEmailDialog({ isOpen, student, purpose, onCancel, onSuccess }: MissingEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const { updateStudent } = useStudents({ load: false });
  const trimmed = email.trim();

  const handleSave = async () => {
    if (!student) return;
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await updateStudent({ id: student.id, email: trimmed });
      onSuccess({ ...student, email: trimmed });
      setEmail("");
    } catch (saveError) {
      console.error("Failed to update student email:", saveError);
      setError("Could not save the email. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const close = () => {
    setEmail("");
    setError("");
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an email address</DialogTitle>
          <DialogDescription>
            {student?.name || "This student"} doesn&apos;t have an email saved, so the {purpose} can&apos;t be sent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Label htmlFor="missing-email">Email</Label>
          <Input
            id="missing-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={close}>
            Skip email
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !trimmed}>
            {isSaving ? "Saving..." : "Save & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
