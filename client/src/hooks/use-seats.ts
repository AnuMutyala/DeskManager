import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertSeat } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useSeats() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: seats, isLoading } = useQuery({
    queryKey: [api.seats.list.path],
    queryFn: async () => {
      const res = await fetch(api.seats.list.path);
      if (!res.ok) throw new Error("Failed to fetch seats");
      return api.seats.list.responses[200].parse(await res.json());
    },
  });

  const createSeat = useMutation({
    mutationFn: async (seat: InsertSeat) => {
      const res = await fetch(api.seats.create.path, {
        method: api.seats.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seat),
      });
      if (!res.ok) throw new Error("Failed to create seat");
      return api.seats.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.seats.list.path] });
      toast({ title: "Success", description: "Seat created successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const updateSeat = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertSeat>) => {
      const url = buildUrl(api.seats.update.path, { id });
      const res = await fetch(url, {
        method: api.seats.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update seat");
      return api.seats.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.seats.list.path] });
      toast({ title: "Success", description: "Seat updated successfully" });
    },
  });

  const deleteSeat = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.seats.delete.path, { id });
      const res = await fetch(url, { method: api.seats.delete.method });
      if (!res.ok) throw new Error("Failed to delete seat");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.seats.list.path] });
      toast({ title: "Success", description: "Seat deleted successfully" });
    },
  });

  return { seats, isLoading, createSeat, updateSeat, deleteSeat };
}
