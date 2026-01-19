import OpenAI from 'openai'
import axios from 'axios'
import { logger } from '../utils/logger'

// LLM Provider configuration - dynamically read from environment
const getLLMProvider = (): string => process.env.LLM_PROVIDER || 'openai'

export interface GenerateNodeContentParams {
  theme: string
  searchResults: SearchResult[]
  language: string
  length: 'short' | 'medium' | 'long'
  context?: {
    visibleText?: string
    nodeTree?: string
    parentNode?: {
      id: string
      theme: string
      summary: string
    }
    siblingNodes?: Array<{
      id: string
      theme: string
      summary: string
    }>
  }
  description?: string
}

export interface GenerateIdeasParams {
  theme: string
  searchResults: SearchResult[]
  language: string
  context?: {
    visibleText?: string
    nodeTree?: string
    parentNode?: {
      id: string
      theme: string
      summary: string
    }
    siblingNodes?: Array<{
      id: string
      theme: string
      summary: string
    }>
    childNodes?: Array<{
      id: string
      theme: string
      summary: string
    }>
  }
}

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source: string
}

// Node generation prompt template
const NODE_GENERATION_TEMPLATE = `
任务：根据下面信息生成节点摘要与完整教程（Markdown）。

上下文：
- 用户输入主题：{{theme}}
- 用户描述：{{description}}
- 当前界面可见内容（若有）：{{visibleText}}
- 相关节点树片段（父/子/同级）：{{nodeTree}}
- 检索摘要（来自联网检索）：
{{searchResults}}

要求：
- 输出 JSON：{"summary":"...","content_md":"# ..."}
- content_md 必须是“文章结构”的 Markdown：使用清晰的 H2/H3 标题组织内容；不要生成“目录”或 “Table of Contents” 段落
- 建议结构：引言 → 核心概念 → 步骤与示例 → 常见错误与最佳实践 → 总结与延伸阅读
- 代码块请尽量使用标注（例如 \`\`\`run:python）来标识可执行代码
- 语言：{{language}}
- 长度：建议 {{wordCount}} 字

请确保生成的内容准确、逻辑清晰、具有教育性与实用性。仅返回 JSON。
`

// Idea generation prompt template
const IDEA_GENERATION_TEMPLATE = `
任务：基于给定的主题和上下文，生成相关的知识点联想推荐。

主题：{{theme}}

当前节点可见内容：
{{visibleText}}

相关节点树片段：
{{nodeTree}}

检索到的相关信息：
{{searchResults}}

要求：
- 输出 JSON 数组格式：["推荐1", "推荐2", "推荐3", ...]
- 每个推荐应该是具体的知识点或子主题
- 生成 5-8 个相关推荐
- 语言：{{language}}
- 推荐应该具有逻辑关联性和学习价值
- 考虑当前节点的内容和相关节点树的关系

请提供高质量的相关主题推荐。
`

const MINDMAP_GENERATION_TEMPLATE = `
任务：基于输入内容与检索摘要，生成思维导图数据（层级结构）。

输入内容（可能为 Markdown）：
{{content}}

检索摘要（来自联网检索）：
{{searchResults}}

要求：
- 严格输出 JSON：{"nodes":[{"id":"mindmap-root","text":"主题","parentId":null,"children":["子1","子2"]},...],"edges":[{"fromId":"mindmap-root","toId":"..."}]}
- 节点数量建议不超过 12，层级清晰，children 为子节点 ID 列表
- 语言：{{language}}
- 仅返回 JSON，不要附加说明
`

export class LLMService {
  private getWordCount(length: 'short' | 'medium' | 'long'): number {
    switch (length) {
      case 'short': return 800
      case 'medium': return 1500
      case 'long': return 2500
      default: return 1500
    }
  }

