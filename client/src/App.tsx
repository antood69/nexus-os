import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import WorkflowsPage from "@/pages/WorkflowsPage";
import AgentsPage from "@/pages/AgentsPage";
import AgentChatPage from "@/pages/AgentChatPage";
import WorkflowDetailPage from "@/pages/WorkflowDetailPage";
import AuditPage from "@/pages/AuditPage";
import PricingPage from "@/pages/PricingPage";
import TradingJournalPage from "@/pages/TradingJournalPage";
import BotChallengePage from "@/pages/BotChallengePage";
import AppLayout from "@/components/AppLayout";
import JarvisWidget from "@/components/JarvisWidget";

function AppRouter() {
  return (
    <>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/workflows" component={WorkflowsPage} />
          <Route path="/workflows/:id" component={WorkflowDetailPage} />
          <Route path="/agents" component={AgentsPage} />
          <Route path="/agents/:id/chat" component={AgentChatPage} />
          <Route path="/audit" component={AuditPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/journal" component={TradingJournalPage} />
          <Route path="/bot-challenge" component={BotChallengePage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
      <JarvisWidget />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
