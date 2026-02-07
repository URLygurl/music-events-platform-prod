import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-4 py-8 flex flex-col items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center space-y-4">
          <User className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sign in to view your profile</p>
          <Button onClick={() => { window.location.href = "/api/login"; }} data-testid="button-sign-in">
            Sign in
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-8 flex flex-col items-center">
        <Avatar className="w-20 h-20 mb-4">
          <AvatarImage src={user?.profileImageUrl || undefined} />
          <AvatarFallback className="text-lg">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </AvatarFallback>
        </Avatar>

        <h2 className="text-lg font-semibold" data-testid="text-profile-name">
          {user?.firstName} {user?.lastName}
        </h2>
        {user?.email && (
          <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
            {user.email}
          </p>
        )}

        <Button
          variant="outline"
          className="mt-6"
          onClick={() => logout()}
          data-testid="button-profile-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </Button>
      </div>
    </AppLayout>
  );
}
