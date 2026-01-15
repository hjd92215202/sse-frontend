<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-800">本体知识库 (T-Box & A-Box)</h2>
      <a-space>
        <a-button type="outline" @click="handleExportTTL" :loading="exportLoading">
          <template #icon><icon-download /></template>导出 TTL
        </a-button>
        <a-button type="primary" size="large" @click="openCreateModal">
          <template #icon><icon-plus /></template>新增本体节点
        </a-button>
      </a-space>
    </div>

    <!-- 列表表格 -->
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
          
          <a-table-column title="显示名称 / 标识" :width="200">
            <template #cell="{ record }">
              <div class="font-bold text-gray-800">{{ record.label }}</div>
              <div class="text-xs text-gray-400 font-mono">{{ record.node_key }}</div>
            </template>
          </a-table-column>

          <a-table-column title="物理绑定">
            <template #cell="{ record }">
              <div class="text-xs">
                <div class="text-gray-400">Source: {{ record.source_id }}</div>
                <code class="text-blue-600 bg-blue-50 px-1 rounded">{{ record.target_table }}.{{ record.target_column }}</code>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="业务逻辑约束">
            <template #cell="{ record }">
              <div v-if="record.default_constraints && record.default_constraints.length > 0">
                <a-space wrap size="mini">
                  <a-tag v-for="(c, idx) in record.default_constraints" :key="idx" color="green" size="small" bordered>
                    <span class="font-mono">{{ c.column }} {{ c.operator }} '{{ c.value }}'</span>
                  </a-tag>
                </a-space>
              </div>
              <span v-else class="text-gray-300 text-xs italic">无</span>
            </template>
          </a-table-column>

          <a-table-column title="语义关联 / A-Box">
            <template #cell="{ record }">
              <div v-if="record.node_role === 'DIMENSION'" class="text-xs text-green-600 flex items-center gap-1">
                <icon-check-circle-fill /> 维度实例已同步
              </div>
              <div v-else class="text-xs">
                <span class="text-gray-400 block mb-1">支持分析维度:</span>
                <a-space wrap size="mini">
                  <a-tag v-for="dimId in record.supported_dimension_ids" :key="dimId" size="small" color="blue">
                    {{ getDimensionLabel(dimId) }}
                  </a-tag>
                  <span v-if="!record.supported_dimension_ids?.length" class="text-gray-300">未定义关联</span>
                </a-space>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="操作" :width="100">
            <template #cell="{ record }">
              <a-button type="text" size="small" @click="editMapping(record)"><icon-edit /> 编辑</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 配置弹窗 -->
    <a-modal v-model:visible="modalVisible" title="本体建模工作台" width="750px" @ok="handleSave" :ok-loading="saveLoading">
      <a-form :model="form" layout="vertical">
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="节点角色" required>
            <a-radio-group v-model="form.node_role" type="button" @change="onRoleChange">
              <a-radio value="METRIC">指标 (Metric)</a-radio>
              <a-radio value="DIMENSION">维度 (Dimension)</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="唯一 Key" required>
            <a-input v-model="form.node_key" placeholder="英文标识" :disabled="isEdit" />
          </a-form-item>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="显示名称" required>
            <a-input v-model="form.label" placeholder="中文名称" />
          </a-form-item>
          <a-form-item label="同义词/别名">
            <a-input-tag v-model="form.alias_names" placeholder="回车添加" allow-clear />
          </a-form-item>
        </div>

        <a-divider>物理元数据绑定</a-divider>
        <div class="grid grid-cols-3 gap-2">
          <a-form-item label="目标数据源" required>
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
              <a-button v-if="form.node_role === 'DIMENSION' && form.id" 
                        type="outline" @click="handleSyncValues(form.id)" title="同步码值到 A-Box">
                <template #icon><icon-sync /></template>
              </a-button>
            </div>
          </a-form-item>
        </div>

        <!-- 指标专用配置 -->
        <div v-if="form.node_role === 'METRIC'" class="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4">
           <div class="grid grid-cols-2 gap-4">
              <a-form-item label="默认计算逻辑">
                <a-select v-model="form.default_agg">
                  <a-option value="SUM">求和 (SUM)</a-option>
                  <a-option value="AVG">平均 (AVG)</a-option>
                  <a-option value="COUNT">计数 (COUNT)</a-option>
                  <a-option value="MAX">最大值 (MAX)</a-option>
                  <a-option value="NONE">不聚合 (明细)</a-option>
                </a-select>
              </a-form-item>
              <a-form-item label="关联有效维度">
                <a-select v-model="form.supported_dimension_ids" multiple placeholder="请关联维度节点">
                  <a-option v-for="d in dimensionNodes" :key="d.id" :value="d.id">{{ d.label }}</a-option>
                </a-select>
              </a-form-item>
           </div>
        </div>

        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-gray-700">业务隐含逻辑</span>
          <a-button type="outline" size="mini" @click="form.default_constraints.push({column:'', operator:'=', value:''})">
            <template #icon><icon-plus /></template>添加
          </a-button>
        </div>
        <div v-for="(c, idx) in form.default_constraints" :key="idx" class="flex gap-2 mb-2 bg-gray-50 p-2 rounded">
          <a-input v-model="c.column" placeholder="字段名" size="small" />
          <a-select v-model="c.operator" size="small" style="width: 100px">
            <a-option value="=">=</a-option>
            <a-option value=">">></a-option>
            <a-option value="LIKE">LIKE</a-option>
          </a-select>
          <a-input v-model="c.value" placeholder="值" size="small" />
          <a-button type="text" status="danger" @click="form.default_constraints.splice(idx, 1)"><icon-delete /></a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { IconPlus, IconDelete, IconSync, IconDownload, IconEdit, IconCheckCircleFill } from '@arco-design/web-vue/es/icon';
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
  default_agg: 'SUM',
  alias_names: [] as string[],
  default_constraints: [] as any[],
  supported_dimension_ids: [] as string[]
});

