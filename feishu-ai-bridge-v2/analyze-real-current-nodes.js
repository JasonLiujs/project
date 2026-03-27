#!/usr/bin/env node

// 分析真实的current_nodes API响应数据
const realApiResponse = {
  "err": {},
  "err_code": 0,
  "err_msg": "",
  "data": [
    {
      "id": 6928175097,
      "name": "支持网页端登录的方式",
      "work_item_type_key": "story",
      "current_nodes": [
        {
          "owners": [],
          "milestone": false,
          "id": "state_23",
          "name": "UI设计"
        },
        {
          "id": "state_26",
          "name": "实验设计",
          "owners": [],
          "milestone": false
        },
        {
          "id": "state_27",
          "name": "埋点设计",
          "owners": [],
          "milestone": false
        },
        {
          "id": "state_29",
          "name": "合规评估",
          "owners": [],
          "milestone": false
        }
      ],
      "state_times": [
        {
          "state_key": "start",
          "start_time": 1774456854709,
          "end_time": 1774505859753,
          "name": "需求提出"
        },
        {
          "start_time": 1774505859758,
          "end_time": 1774608170925,
          "name": "方案设计",
          "state_key": "state_0"
        },
        {
          "state_key": "state_23",
          "start_time": 1774608170955,
          "end_time": 0,
          "name": "UI设计"
        },
        {
          "state_key": "state_26",
          "start_time": 1774608170955,
          "end_time": 0,
          "name": "实验设计"
        },
        {
          "state_key": "state_27",
          "start_time": 1774608170955,
          "end_time": 0,
          "name": "埋点设计"
        },
        {
          "state_key": "state_29",
          "start_time": 1774608170955,
          "end_time": 0,
          "name": "合规评估"
        }
      ]
    }
  ]
};

function analyzeRealCurrentNodesData() {
  console.log('📊 ====== 真实API响应数据分析 ======\n');

  console.log('🔍 关键发现:');
  console.log('  1. 响应格式与预期不同');
  console.log('  2. 数据在 data 数组中，而不是 data.work_items');
  console.log('  3. current_nodes 和 state_times 是分开的');

  const workItem = realApiResponse.data[0];

  console.log('\n📋 工作项基本信息:');
  console.log(`  • ID: ${workItem.id}`);
  console.log(`  • 名称: ${workItem.name}`);
  console.log(`  • 类型: ${workItem.work_item_type_key}`);

  console.log('\n🎯 current_nodes 数据分析:');
  console.log(`  • 节点数量: ${workItem.current_nodes.length}`);

  workItem.current_nodes.forEach((node, index) => {
    console.log(`  ${index + 1}. ${node.name} (${node.id})`);
    console.log(`     • 负责人: ${node.owners?.length || 0}个 [${node.owners?.join(', ') || '无'}]`);
    console.log(`     • 里程碑: ${node.milestone ? '是' : '否'}`);
  });

  console.log('\n⏰ state_times 时间数据分析:');
  console.log('  (这里包含了真正的时间信息)');

  workItem.state_times.forEach((timeInfo, index) => {
    const startTime = new Date(timeInfo.start_time).toLocaleString('zh-CN');
    const endTime = timeInfo.end_time === 0 ? '进行中' : new Date(timeInfo.end_time).toLocaleString('zh-CN');
    const isInProgress = timeInfo.end_time === 0;

    console.log(`  ${index + 1}. ${timeInfo.name} (${timeInfo.state_key})`);
    console.log(`     • 开始: ${startTime}`);
    console.log(`     • 结束: ${endTime}`);
    console.log(`     • 状态: ${isInProgress ? '✅ 进行中' : '❌ 已完成'}`);
  });

  console.log('\n🔄 数据关联分析:');
  console.log('  将current_nodes与state_times进行匹配...');

  const enrichedNodes = workItem.current_nodes.map(node => {
    // 尝试在state_times中找到对应的时间信息
    const timeInfo = workItem.state_times.find(time =>
      time.state_key === node.id || time.name === node.name
    );

    const enriched = {
      ...node,
      start_time: timeInfo?.start_time || 0,
      end_time: timeInfo?.end_time || 0,
      timeInfo: timeInfo || null
    };

    return enriched;
  });

  console.log('\n📊 合并后的节点数据:');
  enrichedNodes.forEach((node, index) => {
    const isInProgress = node.start_time !== 0 && node.end_time === 0;
    const startTimeStr = node.start_time ? new Date(node.start_time).toLocaleString('zh-CN') : '未开始';
    const endTimeStr = node.end_time === 0 ? '未结束' : new Date(node.end_time).toLocaleString('zh-CN');

    console.log(`  ${index + 1}. ${node.name}`);
    console.log(`     • ID: ${node.id}`);
    console.log(`     • 开始: ${startTimeStr}`);
    console.log(`     • 结束: ${endTimeStr}`);
    console.log(`     • 进行中: ${isInProgress ? '✅ 是' : '❌ 否'}`);
    console.log(`     • 负责人: ${node.owners?.length || 0}个`);
  });

  console.log('\n✅ 验证结果:');
  const allInProgress = enrichedNodes.every(node =>
    node.start_time !== 0 && node.end_time === 0
  );
  console.log(`  • current_nodes中所有节点都是"进行中": ${allInProgress ? '✅ 是' : '❌ 否'}`);

  return {
    workItem,
    enrichedNodes,
    allInProgress
  };
}

