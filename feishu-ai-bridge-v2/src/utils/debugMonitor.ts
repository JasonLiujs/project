/**
 * 调试监控工具
 * 用于测试和调试事件监听功能
 */
import { MCPClient } from '../api/mcp';
import { API_CONFIG } from '../constants';

export class DebugMonitor {
  private mcpClient: MCPClient;

  constructor(userKey: string = API_CONFIG.defaultUserKey) {
    this.mcpClient = new MCPClient(userKey);
  }

  /**
   * 测试列出所有工作项
   */
  async testListAllItems(): Promise<void> {
    console.log('🔍 [Debug] Testing listWorkItems...');
    try {
      const result = await this.mcpClient.listWorkItems('story');
      console.log('✅ [Debug] ListWorkItems result:', {
        success: !!result.data,
        itemCount: result.data?.items?.length || 0,
        items: result.data?.items?.slice(0, 3) || [] // 只显示前3个
      });

      if (result.data?.items) {
        result.data.items.forEach((item, index) => {
          if (index < 3) { // 只显示前3个的详细信息
            console.log(`📋 [Debug] Item ${index + 1}:`, {
              id: item.work_item_id,
              title: item.title,
              type: item.type,
              created_time: item.created_time ? new Date(item.created_time).toLocaleString('zh-CN') : 'Unknown',
              updated_time: item.updated_time ? new Date(item.updated_time).toLocaleString('zh-CN') : 'Unknown'
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ [Debug] ListWorkItems failed:', error);
    }
  }

  /**
   * 测试按时间筛选工作项
   */
  async testTimeFiltering(minutesBack: number = 60): Promise<void> {
    console.log(`🕒 [Debug] Testing time filtering (last ${minutesBack} minutes)...`);

    const cutoffTime = Date.now() - (minutesBack * 60 * 1000);
    console.log(`⏰ [Debug] Cutoff time: ${new Date(cutoffTime).toLocaleString('zh-CN')}`);

    try {
      // 测试不同的时间字段名
      const timeFields = ['created_time', 'create_time', 'createdTime', 'updated_time', 'update_time'];

      for (const fieldName of timeFields) {
        console.log(`🔍 [Debug] Testing field: ${fieldName}`);

        try {
          const result = await this.mcpClient.listWorkItems('story', [
            {
              field_key: fieldName,
              operator: '>=',
              field_value: cutoffTime
            }
          ]);

          console.log(`✅ [Debug] Field ${fieldName} result:`, {
            success: !!result.data,
            itemCount: result.data?.items?.length || 0
          });

          if (result.data?.items && result.data.items.length > 0) {
            console.log(`📋 [Debug] Recent items with ${fieldName}:`,
              result.data.items.slice(0, 2).map(item => ({
                id: item.work_item_id,
                title: item.title,
                [fieldName]: item[fieldName] ? new Date(item[fieldName]).toLocaleString('zh-CN') : 'Unknown'
              }))
            );
          }
        } catch (error) {
          console.log(`❌ [Debug] Field ${fieldName} failed:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.error('❌ [Debug] Time filtering test failed:', error);
    }
  }

  /**
   * 测试实时监听模拟
   */
  async simulateEventListening(durationMinutes: number = 2): Promise<void> {
    console.log(`🎧 [Debug] Simulating event listening for ${durationMinutes} minutes...`);

    let checkCount = 0;
    const startTime = Date.now();

    const interval = setInterval(async () => {
      checkCount++;
      console.log(`🔄 [Debug] Check #${checkCount} - ${new Date().toLocaleTimeString('zh-CN')}`);

      // 检查最近5分钟的创建事件
      await this.checkRecentCreations(5);

      // 检查是否达到持续时间
      if (Date.now() - startTime >= durationMinutes * 60 * 1000) {
        clearInterval(interval);
        console.log('🏁 [Debug] Event listening simulation completed');
      }
    }, 30000); // 每30秒检查一次

    console.log('⏸️ [Debug] Event listening started. Create a work item in Feishu now!');
  }

  /**
   * 检查最近创建的工作项
   */
  async checkRecentCreations(minutesBack: number = 5): Promise<void> {
    const cutoffTime = Date.now() - (minutesBack * 60 * 1000);

    try {
      // 先尝试使用 created_time
      const result = await this.mcpClient.listWorkItems('story', [
        {
          field_key: 'created_time',
          operator: '>=',
          field_value: cutoffTime
        }
      ]);

      const recentItems = result.data?.items || [];

      if (recentItems.length > 0) {
        console.log(`🆕 [Debug] Found ${recentItems.length} recent items:`);
        recentItems.forEach(item => {
          const createdTime = item.created_time ? new Date(item.created_time).toLocaleString('zh-CN') : 'Unknown';
          console.log(`  📝 ${item.work_item_id}: ${item.title} (created: ${createdTime})`);
        });
      } else {
        console.log(`⭕ [Debug] No recent items found (last ${minutesBack} minutes)`);
      }
    } catch (error) {
      console.error('❌ [Debug] Check recent creations failed:', error);
    }
  }

  /**
   * 获取特定工作项的详细信息
   */
  async inspectWorkItem(workItemId: string): Promise<void> {
    console.log(`🔍 [Debug] Inspecting work item: ${workItemId}`);

    try {
      const result = await this.mcpClient.getWorkItemBrief(workItemId, 'story');
      console.log(`📋 [Debug] Work item details:`, {
        id: result.data?.work_item_id,
        title: result.data?.title,
        type: result.data?.type,
        status: result.data?.status,
        description: result.data?.description?.substring(0, 100) + '...',
        created_time: result.data?.created_time ? new Date(result.data.created_time).toLocaleString('zh-CN') : 'Unknown',
        updated_time: result.data?.updated_time ? new Date(result.data.updated_time).toLocaleString('zh-CN') : 'Unknown',
        field_values: result.data?.field_values
      });
    } catch (error) {
      console.error('❌ [Debug] Inspect work item failed:', error);
    }
  }

  /**
   * 执行完整的监听测试
   */
  async runFullTest(): Promise<void> {
    console.log('🚀 [Debug] Starting full monitoring test...');
    console.log('=====================================');

    // 1. 测试基本列表功能
    await this.testListAllItems();

    console.log('\n');

    // 2. 测试时间筛选
    await this.testTimeFiltering(120); // 最近2小时

    console.log('\n');

    // 3. 检查最近创建
    await this.checkRecentCreations(60); // 最近1小时

    console.log('\n=====================================');
    console.log('🎯 [Debug] Now create a work item in Feishu and run checkRecentCreations() to test!');
  }
}

// 导出调试实例，可以在浏览器控制台中使用
(window as any).debugMonitor = new DebugMonitor();

// 便捷的全局调试函数
(window as any).testMonitoring = async () => {
  const monitor = new DebugMonitor();
  await monitor.runFullTest();
};

(window as any).checkRecent = async (minutes = 5) => {
  const monitor = new DebugMonitor();
  await monitor.checkRecentCreations(minutes);
};

(window as any).simulateListening = async (minutes = 2) => {
  const monitor = new DebugMonitor();
  await monitor.simulateEventListening(minutes);
};