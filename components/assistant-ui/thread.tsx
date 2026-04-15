'use client'

import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from '@assistant-ui/react'
import { Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <ThreadPrimitive.Empty>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-[13px] font-medium text-foreground mb-1">
              Ask about your repos
            </p>
            <p className="text-[11px] text-muted-foreground">
              I can analyze health scores, find stale PRs, summarize your
              workspace, and more.
            </p>
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <Composer />
    </ThreadPrimitive.Root>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col items-end gap-1">
      <div className="max-w-[280px] rounded-lg rounded-br-none px-3 py-2 text-[12px] leading-relaxed bg-primary text-primary-foreground">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Sparkles className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground">
          Signals AI
        </span>
      </div>
      <div className="max-w-[280px] rounded-lg rounded-bl-none px-3 py-2 text-[12px] leading-relaxed bg-muted text-foreground">
        <MessagePrimitive.Content
          components={{
            Text: AssistantText,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="p-3 pt-0 flex gap-2">
      <ComposerPrimitive.Input
        placeholder="Ask about your repos..."
        rows={2}
        className="flex-1 text-[12px] resize-none rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
      />
      <ComposerPrimitive.Send className="w-8 h-8 self-end rounded-md bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0">
        <Send className="w-3.5 h-3.5 text-primary-foreground" />
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  )
}
