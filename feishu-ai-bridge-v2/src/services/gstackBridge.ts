import {
  GstackRequest,
  GstackResult,
  GstackAnalysisResult,
  NODE_TYPE_TO_GSTACK_SKILLS
} from '../types/workflow';
import { AIInsight } from '../api/mcp';

/**
 * gstack MCP 桥接服务
 * 负责与 gstack 技能的集成，包括技能调用、结果解析和错误处理
 */
export class GstackBridge {
  private gstackEndpoint: string;
  private apiKey: string;
  private timeout: number;

  constructor(config?: {
    endpoint?: string;
    apiKey?: string;
    timeout?: number;
  }) {
    // 在浏览器环境中使用默认配置，避免 process.env 错误
    const defaultEndpoint = 'http://localhost:8000/api/skills';
    const defaultApiKey = '';

    this.gstackEndpoint = config?.endpoint || defaultEndpoint;
    this.apiKey = config?.apiKey || defaultApiKey;
    this.timeout = config?.timeout || 300000; // 5分钟默认超时
  }

  /**
   * 执行单个 gstack 技能
   */
  async executeSkill(request: GstackRequest): Promise<GstackResult> {
    const startTime = Date.now();

    try {
      console.log(`[GstackBridge] Executing skill: ${request.skill}`);

      // 验证技能名称
      this.validateSkillName(request.skill);

      // 构建请求payload
      const payload = this.buildSkillPayload(request);

      // 发起 HTTP 请求到 gstack API
      const response = await this.makeSkillRequest(payload);

      // 解析响应
      const result = await this.parseSkillResponse(response);

      const executionTime = Date.now() - startTime;

      console.log(`[GstackBridge] Skill ${request.skill} completed in ${executionTime}ms`);

      return {
        success: true,
        output: result.rawOutput,
        insights: result.insights,
        executionTime,
        metadata: {
          skillVersion: result.metadata?.skillVersion,
          tokensUsed: result.metadata?.tokensUsed,
          confidence: result.metadata?.confidence,
        },
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[GstackBridge] Skill ${request.skill} failed:`, error);

      return {
        success: false,
        output: '',
        insights: [],
        executionTime,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 执行技能序列（多个技能按顺序执行）
   */
  async executeSkillSequence(requests: GstackRequest[]): Promise<GstackResult[]> {
    const results: GstackResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.executeSkill(request);
        results.push(result);

        // 如果主要技能失败，停止执行后续技能
        if (!result.success && request === requests[0]) {
          console.warn(`[GstackBridge] Primary skill failed, skipping remaining skills`);
          break;
        }

      } catch (error) {
        console.error(`[GstackBridge] Failed to execute skill ${request.skill}:`, error);

        results.push({
          success: false,
          output: '',
          insights: [],
          executionTime: 0,
          metadata: {
            error: error instanceof Error ? error.message : 'Execution failed',
          },
        });
      }
    }

    return results;
  }

  /**
   * 解析 gstack 输出为结构化的分析结果
   */
  async parseGstackOutput(rawOutput: string, skillType: string): Promise<GstackAnalysisResult> {
    try {
      // 尝试从输出中提取结构化信息
      const analysisResult = await this.extractStructuredAnalysis(rawOutput, skillType);

      return analysisResult;

    } catch (error) {
      console.error(`[GstackBridge] Failed to parse gstack output:`, error);

      // 返回默认结构，包含原始输出
      return {
        summary: rawOutput.substring(0, 500) + (rawOutput.length > 500 ? '...' : ''),
        recommendations: this.extractRecommendations(rawOutput),
        risks: [],
        nextSteps: [],
        architectureInsights: {
          patterns: [],
          concerns: [],
          suggestions: [],
        },
      };
    }
  }

  /**
   * 根据节点类型推荐 gstack 技能
   */
  getRecommendedSkills(nodeType: string): string[] {
    return NODE_TYPE_TO_GSTACK_SKILLS[nodeType] || ['plan-eng-review'];
  }

  /**
   * 验证技能名称
   */
  private validateSkillName(skillName: string): void {
    const validSkills = [
      'plan-eng-review',
      'plan-ceo-review',
      'plan-design-review',
      'investigate',
      'review',
      'qa',
      'qa-only',
      'ship',
      'land-and-deploy',
      'codex',
      'design-review',
      'office-hours',
    ];

    if (!validSkills.includes(skillName)) {
      throw new Error(`Invalid gstack skill: ${skillName}`);
    }
  }

  /**
   * 构建技能请求 payload
   */
  private buildSkillPayload(request: GstackRequest): any {
    // 基于 MCP JSON-RPC 协议构建请求
    return {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'skill/execute',
      params: {
        skill: request.skill,
        context: {
          workItem: request.context.workItemData,
          nodeType: request.context.nodeType,
          requirements: request.context.requirements,
          repository: request.context.repositoryInfo,
        },
        configuration: request.configuration || {},
      },
    };
  }

  /**
   * 发起技能请求
   */
  private async makeSkillRequest(payload: any): Promise<any> {
    // 在实际实现中，这里应该调用真实的 gstack API
    // 目前为了演示，我们模拟一个响应

    console.log(`[GstackBridge] Making request to ${this.gstackEndpoint}`);
    console.log(`[GstackBridge] Payload:`, JSON.stringify(payload, null, 2));

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    // 模拟不同技能的响应
    return this.mockSkillResponse(payload.params.skill, payload.params.context);

    // TODO: 实际实现
    /*
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.gstackEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
    */
  }

  /**
   * 模拟技能响应（临时实现）
   */
  private mockSkillResponse(skillName: string, context: any): any {
    const workItemTitle = context.workItem?.data?.title || '未知工作项';

    const responses: Record<string, any> = {
      'plan-eng-review': {
        jsonrpc: '2.0',
        id: Date.now(),
        result: {
          success: true,
          output: `# 工程分析评审报告

## 项目概述
针对工作项"${workItemTitle}"的技术分析和架构评审。

## 架构建议
1. **微服务架构**: 采用领域驱动设计，将功能模块解耦
2. **数据库设计**: 使用 PostgreSQL 作为主数据库，Redis 作为缓存
3. **API 设计**: RESTful API + GraphQL 查询层

## 风险评估
- 🔴 **高风险**: 数据迁移复杂度高，需要详细的迁移策略
- 🟡 **中风险**: 第三方依赖较多，需要备选方案
- 🟢 **低风险**: 技术栈成熟，团队经验充足

## 技术方案
### 后端技术栈
- Node.js + TypeScript
- Express.js 框架
- Prisma ORM
- JWT 认证

### 前端技术栈
- React 18 + TypeScript
- Next.js 框架
- Tailwind CSS
- Zustand 状态管理

## 测试策略
1. **单元测试**: Jest + React Testing Library
2. **集成测试**: Supertest + Testcontainers
3. **E2E测试**: Playwright
4. **性能测试**: K6 压力测试

## 下一步行动
1. 创建项目脚手架和开发环境
2. 设计数据库 schema 和 API 接口
3. 实现核心业务逻辑
4. 编写测试用例并设置 CI/CD
5. 部署到测试环境进行验证`,
          insights: [
            {
              type: 'suggestion',
              title: '架构优化建议',
              content: '建议采用微服务架构提高系统的可维护性和扩展性',
              confidence: 0.9,
            },
            {
              type: 'risk',
              title: '数据迁移风险',
              content: '现有数据迁移复杂度较高，需要制定详细的迁移计划',
              confidence: 0.85,
            },
          ],
          metadata: {
            skillVersion: '2.1.0',
            tokensUsed: 1500,
            confidence: 0.88,
          },
        },
      },

      'investigate': {
        jsonrpc: '2.0',
        id: Date.now(),
        result: {
          success: true,
          output: `# 问题调查报告

## 问题分析
针对"${workItemTitle}"进行了系统性调查分析。

## 根因分析
1. **直接原因**: API 响应时间过长
2. **间接原因**: 数据库查询未优化
3. **根本原因**: 缺少适当的索引策略

## 影响范围
- 用户体验: 页面加载时间增加 300%
- 系统性能: 数据库 CPU 使用率达到 80%
- 业务影响: 用户转化率下降 15%

## 解决方案
1. 优化数据库查询，添加必要索引
2. 实现查询结果缓存机制
3. 异步处理非关键路径操作

## 预防措施
- 建立性能监控预警机制
- 定期进行性能压测
- 建立代码审查流程`,
          insights: [
            {
              type: 'risk',
              title: '性能瓶颈',
              content: '数据库查询性能问题可能影响系统整体稳定性',
              confidence: 0.92,
            },
          ],
          metadata: {
            skillVersion: '1.8.0',
            tokensUsed: 1200,
            confidence: 0.91,
          },
        },
      },

      'review': {
        jsonrpc: '2.0',
        id: Date.now(),
        result: {
          success: true,
          output: `# 代码审查报告

## 审查概述
对"${workItemTitle}"相关代码进行了全面审查。

## 代码质量评估
- **整体评分**: 8.5/10
- **可读性**: 优秀
- **可维护性**: 良好
- **性能**: 需要改进

## 发现的问题
### 🔴 严重问题
- SQL 注入安全漏洞 (line 45 in userService.ts)
- 内存泄漏风险 (event listeners 未清理)

### 🟡 一般问题
- 缺少输入验证 (3处)
- 错误处理不够完善 (5处)
- 部分函数过于复杂，建议拆分

### 🟢 最佳实践
- TypeScript 类型定义完整
- 测试覆盖率达到 85%
- 代码风格一致

## 改进建议
1. 使用参数化查询防止 SQL 注入
2. 实现统一的错误处理中间件
3. 添加输入验证装饰器
4. 优化算法复杂度

## 安全检查
- ✅ 认证授权机制完善
- ⚠️ 存在 SQL 注入风险
- ✅ 敏感数据加密处理
- ✅ API 限流机制就位`,
          insights: [
            {
              type: 'risk',
              title: 'SQL 注入安全风险',
              content: '发现潜在的 SQL 注入漏洞，需要立即修复',
              confidence: 0.95,
            },
            {
              type: 'suggestion',
              title: '代码重构建议',
              content: '部分复杂函数建议拆分为更小的单元以提高可维护性',
              confidence: 0.78,
            },
          ],
          metadata: {
            skillVersion: '2.3.1',
            tokensUsed: 1800,
            confidence: 0.87,
          },
        },
      },

      'qa': {
        jsonrpc: '2.0',
        id: Date.now(),
        result: {
          success: true,
          output: `# QA 测试报告

## 测试概述
对"${workItemTitle}"进行了全面的质量保证测试。

## 测试结果概览
- **测试用例总数**: 156
- **通过**: 142 (91%)
- **失败**: 14 (9%)
- **跳过**: 0

## 功能测试
### ✅ 通过的功能
- 用户登录注册流程
- 数据 CRUD 操作
- API 接口响应正确性
- 权限控制机制

### ❌ 失败的功能
- 文件上传在大文件时超时
- 批量操作并发处理异常
- 某些边界条件处理不当

## 性能测试
- **响应时间**: 平均 250ms (目标 < 300ms) ✅
- **并发处理**: 支持 1000 并发 (目标 800) ✅
- **内存使用**: 峰值 512MB (目标 < 1GB) ✅

## 安全测试
- **认证测试**: 通过
- **授权测试**: 通过
- **注入攻击**: 发现 2 个漏洞
- **敏感数据**: 通过

## 兼容性测试
- Chrome: ✅
- Firefox: ✅
- Safari: ⚠️ 部分样式问题
- Mobile: ✅

## 修复建议
1. 优化文件上传处理逻辑，增加进度反馈
2. 修复批量操作的并发同步问题
3. 完善边界条件的错误处理
4. 修复 Safari 浏览器样式兼容性`,
          insights: [
            {
              type: 'summary',
              title: 'QA 测试总结',
              content: '整体质量良好，91%的测试用例通过，主要问题集中在文件处理和并发控制',
              confidence: 0.89,
            },
          ],
          metadata: {
            skillVersion: '3.1.0',
            tokensUsed: 1600,
            confidence: 0.86,
          },
        },
      },
    };

    return responses[skillName] || {
      jsonrpc: '2.0',
      id: Date.now(),
      result: {
        success: true,
        output: `# ${skillName} 分析报告\n\n针对"${workItemTitle}"的分析已完成。`,
        insights: [],
        metadata: {
          skillVersion: '1.0.0',
          confidence: 0.5,
        },
      },
    };
  }

