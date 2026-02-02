import { getEnv } from './env';
import type { FileAttachment } from './files';

const API_URL = 'https://api.perplexity.ai/chat/completions';

export const MODELS = ['sonar', 'sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research'] as const;
export type Model = (typeof MODELS)[number];

export interface SearchResult {
  title: string;
  url: string;
  date?: string;
}

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onDone: (citations: SearchResult[], usage: { prompt_tokens: number; completion_tokens: number }) => void;
  onError: (error: Error) => void;
}

interface MessageContent {
  type: 'text' | 'file_url' | 'image_url';
  text?: string;
  file_url?: { url: string };
  image_url?: { url: string };
  file_name?: string;
}

function buildMessages(query: string, file?: FileAttachment): { role: string; content: string | MessageContent[] }[] {
  if (!file) {
    return [{ role: 'user', content: query }];
  }

  const content: MessageContent[] = [
    { type: 'text', text: query },
  ];

  if (file.type === 'image') {
    // Images: use image_url with data URL prefix per Perplexity API spec
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mimeType};base64,${file.data}` },
    });
  } else {
    // Documents: use file_url with raw base64
    content.push({
      type: 'file_url',
      file_url: { url: file.data },
      file_name: file.filename,
    });
  }

  return [{ role: 'user', content }];
}

export async function search(
  query: string,
  model: Model,
  callbacks: StreamCallbacks,
  file?: FileAttachment
): Promise<void> {
  const body = JSON.stringify({
    model,
    messages: buildMessages(query, file),
    stream: true,
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getEnv().PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    callbacks.onError(new Error(`API error ${response.status}: ${text}`));
    return;
  }

  if (!response.body) {
    callbacks.onError(new Error('No response body'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let citations: SearchResult[] = [];
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let parseErrors = 0;
  let unexpectedLines = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      if (!line.startsWith('data: ')) {
        if (!line.startsWith(':')) {
          unexpectedLines++;
          if (unexpectedLines <= 3) {
            console.error(`[pplx] Unexpected SSE line: ${line.slice(0, 100)}${line.length > 100 ? '...' : ''}`);
          }
        }
        continue;
      }

      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          callbacks.onContent(delta);
        }

        if (parsed.search_results) {
          citations = parsed.search_results;
        }
        if (parsed.usage) {
          usage = parsed.usage;
        }
      } catch {
        parseErrors++;
        if (parseErrors <= 3) {
          console.error(`[pplx] Failed to parse JSON: ${data.slice(0, 100)}${data.length > 100 ? '...' : ''}`);
        }
        continue;
      }
    }
  }

  if (parseErrors > 0 || unexpectedLines > 0) {
    console.error(`[pplx] Stream completed with ${parseErrors} parse errors, ${unexpectedLines} unexpected lines`);
  }

  callbacks.onDone(citations, usage);
}

