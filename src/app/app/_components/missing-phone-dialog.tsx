import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Student } from "@/lib/types";
import { useStudents } from "@/hooks/use-students";

interface MissingPhoneDialogProps {
  isOpen: boolean;
  student: Student | null;
  onCancel: () => void;
  onSuccess: (updatedStudent: Student) => void;
}

export function MissingPhoneDialog({ isOpen, student, onCancel, onSuccess }: MissingPhoneDialogProps) {
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { updateStudent } = useStudents();

  const handleSave = async () => {
    if (!student || !phone.trim()) return;
    
    setIsSaving(true);
    try {
      await updateStudent({ id: student.id, mobileNumber: phone.trim() });
      onSuccess({ ...student, mobileNumber: phone.trim() });
      setPhone(""); // reset for next time
    } catch (error) {
      console.error("Failed to update student phone number:", error);
      alert("Failed to save phone number. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setPhone("");
        onCancel();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Missing Phone Number</DialogTitle>
          <DialogDescription>
            You opted to open WhatsApp, but {student?.name || "this student"} doesn't have a phone number saved.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Skip WhatsApp
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !phone.trim()}>
            {isSaving ? "Saving..." : "Save & Open WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
