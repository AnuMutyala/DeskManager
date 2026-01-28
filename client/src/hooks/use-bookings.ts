import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertBooking } from "@shared/routes";
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
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return api.bookings.list.responses[200].parse(await res.json());
    },
  });

  const createBooking = useMutation({
    mutationFn: async (booking: InsertBooking) => {
      const res = await fetch(api.bookings.create.path, {
        method: api.bookings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking),
      });
      if (!res.ok) {
        if (res.status === 409) throw new Error("Slot already booked");
        throw new Error("Failed to create booking");
      }
      return api.bookings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      toast({ title: "Success", description: "Booking confirmed!" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const cancelBooking = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bookings.cancel.path, { id });
      const res = await fetch(url, { method: api.bookings.cancel.method });
      if (!res.ok) throw new Error("Failed to cancel booking");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      toast({ title: "Cancelled", description: "Booking cancelled successfully" });
    },
  });

  return { bookings, isLoading, createBooking, cancelBooking };
}
