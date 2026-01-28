import { useBookings } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isFuture } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Armchair, Trash2, AlertCircle } from "lucide-react";
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

export default function MyBookings() {
  const { user } = useAuth();
  const { bookings, isLoading, cancelBooking } = useBookings({ userId: String(user?.id) });

  if (isLoading) return null;

  const sortedBookings = bookings?.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
  const upcoming = sortedBookings.filter(b => isFuture(parseISO(b.date)) || b.date === format(new Date(), 'yyyy-MM-dd'));
  const past = sortedBookings.filter(b => !isFuture(parseISO(b.date)) && b.date !== format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl">
          <CalendarDays className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display">My Bookings</h1>
          <p className="text-muted-foreground">Manage your upcoming workspace reservations</p>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Upcoming ({upcoming.length})
        </h2>
        
        {upcoming.length === 0 ? (
          <Card className="border-dashed border-2 bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Armchair className="w-12 h-12 mb-4 opacity-20" />
              <p>No upcoming bookings found.</p>
              <Button variant="link" asChild className="mt-2">
                <a href="/dashboard">Book a seat now</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((booking) => (
              <Card key={booking.id} className="group hover:shadow-md transition-all border-l-4 border-l-primary">
                <CardContent className="p-6 flex justify-between items-center">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <CalendarDays className="w-4 h-4" />
                      {format(parseISO(booking.date), "EEEE, MMMM do, yyyy")}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {booking.slot === 'AM' ? 'Morning (08:00 - 13:00)' : 
                         booking.slot === 'PM' ? 'Afternoon (13:00 - 18:00)' : 'Full Day'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-secondary px-3 py-1 rounded-full text-sm font-semibold">
                        Seat {booking.seat.label}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {booking.seat.type}
                      </span>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel your reservation for {format(parseISO(booking.date), "MMM do")}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => cancelBooking.mutate(booking.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Yes, Cancel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <div className="border-t pt-8 mt-8">
              <h2 className="text-lg font-semibold text-muted-foreground mb-4">Past Bookings</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {past.map((booking) => (
                  <Card key={booking.id} className="bg-secondary/50">
                    <CardContent className="p-4">
                      <p className="font-medium text-sm">{format(parseISO(booking.date), "MMM do, yyyy")}</p>
                      <p className="text-xs mt-1">Seat {booking.seat.label} • {booking.slot}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
