import { useState } from "react";
import { useBookings } from "@/hooks/use-bookings";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover";
import { Calendar } from "@/components/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function ViewBookings() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { bookings, isLoading, cancelBooking } = useBookings({ date: dateStr });

  const handleExportCSV = () => {
    if (!bookings || bookings.length === 0) return;

    const headers = ["#", "User", "Seat", "Date", "Slot", "Created At"];
    const rows = bookings.map((b, index) => [
      index + 1,
      b.user?.username || '',
      b.seat?.label || '',
      b.date,
      b.slot,
      b.createdAt ? format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm:ss') : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">View All Bookings</h1>
          <p className="text-muted-foreground mt-1">
            Filter and manage all office bookings
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by Date:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!bookings || bookings.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : bookings && bookings.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking, index) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{booking.user?.username || 'N/A'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {booking.seat?.label || 'N/A'}
                        {booking.seat?.type === 'REGULAR' && <span>🖥️</span>}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(booking.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        booking.slot === 'FULL'
                          ? 'bg-purple-100 text-purple-700'
                          : booking.slot === 'AM'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {booking.slot}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {booking.createdAt ? format(new Date(booking.createdAt), 'MMM dd, HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel this booking for {booking.user?.username} at seat {booking.seat?.label}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No, keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelBooking.mutate(booking.id)}>
                              Yes, cancel booking
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No bookings found for {format(selectedDate, 'MMMM dd, yyyy')}</p>
            <p className="text-sm mt-2">Try selecting a different date</p>
          </div>
        )}
      </Card>
    </div>
  );
}
