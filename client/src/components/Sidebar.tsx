import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Armchair,
  CalendarDays,
  LogOut,
  User,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const links = [
    { href: isAdmin ? "/admin" : "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    isAdmin && { href: "/admin/seats", icon: Armchair, label: "Manage Seats" },
    !isAdmin && { href: "/bookings", icon: CalendarDays, label: "My Bookings" },
  ].filter(Boolean);

  return (
    <div className="h-screen w-64 bg-card border-r border-border fixed left-0 top-0 flex flex-col shadow-xl z-50">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <img src="/ufinityLogo.svg" alt="Ufinity" className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              HotDesk
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Workspace Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => (
          link && (
            <Link key={link.href} href={link.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
              location === link.href
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <link.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
              {link.label}
            </Link>
          )
        ))}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="bg-secondary/50 rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
