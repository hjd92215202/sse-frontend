<template>
  <div class="max-w-5xl mx-auto flex flex-col h-full">
    <!-- 头部搜索区域 -->
    <div class="bg-white p-6 rounded-xl shadow-sm mb-6 border-b-4 border-blue-600">
      <a-input-search v-model="query" placeholder="例如：2026-01-01 结算平台 A公司的 收益额" button-text="语义提问" size="large"
        :loading="loading" @search="onSearch" allow-clear />
    </div>

    <!-- 结果展示区域 -->
    <div v-if="result" class="flex-1 overflow-auto space-y-4">
      
      <!-- 情况 1：发现歧义 (Disambiguation Card) -->
      <a-card v-if="result.status === 'ambiguous'" class="border-orange-300 bg-orange-50 shadow-sm">
        <template #title>
          <div class="flex items-center gap-2 text-orange-700">
            <icon-question-circle-fill /> 意图对齐确认
          </div>
        </template>
        <p class="mb-4 text-gray-700">{{ result.answer }}</p>
        <a-space wrap>
          <a-button v-for="item in result.candidates" :key="item" type="primary" status="warning" shape="round"
            @click="selectCandidate(item)">
            {{ item }}
          </a-button>
        </a-space>
      </a-card>

      <!-- 情况 2：查询成功 -->
      <template v-if="result.status === 'success'">
        <div class="flex gap-4">
          <a-statistic title="匹配实体">
            <span class="text-lg font-bold text-blue-600">
              {{ query.includes('收益') ? '收益额' : '维度明细' }}
            </span>
          </a-statistic>
          <a-statistic title="执行逻辑">
            <span class="text-lg font-bold text-orange-600">
              {{ result.logic || '自动推理' }}
            </span>
          </a-statistic>
        </div>

        <a-collapse>
          <a-collapse-item header="查看生成的推理 SQL" key="sql">
            <pre class="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">{{ result.sql }}</pre>
          </a-collapse-item>
        </a-collapse>

        <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <a-table :data="result.data" :pagination="{ pageSize: 5 }">
            <template #columns>
              <a-table-column v-for="key in Object.keys(result.data[0] || {})" :key="key" :title="key"
                :data-index="key" />
            </template>
          </a-table>
        </div>
      </template>

      <!-- 情况 3：完全无法匹配 -->
      <a-empty v-if="result.status === 'fail'" :description="result.answer" class="bg-white p-12 rounded-xl shadow-sm" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IconQuestionCircleFill } from '@arco-design/web-vue/es/icon';
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
    Message.error('语义引擎服务异常');
  } finally {
    loading.value = false;
  }
};

// 点击歧义候选项后的处理逻辑
const selectCandidate = (candidateLabel: string) => {
  query.value = `${candidateLabel} ${query.value}`;
  onSearch();
};
</script>