# My Chat

![Watch the video](https://screen.studio/share/r5ljIy7R)

## Background

MCP servers have come a long way, and it's been easier than ever to create and run MCP servers, but the only way to use them is through Claude Desktop or their code editor. There's no "ChatGPT for MCP" yet.

This was my attempt at creating a simple open source MCP playground, where I could test out MCP servers and see how they work. At its full potential, if MCP is the internet for agents, what does Chromium look like?

I also was heavily inspired by [t3.chat](https://t3.chat), which has some great features that I wanted to replicate, like the tree-based chat history.

## Core Features

- Fully [Vercel AI SDK](https://sdk.vercel.ai/) compatible
- Git-based chat history.
- No database/auth required, just Node.js.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v20 or higher)
- [pnpm](https://pnpm.io/installation) (a faster alternative to npm)

### Running the project

```bash
# Clone the repository
git clone https://github.com/kamath/chat
cd chat

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```
