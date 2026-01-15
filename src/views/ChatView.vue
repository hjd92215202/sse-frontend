<template>
  <div class="max-w-5xl mx-auto flex flex-col h-full">
    <div class="bg-white p-6 rounded-xl shadow-sm mb-6 border-b-4 border-blue-600">
      <a-input-search v-model="query" placeholder="例如：查询结算平台的收益总额 (支持识别码值和语义约束)" button-text="语义提问" size="large"
        :loading="loading" @search="onSearch" />
    </div>

    <div v-if="result" class="flex-1 overflow-auto space-y-4">
      <!-- 情况 1：语义歧义/冲突 -->
      <a-alert v-if="result.status === 'ambiguous'" type="warning" title="语义核对" show-icon>
        {{ result.answer }}
      </a-alert>

      <!-- 情况 2：查询成功 -->
      <template v-if="result.status === 'success'">
        <div class="flex gap-4">
          <a-statistic title="执行动作">
            <span class="text-lg font-bold text-orange-600">
              {{ result.sql?.includes('SUM') ? '聚合求和' : '明细列表' }}
            </span>
          </a-statistic>
        </div>

        <a-collapse>
          <a-collapse-item header="查看推理 SQL" key="1">
            <pre class="bg-gray-900 text-green-400 p-4 rounded text-xs">{{ result.sql }}</pre>
          </a-collapse-item>
        </a-collapse>

        <div class="bg-white p-4 rounded shadow-sm">
          <a-table :data="result.data" :pagination="{ pageSize: 5 }">
            <template #columns>
              <a-table-column v-for="k in Object.keys(result.data[0] || {})" :key="k" :title="k" :data-index="k" />
            </template>
          </a-table>
        </div>
      </template>

      <!-- 情况 3：识别失败 -->
      <a-empty v-if="result.status === 'fail'" :description="result.answer" />
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
    result.value = res.data;
  } catch (e) {
    Message.error('语义引擎响应异常');
  } finally {
    loading.value = false;
  }
};
</script>