import { Sidebar } from "@/components/Sidebar";
import { MessageSquare } from "lucide-react";
const aiIcon = "/ai-icon.png";

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden" style={{ background: "#000" }}>
            <img src={aiIcon} alt="AI" className="w-20 h-20 object-cover" style={{ filter: "invert(1)" }} />
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">
              How can I <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">help you?</span>
            </h1>
            <p className="text-lg text-white/50 leading-relaxed">
              Your intelligent assistant for coding, writing, and creative problem solving.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {[
              { icon: "⚡", title: "Fast Responses", desc: "Streaming answers in seconds" },
              { icon: "🎨", title: "Creative", desc: "Ideas, stories, and designs" },
              { icon: "💻", title: "Code", desc: "Write, debug, and explain code" },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl border border-white/8 hover:border-white/15 transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h3 className="font-semibold text-white/90 mb-1 text-sm">{feature.title}</h3>
                <p className="text-xs text-white/40">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="md:hidden mt-12 text-white/30 flex items-center gap-2 text-sm animate-pulse">
          <MessageSquare className="w-4 h-4" />
          Tap the menu to start chatting
        </div>
      </main>
    </div>
  );
}
