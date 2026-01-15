<template>
  <div class="max-w-5xl mx-auto flex flex-col h-full">
    <div class="bg-white p-6 rounded-xl shadow-sm mb-6 border-b-4 border-blue-500">
      <a-input-search v-model="query" placeholder="输入问题，例如：查询结算平台 A公司的 总收益" button-text="语义提问" size="large"
        :loading="loading" @search="onSearch" />
    </div>

    <div v-if="result" class="flex-1 overflow-auto space-y-6">
      <div class="flex gap-4">
        <a-statistic title="匹配实体">
          <!-- 使用插槽代替 value 属性 -->
          <span class="text-lg font-bold text-blue-600">
            {{ result.matched_metrics?.join(', ') || '明细' }}
          </span>
        </a-statistic>

        <a-statistic title="执行逻辑">
          <span class="text-lg font-bold text-orange-600">
            {{ result.logic === 'SUM' ? '求和聚合' : '明细列表' }}
          </span>
        </a-statistic>
      </div>

      <a-collapse :default-active-key="['sql']">
        <a-collapse-item header="查看生成的推理 SQL" key="sql">
          <pre class="bg-gray-800 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">{{ result.sql }}</pre>
        </a-collapse-item>
      </a-collapse>

      <div class="bg-white rounded-xl shadow-sm p-4">
        <a-table :data="result.data" :pagination="{ pageSize: 5 }">
          <template #columns>
            <a-table-column v-for="key in Object.keys(result.data[0] || {})" :key="key" :title="key"
              :data-index="key" />
          </template>
        </a-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

const query = ref('');
const loading = ref(false);
const result = ref<any>(null);

const onSearch = async () => {
  if (!query.value) return;
  loading.value = true;
  try {
    const res = await client.post('/chat', { query: query.value });
    if (res.data.status === 'success') {
      result.value = res.data;
    } else {
      Message.warning(res.data.answer || '未能匹配到本体节点');
    }
  } catch (e) {
    Message.error('服务异常');
  } finally {
    loading.value = false;
  }
};
</script>