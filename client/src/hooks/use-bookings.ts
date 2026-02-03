import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertBooking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useBookings(filters?: { date?: string; userId?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = [api.bookings.list.path, filters?.date, filters?.userId].filter(Boolean);

  const { data: bookings, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.date) params.append("date", filters.date);
      if (filters?.userId) params.append("userId", filters.userId);
      const url = `${api.bookings.list.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return api.bookings.list.responses[200].parse(await res.json());
    },
  });

  const createBooking = useMutation({
    mutationFn: async (booking: InsertBooking) => {
      // Use the unified recurring endpoint with an explicit dates array.
      const payload = {
        seatId: booking.seatId,
        dates: [booking.date],
        slot: booking.slot,
      };
      const res = await fetch(api.bookings.recurring.path, {
        method: api.bookings.recurring.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 409) throw new Error("Slot already booked");
        throw new Error("Failed to create booking");
      }
      // recurring endpoint returns an array of created bookings
      return api.bookings.recurring.responses[201].parse(await res.json());
    },
    // optimistic update so UI reflects booking immediately
    onMutate: async (booking: InsertBooking) => {
      await queryClient.cancelQueries({ queryKey: [api.bookings.list.path, booking.date] });
      const previous = queryClient.getQueryData([api.bookings.list.path, booking.date]);
      // add a temporary booking entry so UI updates instantly
      const temp = { ...booking, id: `temp-${Date.now()}` } as any;
      queryClient.setQueryData([api.bookings.list.path, booking.date], (old: any) => {
        if (!old) return [temp];
        return [...old, temp];
      });
      return { previous };
    },
    onError: (err: Error, variables: any, context: any) => {
      // rollback to previous date-specific data
      if (context?.previous) {
        const key = [api.bookings.list.path, variables?.date];
        queryClient.setQueryData(key, context.previous);
      }
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
    onSettled: () => {
      // ensure queries are fresh
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      // Clear global availability cache so other components refetch
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.__availabilityFetchedRanges) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.__availabilityFetchedRanges = {};
      }
      toast({ title: "Success", description: "Booking confirmed!" });
    },
  });

  const cancelBooking = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bookings.cancel.path, { id });
      const res = await fetch(url, {
        method: api.bookings.cancel.method,
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to cancel booking");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      // Clear global availability cache so other components refetch
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.__availabilityFetchedRanges) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.__availabilityFetchedRanges = {};
      }
      toast({ title: "Cancelled", description: "Booking cancelled successfully" });
    },
  });

  return { bookings, isLoading, createBooking, cancelBooking };
}
