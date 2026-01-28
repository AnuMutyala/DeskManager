import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Seat, InsertBooking } from "@shared/schema";
import { useBookings } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Clock, Armchair } from "lucide-react";
import { format } from "date-fns";

interface BookingModalProps {
  seat: Seat | null;
  date: Date;
  existingBookings: any[]; // Using derived type from hook would be cleaner but complex for now
  onClose: () => void;
}

export function BookingModal({ seat, date, existingBookings, onClose }: BookingModalProps) {
  const { createBooking } = useBookings();
  const { user } = useAuth();
  
  if (!seat || !user) return null;

  const dateStr = format(date, "yyyy-MM-dd");
  
  // Check availability
  const bookingsForSeat = existingBookings.filter(b => b.seatId === seat.id && b.date === dateStr);
  const isAmBooked = bookingsForSeat.some(b => b.slot === "AM" || b.slot === "FULL");
  const isPmBooked = bookingsForSeat.some(b => b.slot === "PM" || b.slot === "FULL");

  const handleBook = (slot: "AM" | "PM" | "FULL") => {
    const bookingData: InsertBooking = {
      seatId: seat.id,
      userId: user.id,
      date: dateStr,
      slot
    };
    
    createBooking.mutate(bookingData, {
      onSuccess: () => onClose()
    });
  };

  return (
    <Dialog open={!!seat} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-display">
            <Armchair className="w-6 h-6 text-primary" />
            Book Seat {seat.label}
          </DialogTitle>
          <DialogDescription>
            {format(date, "EEEE, MMMM do, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-secondary/50 p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{seat.type}</span>
            </div>
            {seat.tags && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(seat.tags as string[]).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-background text-xs rounded-md border text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <Button 
              variant="outline" 
              className="justify-between h-auto py-4 text-base"
              disabled={isAmBooked || createBooking.isPending}
              onClick={() => handleBook("AM")}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Morning (08:00 - 13:00)
              </span>
              {isAmBooked ? (
                <span className="text-xs font-semibold text-destructive uppercase">Booked</span>
              ) : (
                <span className="text-xs font-semibold text-green-600 uppercase">Available</span>
              )}
            </Button>

            <Button 
              variant="outline" 
              className="justify-between h-auto py-4 text-base"
              disabled={isPmBooked || createBooking.isPending}
              onClick={() => handleBook("PM")}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Afternoon (13:00 - 18:00)
              </span>
              {isPmBooked ? (
                <span className="text-xs font-semibold text-destructive uppercase">Booked</span>
              ) : (
                <span className="text-xs font-semibold text-green-600 uppercase">Available</span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
