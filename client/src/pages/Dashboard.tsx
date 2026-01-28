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

  const renderSeat = (label: string) => {
    const seat = seats?.find(s => s.label === label);
    if (!seat) return <div key={label} className="w-12 h-12 border-2 border-dashed border-border/20 rounded-lg flex items-center justify-center text-[10px] text-muted-foreground/30">{label}</div>;

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
            <div className="w-3 h-3 rounded-full bg-amber-500" /> Partial
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-200 border" /> Booked
          </div>
        </div>

        {/* Layout Container */}
        <div className="flex flex-col gap-16 min-w-max">
          {/* Top Row Clusters */}
          <div className="flex gap-20">
            {/* Cluster 1: 2x4 Horizontal Mix (T56-T53, T49-T52) */}
            <div className="grid grid-cols-4 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T56', 'T55', 'T54', 'T53', 'T49', 'T50', 'T51', 'T52'].map(renderSeat)}
            </div>

            {/* Cluster 2: 4x2 Vertical (T60-T57, T61-T64) */}
            <div className="grid grid-cols-2 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T60', 'T61', 'T59', 'T62', 'T58', 'T63', 'T57', 'T64'].map(renderSeat)}
            </div>

            {/* Cluster 3: 4x2 Vertical (T68-T65, T69-T72) */}
            <div className="grid grid-cols-2 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T68', 'T69', 'T67', 'T70', 'T66', 'T71', 'T65', 'T72'].map(renderSeat)}
            </div>

            {/* Cluster 4: 4x2 Vertical (T76-T73, T77-T80) */}
            <div className="grid grid-cols-2 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T76', 'T77', 'T75', 'T78', 'T74', 'T79', 'T73', 'T80'].map(renderSeat)}
            </div>
          </div>

          {/* Spacer Cluster row 1 to row 2 cluster */}
          <div className="flex gap-20">
            {/* Cluster 1 Bottom Row (T48-T45, T41-T44) */}
            <div className="grid grid-cols-4 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T48', 'T47', 'T46', 'T45', 'T41', 'T42', 'T43', 'T44'].map(renderSeat)}
            </div>
          </div>

          {/* Bottom Row Clusters */}
          <div className="flex gap-12 items-start">
            {/* S-Range (S4-S1) */}
            <div className="flex flex-col border-2 border-green-200 p-1 rounded-sm gap-px">
              {['S4', 'S3', 'S2', 'S1'].map(renderSeat)}
            </div>

            {/* T-Range (T8-T5, T9-T12) */}
            <div className="grid grid-cols-2 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T8', 'T9', 'T7', 'T10', 'T6', 'T11', 'T5', 'T12'].map(renderSeat)}
            </div>

            {/* T-Range (T16-T13, T17-T20) */}
            <div className="grid grid-cols-2 border-2 border-blue-200 p-1 rounded-sm gap-px">
              {['T16', 'T17', 'T15', 'T18', 'T14', 'T19', 'T13', 'T20'].map(renderSeat)}
            </div>

            {/* Horizontal T-Clusters */}
            <div className="flex flex-col gap-12">
              {/* Cluster (T40-T36, T31-T35) */}
              <div className="grid grid-cols-5 border-2 border-blue-200 p-1 rounded-sm gap-px">
                {['T40', 'T39', 'T38', 'T37', 'T36', 'T31', 'T32', 'T33', 'T34', 'T35'].map(renderSeat)}
              </div>
              {/* Cluster (T30-T26, T21-T25) */}
              <div className="grid grid-cols-5 border-2 border-blue-200 p-1 rounded-sm gap-px">
                {['T30', 'T29', 'T28', 'T27', 'T26', 'T21', 'T22', 'T23', 'T24', 'T25'].map(renderSeat)}
              </div>
            </div>
          </div>
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
