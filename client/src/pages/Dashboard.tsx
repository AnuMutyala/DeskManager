import { useState } from "react";
import { useSeats } from "@/hooks/use-seats";
import { useBookings } from "@/hooks/use-bookings";
import { BookingModal } from "@/components/BookingModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Seat } from "@shared/schema";

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
    if (seatBookings.length === 0) return "available";
    if (seatBookings.some(b => b.slot === "FULL")) return "booked";
    if (seatBookings.length === 2) return "booked"; // Both AM and PM
    return "partial";
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
          <Button variant="ghost" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium">
            <CalendarIcon className="w-4 h-4 text-primary" />
            {format(selectedDate, "EEE, MMM do")}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextDay}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Floor Plan Visualization */}
      <Card className="p-8 min-h-[600px] relative overflow-hidden bg-secondary/20 border-border/50">
        <div className="absolute top-4 right-4 flex gap-4 text-xs font-medium bg-card p-3 rounded-lg border shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" /> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" /> Partial
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-200 border" /> Booked
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-100 pattern-diagonal-lines" /> Blocked
          </div>
        </div>

        {/* Floor Plan Image Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ 
               backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', 
               backgroundSize: '20px 20px' 
             }} 
        />
        
        {/* Simple Grid Layout for Seats (Demo) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 relative z-0">
          {seats?.map(seat => {
            const status = getSeatStatus(seat.id);
            const isBlocked = seat.isBlocked;
            
            return (
              <button
                key={seat.id}
                disabled={isBlocked || status === 'booked'}
                onClick={() => setSelectedSeat(seat)}
                className={`
                  group relative aspect-square rounded-2xl border-2 transition-all duration-300
                  flex flex-col items-center justify-center gap-2
                  ${isBlocked 
                    ? 'bg-red-50 border-red-100 opacity-60 cursor-not-allowed' 
                    : status === 'booked'
                    ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                    : status === 'partial'
                    ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-lg hover:-translate-y-1'
                    : 'bg-white border-green-200 hover:border-green-400 hover:shadow-lg hover:-translate-y-1'
                  }
                `}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${status === 'available' ? 'bg-green-100 text-green-700' : 
                    status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}
                `}>
                  {seat.label}
                </div>
                <div className="text-xs text-muted-foreground capitalize font-medium">{seat.type}</div>
                
                {/* Visual Indicator of Desk */}
                <div className="w-12 h-1 bg-current opacity-20 rounded-full mt-2" />
              </button>
            );
          })}
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
