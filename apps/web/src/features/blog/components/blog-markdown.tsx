import type { ElementType, ReactNode } from 'react';

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function normalizeContent(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gis, (_, level: string, content: string) => `\n${'#'.repeat(Number(level))} ${stripTags(content)}\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, content: string) => `\n${stripTags(content)}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gis, '**$2**')
    .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gis, '*$2*')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, (_, content: string) => `\n- ${stripTags(content)}`)
    .replace(/<[^>]+>/g, '')
    .trim();
}

function renderInline(value: string): ReactNode[] {
  const tokens = value.split(/(\*\*.+?\*\*|\*.+?\*|`.+?`|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('*') && token.endsWith('*')) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label = '', href = ''] = link;
      const safeHref = href.startsWith('/') || href.startsWith('https://') || href.startsWith('http://') ? href : null;
      return safeHref ? <a key={index} href={safeHref}>{label}</a> : token;
    }
    return token;
  });
}

export function BlogMarkdown({ content }: { content: string }) {
  const lines = normalizeContent(content).split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];
  let orderedList: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const text = quote.join(' ');
    const isTip = /^(نکته|tip)\s*[:：]/i.test(text);
    blocks.push(
      <blockquote key={`quote-${blocks.length}`} className={isTip ? 'blog-blockquote blog-tip' : 'blog-blockquote'}>
        {renderInline(text)}
      </blockquote>,
    );
    quote = [];
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {list.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
        </ul>,
      );
      list = [];
    }
    if (orderedList.length) {
      blocks.push(
        <ol key={`ol-${blocks.length}`}>
          {orderedList.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
        </ol>,
      );
      orderedList = [];
    }
  };
  const flushCode = () => {
    if (!code.length) return;
    blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join('\n')}</code></pre>);
    code = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushQuote();
      flushList();
      if (inCode) flushCode();
      inCode = !inCode;
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushQuote();
      flushList();
      const level = Math.min(heading[1]?.length ?? 1, 4);
      const Heading = `h${level}` as ElementType;
      blocks.push(<Heading key={`h-${blocks.length}`}>{renderInline(heading[2] ?? '')}</Heading>);
      return;
    }
    const quoteLine = line.match(/^\s*>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1] ?? '');
      return;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      flushQuote();
      list.push(unordered[1] ?? '');
      return;
    }
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushQuote();
      orderedList.push(ordered[1] ?? '');
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushQuote();
      flushList();
      return;
    }
    flushQuote();
    flushList();
    paragraph.push(line.trim());
  });

  flushParagraph();
  flushQuote();
  flushList();
  flushCode();
  return <div className="blog-markdown">{blocks}</div>;
}
