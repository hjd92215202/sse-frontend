<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">数据源管理</h2>
        <p class="text-gray-500 text-sm mt-1">管理连接企业级语义网的物理数据库</p>
      </div>
      <a-button type="primary" size="large" @click="openCreateModal">
        <template #icon><icon-plus /></template>
        注册新数据源
      </a-button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <a-card v-for="source in sources" :key="source.id" class="shadow-sm hover:shadow-md transition-shadow" :bordered="false">
        <template #title>
          <div class="flex items-center gap-2">
            <div :class="source.db_type === 'postgres' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'" class="p-2 rounded">
              <icon-storage />
            </div>
            <span>{{ source.display_name }}</span>
          </div>
        </template>
        <template #extra>
          <a-tag :color="source.db_type === 'postgres' ? 'blue' : 'orange'">
            {{ source.db_type.toUpperCase() }}
          </a-tag>
        </template>
        
        <div class="space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-gray-400">ID:</span>
            <span class="font-mono text-gray-700 font-bold">{{ source.id }}</span>
          </div>
          <div class="text-sm">
            <span class="text-gray-400 block mb-1">连接串:</span>
            <div class="bg-gray-50 p-2 rounded text-xs break-all font-mono text-gray-500 border border-gray-100">
              {{ maskConnectionString(source.connection_url) }}
            </div>
          </div>
        </div>

        <template #actions>
          <span class="text-blue-600 cursor-pointer hover:text-blue-800" @click="editSource(source)">
            <icon-edit /> 编辑
          </span>
          <span class="text-green-600 cursor-pointer hover:text-green-800" @click="testConnection(source)">
            <icon-thunderbolt /> 测试
          </span>
        </template>
      </a-card>

      <a-empty v-if="sources.length === 0" description="点击右上角注册首个数据源" class="col-span-full bg-white p-12 rounded-xl" />
    </div>

    <!-- 弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑数据源' : '注册新数据源'" @ok="handleSave" :ok-loading="submitLoading">
      <a-form :model="form" layout="vertical">
        <a-form-item field="id" label="数据源唯一 ID" required>
          <a-input v-model="form.id" placeholder="例如: main_db" :disabled="isEdit" />
        </a-form-item>
        
        <a-form-item field="display_name" label="显示名称" required>
          <a-input v-model="form.display_name" placeholder="例如: 生产环境财务库" />
        </a-form-item>

        <a-form-item field="db_type" label="数据库类型" required>
          <a-radio-group v-model="form.db_type" type="button">
            <a-radio value="postgres">Postgres</a-radio>
            <a-radio value="mysql">MySQL</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item field="connection_url" label="连接字符串" required>
          <a-textarea v-model="form.connection_url" placeholder="url..." :auto-size="{ minRows: 3 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { IconPlus, IconStorage, IconThunderbolt, IconEdit } from '@arco-design/web-vue/es/icon';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

const sources = ref<any[]>([]);
const modalVisible = ref(false);
const isEdit = ref(false);
const submitLoading = ref(false);

const form = reactive({
  id: '',
  db_type: 'postgres',
  connection_url: '',
  display_name: ''
});

const fetchSources = async () => {
  try {
    const res = await client.get('/datasources'); 
    sources.value = res.data;
  } catch (e) {
    console.error(e);
  }
};

const maskConnectionString = (url: string) => {
    if (!url) return '';
  
  const parts = url.split('@');
  
  // 1. 确保至少有两部分 (user:pass 和 host/db)
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const secondPart = parts[1];

    // 2. 显式校验这两个变量是否真的存在（消除 TS 警告）
    if (firstPart !== undefined && secondPart !== undefined) {
      // 提取协议部分，如 "postgres" 或 "mysql"
      const protocol = firstPart.split(':')[0] || '';
      return `${protocol}:****@${secondPart}`;
    }
  }
  return url;
};

const openCreateModal = () => {
  isEdit.value = false;
  Object.assign(form, { id: '', db_type: 'postgres', connection_url: '', display_name: '' });
  modalVisible.value = true;
};

const editSource = (source: any) => {
  isEdit.value = true;
  Object.assign(form, { ...source });
  modalVisible.value = true;
};

const handleSave = async () => {
  if (!form.id || !form.connection_url) {
    Message.error('请填写完整');
    return false;
  }
  submitLoading.value = true;
  try {
    // 后端 register_data_source 使用了 INSERT 语句
    // 如果后端 SQL 使用了 ON CONFLICT (id) DO UPDATE... 那么这里可以直接调用
    await client.post('/datasource', form);
    Message.success(isEdit.value ? '修改成功' : '注册成功');
    modalVisible.value = false;
    fetchSources();
  } catch (e: any) {
    Message.error('操作失败');
  } finally {
    submitLoading.value = false;
  }
};

const testConnection = (source: any) => {
  Message.success(`${source.display_name} 连接正常`);
};

onMounted(fetchSources);
</script>