import { useState } from "react";
import { useSeats } from "@/hooks/use-seats";
import { Seat, InsertSeat } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Ban, GripVertical, Maximize2 } from "lucide-react";
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
import { Card } from "@/components/ui/card";

const GRID_COLS = 20;
const GRID_ROWS = 15;
const CELL_SIZE = 40; // pixels

export default function ManageSeats() {
  const { seats, createSeat, updateSeat, deleteSeat } = useSeats();
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedSeat, setDraggedSeat] = useState<Seat | null>(null);
  const [resizingSeat, setResizingSeat] = useState<Seat | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Form setup
  const form = useForm<InsertSeat>({
    resolver: zodResolver(insertSeatSchema),
    defaultValues: {
      label: "",
      type: "regular",
      isBlocked: false,
      tags: [],
      gridX: 0,
      gridY: 0,
      gridWidth: 2,
      gridHeight: 2,
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
      gridX: seat.gridX ?? 0,
      gridY: seat.gridY ?? 0,
      gridWidth: seat.gridWidth ?? 2,
      gridHeight: seat.gridHeight ?? 2,
    });
    setIsDialogOpen(true);
  };

  const handleToggleBlock = (seat: Seat) => {
    updateSeat.mutate({ id: seat.id, isBlocked: !seat.isBlocked });
  };

  // Drag and drop handlers
  const handleDragStart = (seat: Seat) => {
    setDraggedSeat(seat);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (gridX: number, gridY: number) => {
    if (draggedSeat && !checkCollision(draggedSeat, gridX, gridY)) {
      updateSeat.mutate({
        id: draggedSeat.id,
        gridX,
        gridY,
      });
    }
    setDraggedSeat(null);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, seat: Seat) => {
    e.stopPropagation();
    setResizingSeat(seat);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: seat.gridWidth ?? 2,
      height: seat.gridHeight ?? 2,
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (resizingSeat && resizeStart) {
      const deltaX = Math.round((e.clientX - resizeStart.x) / CELL_SIZE);
      const deltaY = Math.round((e.clientY - resizeStart.y) / CELL_SIZE);

      const newWidth = Math.max(1, Math.min(6, resizeStart.width + deltaX));
      const newHeight = Math.max(1, Math.min(6, resizeStart.height + deltaY));

      // Temporarily update UI (actual update happens on mouseup)
      const element = document.getElementById(`seat-${resizingSeat.id}`);
      if (element) {
        element.style.width = `${newWidth * CELL_SIZE}px`;
        element.style.height = `${newHeight * CELL_SIZE}px`;
      }
    }
  };

  const handleResizeEnd = (e: MouseEvent) => {
    if (resizingSeat && resizeStart) {
      const deltaX = Math.round((e.clientX - resizeStart.x) / CELL_SIZE);
      const deltaY = Math.round((e.clientY - resizeStart.y) / CELL_SIZE);

      const newWidth = Math.max(1, Math.min(6, resizeStart.width + deltaX));
      const newHeight = Math.max(1, Math.min(6, resizeStart.height + deltaY));

      updateSeat.mutate({
        id: resizingSeat.id,
        gridWidth: newWidth,
        gridHeight: newHeight,
      });
    }
    setResizingSeat(null);
    setResizeStart(null);
  };

  // Check for collisions
  const checkCollision = (seat: Seat, newX: number, newY: number) => {
    const width = seat.gridWidth ?? 2;
    const height = seat.gridHeight ?? 2;

    return seats?.some(s => {
      if (s.id === seat.id) return false;
      const sWidth = s.gridWidth ?? 2;
      const sHeight = s.gridHeight ?? 2;
      const sX = s.gridX ?? 0;
      const sY = s.gridY ?? 0;

      return !(newX + width <= sX || newX >= sX + sWidth ||
        newY + height <= sY || newY >= sY + sHeight);
    });
  };

  // Set up global resize listeners
  useState(() => {
    if (resizingSeat) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  });

  return (
    <div className="p-8 max-w-full mx-auto space-y-8 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display">Manage Seats - Grid Layout</h1>
          <p className="text-muted-foreground">Drag seats to arrange, resize using the handle in bottom-right corner.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingSeat(null);
            form.reset({
              label: "",
              type: "regular",
              isBlocked: false,
              tags: [],
              gridX: 0,
              gridY: 0,
              gridWidth: 2,
              gridHeight: 2,
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/25">
              <Plus className="w-4 h-4" /> Add Seat
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSeat ? 'Edit Seat' : 'Add New Seat'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gridX"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grid X Position</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max={GRID_COLS - 1} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gridY"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grid Y Position</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max={GRID_ROWS - 1} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gridWidth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Width (grid units)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="6" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gridHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (grid units)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="6" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

      {/* Grid Editor */}
      <Card className="p-6 bg-secondary/20">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Grid: {GRID_COLS} × {GRID_ROWS} cells | Drag to move seats | Use resize handle to adjust size
          </div>
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>Regular</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-purple-500 rounded" />
              <span>Standing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-200 rounded" />
              <span>Blocked</span>
            </div>
          </div>
        </div>

        <div
          className="relative border-2 border-border/50 rounded-lg overflow-auto"
          style={{
            width: '100%',
            height: `${GRID_ROWS * CELL_SIZE + 2}px`,
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        >
          {/* Grid cells for drop targets */}
          {Array.from({ length: GRID_ROWS }).map((_, y) =>
            Array.from({ length: GRID_COLS }).map((_, x) => (
              <div
                key={`${x}-${y}`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(x, y)}
                className="absolute hover:bg-blue-100/30 transition-colors"
                style={{
                  left: x * CELL_SIZE,
                  top: y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
              />
            ))
          )}

          {/* Seats */}
          {seats?.map((seat) => {
            const x = seat.gridX ?? 0;
            const y = seat.gridY ?? 0;
            const width = seat.gridWidth ?? 2;
            const height = seat.gridHeight ?? 2;

            return (
              <div
                id={`seat-${seat.id}`}
                key={seat.id}
                draggable
                onDragStart={() => handleDragStart(seat)}
                className={`
                  absolute rounded-lg shadow-lg cursor-move border-2
                  transition-all duration-200 hover:shadow-xl hover:scale-105
                  flex flex-col items-center justify-center gap-1 text-white font-bold
                  ${seat.isBlocked
                    ? 'bg-red-200 border-red-300'
                    : seat.type === 'standing'
                      ? 'bg-purple-500 border-purple-600'
                      : 'bg-blue-500 border-blue-600'
                  }
                `}
                style={{
                  left: x * CELL_SIZE + 2,
                  top: y * CELL_SIZE + 2,
                  width: width * CELL_SIZE - 4,
                  height: height * CELL_SIZE - 4,
                }}
              >
                <GripVertical className="w-4 h-4 opacity-60" />
                <div className="text-center">
                  <div className="text-sm">{seat.label}</div>
                  <div className="text-[10px] opacity-80 capitalize">{seat.type}</div>
                </div>

                {/* Resize Handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, seat)}
                  className="absolute bottom-1 right-1 cursor-se-resize bg-white/30 p-1 rounded hover:bg-white/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Maximize2 className="w-3 h-3" />
                </div>

                {/* Edit/Delete Buttons */}
                <div className="absolute top-1 right-1 flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 bg-white/20 hover:bg-white/40"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(seat);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 bg-white/20 hover:bg-white/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Seat?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete seat {seat.label}.
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

                {/* Block Toggle */}
                <div className="absolute bottom-1 left-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 bg-white/20 hover:bg-white/40"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBlock(seat);
                    }}
                  >
                    <Ban className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
