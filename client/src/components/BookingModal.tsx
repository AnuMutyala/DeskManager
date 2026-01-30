import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Seat, InsertBooking, SeatType } from "@shared/schema";
import { useBookings } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { Clock, Armchair } from "lucide-react";

import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { format, addDays, startOfDay, isBefore } from "date-fns";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "./calendar";

interface BookingModalProps {
  seat: Seat | null;
  date: Date;
  existingBookings: any[]; // Using derived type from hook would be cleaner but complex for now
  onClose: () => void;
}

export function BookingModal({ seat, date, existingBookings, onClose }: BookingModalProps) {
  const { createBooking } = useBookings();
  const { user } = useAuth();
  const { toast } = useToast();
  const [weeks, setWeeks] = useState(4);
  const [selectedSlot, setSelectedSlot] = useState<"AM" | "PM" | "FULL" | null>(null);
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { am: boolean; pm: boolean }>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(date ?? new Date());
  const [recurrencePattern, setRecurrencePattern] = useState<'none' | 'weekly'>('none');

  // NOTE: do not return early here because hooks must be called in the same order
  // The presence check is applied just before the render return below.

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Check availability (guard against undefined existingBookings)
  const bookingsForSeat = (existingBookings || []).filter(b => b.seatId === seat?.id && b.date === dateStr);
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

  const computeDates = () => {
    const dates: Date[] = [];
    for (let i = 0; i < weeks; i++) {
      dates.push(addDays(selectedDate, i * 7));
    }
    return dates;
  };

  const fetchAvailabilityRange = async (start: Date, days = 28) => {
    if (!seat) return;
    setChecking(true);
    const result: Record<string, { am: boolean; pm: boolean }> = {};
    try {
      for (let i = 0; i < days; i++) {
        const d = addDays(start, i);
        const ds = format(d, 'yyyy-MM-dd');
        const res = await fetch(`/api/bookings?date=${ds}`);
        if (!res.ok) {
          result[ds] = { am: true, pm: true };
          continue;
        }
        const bookings = await res.json();
        const forSeat = bookings.filter((b: any) => b.seatId === seat?.id);
        result[ds] = {
          am: !forSeat.some((b: any) => b.slot === 'AM' || b.slot === 'FULL'),
          pm: !forSeat.some((b: any) => b.slot === 'PM' || b.slot === 'FULL')
        };
      }
      setAvailability(result);
    } catch (err) {
      console.error('Error fetching availability range', err);
    } finally {
      setChecking(false);
    }
  };

  const checkAvailabilityForDates = async () => {
    await fetchAvailabilityRange(selectedDate, weeks * 7);
  };

  const handleBookRecurring = async (slot: "AM" | "PM") => {
    try {
      const payload = {
        seatId: seat.id,
        startDate: dateStr,
        occurrences: weeks,
        intervalWeeks: 1,
        slot
      };

      const res = await fetch('/api/bookings/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 201) {
        const created = await res.json();
        toast({ title: 'Booked', description: `Created ${created.length} bookings` });
        onClose();
        return;
      }

      if (res.status === 409) {
        const body = await res.json();
        const conflicts: string[] = body.conflicts || [];
        toast({ variant: 'destructive', title: 'Conflict', description: `The following dates are unavailable: ${conflicts.join(', ')}` });
        return;
      }

      const errBody = await res.text();
      toast({ variant: 'destructive', title: 'Error', description: errBody || 'Failed to create recurring bookings' });
    } catch (err) {
      console.error('Recurring booking error', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create recurring bookings' });
    }
  };

  // Custom day renderer to show availability dot
  const Day = ({ date, ...props }: any) => {
    const ds = format(date, 'yyyy-MM-dd');
    const a = availability[ds];
    let dotClasses = '';
    if (a) {
      if (a.am && a.pm) dotClasses = 'w-2 h-2 rounded-full bg-green-500 ring-1 ring-white/60';
      else if (a.am || a.pm) dotClasses = 'w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white/60';
      else dotClasses = 'w-2 h-2 rounded-full bg-slate-200 border border-slate-300';
    }

    const handleClick = (e: any) => {
      if (props.onClick) props.onClick(e);
      // don't allow selecting past dates
      if (isBefore(startOfDay(date), startOfDay(new Date()))) return;
      setSelectedDate(date);
      fetchAvailabilityRange(date, 28);
    };

    return (
      <div className="relative">
        {/* @ts-ignore */}
        <button {...props} onClick={handleClick} className={`${props.className} relative`}>
          <span className="pointer-events-none select-none text-sm">{String(date.getDate())}</span>
        </button>
        {(
          // show dots if date is not before today and we have availability info or fallback bookings
          !isBefore(startOfDay(date), startOfDay(new Date())) && (a || existingBookings.some((b: any) => b.seatId === seat.id))
        ) && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex gap-0.5">
            {
              // determine AM availability: prefer fetched data, else fallback to existingBookings
              (() => {
                const amAvailable = a ? a.am : !existingBookings.some((b: any) => b.seatId === seat.id && b.date === ds && (b.slot === 'AM' || b.slot === 'FULL'));
                return (
                  <span className={`${amAvailable ? 'w-2 h-2 rounded-full bg-green-500 ring-1 ring-white/60' : 'w-2 h-2 rounded-full bg-amber-500'}`} />
                );
              })()
            }
            {
              (() => {
                const pmAvailable = a ? a.pm : !existingBookings.some((b: any) => b.seatId === seat.id && b.date === ds && (b.slot === 'PM' || b.slot === 'FULL'));
                return (
                  <span className={`${pmAvailable ? 'w-2 h-2 rounded-full bg-green-500 ring-1 ring-white/60' : 'w-2 h-2 rounded-full bg-amber-500'}`} />
                );
              })()
            }
          </div>
        )}
      </div>
    );
  };

  // Keep modal selected date in sync with parent `date` (dashboard selected date)
  useEffect(() => {
    setSelectedDate(date ?? new Date());
    // prefetch availability for the date we were opened on
    fetchAvailabilityRange(date ?? new Date(), 28);
  }, [date, seat]);

  if (!seat || !user) return null;

  return (
    <Dialog open={!!seat} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-display">
            <Armchair className="w-6 h-6 text-primary" />
            Book Seat {seat.label}
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, "EEEE, MMMM do, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-secondary/50 p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize flex items-center gap-2">
                {seat.type}
                {seat.type === SeatType.REGULAR ? (
                  <span className="text-sm">🖥️</span>
                ) : null}
              </span>
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
            <div className="flex items-center gap-3">
              {/* date picker and recurrence pattern */}
              {/* popover calendar and repeat select inserted below */}
            </div>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="px-3 py-1 border rounded flex items-center gap-2" onClick={() => fetchAvailabilityRange(selectedDate, 28)}>
                    <span>{format(selectedDate, 'EEE, MMM do')}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d: Date | undefined) => d && setSelectedDate(d)}
                    disabled={(d: Date) => {
                      const ds = format(d, 'yyyy-MM-dd');
                      const a = availability[ds];
                      return a ? (!a.am && !a.pm) : false;
                    }}
                    components={{ Day }}
                  />

                </PopoverContent>
              </Popover>

              <div className="ml-2">
                <label className="text-sm block">Repeat</label>
                <select value={recurrencePattern} onChange={(e) => setRecurrencePattern(e.target.value as any)} className="rounded border px-2 py-1" disabled={!selectedSlot}>
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <Button
              variant="outline"
              className={`justify-between h-auto py-4 text-base ${selectedSlot === 'AM' ? 'ring-2 ring-primary/60' : ''}`}
              disabled={isAmBooked || createBooking.isPending}
              onClick={() => {
                setSelectedSlot('AM');
                fetchAvailabilityRange(selectedDate, weeks * 7);
              }}
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
            {recurrencePattern === 'weekly' && selectedSlot && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium">Recurring Dates</h4>
                <div className="grid gap-1 text-sm">
                  {computeDates().map(d => {
                    const ds = format(d, 'yyyy-MM-dd');
                    const avail = availability[ds];
                    return (
                      <div key={ds} className="flex justify-between">
                        <div>{format(d, 'EEEE, MMM do')}</div>
                        <div className="flex gap-2">
                          <div className={`px-2 py-0.5 rounded ${avail ? (avail.am ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'text-muted-foreground'}`}>AM</div>
                          <div className={`px-2 py-0.5 rounded ${avail ? (avail.pm ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'text-muted-foreground'}`}>PM</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="default" onClick={() => handleBookRecurring(selectedSlot!)}>Book Recurring ({selectedSlot})</Button>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className={`justify-between h-auto py-4 text-base ${selectedSlot === 'PM' ? 'ring-2 ring-primary/60' : ''}`}
              disabled={isPmBooked || createBooking.isPending}
              onClick={() => {
                setSelectedSlot('PM');
                fetchAvailabilityRange(selectedDate, weeks * 7);
              }}
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

            {/* Confirm one-off booking when a slot has been selected */}
            <div className="pt-3">
              <Button
                variant="default"
                disabled={!selectedSlot || createBooking.isPending}
                onClick={() => {
                  if (!selectedSlot) return;
                  // single booking
                  handleBook(selectedSlot);
                }}
              >
                Confirm Booking ({selectedSlot ?? '-'})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
