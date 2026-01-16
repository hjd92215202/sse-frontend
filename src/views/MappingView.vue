<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-800">本体知识库 (Semantic Modeling)</h2>
      <a-space>
        <a-button type="outline" @click="handleExportTTL" :loading="exportLoading">
          <template #icon><icon-download /></template>导出 TTL
        </a-button>
        <a-button type="primary" size="large" @click="openCreateModal">
          <template #icon><icon-plus /></template>新增语义节点
        </a-button>
      </a-space>
    </div>

    <!-- 本体列表表格 -->
    <a-card class="shadow-sm" :bordered="false">
      <a-table :data="mappings" :loading="loading" :pagination="false">
        <template #columns>
          <a-table-column title="角色/类型" :width="130">
            <template #cell="{ record }">
              <a-space direction="vertical" size="mini">
                <a-tag :color="record.node_role === 'METRIC' ? 'gold' : 'cyan'" size="small">
                  {{ record.node_role === 'METRIC' ? '指标' : '维度' }}
                </a-tag>
                <a-tag size="small" bordered color="gray">{{ record.semantic_type }}</a-tag>
              </a-space>
            </template>
          </a-table-column>
          
          <a-table-column title="显示名称 / 标识" :width="200">
            <template #cell="{ record }">
              <div class="font-bold text-gray-800">{{ record.label }}</div>
              <div class="text-xs text-gray-400 font-mono">{{ record.node_key }}</div>
            </template>
          </a-table-column>

          <a-table-column title="逻辑口径 / SQL 表达式">
            <template #cell="{ record }">
              <div class="text-xs">
                <div class="text-gray-400 mb-1">物理表: {{ record.target_table }}</div>
                <code class="text-pink-600 bg-pink-50 p-1 rounded font-mono">{{ record.sql_expression }}</code>
              </div>
            </template>
          </a-table-column>

          <a-table-column title="关联维度 (T-Box)">
            <template #cell="{ record }">
              <a-space wrap v-if="record.node_role === 'METRIC'">
                <a-tag v-for="id in record.supported_dimension_ids" :key="id" size="small" color="arcoblue">
                  {{ getDimLabel(id) }}
                </a-tag>
                <span v-if="!record.supported_dimension_ids?.length" class="text-gray-300 text-xs italic">未关联</span>
              </a-space>
              <div v-else-if="record.semantic_type === 'DATE'" class="text-xs text-orange-600 font-bold italic">
                <icon-calendar /> 时间语义类
              </div>
              <div v-else class="text-xs text-green-600 font-bold"><icon-check-circle-fill /> A-Box 就绪</div>
            </template>
          </a-table-column>

          <a-table-column title="操作" :width="150">
            <template #cell="{ record }">
              <a-space>
                <a-button type="text" size="small" @click="editMapping(record)">编辑</a-button>
                <a-popconfirm content="确定要删除吗？物理映射及码值将一并清理。" type="warning" @ok="handleDelete(record.id)">
                  <a-button type="text" status="danger" size="small">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 建模弹窗 -->
    <a-modal v-model:visible="modalVisible" title="语义建模工作台" width="850px" @ok="handleSave" :ok-loading="saveLoading">
      <a-form :model="form" layout="vertical">
        <div class="grid grid-cols-3 gap-4">
          <a-form-item label="节点角色" required>
            <a-radio-group v-model="form.node_role" type="button" @change="onRoleChange">
              <a-radio value="METRIC">指标</a-radio>
              <a-radio value="DIMENSION">维度</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="语义类型" required>
            <a-select v-model="form.semantic_type">
              <a-option value="STRING">字符串 (STRING)</a-option>
              <a-option value="DATE">日期 (DATE)</a-option>
              <a-option value="NUMBER">数值 (NUMBER)</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="唯一 Key" required>
            <a-input v-model="form.node_key" placeholder="英文标识" :disabled="isEdit" />
          </a-form-item>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="业务名称" required>
            <a-input v-model="form.label" placeholder="例如: 收益金额" />
          </a-form-item>
          <a-form-item label="同义词/别名">
            <a-input-tag v-model="form.alias_names" placeholder="回车添加别名" allow-clear />
          </a-form-item>
        </div>

        <a-divider>物理元数据绑定 (Cascading)</a-divider>
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="目标数据源" required>
            <a-select v-model="form.source_id" @change="handleSourceChange" placeholder="选择数据库">
              <a-option v-for="s in sources" :key="s.id" :value="s.id">{{ s.display_name }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="物理表" required>
            <a-select v-model="form.target_table" @change="handleTableChange" :loading="tableLoading" placeholder="选择表">
              <a-option v-for="t in tableOptions" :key="t" :value="t">{{ t }}</a-option>
            </a-select>
          </a-form-item>
        </div>

        <a-form-item label="SQL 逻辑表达式 (字段或 CASE WHEN)" required help="直接选列，或手动输入 SQL 片段。如果是维度，支持右侧同步 A-Box">
          <div class="flex gap-2">
            <a-select v-model="form.sql_expression" allow-create :loading="columnLoading" class="flex-1" placeholder="请选择或输入逻辑">
              <a-option v-for="c in columnOptions" :key="c" :value="c">{{ c }}</a-option>
            </a-select>
            <a-button v-if="form.node_role === 'DIMENSION' && form.id" 
                      type="outline" @click="handleSyncValues(form.id)" title="将数据库真实值同步到 A-Box 实例库">
              <template #icon><icon-sync /></template> 同步码值
            </a-button>
          </div>
        </a-form-item>

        <!-- 针对 DATE 类型的特殊配置 -->
        <div v-if="form.semantic_type === 'DATE'" class="bg-blue-50 p-4 rounded mb-4 border border-blue-100">
           <a-form-item label="日期解析格式 (Regex Hints)" required help="用于指导推理引擎识别提问中的日期字符串">
             <a-select v-model="form.value_format">
               <a-option value="yyyy-MM-dd">yyyy-MM-dd (例: 2025-01-01)</a-option>
               <a-option value="yyyyMMdd">yyyyMMdd (例: 20250101)</a-option>
               <a-option value="yyyy-MM">yyyy-MM (例: 2025-01)</a-option>
             </a-select>
           </a-form-item>
        </div>

        <!-- 指标专用配置 -->
        <div v-if="form.node_role === 'METRIC'" class="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
          <div class="grid grid-cols-2 gap-4">
            <a-form-item label="默认计算逻辑">
              <a-select v-model="form.default_agg">
                <a-option value="SUM">求和 (SUM)</a-option>
                <a-option value="AVG">平均 (AVG)</a-option>
                <a-option value="COUNT">计数 (COUNT)</a-option>
                <a-option value="NONE">不聚合 (明细数据)</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="关联分析维度 (T-Box Relation)" help="只有勾选的关系，在推理时才会被视为合法路径">
              <a-select v-model="form.supported_dimension_ids" multiple placeholder="选择支持的维度">
                <a-option v-for="d in dimensionNodes" :key="d.id" :value="d.id">{{ d.label }}</a-option>
              </a-select>
            </a-form-item>
          </div>
        </div>

        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-gray-700">业务隐含逻辑约束</span>
          <a-button type="outline" size="mini" @click="addRule"><icon-plus /> 添加</a-button>
        </div>
        <div v-for="(c, idx) in form.default_constraints" :key="idx" class="flex gap-2 mb-2 bg-gray-50 p-2 rounded">
          <a-input v-model="c.column" placeholder="字段名" size="small" />
          <a-select v-model="c.operator" size="small" style="width: 100px">
            <a-option value="=">=</a-option>
            <a-option value=">">></a-option>
            <a-option value="LIKE">LIKE</a-option>
          </a-select>
          <a-input v-model="c.value" placeholder="过滤值" size="small" />
          <a-button type="text" status="danger" @click="form.default_constraints.splice(idx, 1)"><icon-delete /></a-button>
        </div>
      </a-form>
      <template #footer>
        <div class="mr-auto text-gray-400 text-xs flex items-center">
          <icon-info-circle /> 保存后内存分词器字典与 FST 将同步热更新
        </div>
        <a-button @click="modalVisible = false">取消</a-button>
        <a-button type="primary" @click="handleSave" :loading="saveLoading">保存配置</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { IconPlus, IconDelete, IconSync, IconDownload, IconCheckCircleFill, IconCalendar, IconInfoCircle } from '@arco-design/web-vue/es/icon';
import client from '../api/client';
import { Message } from '@arco-design/web-vue';

interface BusinessConstraint {
  column: string;
  operator: string;
  value: string;
}

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
  semantic_type: 'STRING',
  source_id: '',
  target_table: '',
  sql_expression: '',
  default_agg: 'SUM',
  alias_names: [] as string[],
  default_constraints: [] as BusinessConstraint[],
  supported_dimension_ids: [] as string[],
  value_format: 'yyyy-MM-dd'
});