  private async callOpenAI(messages: any[], options: any = {}): Promise<string> {
    // Initialize OpenAI client only when needed
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    })

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      temperature: options.temperature || 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('Empty response from OpenAI API')
    }

    return content
  }

  private async callOllama(messages: any[], options: any = {}): Promise<string> {
    const model = process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud'
    let baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Proxy configuration (for Cloud access)
    const proxyConfig = {
      protocol: 'http',
      host: '127.0.0.1',
      port: 7890
    }

    // Auto-switch to Ollama Cloud if model name contains "cloud"
    let useProxy = false
    if (model.toLowerCase().includes('cloud')) {
      baseUrl = 'https://ollama.com'
      const apiKey = process.env.OLLAMA_API_KEY
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      } else {
        logger.warn('Ollama Cloud model detected but OLLAMA_API_KEY is missing.')
      }
      useProxy = true
      logger.info('Switched to Ollama Cloud API with Proxy', { model, baseUrl, proxy: proxyConfig })
    }

    // Convert to Ollama format
    const ollamaMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    try {
      const response = await axios.post(`${baseUrl}/api/chat`, {
        model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
        }
      }, {
        headers,
        proxy: useProxy ? proxyConfig : false,
        timeout: 300000 // 5 minutes timeout for long generation tasks
      })

      return response.data.message?.content || ''
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message
      logger.error('Ollama API request failed', { error: errorMsg, model, baseUrl })
      throw new Error(`Ollama API error: ${errorMsg}`)
    }
  }

  private formatSearchResults(searchResults: SearchResult[]): string {
    if (!searchResults || searchResults.length === 0) {
      return '暂无检索结果'
    }

    return searchResults
      .slice(0, 5) // Limit to top 5 results
      .map((result, index) =>
        `${index + 1}. ${result.title}: ${result.snippet}`
      )
      .join('\n')
  }

  async generateNodeContent(params: GenerateNodeContentParams): Promise<string> {
    try {
      const { theme, searchResults, language, length, context, description } = params
      const wordCount = this.getWordCount(length)
      const formattedSearchResults = this.formatSearchResults(searchResults)

      const prompt = NODE_GENERATION_TEMPLATE
        .replace('{{theme}}', theme)
        .replace('{{description}}', description || '无')
        .replace('{{visibleText}}', context?.visibleText || '无可见内容')
        .replace('{{nodeTree}}', context?.nodeTree || '无相关节点')
        .replace('{{searchResults}}', formattedSearchResults)
        .replace('{{language}}', language)
        .replace('{{wordCount}}', wordCount.toString())

      const messages = [
        {
          role: 'system',
          content: '你是一个专业的教育内容生成助手，能够根据主题和检索信息生成高质量的教程内容。请确保内容准确、有教育价值，并遵循用户的要求。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const provider = getLLMProvider()
      logger.info(`Calling ${provider} API for node generation`, {
        theme,
        language,
        length,
        searchResultCount: searchResults?.length || 0
      })

      let content: string
      if (provider === 'ollama') {
        content = await this.callOllama(messages, { temperature: 0.7 })
      } else {
        content = await this.callOpenAI(messages, { temperature: 0.7 })
      }

      if (!content) {
        throw new Error(`Empty response from ${provider} API`)
      }

      logger.info('Node content generated successfully', {
        provider,
        theme,
        responseLength: content.length
      })

      return content

    } catch (error: any) {
      logger.error(`Failed to generate node content with ${getLLMProvider()}`, {
        error: error.message,
        theme: params.theme,
        stack: error.stack
      })
      throw new Error(`LLM generation failed: ${error.message}`)
    }
  }

  async generateIdeas(params: GenerateIdeasParams): Promise<string> {
    try {
      const { theme, searchResults, language, context } = params
      const formattedSearchResults = this.formatSearchResults(searchResults)

      const prompt = IDEA_GENERATION_TEMPLATE
        .replace('{{theme}}', theme)
        .replace('{{visibleText}}', context?.visibleText || '暂无可见内容')
        .replace('{{nodeTree}}', context?.nodeTree || '暂无相关节点')
        .replace('{{searchResults}}', formattedSearchResults)
        .replace('{{language}}', language)

      const messages = [
        {
          role: 'system',
          content: '你是一个专业的知识关联助手，能够根据主题生成相关知识点的推荐。请确保推荐的内容具有教育价值和逻辑关联性。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const provider = getLLMProvider()
      logger.info(`Calling ${provider} API for idea generation`, {
        theme,
        language,
        searchResultCount: searchResults?.length || 0
      })

      let content: string
      if (provider === 'ollama') {
        content = await this.callOllama(messages, { temperature: 0.8 })
      } else {
        content = await this.callOpenAI(messages, { temperature: 0.8 })
      }

      if (!content) {
        throw new Error(`Empty response from ${provider} API`)
      }

      logger.info('Ideas generated successfully', {
        provider,
        theme,
        responseLength: content.length
      })

      return content

    } catch (error: any) {
      logger.error(`Failed to generate ideas with ${getLLMProvider()}`, {
        error: error.message,
        theme: params.theme,
        stack: error.stack
      })
      throw new Error(`Idea generation failed: ${error.message}`)
    }
  }

  async generateMindMap(params: { content: string; language: string; searchResults: SearchResult[] }): Promise<string> {
    try {
      const { content, language, searchResults } = params
      const formattedSearchResults = this.formatSearchResults(searchResults)

      const prompt = MINDMAP_GENERATION_TEMPLATE
        .replace('{{content}}', content || '暂无内容')
        .replace('{{searchResults}}', formattedSearchResults)
        .replace('{{language}}', language)

      const messages = [
        {
          role: 'system',
          content: '你是一个结构化知识图谱生成助手，能够从文本中抽取层级结构并输出思维导图数据的 JSON。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const provider = getLLMProvider()
      logger.info(`Calling ${provider} API for mindmap generation`, {
        language,
        searchResultCount: searchResults?.length || 0
      })

      let contentStr: string
      if (provider === 'ollama') {
        contentStr = await this.callOllama(messages, { temperature: 0.5 })
      } else {
        contentStr = await this.callOpenAI(messages, { temperature: 0.5 })
      }

      if (!contentStr) {
        throw new Error(`Empty response from ${provider} API`)
      }

      logger.info('Mindmap generated successfully', {
        provider,
        responseLength: contentStr.length
      })

      return contentStr
    } catch (error: any) {
      logger.error(`Failed to generate mindmap with ${getLLMProvider()}`, {
        error: error.message,
        stack: error.stack
      })
      throw new Error(`Mindmap generation failed: ${error.message}`)
    }
  }

  async chat(params: { message: string; history?: any[]; context?: any }): Promise<string> {
    try {
      const { message, history = [], context } = params

      const systemPrompt = `你是一个智能 AI 助教，名字叫 NexLearn Assistant。
你的目标是辅助用户进行高效的自主学习。
你可以回答用户关于编程、科学、历史等各种领域的问题。
请保持回答简洁、准确、有条理。
如果用户正在学习特定的内容（见上下文），请结合上下文进行回答。`

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: `上下文信息：\n${JSON.stringify(context || {})}\n\n用户问题：${message}` }
      ]

      const provider = getLLMProvider()
      logger.info(`Calling ${provider} API for chat`, { messageLength: message.length })

      let content: string
      if (provider === 'ollama') {
        content = await this.callOllama(messages, { temperature: 0.7 })
      } else {
        content = await this.callOpenAI(messages, { temperature: 0.7 })
      }

      return content
    } catch (error: any) {
      logger.error('Chat failed', { error: error.message })
      throw error
    }
  }
}

// Export singleton instance
export const llmService = new LLMService()
