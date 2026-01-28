import { BookingModal } from "@/components/BookingModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBookings } from "@/hooks/use-bookings";
import { useSeats } from "@/hooks/use-seats";
import { Seat } from "@shared/schema";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { seats, isLoading: seatsLoading } = useSeats();

  const { bookings, isLoading: bookingsLoading } = useBookings({ date: dateStr });

  if (seatsLoading || bookingsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const handlePrevDay = () => setSelectedDate(curr => addDays(curr, -1));
  const handleNextDay = () => setSelectedDate(curr => addDays(curr, 1));

  // Determine seat status
  const getSeatStatus = (seatId: number) => {
    const seatBookings = bookings?.filter(b => b.seatId === seatId) || [];
    if (seatBookings.length === 0) return { status: "available", am: false, pm: false };

    const hasAM = seatBookings.some(b => b.slot === "AM" || b.slot === "FULL");
    const hasPM = seatBookings.some(b => b.slot === "PM" || b.slot === "FULL");
    const isFull = hasAM && hasPM;

    return {
      status: isFull ? "booked" : "partial",
      am: hasAM,
      pm: hasPM
    };
  };

  const renderSeatButton = (seat: Seat) => {
    const { status, am, pm } = getSeatStatus(seat.id);
    const isBlocked = seat.isBlocked;

    return (
      <button
        key={seat.id}
        disabled={isBlocked || status === 'booked'}
        onClick={() => setSelectedSeat(seat)}
        data-testid={`button-seat-${seat.label}`}
        className={`
          group relative w-12 h-12 rounded-lg border-2 transition-all duration-300
          flex flex-col items-center justify-center
          ${isBlocked
            ? 'bg-red-50 border-red-100 opacity-60 cursor-not-allowed'
            : status === 'booked'
              ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
              : status === 'partial'
                ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5'
                : 'bg-white border-green-200 hover:border-green-400 hover:shadow-md hover:-translate-y-0.5'
          }
        `}
      >
        <span className="text-[10px] font-bold">{seat.label}</span>
        {status !== 'available' && !isBlocked && (
          <div className="flex gap-0.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${am ? 'bg-amber-500' : 'bg-slate-200'}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${pm ? 'bg-amber-500' : 'bg-slate-200'}`} />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header & Date Selection */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold font-display text-foreground">Office Floor Plan</h1>
          <p className="text-muted-foreground mt-1">Select a seat to book it for the day.</p>
        </div>

        <div className="flex items-center gap-4 bg-card p-2 rounded-xl border border-border/50 shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePrevDay} data-testid="button-prev-day">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium" data-testid="text-selected-date">
            <CalendarIcon className="w-4 h-4 text-primary" />
            {format(selectedDate, "EEE, MMM do")}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextDay} data-testid="button-next-day">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Floor Plan Visualization */}
      <Card className="p-12 min-h-[700px] relative overflow-auto bg-white border-border/50">
			 <div className="absolute top-4 right-4 flex gap-4 text-xs font-medium bg-card p-3 rounded-lg border shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" /> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" /> Half Day available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-200 border" /> Booked
          </div>
        </div>
        <div className="relative min-h-[700px] min-w-[900px]">
            {(seats || []).map((seat) => (
              <div
                key={seat.id}
                className="absolute"
                style={{ left: seat.x ?? 0, top: seat.y ?? 0 }}
              >
                {renderSeatButton(seat)}
              </div>
            ))}
          </div>
      </Card>

      <BookingModal
        seat={selectedSeat}
        date={selectedDate}
        existingBookings={bookings || []}
        onClose={() => setSelectedSeat(null)}
      />
    </div>
  );
}
