import { useState } from "react";
import { useSeats } from "@/hooks/use-seats";
import { useBookings } from "@/hooks/use-bookings";
import { BookingModal } from "@/components/BookingModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Seat } from "@shared/schema";

const CELL_SIZE = 50; // pixels for dashboard view
const GRID_COLS = 20;
const GRID_ROWS = 15;

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

  return (
    <div className="p-8 max-w-full mx-auto space-y-8 animate-in">
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
      <Card className="p-8 min-h-[600px] relative overflow-auto bg-secondary/20 border-border/50">
        <div className="absolute top-4 right-4 flex gap-4 text-xs font-medium bg-card p-3 rounded-lg border shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" /> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" /> Partial
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-300 border" /> Booked
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-200" /> Blocked
          </div>
        </div>

        {/* Grid-based Layout */}
        <div
          className="relative mx-auto"
          style={{
            width: `${GRID_COLS * CELL_SIZE}px`,
            height: `${GRID_ROWS * CELL_SIZE}px`,
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        >
          {seats?.map(seat => {
            const { status, am, pm } = getSeatStatus(seat.id);
            const isBlocked = seat.isBlocked;
            const x = seat.gridX ?? 0;
            const y = seat.gridY ?? 0;
            const width = seat.gridWidth ?? 2;
            const height = seat.gridHeight ?? 2;

            return (
              <button
                key={seat.id}
                disabled={isBlocked || status === 'booked'}
                onClick={() => setSelectedSeat(seat)}
                className={`
                  group absolute rounded-xl border-2 transition-all duration-300
                  flex flex-col items-center justify-center gap-2 p-2
                  ${isBlocked
                    ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed'
                    : status === 'booked'
                      ? 'bg-slate-100 border-slate-300 cursor-not-allowed'
                      : status === 'partial'
                        ? 'bg-amber-50 border-amber-300 hover:border-amber-500 hover:shadow-lg hover:-translate-y-1'
                        : 'bg-white border-green-300 hover:border-green-500 hover:shadow-xl hover:-translate-y-1'
                  }
                `}
                style={{
                  left: x * CELL_SIZE + 2,
                  top: y * CELL_SIZE + 2,
                  width: width * CELL_SIZE - 4,
                  height: height * CELL_SIZE - 4,
                }}
              >
                <div className={`
                  rounded-full flex items-center justify-center text-sm font-bold px-3 py-1
                  ${status === 'available' ? 'bg-green-100 text-green-700' :
                    status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}
                `}>
                  {seat.label}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-[11px] text-muted-foreground capitalize font-medium">{seat.type}</div>
                  {status !== 'available' && !isBlocked && (
                    <div className="flex gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${am ? 'bg-rose-500 text-white border-rose-600' : 'bg-green-100 text-green-700 border-green-200'}`}>
                        AM {am ? '✗' : '✓'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${pm ? 'bg-rose-500 text-white border-rose-600' : 'bg-green-100 text-green-700 border-green-200'}`}>
                        PM {pm ? '✗' : '✓'}
                      </span>
                    </div>
                  )}
                  {status === 'available' && !isBlocked && (
                    <div className="text-[10px] text-green-600 font-semibold">Click to book</div>
                  )}
                </div>

                {/* Visual desk representation */}
                <div className="absolute inset-2 border-2 border-current opacity-10 rounded-lg pointer-events-none" />
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
