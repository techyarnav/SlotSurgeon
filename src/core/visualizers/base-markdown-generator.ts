export class BaseMarkdownGenerator {
  protected formatHeader(level: number, text: string): string {
    return `${'#'.repeat(level)} ${text}\n\n`;
  }

  protected formatTable(headers: string[], rows: string[][]): string {
    let table = `| ${headers.join(' | ')} |\n`;
    table += `| ${headers.map(() => '---').join(' | ')} |\n`;

    rows.forEach(row => {
      table += `| ${row.join(' | ')} |\n`;
    });

    return table + '\n';
  }

  protected formatCodeBlock(code: string, language = ''): string {
    return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }

  protected formatList(items: string[], ordered = false): string {
    return items.map((item, index) => {
      const bullet = ordered ? `${index + 1}.` : '-';
      return `${bullet} ${item}\n`;
    }).join('') + '\n';
  }

  protected formatBold(text: string): string {
    return `**${text}**`;
  }

  protected formatItalic(text: string): string {
    return `*${text}*`;
  }

  protected formatCode(text: string): string {
    return `\`${text}\``;
  }

  protected formatLink(text: string, url: string): string {
    return `[${text}](${url})`;
  }

  protected formatEmoji(emoji: string, text: string): string {
    return `${emoji} ${text}`;
  }

  protected generateMetadata(): string {
    return `---
title: "SlotSurgeon Analysis Report"
generated: "${new Date().toISOString()}"
tool: "SlotSurgeon"
---

`;
  }
}
