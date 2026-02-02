import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSeats } from "@/hooks/use-seats";
import { Seat, InsertSeat, SeatType } from "@shared/schema";
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
import { Calendar } from "@/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover";
import { format } from "date-fns";

export default function ManageSeats() {
  const { seats, createSeat, updateSeat, deleteSeat } = useSeats();
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});
  const positionsRef = useRef<Record<number, { x: number; y: number }>>({});
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<
    | { id: number; offsetX: number; offsetY: number }
    | { ids: number[]; offsets: Record<number, { offsetX: number; offsetY: number }> }
    | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openSeatMenu, setOpenSeatMenu] = useState<number | null>(null);
  const liveDragPositionsRef = useRef<Record<number, { x: number; y: number }>>({});

  // Block dialog state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [seatToBlock, setSeatToBlock] = useState<Seat | null>(null);
  const [blockStartDate, setBlockStartDate] = useState<Date | undefined>(undefined);
  const [blockEndDate, setBlockEndDate] = useState<Date | undefined>(undefined);

  // Form setup
  const form = useForm<InsertSeat>({
    resolver: zodResolver(insertSeatSchema),
    defaultValues: {
      label: "",
      type: SeatType.REGULAR,
      isBlocked: false,
      tags: [],
      x: 0,
      y: 0,
    },
  });

  const onSubmit = (data: InsertSeat) => {
    if (editingSeat) {
      updateSeat.mutate({ id: editingSeat.id, ...data }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingSeat(null);
          form.reset({ label: "", type: SeatType.REGULAR, isBlocked: false, tags: [], x: 0, y: 0 });
        }
      });
    } else {
      createSeat.mutate(data, {
        onSuccess: () => {
          setIsDialogOpen(false);
          form.reset({ label: "", type: SeatType.REGULAR, isBlocked: false, tags: [], x: 0, y: 0 });
        }
      });
    }
  };

  const handleEdit = (seat: Seat) => {
    setEditingSeat(seat);
    form.reset({
      label: seat.label,
      type: seat.type as SeatType.REGULAR | SeatType.STANDING,
      isBlocked: seat.isBlocked || false,
      tags: seat.tags as string[] || [],
      x: seat.x ?? 0,
      y: seat.y ?? 0,
    });
    setIsDialogOpen(true);
  };

  const handleToggleBlock = (seat: Seat) => {
    // If seat is currently blocked, unblock it
    if (seat.isBlocked) {
      updateSeat.mutate({
        id: seat.id,
        isBlocked: false,
        blockStartDate: null,
        blockEndDate: null
      });
    } else {
      // Open dialog to set date range
      setSeatToBlock(seat);
      setBlockStartDate(undefined);
      setBlockEndDate(undefined);
      setBlockDialogOpen(true);
    }
  };

  const handleConfirmBlock = () => {
    if (!seatToBlock) return;

    // Default to today if no dates specified
    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = blockStartDate ? format(blockStartDate, 'yyyy-MM-dd') : today;
    const endDate = blockEndDate ? format(blockEndDate, 'yyyy-MM-dd') : today;

    updateSeat.mutate({
      id: seatToBlock.id,
      isBlocked: true,
      blockStartDate: startDate,
      blockEndDate: endDate
    }, {
      onSuccess: () => {
        setBlockDialogOpen(false);
        setSeatToBlock(null);
        setBlockStartDate(undefined);
        setBlockEndDate(undefined);
      }
    });
  };

  const resetLayout = async () => {
    if (!seats) return;
    try {
      // Try to load saved default layout from server
      const res = await fetch('/api/layout/default');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // apply saved layout — match by label first, fall back to id
          const updates: Array<{ id: number; x: number; y: number }> = [];
          data.forEach((d: any) => {
            let match: Seat | undefined;
            if (d?.label) {
              match = seats.find((s) => s.label === d.label);
            }
            if (!match && typeof d?.id === 'number') {
              match = seats.find((s) => s.id === d.id);
            }
            if (match) {
              updates.push({ id: match.id, x: d.x, y: d.y });
              updateSeat.mutate({ id: match.id, x: d.x, y: d.y });
            }
          });
          setPositions((prev) => {
            const next = { ...prev };
            updates.forEach((u) => {
              next[u.id] = { x: u.x, y: u.y };
            });
            return next;
          });
          return;
        }
      }
    } catch (err) {
      // fallthrough to fallback
      console.error('Failed to load saved default layout:', err);
    }

    // Fallback: keep existing cluster logic if no saved default exists
    const cell = 56; // approximate cell size (button + gap)
    const topY = 20;
    const bottomY = topY + cell * 3 + 120;
    const clusterGap = 240;

    const clusters = [
      { labels: ['T56','T55','T54','T53','T49','T50','T51','T52'], cols: 4, baseX: 20, baseY: topY },
      { labels: ['T48','T47','T46','T45','T41','T42','T43','T44'], cols: 4, baseX: 20 + clusterGap, baseY: topY },
      { labels: ['T60','T61','T59','T62','T58','T63','T57','T64'], cols: 2, baseX: 20 + clusterGap * 2, baseY: topY },
      { labels: ['T68','T69','T67','T70','T66','T71','T65','T72'], cols: 2, baseX: 20 + clusterGap * 3, baseY: topY },
      { labels: ['T76','T77','T75','T78','T74','T79','T73','T80'], cols: 2, baseX: 20 + clusterGap * 4, baseY: topY },
      { labels: ['S4','S3','S2','S1'], cols: 1, baseX: 20, baseY: bottomY },
      { labels: ['T8','T9','T7','T10','T6','T11','T5','T12'], cols: 2, baseX: 20 + 120, baseY: bottomY },
      { labels: ['T16','T17','T15','T18','T14','T19','T13','T20'], cols: 2, baseX: 20 + 320, baseY: bottomY },
      { labels: ['T40','T39','T38','T37','T36','T31','T32','T33','T34','T35'], cols: 5, baseX: 20 + 560, baseY: bottomY },
      { labels: ['T30','T29','T28','T27','T26','T21','T22','T23','T24','T25'], cols: 5, baseX: 20 + 900, baseY: bottomY },
    ];

    const labelToPos: Record<string, { x: number; y: number }> = {};
    clusters.forEach((c) => {
      c.labels.forEach((label, idx) => {
        const col = idx % c.cols;
        const row = Math.floor(idx / c.cols);
        const x = c.baseX + col * cell;
        const y = c.baseY + row * cell;
        labelToPos[label] = { x, y };
      });
    });

    const updates = seats.map((seat) => {
      const p = labelToPos[seat.label];
      return { id: seat.id, x: p ? p.x : 0, y: p ? p.y : 0 };
    });

    for (const u of updates) {
      updateSeat.mutate(u as any);
    }

    setPositions((prev) => {
      const next = { ...prev };
      seats.forEach((seat) => {
        const p = labelToPos[seat.label];
        next[seat.id] = { x: p ? p.x : 0, y: p ? p.y : 0 };
      });
      return next;
    });
  };

  const { toast } = useToast();

  const saveCurrentAsDefault = async () => {
    if (!seats) return;
    try {
      const payload = seats.map((s) => {
        const pos = positionsRef.current[s.id] ?? positions[s.id] ?? { x: s.x ?? 0, y: s.y ?? 0 };
        return { id: s.id, label: s.label, x: pos.x, y: pos.y };
      });
      const res = await fetch('/api/layout/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || res.statusText || 'Failed to save default layout');
      }
      toast({ title: 'Saved', description: 'Current layout saved as default' });
    } catch (err: any) {
      console.error('Save default layout failed:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'Failed to save default layout' });
    }
  };

  useEffect(() => {
    if (!seats) return;
    setPositions((prev) => {
      const next: Record<number, { x: number; y: number }> = { ...prev };
      seats.forEach((seat) => {
        if (!next[seat.id]) {
          next[seat.id] = { x: seat.x ?? 0, y: seat.y ?? 0 };
        }
      });
      return next;
    });
  }, [seats]);


  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const startDrag = (seat: Seat, e: ReactPointerEvent<HTMLButtonElement>) => {
    const container = layoutRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // selection behavior: toggle or set selection based on modifier keys
    const isToggle = e.shiftKey || e.ctrlKey || e.metaKey;
    let newSelected = selectedIds.slice();
    if (isToggle) {
      newSelected = selectedIds.includes(seat.id) ? selectedIds.filter(id => id !== seat.id) : [...selectedIds, seat.id];
    } else if (!selectedIds.includes(seat.id)) {
      newSelected = [seat.id];
    }
    setSelectedIds(newSelected);

    // if multiple selected and this seat is part of selection, start group drag
    const group = newSelected.length > 1 && newSelected.includes(seat.id);
    if (group) {
      const offsets: Record<number, { offsetX: number; offsetY: number }> = {};
      newSelected.forEach((id) => {
        const cur = positionsRef.current[id] || { x: 0, y: 0 };
        offsets[id] = { offsetX: e.clientX - rect.left - cur.x, offsetY: e.clientY - rect.top - cur.y };
      });
      dragRef.current = { ids: newSelected, offsets };
    } else {
      const current = positionsRef.current[seat.id] || { x: seat.x ?? 0, y: seat.y ?? 0 };
      const offsetX = e.clientX - rect.left - current.x;
      const offsetY = e.clientY - rect.top - current.y;
      dragRef.current = { id: seat.id, offsetX, offsetY };
    }

    const handleMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if ('id' in drag) {
        const x = Math.max(0, Math.round(ev.clientX - rect.left - drag.offsetX));
        const y = Math.max(0, Math.round(ev.clientY - rect.top - drag.offsetY));
        setPositions((prev) => ({ ...prev, [drag.id]: { x, y } }));
        liveDragPositionsRef.current[drag.id] = { x, y };
      } else {
        const next: Record<number, { x: number; y: number }> = {};
        drag.ids.forEach((id) => {
          const off = drag.offsets[id];
          const x = Math.max(0, Math.round(ev.clientX - rect.left - off.offsetX));
          const y = Math.max(0, Math.round(ev.clientY - rect.top - off.offsetY));
          next[id] = { x, y };
        });
        setPositions((prev) => ({ ...prev, ...next }));
        Object.assign(liveDragPositionsRef.current, next);
      }
    };

    const handleUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (!drag) return;
      if ('id' in drag) {
        const pos = liveDragPositionsRef.current[drag.id] ?? positionsRef.current[drag.id];
        if (pos) updateSeat.mutate({ id: drag.id, x: pos.x, y: pos.y });
        delete liveDragPositionsRef.current[drag.id];
      } else {
        drag.ids.forEach((id) => {
          const pos = liveDragPositionsRef.current[id] ?? positionsRef.current[id];
          if (pos) updateSeat.mutate({ id, x: pos.x, y: pos.y });
          delete liveDragPositionsRef.current[id];
        });
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacing) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-seat]") || target.closest("button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left - 24));
    const y = Math.max(0, Math.round(e.clientY - rect.top - 24));
    form.setValue("x", x);
    form.setValue("y", y);
    setEditingSeat(null);
    setIsPlacing(false);
    setIsDialogOpen(true);
  };

		console.log("selectedIds: ",selectedIds)
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
            form.reset({ label: "", type: SeatType.REGULAR, isBlocked: false, tags: [], x: 0, y: 0 });
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
                          <SelectItem value={SeatType.REGULAR}> Monitor</SelectItem>
                          <SelectItem value={SeatType.STANDING}>No Monitor</SelectItem>
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
                          checked={field.value ?? false}
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

      {/* Block Seat Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Seat {seatToBlock?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select date range for blocking. If no dates are selected, the seat will be blocked for 1 day (today only).
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date (optional)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {blockStartDate ? format(blockStartDate, 'PPP') : 'Select start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={blockStartDate}
                    onSelect={setBlockStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date (optional)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {blockEndDate ? format(blockEndDate, 'PPP') : 'Select end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={blockEndDate}
                    onSelect={setBlockEndDate}
                    initialFocus
                    disabled={(date) => blockStartDate ? date < blockStartDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmBlock} disabled={updateSeat.isPending}>
                {updateSeat.isPending ? 'Blocking...' : 'Block Seat'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Layout Editor</h2>
            <p className="text-sm text-muted-foreground">Drag seats to arrange the floor plan.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isPlacing ? "default" : "secondary"}
              size="sm"
              onClick={() => setIsPlacing((prev) => !prev)}
            >
              {isPlacing ? "Click on Canvas" : "Add Seat on Canvas"}
            </Button>
            <Button variant="secondary" size="sm" onClick={saveCurrentAsDefault}>
              Save Current as Default
            </Button>
            <Button variant="secondary" size="sm" onClick={resetLayout}>
              Reset to Default
            </Button>

          </div>
        </div>
        <div className="p-4">
          <div
            ref={layoutRef}
            onClick={handleCanvasClick}
            className={`relative h-[700px] min-w-[1200px] rounded-lg border border-dashed border-border/60 bg-muted/20 overflow-auto ${isPlacing ? "cursor-crosshair" : ""}`}
          >
            {(() => {
              const seatSize = 48; // matches w-12 h-12
              const padding = 40;
              const allPositions = (seats || []).map((seat) => positions[seat.id] || { x: seat.x ?? 0, y: seat.y ?? 0 });
              const maxX = allPositions.length ? Math.max(...allPositions.map(p => p.x)) : 0;
              const maxY = allPositions.length ? Math.max(...allPositions.map(p => p.y)) : 0;
              const contentWidth = Math.max(1200, maxX + seatSize + padding);
              const contentHeight = Math.max(700, maxY + seatSize + padding);

              return (
                <div style={{ width: contentWidth, height: contentHeight, position: 'relative' }}>
                  {(seats || []).map((seat) => {
                    const pos = positions[seat.id] || { x: seat.x ?? 0, y: seat.y ?? 0 };
                    return (
                      <button
                        key={seat.id}
                        onPointerDown={(e) => startDrag(seat, e)}
                        data-seat
                        className={`absolute w-12 h-12 rounded-md border text-[10px] font-semibold shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing ${selectedIds.includes(seat.id) ? 'ring-2 ring-primary/60' : ''} ${seat.isBlocked ? 'bg-red-50 border-red-100' : 'bg-white border-green-200 hover:border-green-400'}`}
                        style={{ left: pos.x, top: pos.y }}
                        title={`Drag ${seat.label}`}
                        type="button"
                      >
                        {seat.label}
                        {seat.type === SeatType.REGULAR && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-card/90 px-1 rounded-md border border-border/50">🖥️</div>
                        )}

                        <button
                          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setOpenSeatMenu(openSeatMenu === seat.id ? null : seat.id); }}
                          className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 bg-transparent p-1 text-xs"
                          aria-label={`Actions for ${seat.label}`}
                          type="button"
                        >
                          ⧉
                        </button>

                        {openSeatMenu === seat.id && (
                          <div className="absolute left-full top-0 ml-1 w-auto bg-card border rounded-md shadow-lg z-50 flex gap-1 p-1" onPointerDown={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { handleToggleBlock(seat); setOpenSeatMenu(null); }}
                              title={seat.isBlocked ? "Unblock" : "Block"}
                            >
                              <Ban className={`w-4 h-4 ${seat.isBlocked ? 'text-green-600' : 'text-orange-500'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { handleEdit(seat); setOpenSeatMenu(null); }}>
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
                                    onClick={() => {
                                      deleteSeat.mutate(seat.id);
                                      setSelectedIds((prev) => prev.filter((id) => id !== seat.id));
                                      setOpenSeatMenu(null);
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

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
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Blocked
                      </span>
                      {seat.blockStartDate && seat.blockEndDate && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(seat.blockStartDate), 'MMM d')} - {format(new Date(seat.blockEndDate), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
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
                          <AlertDialogTitle>{selectedIds.length > 1 && selectedIds.includes(seat.id) ? 'Delete Seats?' : 'Delete Seat?'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {selectedIds.length > 1 && selectedIds.includes(seat.id)
                              ? `This will permanently delete ${selectedIds.length} selected seats and remove all associated history.`
                              : `This will permanently delete seat ${seat.label} and remove all associated history.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive"
                            onClick={() => {
                              if (selectedIds.length > 1 && selectedIds.includes(seat.id)) {
                                // delete all selected
                                selectedIds.forEach((id) => deleteSeat.mutate(id));
                                setSelectedIds([]);
                              } else {
                                deleteSeat.mutate(seat.id);
                                setSelectedIds((prev) => prev.filter((id) => id !== seat.id));
                              }
                            }}
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