  /**
   * 解析技能响应
   */
  private async parseSkillResponse(response: any): Promise<{
    rawOutput: string;
    insights: AIInsight[];
    metadata?: any;
  }> {
    if (response.error) {
      throw new Error(`Skill execution failed: ${response.error.message}`);
    }

    const result = response.result;
    return {
      rawOutput: result.output || '',
      insights: result.insights || [],
      metadata: result.metadata,
    };
  }

  /**
   * 提取结构化分析结果
   */
  private async extractStructuredAnalysis(rawOutput: string, skillType: string): Promise<GstackAnalysisResult> {
    // 使用正则表达式或 LLM 来解析输出文本
    const lines = rawOutput.split('\n');

    const result: GstackAnalysisResult = {
      summary: '',
      recommendations: [],
      risks: [],
      nextSteps: [],
      architectureInsights: {
        patterns: [],
        concerns: [],
        suggestions: [],
      },
    };

    // 提取摘要
    const summaryIndex = lines.findIndex(line => line.includes('## 项目概述') || line.includes('## 概述'));
    if (summaryIndex >= 0) {
      result.summary = lines.slice(summaryIndex + 1, summaryIndex + 3).join(' ').trim();
    }

    // 提取建议
    result.recommendations = this.extractRecommendations(rawOutput);

    // 提取风险
    result.risks = this.extractRisks(rawOutput);

    // 提取下一步行动
    result.nextSteps = this.extractNextSteps(rawOutput);

    // 提取架构洞察（仅针对架构相关技能）
    if (['plan-eng-review', 'plan-design-review'].includes(skillType)) {
      result.architectureInsights = this.extractArchitectureInsights(rawOutput);
    }

    return result;
  }

