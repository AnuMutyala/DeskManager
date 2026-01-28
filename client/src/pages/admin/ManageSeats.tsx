import { useState } from "react";
import { useSeats } from "@/hooks/use-seats";
import { Seat, InsertSeat } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Ban } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSeatSchema } from "@shared/schema";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ManageSeats() {
  const { seats, createSeat, updateSeat, deleteSeat } = useSeats();
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form setup
  const form = useForm<InsertSeat>({
    resolver: zodResolver(insertSeatSchema),
    defaultValues: {
      label: "",
      type: "regular",
      isBlocked: false,
      tags: [],
    },
  });

  const onSubmit = (data: InsertSeat) => {
    if (editingSeat) {
      updateSeat.mutate({ id: editingSeat.id, ...data }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingSeat(null);
          form.reset();
        }
      });
    } else {
      createSeat.mutate(data, {
        onSuccess: () => {
          setIsDialogOpen(false);
          form.reset();
        }
      });
    }
  };

  const handleEdit = (seat: Seat) => {
    setEditingSeat(seat);
    form.reset({
      label: seat.label,
      type: seat.type as "regular" | "standing",
      isBlocked: seat.isBlocked || false,
      tags: seat.tags as string[] || [],
    });
    setIsDialogOpen(true);
  };

  const handleToggleBlock = (seat: Seat) => {
    updateSeat.mutate({ id: seat.id, isBlocked: !seat.isBlocked });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display">Manage Seats</h1>
          <p className="text-muted-foreground">Add, edit, or block seats in the office layout.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingSeat(null);
            form.reset({ label: "", type: "regular", isBlocked: false, tags: [] });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/25">
              <Plus className="w-4 h-4" /> Add Seat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSeat ? 'Edit Seat' : 'Add New Seat'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label (e.g., T-101)</FormLabel>
                      <FormControl>
                        <Input placeholder="T-101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="regular">Regular Desk</SelectItem>
                          <SelectItem value="standing">Standing Desk</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isBlocked"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Blocked</FormLabel>
                        <FormDescription>
                          Prevent bookings for this seat
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createSeat.isPending || updateSeat.isPending}>
                  {editingSeat ? 'Update Seat' : 'Create Seat'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats?.map((seat) => (
              <TableRow key={seat.id} className="hover:bg-secondary/20 transition-colors">
                <TableCell className="font-medium">{seat.label}</TableCell>
                <TableCell className="capitalize">{seat.type}</TableCell>
                <TableCell>
                  {seat.isBlocked ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Blocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleToggleBlock(seat)}
                      title={seat.isBlocked ? "Unblock" : "Block"}
                    >
                      <Ban className={`w-4 h-4 ${seat.isBlocked ? 'text-green-600' : 'text-orange-500'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(seat)}>
                      <Pencil className="w-4 h-4 text-blue-500" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Seat?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete seat {seat.label} and remove all associated history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive"
                            onClick={() => deleteSeat.mutate(seat.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
