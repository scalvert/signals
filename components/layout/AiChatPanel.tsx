'use client'

import { useState, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Sparkles,
  Send,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Wrench,
  Check,
  Loader2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiChatPanelProps {
  workspaceId: number
}

const quickChips = [
  'Which repos need attention?',
  'Show external PRs',
  'What repos have low health?',
  'Summarize this workspace',
]

function ToolCallDisplay({ part }: { part: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const toolType = part.type as string
  const toolName = toolType.replace('tool-', '').replace(/_/g, ' ')
  const state = part.state as string | undefined
  const input = part.input as Record<string, unknown> | undefined
  const output = part.output as unknown

  const isDone = state === 'output-available'
  const isError = state === 'output-error'

  return (
    <div className="my-1.5 rounded-md border border-border bg-background text-foreground">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-muted/50 transition-colors rounded-md"
      >
        {isDone ? (
          <Check className="w-3 h-3 text-[var(--health-a)] shrink-0" />
        ) : isError ? (
          <XCircle className="w-3 h-3 text-[var(--health-d)] shrink-0" />
        ) : (
          <Loader2 className="w-3 h-3 text-muted-foreground animate-spin shrink-0" />
        )}
        <Wrench className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{toolName}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-muted-foreground ml-auto shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-border">
          {input && Object.keys(input).length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Request
              </div>
              <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-[120px] overflow-y-auto">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {isDone && output !== undefined && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Response
              </div>
              <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
          {isError && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Error
              </div>
              <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto text-[var(--health-d)]">
                {(part.errorText as string) ?? 'Unknown error'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AiChatPanel({ workspaceId }: AiChatPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { workspaceId },
      }),
    [workspaceId],
  )
  const { messages, sendMessage, status } = useChat({ transport })

  const isLoading = status === 'streaming' || status === 'submitted'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = (input ?? '').trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInput('')
  }

  function sendQuickChip(text: string) {
    sendMessage({ text })
  }

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
        <button
          onClick={() => setIsExpanded(false)}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Collapse"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
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
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col gap-1',
              msg.role === 'user' ? 'items-end' : 'items-start',
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground">
                  Signals AI
                </span>
              </div>
            )}
            <div
              className={cn(
                'max-w-[280px] rounded-lg px-3 py-2 text-[12px] leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-muted text-foreground rounded-bl-none',
              )}
            >
              {msg.parts.map((part, i) => {
                if (part.type === 'text') {
                  if (msg.role === 'user') {
                    return (
                      <span key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    )
                  }
                  return (
                    <div key={i} className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {part.text}
                      </ReactMarkdown>
                    </div>
                  )
                }
                if (part.type.startsWith('tool-')) {
                  return (
                    <ToolCallDisplay
                      key={i}
                      part={part as unknown as Record<string, unknown>}
                    />
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 px-1 py-2">
            <div className="flex gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Analyzing your repos...
            </span>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
          {quickChips.map((chip) => (
            <button
              key={chip}
              onClick={() => sendQuickChip(chip)}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors bg-background disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 pt-0 flex gap-2">
        <textarea
          value={input ?? ''}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder="Ask about your repos..."
          rows={2}
          className="flex-1 text-[12px] resize-none rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
        />
        <button
          type="submit"
          disabled={!(input ?? '').trim() || isLoading}
          className="w-8 h-8 self-end rounded-md bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
        >
          <Send className="w-3.5 h-3.5 text-primary-foreground" />
        </button>
      </form>
    </aside>
  )
}
