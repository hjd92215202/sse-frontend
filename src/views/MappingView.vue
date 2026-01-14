<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-800">语义映射配置</h2>
      <a-button type="primary" @click="openCreateModal">
        <template #icon><icon-plus /></template>
        新增语义映射
      </a-button>
    </div>

    <!-- 映射列表 -->
    <a-card class="shadow-sm">
      <a-table :data="mappings" :loading="loading" :pagination="false">
        <template #columns>
          <a-table-column title="实体标识 (Key)" data-index="entity_key" />
          <a-table-column title="中文名称" data-index="entity_label" />
          <a-table-column title="别名">
            <template #cell="{ record }">
              <a-space wrap>
                <a-tag v-for="tag in record.alias_names" :key="tag" color="arcoblue">
                  {{ tag }}
                </a-tag>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="物理映射 (表.列)">
            <template #cell="{ record }">
              <code class="bg-gray-100 p-1 rounded text-red-500">
                {{ record.target_table }}.{{ record.target_column }}
              </code>
            </template>
          </a-table-column>
          <a-table-column title="数据源 ID" data-index="source_id" />
          <a-table-column title="操作">
            <template #cell="{ record }">
              <a-button type="text" size="small" @click="editMapping(record)">编辑</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" title="语义映射配置" @ok="handleSave">
      <a-form :model="form" layout="vertical">
        <a-form-item field="entity_key" label="实体唯一标识 (Key)" help="例如: profit_platform">
          <a-input v-model="form.entity_key" placeholder="请输入英文标识" />
        </a-form-item>
        <a-form-item field="entity_label" label="业务显示名称" help="例如: 分润平台">
          <a-input v-model="form.entity_label" placeholder="请输入业务中文名" />
        </a-form-item>
        <a-form-item field="alias_names" label="同义词/别名 (回车添加)">
          <a-input-tag v-model="form.alias_names" placeholder="输入别名并回车" allow-clear />
        </a-form-item>
        <a-divider>物理数据库绑定</a-divider>
        <a-form-item field="source_id" label="目标数据源">
          <a-select v-model="form.source_id" placeholder="请选择数据源">
            <a-option v-for="s in sources" :key="s.id" :value="s.id">{{ s.display_name }} ({{ s.id }})</a-option>
          </a-select>
        </a-form-item>
        <div class="grid grid-cols-2 gap-4">
          <a-form-item field="target_table" label="物理表名">
            <a-input v-model="form.target_table" placeholder="t_revenue_data" />
          </a-form-item>
          <a-form-item field="target_column" label="物理列名">
            <a-input v-model="form.target_column" placeholder="platform_name" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { IconPlus } from '@arco-design/web-vue/es/icon';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

const loading = ref(false);
const mappings = ref([]);
const sources = ref<any[]>([]);
const modalVisible = ref(false);

const form = reactive({
  entity_key: '',
  entity_label: '',
  alias_names: [] as string[],
  target_table: '',
  target_column: '',
  source_id: ''
});

// 加载数据
const fetchData = async () => {
  loading.value = true;
  try {
    const [mRes, sRes] = await Promise.all([
      client.get('/mappings'),
      // 注意：这里需要后端实现一个获取所有数据源的接口，或者你手动维护列表
      client.get('/datasources'),
    ]);
    mappings.value = mRes.data;
    // 假设后端有获取数据源的接口，如果没有，请参考 register_data_source 的逻辑补充后端 list 接口
    sources.value = sRes.data;
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  Object.assign(form, {
    entity_key: '',
    entity_label: '',
    alias_names: [],
    target_table: '',
    target_column: '',
    source_id: ''
  });
  modalVisible.value = true;
};

const editMapping = (record: any) => {
  Object.assign(form, record);
  modalVisible.value = true;
};

const handleSave = async () => {
  try {
    await client.post('/mapping', form);
    Message.success('映射保存成功，FST 引擎已刷新');
    fetchData();
    return true;
  } catch (e: any) {
    Message.error('保存失败: ' + e.message);
    return false;
  }
};

onMounted(fetchData);
</script>