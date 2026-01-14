<template>
  <div class="max-w-5xl mx-auto flex flex-col h-full">
    <!-- 头部搜索 -->
    <div class="bg-white p-6 rounded-xl shadow-sm mb-6">
      <a-input-search
        v-model="query"
        placeholder="输入业务问题，例如：结算平台 A公司"
        button-text="提问"
        size="large"
        :loading="loading"
        @search="onSearch"
      />
      <div class="mt-2 text-xs text-gray-400">
        已支持实体：结算平台、运营平台 (基于 FST 毫秒级匹配)
      </div>
    </div>

    <!-- 结果展示区 -->
    <div v-if="result" class="flex-1 overflow-auto space-y-6">
      <!-- 语义推断信息 -->
      <a-alert type="success" title="推断结果">
        系统识别到维度 <b>{{ result.matched_entity }}</b>，
        正在从 <b>{{ result.query_info?.source }}</b> 的表 <b>{{ result.query_info?.table }}</b> 检索数据。
      </a-alert>

      <!-- 数据表格 -->
      <div class="bg-white rounded-xl shadow-sm p-4">
        <a-table :data="result.data" :pagination="false">
          <template #columns>
            <a-table-column 
              v-for="key in Object.keys(result.data[0] || {})" 
              :key="key" 
              :title="key" 
              :data-index="key" 
            />
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
      Message.warning(res.data.answer || '未能识别意图');
    }
  } catch (e) {
    Message.error('查询失败，请检查后端连接');
  } finally {
    loading.value = false;
  }
};
</script>