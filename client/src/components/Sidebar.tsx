import { Link, useLocation } from "wouter";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Menu, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
const aiIcon = "/ai-icon.png";

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { data: conversations, isLoading } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = conversations?.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNew = async () => {
    const newConv = await createConversation.mutateAsync();
    if (newConv) window.location.href = `/chat/${newConv.id}`;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: "#000" }}>
      {/* Top: logo + toggle */}
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#1a1a1a" }}
          >
            <img
              src={aiIcon}
              alt="AI"
              className="w-8 h-8 object-cover"
              style={{ filter: "invert(1)" }}
            />
          </div>
          <span className="font-semibold text-white/90 text-sm tracking-wide">TekGPT</span>
        </div>
      </div>

      {/* Nav items */}
      <div className="px-2 py-1 space-y-0.5">
        <button
          data-testid="button-new-chat"
          onClick={handleCreateNew}
          disabled={createConversation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all text-left"
        >
          {createConversation.isPending
            ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            : <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          }
          New chat
        </button>

        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all text-left"
          onClick={() => {
            const el = document.getElementById('sidebar-search');
            el?.focus();
          }}
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Search chats
        </button>
      </div>

      {/* Search input (hidden, triggered by search button) */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <input
            id="sidebar-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            data-testid="input-search"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none transition-all text-white/70 placeholder:text-white/25"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
          />
        </div>
      </div>

      {/* Recents */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider px-3 py-2 mt-1">
          Recents
        </p>

        {isLoading ? (
          <div className="space-y-1 px-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : filteredConversations?.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 text-white/15" />
            <p className="text-xs text-white/25">No conversations yet</p>
          </div>
        ) : (
          filteredConversations?.map((conv) => {
            const isActive = location === `/chat/${conv.id}`;
            return (
              <div key={conv.id} className="group relative flex items-center">
                <Link
                  href={`/chat/${conv.id}`}
                  data-testid={`link-conversation-${conv.id}`}
                  className={cn(
                    "flex-1 flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-150 truncate",
                    isActive
                      ? "text-white"
                      : "text-white/55 hover:text-white/90"
                  )}
                  style={isActive ? { background: "rgba(255,255,255,0.08)" } : {}}
                >
                  <span className="truncate pr-6 text-sm">{conv.title}</span>
                </Link>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteConversation.mutate(conv.id);
                  }}
                  data-testid={`button-delete-${conv.id}`}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-white/25 hover:text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", paddingTop: "12px" }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-all cursor-default">
          <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden" style={{ background: "#000" }}>
            <img src={aiIcon} alt="AI" className="w-7 h-7 object-cover" style={{ filter: "invert(1)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/70 truncate">Guest User</p>
            <p className="text-[10px] text-white/30 truncate">Powered by Groq</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute left-3 top-3 z-50 h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className={cn("hidden md:block w-64 h-screen shrink-0", className)}>
        <SidebarContent />
      </div>
    </>
  );
}
