"use client"

import { useEffect, useState } from "react"
import type { Message as AIMessage } from "@ai-sdk/react"

interface ParsedContent {
  beforeToolCalls: string
  afterToolCalls: string
}

export function useMessageParser(message: AIMessage): ParsedContent {
  const [parsedContent, setParsedContent] = useState<ParsedContent>({
    beforeToolCalls: message.content || "",
    afterToolCalls: "",
  })

  useEffect(() => {
    if (!message.content || !message.toolInvocations?.length) {
      setParsedContent({
        beforeToolCalls: message.content || "",
        afterToolCalls: "",
      })
      return
    }

    // In a real implementation, we would use the actual streaming data
    // to determine where tool calls were inserted in the content.
    // For this demo, we'll use a heuristic approach:

    // 1. Split the content by common tool call indicators
    const toolCallIndicators = [
      "I'll check that for you",
      "Let me look that up",
      "Let me check",
      "I'll search for",
      "I'll get the weather",
      "I'll find the news",
    ]

    let splitIndex = message.content.length

    for (const indicator of toolCallIndicators) {
      const index = message.content.indexOf(indicator)
      if (index !== -1 && index < splitIndex) {
        splitIndex = index
      }
    }

    // 2. If we found a potential split point, use it
    if (splitIndex < message.content.length) {
      setParsedContent({
        beforeToolCalls: message.content.substring(0, splitIndex).trim(),
        afterToolCalls: message.content.substring(splitIndex).trim(),
      })
    } else {
      // 3. Fallback: assume 70% of content is before tool calls
      const fallbackSplitIndex = Math.floor(message.content.length * 0.7)
      setParsedContent({
        beforeToolCalls: message.content.substring(0, fallbackSplitIndex).trim(),
        afterToolCalls: message.content.substring(fallbackSplitIndex).trim(),
      })
    }
  }, [message.content, message.toolInvocations])

  return parsedContent
}