const dimensionNodes = computed(() => mappings.value.filter(n => n.node_role === 'DIMENSION'));

const getDimensionLabel = (id: string) => {
  const dim = mappings.value.find(m => m.id === id);
  return dim ? dim.label : '...';
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [mRes, sRes] = await Promise.all([client.get('/mappings'), client.get('/datasources')]);
    if (Array.isArray(mRes.data)) {
        mappings.value = mRes.data.map((i: any) => ({
          ...i,
          default_constraints: Array.isArray(i.default_constraints) ? i.default_constraints : (i.default_constraints?.["0"] || [])
        }));
    }
    sources.value = sRes.data || [];
  } catch (e) {
    Message.error('无法加载配置');
  } finally { loading.value = false; }
};

const handleSourceChange = async (val: any) => {
  if (!val) return;
  tableOptions.value = [];
  tableLoading.value = true;
  try {
    const res = await client.get(`/metadata/tables?source_id=${val}`);
    tableOptions.value = res.data;
  } finally { tableLoading.value = false; }
};

const handleTableChange = async (val: any) => {
  if (!val) return;
  columnOptions.value = [];
  columnLoading.value = true;
  try {
    const res = await client.get(`/metadata/columns?source_id=${form.source_id}&table_name=${val}`);
    columnOptions.value = res.data;
  } finally { columnLoading.value = false; }
};

const handleSyncValues = async (id: string) => {
  const msg = Message.loading('正在同步 A-Box...');
  try {
    await client.post(`/sync-values/${id}`);
    Message.success('码值同步完成');
    fetchData();
  } catch { Message.error('同步失败'); }
  finally { msg.close(); }
};

const openCreateModal = () => {
  isEdit.value = false;
  Object.assign(form, { id: '', node_key: '', label: '', node_role: 'METRIC', source_id: '', target_table: '', target_column: '', default_agg: 'SUM', alias_names: [], default_constraints: [], supported_dimension_ids: [] });
  modalVisible.value = true;
};

const editMapping = async (record: any) => {
  isEdit.value = true;
  Object.assign(form, {
    ...record,
    supported_dimension_ids: record.supported_dimension_ids || []
  });
  modalVisible.value = true;
  if (record.source_id) handleSourceChange(record.source_id);
  if (record.target_table) handleTableChange(record.target_table);
};

const handleSave = async () => {
  if (!form.node_key || !form.label || !form.source_id) {
    Message.error('请填写完整信息');
    return;
  }
  saveLoading.value = true;
  try {
    // 修改点：直接调用保存，不再赋值给未使用变量 res
    await client.post('/mapping', form);
    Message.success('建模已保存');
    fetchData();
    modalVisible.value = false;
  } catch (e: any) {
    Message.error('保存失败');
  } finally { saveLoading.value = false; }
};

const onRoleChange = () => {
  if (form.node_role === 'DIMENSION') {
      form.supported_dimension_ids = [];
      form.default_agg = 'NONE';
  } else {
      form.default_agg = 'SUM';
  }
};

const handleExportTTL = async () => {
  exportLoading.value = true;
  try {
    const res = await client.get('/ontology/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sse_enterprise.ttl`;
    link.click();
  } catch { Message.error('导出失败'); }
  finally { exportLoading.value = false; }
};

onMounted(fetchData);
</script>