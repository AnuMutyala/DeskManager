import { useSeats } from "@/hooks/use-seats";
import { useBookings } from "@/hooks/use-bookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Armchair, Users, CalendarCheck, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, subDays } from "date-fns";

export default function AdminDashboard() {
  const { seats } = useSeats();
  const { bookings } = useBookings();

  // Basic stats
  const totalSeats = seats?.length || 0;
  const totalBookings = bookings?.length || 0;
  const activeBookings = bookings?.filter(b => new Date(b.date) >= new Date()).length || 0;
  const uniqueUsers = new Set(bookings?.map(b => b.userId)).size || 0;

  // Chart data: Bookings per day for last 7 days
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const count = bookings?.filter(b => b.date === dateStr).length || 0;
    return {
      date: format(date, "EEE"),
      bookings: count
    };
  });

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-bold font-display mt-2">{value}</h3>
        </div>
        <div className={`p-4 rounded-xl ${color} bg-opacity-10 text-opacity-100`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-8 space-y-8 animate-in max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display">Admin Overview</h1>
        <p className="text-muted-foreground">Monitor workspace usage and occupancy trends</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Seats" value={totalSeats} icon={Armchair} color="bg-blue-500" />
        <StatCard title="Active Bookings" value={activeBookings} icon={CalendarCheck} color="bg-green-500" />
        <StatCard title="Unique Users" value={uniqueUsers} icon={Users} color="bg-purple-500" />
        <StatCard title="Total History" value={totalBookings} icon={TrendingUp} color="bg-orange-500" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Booking Trends (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#F1F5F9' }}
                  />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookings?.slice(0, 5).map(booking => (
                <div key={booking.id} className="flex items-center gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {booking.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium truncate">
                      {booking.user.username} booked Seat {booking.seat.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(booking.date), "MMM d")} • {booking.slot}
                    </p>
                  </div>
                </div>
              ))}
              {!bookings?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
