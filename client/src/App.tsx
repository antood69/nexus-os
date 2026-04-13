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
import SettingsPage from "@/pages/SettingsPage";
import TokenUsagePage from "@/pages/TokenUsagePage";
import LoginPage from "@/pages/LoginPage";
import AdminPage from "@/pages/AdminPage";
import MarketplacePage from "@/pages/MarketplacePage";
import MarketplaceDetailPage from "@/pages/MarketplaceDetailPage";
import MyListingsPage from "@/pages/MyListingsPage";
import ToolsPage from "@/pages/ToolsPage";
import BossPage from "@/pages/BossPage";
import CustomizationPage from "@/pages/CustomizationPage";
import AccountStacksPage from "@/pages/AccountStacksPage";
import FiverrPage from "@/pages/FiverrPage";
import JarvisPage from "@/pages/JarvisPage";
import AppGeneratorPage from "@/pages/AppGeneratorPage";
import WhiteLabelPage from "@/pages/WhiteLabelPage";
import PropTradingPage from "@/pages/PropTradingPage";
import AppLayout from "@/components/AppLayout";
import JarvisWidget from "@/components/JarvisWidget";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppRouter() {
  return (
    <Switch>
      {/* Public routes — no AppLayout */}
      <Route path="/login" component={LoginPage} />
      <Route path="/marketplace" component={() => <AppLayout allowPublic><ErrorBoundary><MarketplacePage /></ErrorBoundary></AppLayout>} />
      <Route path="/marketplace/:id" component={() => <AppLayout allowPublic><ErrorBoundary><MarketplaceDetailPage /></ErrorBoundary></AppLayout>} />

      {/* Protected routes — wrapped in AppLayout */}
      <Route>
        <AppLayout>
          <ErrorBoundary>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/boss" component={BossPage} />
            <Route path="/workflows" component={WorkflowsPage} />
            <Route path="/workflows/:id" component={WorkflowDetailPage} />
            <Route path="/agents" component={AgentsPage} />
            <Route path="/agents/:id/chat" component={AgentChatPage} />
            <Route path="/audit" component={AuditPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/journal" component={TradingJournalPage} />
            <Route path="/bot-challenge" component={BotChallengePage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/usage" component={TokenUsagePage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/marketplace" component={MarketplacePage} />
            <Route path="/marketplace/my" component={MyListingsPage} />
            <Route path="/marketplace/:id" component={MarketplaceDetailPage} />
            <Route path="/tools" component={ToolsPage} />
            <Route path="/customize" component={CustomizationPage} />
            <Route path="/stacks" component={AccountStacksPage} />
            <Route path="/fiverr" component={FiverrPage} />
            <Route path="/jarvis" component={JarvisPage} />
            <Route path="/app-generator" component={AppGeneratorPage} />
            <Route path="/white-label" component={WhiteLabelPage} />
            <Route path="/prop-trading" component={PropTradingPage} />
            <Route component={NotFound} />
          </Switch>
          </ErrorBoundary>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
            <JarvisWidget />
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
