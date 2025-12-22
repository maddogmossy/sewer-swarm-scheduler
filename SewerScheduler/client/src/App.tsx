import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import SchedulePage from "@/pages/schedule";
import HomePage from "@/pages/home";
import AcceptInvitePage from "@/pages/accept-invite";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          {/* Landing Page */}
          <Route path="/">
            <HomePage />
          </Route>

          {/* Schedule Page */}
          <Route path="/schedule">
            <SchedulePage />
          </Route>

          {/* Accept Invite Page */}
          <Route path="/invite/:token">
            <AcceptInvitePage />
          </Route>

          {/* Fallback to 404 */}
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
