import axios from 'axios'
import { logger } from '../utils/logger'

export interface SearchRuntimeConfig {
  provider?: 'bing' | 'google' | 'custom' | 'duckduckgo'
  enabled?: boolean
  apiKey?: string
  engineId?: string
}

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source: string
}

export interface BingSearchResponse {
  webPages?: {
    value: Array<{
      name: string
      snippet: string
      url: string
    }>
  }
}

export interface GoogleSearchResponse {
  items?: Array<{
    title: string
    snippet: string
    link: string
  }>
}

export interface DuckDuckGoTopic {
  Text?: string
  FirstURL?: string
  Topics?: DuckDuckGoTopic[]
}

export interface DuckDuckGoResponse {
  Abstract?: string
  AbstractText?: string
  AbstractURL?: string
  RelatedTopics?: DuckDuckGoTopic[]
}

export class SearchService {
  private async searchBing(query: string, config?: SearchRuntimeConfig): Promise<SearchResult[]> {
    try {
      const apiKey = config?.apiKey
      if (!apiKey) {
        logger.warn('Bing Search API key not configured, skipping Bing search')
        return []
      }

      const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10&mkt=zh-CN`

      logger.info('Calling Bing Search API', { query })

      const response = await axios.get<BingSearchResponse>(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        },
        timeout: 10000
      })

      const results: SearchResult[] = []

      if (response.data.webPages?.value) {
        response.data.webPages.value.slice(0, 5).forEach(item => {
          results.push({
            title: item.name,
            snippet: item.snippet,
            url: item.url,
            source: 'bing'
          })
        })
      }

      logger.info('Bing search completed', {
        query,
        resultCount: results.length
      })

      return results

    } catch (error: any) {
      logger.error('Bing search failed', {
        error: error.message,
        query,
        stack: error.stack
      })
      return []
    }
  }

  private async searchGoogle(query: string, config?: SearchRuntimeConfig): Promise<SearchResult[]> {
    try {
      const apiKey = config?.apiKey
      const searchEngineId = config?.engineId

      if (!apiKey || !searchEngineId) {
        logger.warn('Google Search API key or engine ID not configured, skipping Google search')
        return []
      }

      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10&hl=zh-CN`

      logger.info('Calling Google Search API', { query })

      const response = await axios.get<GoogleSearchResponse>(url, {
        timeout: 10000
      })

      const results: SearchResult[] = []

      if (response.data.items) {
        response.data.items.slice(0, 5).forEach(item => {
          results.push({
            title: item.title,
            snippet: item.snippet,
            url: item.link,
            source: 'google'
          })
        })
      }

      logger.info('Google search completed', {
        query,
        resultCount: results.length
      })

      return results

    } catch (error: any) {
      logger.error('Google search failed', {
        error: error.message,
        query,
        stack: error.stack
      })
      return []
    }
  }

  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`

      logger.info('Calling DuckDuckGo Search API', { query })

      const response = await axios.get<DuckDuckGoResponse>(url, {
        timeout: 10000
      })

      const results: SearchResult[] = []

      const abstractText = response.data.AbstractText?.trim()
      const abstractUrl = response.data.AbstractURL?.trim()
      if (abstractText && abstractUrl) {
        results.push({
          title: `${query} - 概览`,
          snippet: abstractText,
          url: abstractUrl,
          source: 'duckduckgo'
        })
      }

      const flattenTopics = (topics: DuckDuckGoTopic[] = []): DuckDuckGoTopic[] => {
        const flat: DuckDuckGoTopic[] = []
        for (const t of topics) {
          if (t.Text && t.FirstURL) {
            flat.push(t)
          }
          if (t.Topics && t.Topics.length > 0) {
            flat.push(...flattenTopics(t.Topics))
          }
        }
        return flat
      }

      const related = flattenTopics(response.data.RelatedTopics)
      related.slice(0, 5).forEach(item => {
        if (!item.Text || !item.FirstURL) return
        results.push({
          title: item.Text.split(' - ')[0] || item.Text,
          snippet: item.Text,
          url: item.FirstURL,
          source: 'duckduckgo'
        })
      })

      logger.info('DuckDuckGo search completed', {
        query,
        resultCount: results.length
      })

      return results
    } catch (error: any) {
      logger.error('DuckDuckGo search failed', {
        error: error.message,
        query,
        stack: error.stack
      })
      return []
    }
  }

  async search(query: string, config?: SearchRuntimeConfig): Promise<SearchResult[]> {
    try {
      logger.info('Starting search operation', { query })

      if (config?.enabled === false) {
        return []
      }

      const provider = config?.provider
      if (provider === 'bing') {
        return await this.searchBing(query, config)
      }
      if (provider === 'google') {
        return await this.searchGoogle(query, config)
      }
      if (provider === 'duckduckgo') {
        return await this.searchDuckDuckGo(query)
      }
      if (provider === 'custom') {
        logger.warn('Custom search provider not implemented, skipping search')
        return []
      }

      const [bingResults, googleResults] = await Promise.allSettled([
        this.searchBing(query, config),
        this.searchGoogle(query, config)
      ])

      const allResults: SearchResult[] = []

      // Collect successful results
      if (bingResults.status === 'fulfilled') {
        allResults.push(...bingResults.value)
      }

      if (googleResults.status === 'fulfilled') {
        allResults.push(...googleResults.value)
      }

      // Remove duplicates based on URL
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.url === result.url)
      )

      // Limit to top 10 results
      const finalResults = uniqueResults.slice(0, 10)

      logger.info('Search operation completed', {
        query,
        totalResults: finalResults.length,
        bingResults: bingResults.status === 'fulfilled' ? bingResults.value.length : 0,
        googleResults: googleResults.status === 'fulfilled' ? googleResults.value.length : 0
      })

      return finalResults

    } catch (error: any) {
      logger.error('Search operation failed', {
        error: error.message,
        query,
        stack: error.stack
      })
      throw new Error(`Search failed: ${error.message}`)
    }
  }

  // Simple fallback search (mock data for development)
  async mockSearch(query: string): Promise<SearchResult[]> {
    logger.info('Using mock search results', { query })

    return [
      {
        title: `${query} - 基本概念`,
        snippet: `这是关于${query}的基本概念介绍，包括定义、特点和应用场景。`,
        url: `https://example.com/${encodeURIComponent(query)}/basics`,
        source: 'mock'
      },
      {
        title: `${query} - 进阶指南`,
        snippet: `深入了解${query}的高级用法和最佳实践。`,
        url: `https://example.com/${encodeURIComponent(query)}/advanced`,
        source: 'mock'
      },
      {
        title: `${query} - 实战案例`,
        snippet: `${query}在实际项目中的应用案例分析。`,
        url: `https://example.com/${encodeURIComponent(query)}/examples`,
        source: 'mock'
      }
    ]
  }
}

// Export singleton instance
export const searchService = new SearchService()
