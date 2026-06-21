import { Link, useLocation } from "wouter";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Menu, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import aiIcon from "@assets/image_1782035573865.png";

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
    if (newConv) {
      window.location.href = `/chat/${newConv.id}`;
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full border-r" style={{ background: "#000", borderColor: "rgba(255,255,255,0.08)" }}>
      {/* Brand Header */}
      <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <img src={aiIcon} alt="AI" className="w-5 h-5 invert" />
          </div>
          <span className="font-semibold text-white text-base">AI Chat</span>
        </div>
        <Button
          onClick={handleCreateNew}
          disabled={createConversation.isPending}
          data-testid="button-new-chat"
          className="w-full justify-start gap-2 h-10 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20 transition-all shadow-none"
        >
          {createConversation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            data-testid="input-search"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none transition-all text-white/80 placeholder:text-white/25"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {isLoading ? (
          <div className="space-y-2 px-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        ) : filteredConversations?.length === 0 ? (
          <div className="text-center py-10 px-4 text-white/25 text-sm">
            <MessageSquare className="h-7 w-7 mx-auto mb-3 opacity-20" />
            <p>No conversations yet</p>
          </div>
        ) : (
          filteredConversations?.map((conv) => (
            <div key={conv.id} className="group relative flex items-center">
              <Link
                href={`/chat/${conv.id}`}
                data-testid={`link-conversation-${conv.id}`}
                className={cn(
                  "flex-1 flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border border-transparent",
                  location === `/chat/${conv.id}`
                    ? "text-white border-white/10"
                    : "text-white/60 hover:text-white/90"
                )}
                style={
                  location === `/chat/${conv.id}`
                    ? { background: "rgba(255,255,255,0.08)" }
                    : {}
                }
                onMouseEnter={e => {
                  if (location !== `/chat/${conv.id}`) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={e => {
                  if (location !== `/chat/${conv.id}`) {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }
                }}
              >
                <span className="font-medium truncate pr-6 block text-sm">{conv.title}</span>
                <span className="text-[10px] text-white/25 font-normal">
                  {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                </span>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteConversation.mutate(conv.id);
                }}
                data-testid={`button-delete-${conv.id}`}
                className="absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-md"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
            <img src={aiIcon} alt="AI" className="w-4 h-4 invert" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">Guest User</p>
            <p className="text-[10px] text-white/30 truncate">Powered by Groq</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden absolute left-4 top-4 z-50 text-white/60 hover:text-white hover:bg-white/10">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 border-r-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className={cn("hidden md:block w-72 h-screen shrink-0", className)}>
        <SidebarContent />
      </div>
    </>
  );
}
