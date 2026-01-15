<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-800">本体知识库配置</h2>
      <a-button type="outline" @click="handleExportTTL" :loading="exportLoading">
        <template #icon><icon-download /></template>
        导出语义 TTL
      </a-button>
      <a-button type="primary" size="large" @click="openCreateModal">
        <template #icon><icon-plus /></template>
        新增本体节点
      </a-button>
    </div>

    <!-- 映射列表 -->
    <a-card class="shadow-sm">
      <a-table :data="mappings" :loading="loading" :pagination="false">
        <template #columns>
          <a-table-column title="类型" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.node_type === 'METRIC' ? 'gold' : 'cyan'">
                {{ record.node_type === 'METRIC' ? '指标' : '维度' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="显示名称" data-index="label" />
          <a-table-column title="实体标识" data-index="node_key" />
          <a-table-column title="别名">
            <template #cell="{ record }">
              <a-space wrap>
                <a-tag v-for="tag in record.alias_names" :key="tag" size="small">{{ tag }}</a-tag>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="物理绑定">
            <template #cell="{ record }">
              <div class="text-xs">
                <div class="text-gray-400 font-bold">Source: {{ record.source_id }}</div>
                <code class="text-red-500">{{ record.target_table }}.{{ record.target_column }}</code>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="业务约束 (Implicit)">
            <template #cell="{ record }">
              <div v-if="record.default_constraints && record.default_constraints.length > 0">
                <div v-for="(c, idx) in record.default_constraints" :key="idx"
                  class="text-xs bg-green-50 text-green-700 px-1 mb-1 rounded border border-green-100">
                  {{ c.column }} {{ c.operator }} '{{ c.value }}'
                </div>
              </div>
              <span v-else class="text-gray-300 text-xs italic">无默认约束</span>
            </template>
          </a-table-column>
          <a-table-column title="操作">
            <template #cell="{ record }">
              <a-button type="text" size="small" @click="editMapping(record)">编辑</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" title="配置本体节点" width="650px" @ok="handleSave">
      <a-form :model="form" layout="vertical">
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="节点类型" required>
            <a-radio-group v-model="form.node_type" type="button">
              <a-radio value="METRIC">指标 (Metric)</a-radio>
              <a-radio value="DIMENSION">维度 (Dimension)</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="唯一标识 (Key)" required>
            <a-input v-model="form.node_key" placeholder="例如: revenue_amt" :disabled="isEdit" />
          </a-form-item>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="显示名称" required>
            <a-input v-model="form.label" placeholder="例如: 收益金额" />
          </a-form-item>
          <a-form-item label="同义词/别名">
            <a-input-tag v-model="form.alias_names" placeholder="输入并回车" allow-clear />
          </a-form-item>
        </div>

        <a-divider>物理存储绑定</a-divider>
        <div class="grid grid-cols-3 gap-2">
          <a-form-item label="数据源" required>
            <a-select v-model="form.source_id" placeholder="选择库">
              <a-option v-for="s in sources" :key="s.id" :value="s.id">{{ s.display_name }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="表名" required>
            <a-input v-model="form.target_table" placeholder="t_order" />
          </a-form-item>
          <a-form-item label="列名" required>
            <a-input v-model="form.target_column" placeholder="amount" />
          </a-form-item>
        </div>

        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-gray-700">业务隐含约束 (Implicit Constraints)</span>
          <a-button type="outline" size="mini"
            @click="form.default_constraints.push({ column: '', operator: '=', value: '' })">
            <template #icon><icon-plus /></template>添加
          </a-button>
        </div>

        <div v-for="(c, idx) in form.default_constraints" :key="idx"
          class="flex gap-2 mb-2 items-center bg-gray-50 p-2 rounded">
          <a-input v-model="c.column" placeholder="字段名" size="small" />
          <a-select v-model="c.operator" placeholder="算子" size="small" style="width: 120px">
            <a-option value="=">=</a-option>
            <a-option value=">">></a-option>
            <a-option value="<">
              < </a-option>
                <a-option value="LIKE">LIKE</a-option>
          </a-select>
          <a-input v-model="c.value" placeholder="过滤值" size="small" />
          <a-button type="text" status="danger" @click="form.default_constraints.splice(idx, 1)">
            <icon-delete />
          </a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { IconPlus, IconDelete, IconDownload } from '@arco-design/web-vue/es/icon';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

const loading = ref(false);
const mappings = ref([]);
const sources = ref<any[]>([]);
const modalVisible = ref(false);
const isEdit = ref(false);

const form = reactive({
  node_key: '',
  label: '',
  node_type: 'METRIC',
  source_id: '',
  target_table: '',
  target_column: '',
  alias_names: [] as string[],
  default_constraints: [] as any[]
});

const fetchData = async () => {
  loading.value = true;
  try {
    const [mRes, sRes] = await Promise.all([
      client.get('/mappings'),
      client.get('/datasources'),
    ]);

    // 关键修复：确保约束条件被解析为数组
    mappings.value = mRes.data.map((i: any) => {
      let constraints = [];
      if (Array.isArray(i.default_constraints)) {
        constraints = i.default_constraints;
      } else if (i.default_constraints && typeof i.default_constraints === 'object') {
        // 处理某些数据库驱动返回的 {"0": {...}} 格式
        constraints = Object.values(i.default_constraints);
      }
      return { ...i, default_constraints: constraints };
    });
    sources.value = sRes.data;
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  isEdit.value = false;
  Object.assign(form, { node_key: '', label: '', node_type: 'METRIC', source_id: '', target_table: '', target_column: '', alias_names: [], default_constraints: [] });
  modalVisible.value = true;
};

const editMapping = (record: any) => {
  isEdit.value = true;
  Object.assign(form, {
    ...record,
    default_constraints: Array.isArray(record.default_constraints) ? [...record.default_constraints] : []
  });
  modalVisible.value = true;
};

const handleSave = async () => {
  if (!form.node_key || !form.label || !form.source_id) {
    Message.error('请填写必要字段');
    return false;
  }
  try {
    await client.post('/mapping', form);
    Message.success('配置已同步至本体库');
    fetchData();
    modalVisible.value = false;
    return true;
  } catch (e: any) {
    Message.error('保存失败');
    return false;
  }
};
 

const exportLoading = ref(false);

const handleExportTTL = async () => {
  exportLoading.value = true;
  try {
    // 采用浏览器直接下载的方式
    const response = await client.get('/ontology/export', {
      responseType: 'blob' // 必须指定为二进制流
    });
    
    // 创建隐藏的下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sse_ontology.ttl');
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    Message.success('TTL 文件导出成功');
  } catch (e) {
    Message.error('导出失败');
  } finally {
    exportLoading.value = false;
  }
};

onMounted(fetchData);
</script>