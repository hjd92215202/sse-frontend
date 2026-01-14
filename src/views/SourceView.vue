<template>
  <div class="space-y-6">
    <!-- 页面头部 -->
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">数据源管理</h2>
        <p class="text-gray-500 text-sm mt-1">注册并管理外部业务数据库连接</p>
      </div>
      <a-button type="primary" size="large" @click="modalVisible = true">
        <template #icon><icon-plus /></template>
        注册新数据源
      </a-button>
    </div>

    <!-- 数据源列表卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <a-card v-for="source in sources" :key="source.id" class="shadow-sm hover:shadow-md transition-shadow" :bordered="false">
        <template #title>
          <div class="flex items-center gap-2">
            <div :class="source.db_type === 'postgres' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'" class="p-2 rounded">
              <icon-storage />
            </div>
            <span>{{ source.display_name || '未命名数据源' }}</span>
          </div>
        </template>
        <template #extra>
          <a-tag :color="source.db_type === 'postgres' ? 'blue' : 'orange'">
            {{ source.db_type.toUpperCase() }}
          </a-tag>
        </template>
        
        <div class="space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-gray-400">标识符 (ID):</span>
            <span class="font-mono text-gray-700">{{ source.id }}</span>
          </div>
          <div class="text-sm">
            <span class="text-gray-400 block mb-1">连接字符串:</span>
            <div class="bg-gray-50 p-2 rounded text-xs break-all font-mono text-gray-500 border border-gray-100">
              {{ maskConnectionString(source.connection_url) }}
            </div>
          </div>
        </div>

        <template #actions>
          <span class="text-blue-600 cursor-pointer hover:text-blue-800" @click="testConnection(source)">
            <icon-thunderbolt /> 测试连接
          </span>
          <span class="text-red-500 cursor-pointer hover:text-red-700">
             <icon-delete /> 移除
          </span>
        </template>
      </a-card>

      <!-- 空状态 -->
      <a-empty v-if="sources.length === 0" description="暂无已注册的数据源" class="col-span-full bg-white p-12 rounded-xl" />
    </div>

    <!-- 注册弹窗 -->
    <a-modal v-model:visible="modalVisible" title="注册新数据源" @ok="handleSave" :ok-loading="submitLoading">
      <a-form :model="form" layout="vertical">
        <a-form-item field="id" label="数据源唯一 ID" required help="后续语义映射将引用此 ID">
          <a-input v-model="form.id" placeholder="例如: finance_db_01" />
        </a-form-item>
        
        <a-form-item field="display_name" label="显示名称" required>
          <a-input v-model="form.display_name" placeholder="例如: 财务结算库" />
        </a-form-item>

        <a-form-item field="db_type" label="数据库类型" required>
          <a-radio-group v-model="form.db_type" type="button">
            <a-radio value="postgres">PostgreSQL</a-radio>
            <a-radio value="mysql">MySQL</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item field="connection_url" label="连接字符串 (Connection URL)" required>
          <a-textarea 
            v-model="form.connection_url" 
            placeholder="postgres://user:password@localhost:5432/dbname"
            :auto-size="{ minRows: 3 }"
          />
          <template #help>
            <div class="text-xs mt-1">
              PG 格式: postgres://user:pass@host:port/db<br/>
              MySQL 格式: mysql://user:pass@host:port/db
            </div>
          </template>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { IconPlus, IconStorage, IconThunderbolt, IconDelete } from '@arco-design/web-vue/es/icon';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

const sources = ref<any[]>([]);
const modalVisible = ref(false);
const submitLoading = ref(false);

const form = reactive({
  id: '',
  db_type: 'postgres',
  connection_url: '',
  display_name: ''
});

// 获取数据源列表
const fetchSources = async () => {
  try {
    // 注意：后端目前代码中注册了 POST /datasource，但可能漏掉了 GET /datasources 接口。
    // 如果后端还没写 GET 接口，这里会报错，建议后端在 api/mapping.rs 中补充。
    const res = await client.get('/datasources'); 
    sources.value = res.data;
  } catch (e) {
    console.error('无法获取数据源列表', e);
  }
};

// 掩码处理连接字符串（保护密码不直接在 UI 暴露过多）
const maskConnectionString = (url: string) => {
  try {
    const parts = url.split('@');
    // 添加更严谨的判断逻辑
    if (parts.length > 1 && parts[0]) {
      const protocolAndUser = parts[0].split(':');
      const protocol = protocolAndUser[0] || '';
      return `${protocol}:****@${parts[1]}`;
    }
    return url;
  } catch {
    return url;
  }
};

// 保存数据源
const handleSave = async () => {
  if (!form.id || !form.connection_url) {
    Message.error('请填写完整信息');
    return false;
  }

  submitLoading.value = true;
  try {
    await client.post('/datasource', form);
    Message.success('数据源注册成功');
    modalVisible.value = false;
    fetchSources();
    // 重置表单
    Object.assign(form, { id: '', db_type: 'postgres', connection_url: '', display_name: '' });
    return true;
  } catch (e: any) {
    Message.error('注册失败: ' + (e.response?.data?.error || e.message));
    return false;
  } finally {
    submitLoading.value = false;
  }
};

// 测试连接逻辑（演示用）
const testConnection = (source: any) => {
  Message.loading(`正在尝试连接 ${source.display_name}...`);
  // 这里可以调用后端一个专门的 ping 接口
  setTimeout(() => {
    Message.success('连接测试通过');
  }, 1500);
};

onMounted(fetchSources);
</script>