  /**
   * 提取建议列表
   */
  private extractRecommendations(text: string): string[] {
    const recommendations: string[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## 架构建议') || line.includes('## 建议') || line.includes('## 改进建议')) {
        // 找到建议部分，提取后续的列表项
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('##')) break; // 遇到下一个章节
          if (nextLine.match(/^\d+\./) || nextLine.startsWith('-') || nextLine.startsWith('*')) {
            recommendations.push(nextLine.replace(/^\d+\.|\*|-/, '').trim());
          }
        }
        break;
      }
    }

    return recommendations;
  }

  /**
   * 提取风险列表
   */
  private extractRisks(text: string): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }> {
    const risks: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    }> = [];

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## 风险评估') || line.includes('## 风险')) {
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('##')) break;

          // 解析风险等级
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
          if (nextLine.includes('🔴') || nextLine.includes('高风险')) severity = 'high';
          else if (nextLine.includes('🟡') || nextLine.includes('中风险')) severity = 'medium';
          else if (nextLine.includes('🟢') || nextLine.includes('低风险')) severity = 'low';

          if (nextLine.includes('风险') || nextLine.includes('问题')) {
            risks.push({
              type: 'general',
              severity,
              description: nextLine.replace(/🔴|🟡|🟢/g, '').trim(),
            });
          }
        }
        break;
      }
    }

    return risks;
  }

  /**
   * 提取下一步行动
   */
  private extractNextSteps(text: string): Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    estimatedTime?: string;
  }> {
    const nextSteps: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high';
    }> = [];

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## 下一步行动') || line.includes('## 下一步') || line.includes('## 后续步骤')) {
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('##')) break;

          if (nextLine.match(/^\d+\./) || nextLine.startsWith('-') || nextLine.startsWith('*')) {
            nextSteps.push({
              action: nextLine.replace(/^\d+\.|\*|-/, '').trim(),
              priority: 'medium', // 默认中等优先级
            });
          }
        }
        break;
      }
    }

    return nextSteps;
  }

  /**
   * 提取架构洞察
   */
  private extractArchitectureInsights(text: string): {
    patterns: string[];
    concerns: string[];
    suggestions: string[];
  } {
    return {
      patterns: this.extractSection(text, ['## 架构模式', '## 设计模式']),
      concerns: this.extractSection(text, ['## 架构问题', '## 关注点']),
      suggestions: this.extractSection(text, ['## 架构建议', '## 改进建议']),
    };
  }

  /**
   * 提取指定章节的内容
   */
  private extractSection(text: string, sectionHeaders: string[]): string[] {
    const items: string[] = [];
    const lines = text.split('\n');

    for (const header of sectionHeaders) {
      const sectionIndex = lines.findIndex(line => line.includes(header));
      if (sectionIndex >= 0) {
        for (let i = sectionIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('##')) break;

          if (line.match(/^\d+\./) || line.startsWith('-') || line.startsWith('*')) {
            items.push(line.replace(/^\d+\.|\*|-/, '').trim());
          }
        }
        break;
      }
    }

    return items;
  }
}

// 导出默认实例
export const gstackBridge = new GstackBridge();