const dimensionNodes = computed(() => mappings.value.filter(n => n.node_role === 'DIMENSION'));
const getDimLabel = (id: string) => mappings.value.find(m => m.id === id)?.label || '...';

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
  } finally { msg.close(); }
};

const handleDelete = async (id: string) => {
  try {
    await client.delete(`/mapping/${id}`);
    Message.success('节点已删除');
    fetchData();
  } catch { Message.error('删除失败'); }
};

const addRule = () => {
  form.default_constraints.push({ column: '', operator: '=', value: '' });
};

const openCreateModal = () => {
  isEdit.value = false;
  Object.assign(form, { id: '', node_key: '', label: '', node_role: 'METRIC', semantic_type: 'STRING', source_id: '', target_table: '', sql_expression: '', alias_names: [], default_constraints: [], supported_dimension_ids: [], default_agg: 'SUM', value_format: 'yyyy-MM-dd' });
  modalVisible.value = true;
};

const editMapping = (record: any) => {
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
    Message.error('请填写完整建模信息');
    return;
  }
  saveLoading.value = true;
  try {
    const res = await client.post('/mapping', form);
    if (!form.id) form.id = res.data.id;
    Message.success('建模已保存并热生效');
    fetchData();
    modalVisible.value = false;
  } catch (e: any) {
    Message.error('保存失败');
  } finally { saveLoading.value = false; }
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
  } finally { exportLoading.value = false; }
};

const onRoleChange = () => {
  if (form.node_role === 'DIMENSION') {
    form.supported_dimension_ids = [];
    form.default_agg = 'NONE';
  }
};

onMounted(fetchData);
</script>