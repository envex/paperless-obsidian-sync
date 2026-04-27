export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  tags: number[];
  modified: string;
}

interface PaperlessTag {
  id: number;
  name: string;
}

interface PagedResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

export class PaperlessClient {
  private headers: HeadersInit;

  constructor(
    private baseUrl: string,
    token: string
  ) {
    this.headers = { Authorization: `Token ${token}` };
  }

  async getTags(): Promise<Map<number, string>> {
    const tags = await this.fetchAll<PaperlessTag>("/api/tags/");
    return new Map(tags.map((t) => [t.id, t.name]));
  }

  async getDocuments(modifiedAfter?: Date): Promise<PaperlessDocument[]> {
    let url = "/api/documents/?ordering=modified&fields=id,title,content,tags,modified";
    if (modifiedAfter) {
      url += `&modified__date__gte=${modifiedAfter.toISOString().split("T")[0]}`;
    }
    return this.fetchAll<PaperlessDocument>(url);
  }

  private async fetchAll<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = this.baseUrl + path;

    while (url) {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) throw new Error(`Paperless API error: ${res.status} ${url}`);
      const page: PagedResponse<T> = await res.json();
      results.push(...page.results);
      url = page.next;
    }

    return results;
  }
}
