'use client'

import { useState } from 'react'
import { Sparkles, ChevronRight, MessageSquare, SquarePen } from 'lucide-react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime, AssistantChatTransport } from '@assistant-ui/react-ai-sdk'
import { Thread } from '@/components/assistant-ui/thread'

interface AiChatPanelProps {
  workspaceId: number
  hasAiKey: boolean
}

function ChatRuntime({ workspaceId, children }: { workspaceId: number; children: React.ReactNode }) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: '/api/chat',
      body: { workspaceId },
    }),
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}

export function AiChatPanel({ workspaceId, hasAiKey }: AiChatPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [chatKey, setChatKey] = useState(0)

  if (!isExpanded) {
    return (
      <aside className="w-12 shrink-0 flex flex-col items-center h-screen border-l border-border bg-card py-3 gap-2">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          title="Open AI chat"
        >
          <Sparkles className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setIsExpanded(true)}
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Chat"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-[320px] shrink-0 flex flex-col h-screen border-l border-border bg-card">
      <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold text-foreground">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChatKey((k) => k + 1)}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="New chat"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Collapse"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hasAiKey ? (
        <div className="flex-1 min-h-0" key={chatKey}>
          <ChatRuntime workspaceId={workspaceId}>
            <Thread />
          </ChatRuntime>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-[13px] font-medium text-foreground mb-1">AI chat not configured</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Set <code className="text-[10px] bg-muted px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> in your environment to enable AI chat and signal enrichment.
          </p>
        </div>
      )}
    </aside>
  )
}
