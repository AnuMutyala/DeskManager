import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Seat, InsertBooking, SeatType } from "@shared/schema";
import { useBookings } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { Clock, Armchair } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { format, addDays, startOfDay, isBefore, isAfter, differenceInCalendarDays } from "date-fns";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
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
  const queryClient = useQueryClient();
  const [weeks, setWeeks] = useState(4);
  const [selectedSlot, setSelectedSlot] = useState<"AM" | "PM" | "FULL" | null>(null);
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { am: boolean; pm: boolean }>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(date ?? new Date());
  const [recurrencePattern, setRecurrencePattern] = useState<'none' | 'weekly' | 'everyday'>('none');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [conflictDialog, setConflictDialog] = useState<{ open: boolean; conflicts: string[]; availableDates: string[]; slot: "AM" | "PM" | "FULL" | null }>({
    open: false,
    conflicts: [],
    availableDates: [],
    slot: null
  });

  // NOTE: do not return early here because hooks must be called in the same order
  // The presence check is applied just before the render return below.

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  // booking window: from today (inclusive) up to 30 days ahead
  const maxDate = addDays(startOfDay(new Date()), 30);

  // Check availability (guard against undefined existingBookings)
  const bookingsForSeat = (existingBookings || []).filter(b => b.seatId === seat?.id && b.date === dateStr);
  const isAmBooked = bookingsForSeat.some(b => b.slot === "AM" || b.slot === "FULL");
  const isPmBooked = bookingsForSeat.some(b => b.slot === "PM" || b.slot === "FULL");
  const isFullUnavailable = isAmBooked || isPmBooked;

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
    if (recurrencePattern === 'weekly') {
      const end = endDate && isAfter(startOfDay(endDate), startOfDay(maxDate)) ? maxDate : endDate;
      if (end) {
        const days = differenceInCalendarDays(startOfDay(end), startOfDay(selectedDate));
        const occurrences = Math.max(0, Math.floor(days / 7) + 1);
        for (let i = 0; i < occurrences; i++) dates.push(addDays(selectedDate, i * 7));
        return dates;
      }
      for (let i = 0; i < weeks; i++) {
        const d = addDays(selectedDate, i * 7);
        if (isAfter(startOfDay(d), startOfDay(maxDate))) break;
        dates.push(d);
      }
      return dates;
    }

    if (recurrencePattern === 'everyday') {
      const end = endDate && isAfter(startOfDay(endDate), startOfDay(maxDate)) ? maxDate : endDate;
      if (end) {
        const days = differenceInCalendarDays(startOfDay(end), startOfDay(selectedDate));
        for (let i = 0; i <= days; i++) {
          const d = addDays(selectedDate, i);
          if (isAfter(startOfDay(d), startOfDay(maxDate))) break;
          dates.push(d);
        }
        return dates;
      }
      for (let i = 0; i < weeks * 7; i++) {
        const d = addDays(selectedDate, i);
        if (isAfter(startOfDay(d), startOfDay(maxDate))) break;
        dates.push(d);
      }
      return dates;
    }

    return dates;
  };



  // Fetch availability for an explicit list of dates (used for recurring preview).
  const fetchAvailabilityForDates = async (dates: Date[]) => {
    if (!seat || !dates || dates.length === 0) return;
    setChecking(true);
    try {
      // compute range (clamped to booking window)
      const validDates = dates
        .map(d => startOfDay(d))
        .filter(d => !isBefore(d, startOfDay(new Date())))
        .filter(d => !isAfter(d, startOfDay(maxDate)));
      if (validDates.length === 0) return;
      const start = format(validDates[0], 'yyyy-MM-dd');
      const end = format(validDates[validDates.length - 1], 'yyyy-MM-dd');

      // global range cache to avoid duplicate range calls across components
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (!window.__availabilityFetchedRanges) window.__availabilityFetchedRanges = {};
      const key = `${start}|${end}`;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.__availabilityFetchedRanges[key]) {
        // already fetched; build availability from cached bookings
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const cached = window.__availabilityFetchedRanges[key] as any[];
        const map: Record<string, { am: boolean; pm: boolean }> = {};
        for (const d of validDates) {
          const ds = format(d, 'yyyy-MM-dd');
          const forSeat = cached.filter((b: any) => b.seatId === seat?.id && b.date === ds);
          map[ds] = {
            am: !forSeat.some((b: any) => b.slot === 'AM' || b.slot === 'FULL'),
            pm: !forSeat.some((b: any) => b.slot === 'PM' || b.slot === 'FULL')
          };
        }
        setAvailability(prev => ({ ...prev, ...map }));
        setChecking(false);
        return;
      }

      const res = await fetch(`/api/bookings?start=${start}&end=${end}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setChecking(false);
        return;
      }
      const bookings = await res.json();

      // cache the bookings for this range
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.__availabilityFetchedRanges[key] = bookings;

      const map: Record<string, { am: boolean; pm: boolean }> = {};
      for (const d of validDates) {
        const ds = format(d, 'yyyy-MM-dd');
        const forSeat = bookings.filter((b: any) => b.seatId === seat?.id && b.date === ds);
        map[ds] = {
          am: !forSeat.some((b: any) => b.slot === 'AM' || b.slot === 'FULL'),
          pm: !forSeat.some((b: any) => b.slot === 'PM' || b.slot === 'FULL')
        };
      }
      setAvailability(prev => ({ ...prev, ...map }));
    } catch (err) {
      console.error('Error fetching availability for dates', err);
    } finally {
      setChecking(false);
    }
  };

const handleBookRecurring = async (slot: "AM" | "PM" | "FULL", skipConflicted = false) => {
    if (!seat) {
      toast({ variant: 'destructive', title: 'Error', description: 'No seat selected' });
      return;
    }

    try {
      // compute explicit occurrence dates for clearer behavior (weekly or everyday)
      const dates = computeDates();
      if (dates.length === 0) {
        toast({ variant: 'destructive', title: 'No dates', description: 'No occurrence dates could be computed' });
        return;
      }

      // Always send explicit dates to the recurring endpoint. Server will
      // accept `dates` and create individual bookings atomically.
      const payload = {
        seatId: seat.id,
        dates: dates.map(d => format(d, 'yyyy-MM-dd')),
        slot,
      };

      console.log('Sending recurring booking payload:', payload);

      const res = await fetch(api.bookings.recurring.path, {
        method: api.bookings.recurring.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (res.status === 201) {
        const created = await res.json();
        toast({ title: 'Booked', description: `Created ${created.length} bookings` });
        queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
        return;
      }

      if (res.status === 409) {
        const body = await res.json();
        const conflicts: string[] = body.conflicts || [];

        if (!skipConflicted) {
          // Show dialog asking if user wants to continue with available dates
          const allDates = dates.map(d => format(d, 'yyyy-MM-dd'));
          const availableDates = allDates.filter(d => !conflicts.includes(d));

          if (availableDates.length > 0) {
            setConflictDialog({
              open: true,
              conflicts,
              availableDates,
              slot
            });
            return;
          }
        }

        toast({ variant: 'destructive', title: 'Conflict', description: `The following dates are unavailable: ${conflicts.join(', ')}` });
        return;
      }

      const errBody = await res.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Recurring booking error response:', res.status, errBody);
      toast({ variant: 'destructive', title: 'Error', description: errBody.message || 'Failed to create recurring bookings' });
    } catch (err) {
      console.error('Recurring booking error', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create recurring bookings' });
    }
  };

  const handleContinueWithAvailable = async () => {
    if (!seat || !conflictDialog.slot) return;

    setConflictDialog({ open: false, conflicts: [], availableDates: [], slot: null });

    try {
      const payload = {
        seatId: seat.id,
        dates: conflictDialog.availableDates,
        slot: conflictDialog.slot,
      };

      const res = await fetch(api.bookings.recurring.path, {
        method: api.bookings.recurring.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (res.status === 201) {
        const created = await res.json();
        toast({ title: 'Booked', description: `Created ${created.length} bookings (${conflictDialog.conflicts.length} dates were skipped)` });
        queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
        return;
      }

      const errBody = await res.json().catch(() => ({ message: 'Unknown error' }));
      toast({ variant: 'destructive', title: 'Error', description: errBody.message || 'Failed to create bookings' });
    } catch (err) {
      console.error('Booking error', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create bookings' });
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
      // don't allow selecting beyond the 1-month window
      if (isAfter(startOfDay(date), startOfDay(maxDate))) return;
      setSelectedDate(date);
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

  // Day renderer for the End Date calendar — does not modify selectedDate
  const EndDay = ({ date, ...props }: any) => {
    const ds = format(date, 'yyyy-MM-dd');
    const a = availability[ds];
    const handleClick = (e: any) => {
      if (props.onClick) props.onClick(e);
      // don't allow selecting past dates relative to selectedDate
      if (isBefore(startOfDay(date), startOfDay(selectedDate))) return;
      // don't allow selecting beyond the 1-month window
      if (isAfter(startOfDay(date), startOfDay(maxDate))) return;
      setEndDate(date);
    };

    return (
      <div className="relative">
        {/* @ts-ignore */}
        <button {...props} onClick={handleClick} className={`${props.className} relative`}>
          <span className="pointer-events-none select-none text-sm">{String(date.getDate())}</span>
        </button>
        {(
          !isBefore(startOfDay(date), startOfDay(new Date())) && (a || existingBookings.some((b: any) => b.seatId === seat.id))
        ) && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex gap-0.5">
            {
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
    // Reset per-seat recurrence state so selections don't carry across seats
    setEndDate(null);
    setRecurrencePattern('none');
    setSelectedSlot(null);
    // Prefetch availability for the full 31-day booking window (today + 30 days)
    // to match Dashboard's fetch range and use the same cache key
    const windowStart = startOfDay(new Date());
    const windowEnd = addDays(windowStart, 30);
    const days = Math.max(0, differenceInCalendarDays(windowEnd, windowStart) + 1);
    const datesToPrefetch: Date[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(windowStart, i);
      datesToPrefetch.push(d);
    }
    fetchAvailabilityForDates(datesToPrefetch);
  }, [date, seat]);

  // When the recurrence pattern and time slot are selected, fetch availability
  // for the computed dates (limit weekly preview to first 5 occurrences).
  useEffect(() => {
    if (!seat) return;
    if (!selectedSlot) return;
    if (recurrencePattern === 'none') return;
    const dates = computeDates();
    const toFetch = recurrencePattern === 'weekly' ? dates.slice(0, 5) : dates.slice(0, 5);
    fetchAvailabilityForDates(toFetch);
  }, [recurrencePattern, selectedSlot, selectedDate, endDate, weeks, seat]);

  if (!seat || !user) return null;

  return (
    <Dialog open={!!seat} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-display">
            <Armchair className="w-6 h-6 text-primary" />
            Book Seat {seat.label} {seat.type === SeatType.REGULAR ? 'with 🖥️' : 'without 🖥️'}
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, "EEEE, MMMM do, yyyy")}
          </DialogDescription>
        </DialogHeader>

            {seat.tags && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(seat.tags as string[]).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-background text-xs rounded-md border text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}


          <div className="grid gap-3">
            <div className="flex items-start gap-4">
              <div>
                <label className="text-sm block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="px-3 py-1 border rounded flex items-center gap-2">
                      <span>{format(selectedDate, 'EEE, MMM do')}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d: Date | undefined) => d && setSelectedDate(d)}
                      disabled={(d: Date) => {
                        // disable past dates and dates beyond the booking window
                        if (isBefore(startOfDay(d), startOfDay(new Date()))) return true;
                        if (isAfter(startOfDay(d), startOfDay(maxDate))) return true;
                        const ds = format(d, 'yyyy-MM-dd');
                        const a = availability[ds];
                        return a ? (!a.am && !a.pm) : false;
                      }}
                      components={{ Day }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm block">Time</label>
                <select
                  value={selectedSlot ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as "AM" | "PM" | "FULL" | "";
                    if (!v) {
                      setSelectedSlot(null);
                      return;
                    }
                    setSelectedSlot(v as any);
                  }}
                  className="rounded border px-2 py-1"
                >
                  <option value="" disabled>Select time</option>
                  <option value="AM" disabled={isAmBooked}>AM {isAmBooked ? ' - Booked' : ' - Available'}</option>
                  <option value="PM" disabled={isPmBooked}>PM {isPmBooked ? ' - Booked' : ' - Available'}</option>
                  <option value="FULL" disabled={isFullUnavailable}>Full day{isFullUnavailable ? ' - Booked' : ' - Available'}</option>
                </select>
              </div>


            </div>

              <div>
                <label className="text-sm block">Repeat</label>
                <select value={recurrencePattern} onChange={(e) => setRecurrencePattern(e.target.value as any)} className="rounded border px-2 py-1 mt-1" disabled={!selectedSlot}>
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly</option>
                  <option value="everyday">Everyday</option>
                </select>
              </div>

                {/* Fetch availability when recurrence pattern or slot changes */}


              {recurrencePattern !== 'none' && selectedSlot && (
                <div className="mt-2">
                  <label className="text-sm block">End Date</label>
                  <div className="mt-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-48 px-3 py-1 border rounded flex items-center gap-2 justify-between text-sm">
                          <span>{endDate ? format(endDate, 'EEE, MMM do') : 'Select end date'}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={endDate ?? undefined}
                          onSelect={(d: Date | undefined) => d && setEndDate(d)}
                          disabled={(d: Date) => {
                            // end date must be >= selectedDate and <= maxDate
                            if (isBefore(startOfDay(d), startOfDay(selectedDate))) return true;
                            if (isAfter(startOfDay(d), startOfDay(maxDate))) return true;
                            return false;
                          }}
                          components={{ Day: EndDay }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            {recurrencePattern !== 'none' && selectedSlot && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium">Recurring Dates</h4>
                <div className="grid gap-1 text-sm">
                  {
                    (() => {
                      const all = computeDates();
                      const preview = all.slice(0, 5);
                      return (
                        <>
                          {preview.map(d => {
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
                          {all.length > 5 && (
                            <div className="text-sm text-muted-foreground">and {all.length - 5} more...</div>
                          )}
                        </>
                      );
                    })()
                  }
                </div>

              </div>
            )}


            {/* Confirm one-off booking when a slot has been selected */}
            <div className="pt-3">
                <Button
                  variant="default"
                  disabled={
                    !selectedSlot ||
                    createBooking.isPending ||
                    (recurrencePattern !== 'none' && !endDate)
                  }
                  onClick={() => {
                    if (!selectedSlot) return;
                    // if a recurrence is selected, submit recurring booking
                    if (recurrencePattern !== 'none') {
                      handleBookRecurring(selectedSlot);
                      return;
                    }
                    // single booking
                    handleBook(selectedSlot);
                    onClose();
                  }}
                >
                  Confirm Booking
                </Button>
            </div>
          </div>

      </DialogContent>

      {/* Conflict Resolution Dialog */}
      <AlertDialog open={conflictDialog.open} onOpenChange={(open) => !open && setConflictDialog({ open: false, conflicts: [], availableDates: [], slot: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some dates are unavailable</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>The following dates are already booked:</p>
              <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                {conflictDialog.conflicts.map(d => format(new Date(d), 'EEE, MMM do')).join(', ')}
              </div>
              <p className="pt-2">
                Would you like to continue booking the remaining <strong>{conflictDialog.availableDates.length}</strong> available dates?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinueWithAvailable}>
              Continue with {conflictDialog.availableDates.length} dates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