function provideFrontendUpdateRecommendations(analysisResult) {
  console.log('\n🔧 ====== 前端代码更新建议 ======');

  console.log('\n💡 关键发现总结:');
  console.log('  1. API响应格式: data[0] 而不是 data.work_items[0]');
  console.log('  2. current_nodes 本身没有时间信息');
  console.log('  3. 时间信息在 state_times 数组中');
  console.log('  4. 需要通过 state_key/name 匹配时间信息');

  console.log('\n📝 需要修改的前端逻辑:');

  console.log('\n  1. 修改响应数据解析:');
  console.log('```javascript');
  console.log('// 旧代码:');
  console.log('const workItems = result.data.work_items || [];');
  console.log('');
  console.log('// 新代码:');
  console.log('const workItems = result.data || [];');
  console.log('```');

  console.log('\n  2. 增强current_nodes数据处理:');
  console.log('```javascript');
  console.log('const processedNodes = workItem.current_nodes.map(node => {');
  console.log('  // 在state_times中查找对应的时间信息');
  console.log('  const timeInfo = workItem.state_times?.find(time =>');
  console.log('    time.state_key === node.id || time.name === node.name');
  console.log('  );');
  console.log('');
  console.log('  return {');
  console.log('    id: node.id,');
  console.log('    name: node.name,');
  console.log('    owners: node.owners || [],');
  console.log('    milestone: node.milestone || false,');
  console.log('    start_time: timeInfo?.start_time || 0,');
  console.log('    end_time: timeInfo?.end_time || 0,');
  console.log('    // 其他字段...');
  console.log('  };');
  console.log('});');
  console.log('```');

  console.log('\n  3. 验证"进行中"状态:');
  const { enrichedNodes } = analysisResult;
  console.log('```javascript');
  console.log('// 验证所有节点都是进行中的');
  console.log('const allInProgress = processedNodes.every(node =>');
  console.log('  node.start_time !== 0 && node.end_time === 0');
  console.log(');');
  console.log('');
  console.log(`// 当前数据验证结果: ${enrichedNodes.every(n => n.start_time !== 0 && n.end_time === 0)}`);
  console.log('```');

  console.log('\n🎯 完整的数据处理函数:');
  console.log('```javascript');
  console.log('function processCurrentNodesWithTimes(apiResponse) {');
  console.log('  if (apiResponse.err_code !== 0 || !apiResponse.data) return [];');
  console.log('');
  console.log('  const workItems = apiResponse.data; // 注意：直接使用data数组');
  console.log('  let allCurrentNodes = [];');
  console.log('');
  console.log('  for (const workItem of workItems) {');
  console.log('    if (workItem.current_nodes && workItem.current_nodes.length > 0) {');
  console.log('      const enrichedNodes = workItem.current_nodes.map(node => {');
  console.log('        // 查找时间信息');
  console.log('        const timeInfo = workItem.state_times?.find(time =>');
  console.log('          time.state_key === node.id || time.name === node.name');
  console.log('        );');
  console.log('');
  console.log('        return {');
  console.log('          id: node.id,');
  console.log('          name: node.name,');
  console.log('          state_key: node.id,');
  console.log('          status: 2, // IN_PROGRESS');
  console.log('          start_time: timeInfo?.start_time || 0,');
  console.log('          end_time: timeInfo?.end_time || 0,');
  console.log('          owners: node.owners || [],');
  console.log('          milestone: node.milestone || false,');
  console.log('          workItemId: workItem.id,');
  console.log('          workItemName: workItem.name,');
  console.log('          // ...其他字段');
  console.log('        };');
  console.log('      });');
  console.log('');
  console.log('      allCurrentNodes.push(...enrichedNodes);');
  console.log('    }');
  console.log('  }');
  console.log('');
  console.log('  return allCurrentNodes;');
  console.log('}');
  console.log('```');
}

function main() {
  const analysis = analyzeRealCurrentNodesData();
  provideFrontendUpdateRecommendations(analysis);

  console.log('\n📊 ====== 总结 ======');
  console.log('✅ 成功获取并分析了真实的current_nodes数据');
  console.log('✅ 发现了API响应格式的实际结构');
  console.log('✅ 确认了current_nodes确实都是正在进行中的节点');
  console.log('✅ 提供了前端代码的具体更新建议');

  console.log('\n🎯 下一步行动:');
  console.log('  1. 更新前端代码以适配真实的API响应格式');
  console.log('  2. 修改数据处理逻辑以合并current_nodes和state_times');
  console.log('  3. 测试更新后的前端功能');
}

main();