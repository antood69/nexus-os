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

      {/* Protected routes — wrapped in AppLayout, each major section gets its own ErrorBoundary */}
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={() => <ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/boss" component={() => <ErrorBoundary><BossPage /></ErrorBoundary>} />
            <Route path="/workflows" component={() => <ErrorBoundary><WorkflowsPage /></ErrorBoundary>} />
            <Route path="/workflows/:id" component={() => <ErrorBoundary><WorkflowDetailPage /></ErrorBoundary>} />
            <Route path="/agents" component={() => <ErrorBoundary><AgentsPage /></ErrorBoundary>} />
            <Route path="/agents/:id/chat" component={() => <ErrorBoundary><AgentChatPage /></ErrorBoundary>} />
            <Route path="/audit" component={() => <ErrorBoundary><AuditPage /></ErrorBoundary>} />
            <Route path="/pricing" component={() => <ErrorBoundary><PricingPage /></ErrorBoundary>} />
            <Route path="/journal" component={() => <ErrorBoundary><TradingJournalPage /></ErrorBoundary>} />
            <Route path="/bot-challenge" component={() => <ErrorBoundary><BotChallengePage /></ErrorBoundary>} />
            <Route path="/settings" component={() => <ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            <Route path="/usage" component={() => <ErrorBoundary><TokenUsagePage /></ErrorBoundary>} />
            <Route path="/admin" component={() => <ErrorBoundary><AdminPage /></ErrorBoundary>} />
            <Route path="/marketplace" component={() => <ErrorBoundary><MarketplacePage /></ErrorBoundary>} />
            <Route path="/marketplace/my" component={() => <ErrorBoundary><MyListingsPage /></ErrorBoundary>} />
            <Route path="/marketplace/:id" component={() => <ErrorBoundary><MarketplaceDetailPage /></ErrorBoundary>} />
            <Route path="/tools" component={() => <ErrorBoundary><ToolsPage /></ErrorBoundary>} />
            <Route path="/customize" component={() => <ErrorBoundary><CustomizationPage /></ErrorBoundary>} />
            <Route path="/stacks" component={() => <ErrorBoundary><AccountStacksPage /></ErrorBoundary>} />
            <Route path="/fiverr" component={() => <ErrorBoundary><FiverrPage /></ErrorBoundary>} />
            <Route path="/jarvis" component={() => <ErrorBoundary><JarvisPage /></ErrorBoundary>} />
            <Route path="/app-generator" component={() => <ErrorBoundary><AppGeneratorPage /></ErrorBoundary>} />
            <Route path="/white-label" component={() => <ErrorBoundary><WhiteLabelPage /></ErrorBoundary>} />
            <Route path="/prop-trading" component={() => <ErrorBoundary><PropTradingPage /></ErrorBoundary>} />
            <Route component={NotFound} />
          </Switch>
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
