import { BookingModal } from "@/components/BookingModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBookings } from "@/hooks/use-bookings";
import { useSeats } from "@/hooks/use-seats";
import { Seat, SeatType } from "@shared/schema";
import { addDays, format, startOfDay, isBefore, isAfter, differenceInCalendarDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/popover";
import { Calendar } from "@/components/calendar";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { seats, isLoading: seatsLoading } = useSeats();

  const { bookings, isLoading: bookingsLoading } = useBookings({ date: dateStr });

  const [availabilityMap, setAvailabilityMap] = useState<Record<string, { am: boolean; pm: boolean }>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Helper to check if a seat is blocked on a specific date
  const isSeatBlockedOnDate = (seat: Seat, dateString: string): boolean => {
    if (seat.blockStartDate && seat.blockEndDate) {
      return dateString >= seat.blockStartDate && dateString <= seat.blockEndDate;
    }
    return seat.isBlocked || false;
  };

  // Fetch workspace-level availability for a range starting at `start` but clamp to booking window
  const fetchAvailabilityRange = async (start: Date, days = 28) => {
    if (!seats) return;
    setCheckingAvailability(true);
    try {
      const result: Record<string, { am: boolean; pm: boolean }> = {};

      const windowStart = startOfDay(new Date());
      const windowEnd = addDays(windowStart, 30);

      // clamp start to the booking window
      let fetchStart = startOfDay(start);
      if (isBefore(fetchStart, windowStart)) fetchStart = windowStart;
      if (isAfter(fetchStart, windowEnd)) {
        // nothing to fetch
        setAvailabilityMap({});
        return;
      }

      const maxDaysAllowed = Math.max(0, differenceInCalendarDays(windowEnd, fetchStart) + 1);
      const fetchDays = Math.min(days, maxDaysAllowed);

      const fetchEnd = addDays(fetchStart, fetchDays - 1);
      const startKey = format(fetchStart, 'yyyy-MM-dd');
      const endKey = format(fetchEnd, 'yyyy-MM-dd');

      // global range cache to avoid duplicate range calls across components
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (!window.__availabilityFetchedRanges) window.__availabilityFetchedRanges = {};
      const rangeKey = `${startKey}|${endKey}`;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.__availabilityFetchedRanges[rangeKey]) {
        // build availability from cached bookings
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const cached = window.__availabilityFetchedRanges[rangeKey] as any[];
        for (let i = 0; i < fetchDays; i++) {
          const d = addDays(fetchStart, i);
          const ds = format(d, 'yyyy-MM-dd');
          // Count seats that are NOT blocked on this specific date
          const totalSeatsForDay = (seats || []).filter(s => !isSeatBlockedOnDate(s, ds)).length || 0;
          const amBooked = cached.filter((b: any) => (b.slot === 'AM' || b.slot === 'FULL') && b.date === ds).length;
          const pmBooked = cached.filter((b: any) => (b.slot === 'PM' || b.slot === 'FULL') && b.date === ds).length;
          result[ds] = {
            am: totalSeatsForDay === 0 ? false : amBooked < totalSeatsForDay,
            pm: totalSeatsForDay === 0 ? false : pmBooked < totalSeatsForDay,
          };
        }
        setAvailabilityMap(result);
        setCheckingAvailability(false);
        return;
      }

      const res = await fetch(`/api/bookings?start=${startKey}&end=${endKey}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setCheckingAvailability(false);
        return;
      }
      const bookingsResp = await res.json();

      // cache bookings for this range
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.__availabilityFetchedRanges[rangeKey] = bookingsResp;

      for (let i = 0; i < fetchDays; i++) {
        const d = addDays(fetchStart, i);
        const ds = format(d, 'yyyy-MM-dd');
        // Count seats that are NOT blocked on this specific date
        const totalSeatsForDay = (seats || []).filter(s => !isSeatBlockedOnDate(s, ds)).length || 0;
        const amBooked = bookingsResp.filter((b: any) => (b.slot === 'AM' || b.slot === 'FULL') && b.date === ds).length;
        const pmBooked = bookingsResp.filter((b: any) => (b.slot === 'PM' || b.slot === 'FULL') && b.date === ds).length;
        result[ds] = {
          am: totalSeatsForDay === 0 ? false : amBooked < totalSeatsForDay,
          pm: totalSeatsForDay === 0 ? false : pmBooked < totalSeatsForDay,
        };
      }
      setAvailabilityMap(result);
    } catch (err) {
      console.error('Error fetching availability', err);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Prefetch availability for the full booking window, but only when a seat is selected.
  // If no seat is selected we clear availability so the header calendar shows no dots.
  useEffect(() => {
    if (!seats) return;
    if (!selectedSeat) {
      setAvailabilityMap({});
      return;
    }
    const windowStart = startOfDay(new Date());
    const windowEnd = addDays(windowStart, 30);
    const days = Math.max(0, differenceInCalendarDays(windowEnd, windowStart) + 1);
    fetchAvailabilityRange(windowStart, days);
  }, [seats, selectedSeat]);

  const isLoading = seatsLoading || bookingsLoading;

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
    // Check if seat is blocked for the selected date
    const isBlocked = seat.blockStartDate && seat.blockEndDate
      ? dateStr >= seat.blockStartDate && dateStr <= seat.blockEndDate
      : seat.isBlocked || false;
    const seatBookings = (bookings || []).filter(b => b.seatId === seat.id);
    const tooltip = seatBookings.length > 0 ? seatBookings.map(b => `${b.user?.username || 'user'} — ${b.slot}`).join('\n') : undefined;

    return (
      <button
        key={seat.id}
        disabled={isBlocked || status === 'booked'}
        onClick={() => setSelectedSeat(seat)}
        title={tooltip}
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
        {( seat.type === SeatType.REGULAR) && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-card/90 px-1 rounded-md border border-border/50">🖥️</div>
        )}
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
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground animate-pulse">Loading workspace...</p>
          </div>
        </div>
      )}
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
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium cursor-pointer" data-testid="text-selected-date">
                <CalendarIcon className="w-4 h-4 text-primary" />
                {format(selectedDate, "EEE, MMM do")}
              </div>
            </PopoverTrigger>
            <PopoverContent>
              {(() => {
                const windowStart = startOfDay(new Date());
                const windowEnd = addDays(windowStart, 30);
                return (
                  <>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d: Date | undefined) => d && setSelectedDate(d)}
                      disabled={(d: Date) => isBefore(startOfDay(d), windowStart) || isAfter(startOfDay(d), windowEnd)}
                      components={{
                        Day: ({ date, ...props }: any) => {
                          const ds = format(date, 'yyyy-MM-dd');
                          const a = availabilityMap[ds];

                          const inWindow = !isBefore(startOfDay(date), windowStart) && !isAfter(startOfDay(date), windowEnd);
                          const isSelected = startOfDay(date).getTime() === startOfDay(selectedDate).getTime();

                          const handleClick = (e: any) => {
                            if (!inWindow) return;
                            if (props.onClick) props.onClick(e);
                            setSelectedDate(date);
                          };

                          return (
                            <div className="relative">
                              {/* @ts-ignore */}
                              <button
                                {...props}
                                onClick={handleClick}
                                disabled={!inWindow || props.disabled}
                                className={`${props.className} relative ${!inWindow ? 'cursor-not-allowed opacity-50' : ''} ${isSelected ? 'ring-2 ring-primary rounded-full' : ''}`}
                              >
                                <span className="pointer-events-none select-none text-sm">{String(date.getDate())}</span>
                              </button>
                              {selectedSeat && inWindow && a && (
                                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex gap-0.5">
                                  <span className={`${a.am ? 'w-2 h-2 rounded-full bg-green-500 ring-1 ring-white/60' : 'w-2 h-2 rounded-full bg-amber-500'}`} />
                                  <span className={`${a.pm ? 'w-2 h-2 rounded-full bg-green-500 ring-1 ring-white/60' : 'w-2 h-2 rounded-full bg-amber-500'}`} />
                                </div>
                              )}
                            </div>
                          );
                        }
                      }}
                    />
                  </>
                );
              })()}
            </PopoverContent>
          </Popover>
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
