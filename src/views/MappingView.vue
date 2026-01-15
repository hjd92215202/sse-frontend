<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-800">本体知识库 (Headless BI 建模)</h2>
      <a-space>
        <a-button type="outline" @click="handleExportTTL" :loading="exportLoading">
          <template #icon><icon-download /></template>导出 TTL
        </a-button>
        <a-button type="primary" size="large" @click="openCreateModal">
          <template #icon><icon-plus /></template>新增语义节点
        </a-button>
      </a-space>
    </div>

    <a-card class="shadow-sm" :bordered="false">
      <a-table :data="mappings" :loading="loading" :pagination="false">
        <template #columns>
          <a-table-column title="角色" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.node_role === 'METRIC' ? 'gold' : 'cyan'" size="small">
                {{ record.node_role === 'METRIC' ? '指标' : '维度' }}
              </a-tag>
            </template>
          </a-table-column>
          
          <a-table-column title="显示名称 / 标识" :width="180">
            <template #cell="{ record }">
              <div class="font-bold text-gray-800">{{ record.label }}</div>
              <div class="text-xs text-gray-400 font-mono">{{ record.node_key }}</div>
            </template>
          </a-table-column>

          <a-table-column title="聚合方式" :width="100">
            <template #cell="{ record }">
              <code v-if="record.node_role === 'METRIC'" class="text-xs bg-gray-100 px-1 rounded">{{ record.default_agg }}</code>
              <span v-else>-</span>
            </template>
          </a-table-column>

          <a-table-column title="业务约束 (Implicit Logic)">
            <template #cell="{ record }">
              <div v-if="record.default_constraints && record.default_constraints.length > 0">
                <a-space wrap size="mini">
                  <a-tag v-for="(c, idx) in record.default_constraints" :key="idx" color="green" size="small" bordered>
                    {{ c.column }} {{ c.operator }} '{{ c.value }}'
                  </a-tag>
                </a-space>
              </div>
              <span v-else class="text-gray-300 text-xs italic">无</span>
            </template>
          </a-table-column>

          <a-table-column title="关联维度 (T-Box)">
            <template #cell="{ record }">
              <div v-if="record.node_role === 'METRIC'">
                <a-space wrap size="mini">
                  <a-tag v-for="id in record.supported_dimension_ids" :key="id" size="small" color="arcoblue">
                    {{ getDimLabel(id) }}
                  </a-tag>
                  <span v-if="!record.supported_dimension_ids?.length" class="text-gray-300 text-xs italic">未关联</span>
                </a-space>
              </div>
              <div v-else class="text-xs text-green-600 flex items-center gap-1">
                 <icon-check-circle-fill /> 维度已就绪
              </div>
            </template>
          </a-table-column>

          <a-table-column title="操作" :width="100">
            <template #cell="{ record }">
              <a-button type="text" size="small" @click="editMapping(record)">编辑</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 弹窗 -->
    <a-modal v-model:visible="modalVisible" title="语义建模工作台" width="750px" @ok="handleSave" :ok-loading="saveLoading">
      <a-form :model="form" layout="vertical">
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="节点角色" required>
            <a-radio-group v-model="form.node_role" type="button">
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
            <a-input-tag v-model="form.alias_names" placeholder="输入并回车" />
          </a-form-item>
        </div>

        <a-divider>物理元数据绑定</a-divider>
        <div class="grid grid-cols-3 gap-2">
          <a-form-item label="数据源" required>
            <a-select v-model="form.source_id" @change="handleSourceChange" placeholder="选择库">
              <a-option v-for="s in sources" :key="s.id" :value="s.id">{{ s.display_name }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="物理表" required>
            <a-select v-model="form.target_table" @change="handleTableChange" placeholder="选择表" :loading="tableLoading">
              <a-option v-for="t in tableOptions" :key="t" :value="t">{{ t }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="物理列" required>
            <div class="flex gap-1">
              <a-select v-model="form.target_column" placeholder="选择列" :loading="columnLoading">
                <a-option v-for="c in columnOptions" :key="c" :value="c">{{ c }}</a-option>
              </a-select>
              <a-button v-if="form.node_role === 'DIMENSION' && form.id" type="outline" @click="handleSyncValues(form.id)" title="同步 A-Box 码值">
                <template #icon><icon-sync /></template>
              </a-button>
            </div>
          </a-form-item>
        </div>

        <div v-if="form.node_role === 'METRIC'" class="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
          <div class="grid grid-cols-2 gap-4">
            <a-form-item label="默认计算逻辑" required>
              <a-select v-model="form.default_agg">
                <a-option value="SUM">求和 (SUM)</a-option>
                <a-option value="AVG">平均 (AVG)</a-option>
                <a-option value="COUNT">计数 (COUNT)</a-option>
                <a-option value="NONE">不聚合 (明细)</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="关联有效维度 (T-Box)">
              <a-select v-model="form.supported_dimension_ids" multiple placeholder="请选择支持的维度">
                <a-option v-for="d in dimensionNodes" :key="d.id" :value="d.id">{{ d.label }}</a-option>
              </a-select>
            </a-form-item>
          </div>
        </div>

        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-gray-700">业务隐含逻辑</span>
          <a-button type="outline" size="mini" @click="form.default_constraints.push({column:'', operator:'=', value:''})">
            <template #icon><icon-plus /></template>添加规则
          </a-button>
        </div>
        <div v-for="(c, idx) in form.default_constraints" :key="idx" class="flex gap-2 mb-2 bg-gray-50 p-2 rounded">
          <a-input v-model="c.column" placeholder="物理字段" size="small" />
          <a-select v-model="c.operator" size="small" style="width: 100px">
            <a-option value="=">=</a-option>
            <a-option value=">">></a-option>
            <a-option value="LIKE">LIKE</a-option>
          </a-select>
          <a-input v-model="c.value" placeholder="过滤值" size="small" />
          <a-button type="text" status="danger" @click="form.default_constraints.splice(idx, 1)"><icon-delete /></a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { IconPlus, IconDelete, IconSync, IconDownload, IconCheckCircleFill } from '@arco-design/web-vue/es/icon';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

const loading = ref(false);
const saveLoading = ref(false);
const exportLoading = ref(false);
const tableLoading = ref(false);
const columnLoading = ref(false);

const mappings = ref<any[]>([]);
const sources = ref<any[]>([]);
const tableOptions = ref<string[]>([]);
const columnOptions = ref<string[]>([]);
const modalVisible = ref(false);
const isEdit = ref(false);

const form = reactive({
  id: '',
  node_key: '',
  label: '',
  node_role: 'METRIC',
  source_id: '',
  target_table: '',
  target_column: '',
  alias_names: [] as string[],
  default_constraints: [] as any[],
  supported_dimension_ids: [] as string[],
  default_agg: 'SUM'
});

const dimensionNodes = computed(() => mappings.value.filter(n => n.node_role === 'DIMENSION'));

const getDimLabel = (id: string) => {
  return mappings.value.find(m => m.id === id)?.label || '...';
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [mRes, sRes] = await Promise.all([client.get('/mappings'), client.get('/datasources')]);
    mappings.value = mRes.data.map((i: any) => ({
      ...i,
      default_constraints: Array.isArray(i.default_constraints) ? i.default_constraints : (i.default_constraints?.["0"] || [])
    }));
    sources.value = sRes.data;
  } finally { loading.value = false; }
};

const handleSourceChange = async (val: any) => {
  tableLoading.value = true;
  const res = await client.get(`/metadata/tables?source_id=${val}`);
  tableOptions.value = res.data;
  tableLoading.value = false;
};

const handleTableChange = async (val: any) => {
  columnLoading.value = true;
  const res = await client.get(`/metadata/columns?source_id=${form.source_id}&table_name=${val}`);
  columnOptions.value = res.data;
  columnLoading.value = false;
};

const handleSyncValues = async (id: string) => {
  const msg = Message.loading('同步码值中...');
  await client.post(`/sync-values/${id}`);
  msg.close();
  Message.success('同步成功');
  fetchData();
};

const openCreateModal = () => {
  isEdit.value = false;
  Object.assign(form, { id: '', node_key: '', label: '', node_role: 'METRIC', source_id: '', target_table: '', target_column: '', alias_names: [], default_constraints: [], supported_dimension_ids: [], default_agg: 'SUM' });
  modalVisible.value = true;
};

const editMapping = (record: any) => {
  isEdit.value = true;
  Object.assign(form, record);
  modalVisible.value = true;
  if (record.source_id) handleSourceChange(record.source_id);
  if (record.target_table) handleTableChange(record.target_table);
};

const handleSave = async () => {
  saveLoading.value = true;
  try {
    await client.post('/mapping', form);
    Message.success('建模已保存');
    fetchData();
    modalVisible.value = false;
  } finally { saveLoading.value = false; }
};

const handleExportTTL = async () => {
  exportLoading.value = true;
  const res = await client.get('/ontology/export', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `sse_enterprise.ttl`;
  link.click();
  exportLoading.value = false;
};

onMounted(fetchData);
</script>