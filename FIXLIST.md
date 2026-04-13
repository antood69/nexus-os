# Bunz — Fix Queue

Items prefixed with "idris" get added here. Fix when current work is done or in a batch pass.

## Bugs
1. **Marketplace crash** — `m.data?.find is not a function` — frontend sends wrong param names (sort→sortBy, price→priceType) + categoriesQuery expects raw array but backend returns `{ categories }` wrapper
2. **Create Bot → 404** — Dashboard QuickAction links to `/bots` but route is `/bot-challenge`
3. **Mobile bottom nav too high** — excessive padding/margin pushing tab bar up from screen edge
4. **Jarvis widget overlaps More button** — floating Jarvis button covers the last tab on mobile

## Enhancements
1. **AI Chat Panel on all creation pages** — App Generator, Bot Challenge, Fiverr, White Label, Workflows all need a conversational assistant for users who don't know what to build
2. **Jarvis should be draggable** — widget mode with touch drag support on mobile
