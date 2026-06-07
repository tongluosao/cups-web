<template>
  <div class="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <UCard>
        <template #header>
          <h2 class="text-xl font-bold flex items-center gap-2">
            <UIcon name="i-lucide-users" class="w-5 h-5" />
            用户管理
          </h2>
        </template>
        <UForm @submit="saveUser" :state="form" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <UInput v-model="form.username" :disabled="form.protected" placeholder="登录名" :color="formErrors.username ? 'error' : undefined" />
            <p v-if="formErrors.username" class="text-xs text-error mt-1">{{ formErrors.username }}</p>
          </div>
          <div>
            <UInput type="password" v-model="form.password" :placeholder="isEditing ? '留空不修改密码' : '密码'" :color="formErrors.password ? 'error' : undefined" />
            <p v-if="formErrors.password" class="text-xs text-error mt-1">{{ formErrors.password }}</p>
          </div>
          <USelect
            v-model="form.role"
            :disabled="form.protected"
            :items="roleItems"
            value-key="value"
            label-key="label"
          />
          <UInput v-model="form.contactName" placeholder="联系人" />
          <UInput v-model="form.phone" placeholder="联系电话" />
          <div>
            <UInput v-model="form.email" placeholder="邮箱" :color="formErrors.email ? 'error' : undefined" />
            <p v-if="formErrors.email" class="text-xs text-error mt-1">{{ formErrors.email }}</p>
          </div>
          <div class="flex gap-2 md:col-span-2">
            <UButton type="submit" color="primary" :loading="savingUser" :disabled="savingUser">{{ isEditing ? '保存' : '新增用户' }}</UButton>
            <UButton type="button" variant="ghost" @click="resetForm">重置</UButton>
          </div>
        </UForm>

        <div class="overflow-x-auto mt-4">
          <UTable :columns="userColumns" :data="users">
            <template #actions-cell="{ row }">
              <div class="flex gap-2">
                <UButton size="sm" variant="ghost" icon="i-lucide-pencil" @click="editUser(row.original)">编辑</UButton>
                <UButton size="sm" variant="outline" color="error" icon="i-lucide-trash-2" :disabled="row.original.username === 'admin'" @click="confirmDelete(row.original)">删除</UButton>
              </div>
            </template>
          </UTable>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-xl font-bold flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="w-5 h-5" />
            打印记录
          </h2>
        </template>
        <div class="flex flex-wrap gap-3 items-end mb-4">
          <UInput v-model="printFilters.username" placeholder="用户名" />
          <UInput type="date" v-model="printFilters.start" />
          <UInput type="date" v-model="printFilters.end" />
          <UButton variant="outline" @click="loadPrintRecords" icon="i-lucide-search">查询</UButton>
        </div>
        <div class="overflow-x-auto">
          <UTable :columns="printColumns" :data="printRecords">
            <template #download-cell="{ row }">
              <UButton size="xs" variant="ghost" icon="i-lucide-download" @click="downloadFile(row.original.id)">下载</UButton>
            </template>
          </UTable>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-bold flex items-center gap-2">
            <UIcon name="i-lucide-settings" class="w-5 h-5" />
            系统设置
          </h2>
          <UButton variant="ghost" size="xs" icon="i-lucide-refresh-cw" :loading="loadingPrinters" @click="loadAdminPrinters">刷新打印机</UButton>
        </div>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label class="block text-sm font-medium mb-1">自动清理天数</label>
          <UInput type="number" step="1" v-model="settings.retentionDays" placeholder="例如 30" />
        </div>
        <div class="flex items-end">
          <UButton color="primary" @click="saveSettings" icon="i-lucide-save" :loading="savingSettings" :disabled="savingSettings">保存设置</UButton>
        </div>
      </div>
      <div class="text-sm text-muted mt-2">自动清理会删除打印记录与文件，并压缩数据库。</div>

      <div class="mt-5 border-t border-default pt-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 class="font-semibold flex items-center gap-2">
              <UIcon name="i-lucide-printer" class="w-4 h-4" />
              可见打印机
            </h3>
            <p class="text-sm text-muted mt-1">
              {{ settings.allowedPrinterUris.length === 0 ? '当前未限制，所有打印机可见。' : `当前仅允许 ${settings.allowedPrinterUris.length} 台打印机。` }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton size="xs" variant="outline" icon="i-lucide-check-check" @click="selectAllPrinters" :disabled="adminPrinters.length === 0">全选</UButton>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-eraser" @click="clearAllowedPrinters">清空限制</UButton>
          </div>
        </div>

        <UInput v-model="printerSearch" icon="i-lucide-search" placeholder="搜索打印机名称或 URI" />

        <div v-if="loadingPrinters" class="py-6 text-center text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="w-5 h-5 animate-spin mx-auto mb-1" />
          正在加载打印机
        </div>
        <div v-else-if="filteredAdminPrinters.length === 0" class="py-6 text-center text-sm text-muted">
          没有匹配的打印机
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          <label
            v-for="printer in filteredAdminPrinters"
            :key="printer.uri"
            class="flex items-start gap-3 rounded-lg border border-default p-3 hover:bg-elevated/60 cursor-pointer"
          >
            <UCheckbox
              :model-value="isPrinterAllowed(printer.uri)"
              class="mt-0.5"
              @update:model-value="togglePrinter(printer.uri, $event)"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium truncate">{{ printer.name }}</span>
              <span class="block text-xs text-muted break-all">{{ printer.uri }}</span>
            </span>
          </label>
        </div>
      </div>
    </UCard>

    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">确认删除</h3>
          <p>确定要删除用户 <strong>{{ pendingDeleteUser?.username }}</strong> 吗？</p>
          <p class="text-sm text-muted">此操作不可撤销。</p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showDeleteModal = false">取消</UButton>
            <UButton color="error" :loading="!!deletingUserId" @click="executeDelete">确认删除</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getCSRF, readError } from '../utils/api'

const toast = useToast()
const emit = defineEmits(['logout'])

const users = ref([])
const form = ref({
  id: null,
  username: '',
  password: '',
  role: 'user',
  protected: false,
  contactName: '',
  phone: '',
  email: ''
})
const printFilters = ref({ username: '', start: '', end: '' })
const printRecords = ref([])
const settings = ref({ retentionDays: '', allowedPrinterUris: [] })
const adminPrinters = ref([])
const printerSearch = ref('')

const savingUser = ref(false)
const savingSettings = ref(false)
const loadingPrinters = ref(false)
const deletingUserId = ref(null)
const pendingDeleteUser = ref(null)
const showDeleteModal = ref(false)
const formErrors = ref({})

const isEditing = computed(() => !!form.value.id)

const roleItems = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' }
]

const userColumns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'username', header: '登录名' },
  { accessorKey: 'role', header: '角色' },
  { accessorKey: 'contactName', header: '联系人' },
  { accessorKey: 'phone', header: '电话' },
  { accessorKey: 'email', header: '邮箱' },
  { id: 'actions', header: '操作' }
]

const printColumns = [
  { accessorKey: 'createdAt', header: '时间' },
  { accessorKey: 'username', header: '用户' },
  { accessorKey: 'filename', header: '文件' },
  { accessorKey: 'pages', header: '页数' },
  { accessorKey: 'status', header: '状态' },
  { id: 'download', header: '下载' }
]

const filteredAdminPrinters = computed(() => {
  const q = printerSearch.value.trim().toLowerCase()
  if (!q) return adminPrinters.value
  return adminPrinters.value.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.uri || '').toLowerCase().includes(q)
  )
})

function validateForm() {
  formErrors.value = {}
  if (!form.value.username.trim()) {
    formErrors.value.username = '用户名不能为空'
  }
  if (!isEditing.value && !form.value.password) {
    formErrors.value.password = '新用户必须设置密码'
  }
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    formErrors.value.email = '邮箱格式无效'
  }
  return Object.keys(formErrors.value).length === 0
}

function resetForm() {
  form.value = {
    id: null,
    username: '',
    password: '',
    role: 'user',
    protected: false,
    contactName: '',
    phone: '',
    email: ''
  }
  formErrors.value = {}
}

function editUser(user) {
  form.value = {
    id: user.id,
    username: user.username,
    password: '',
    role: user.role,
    protected: user.username === 'admin',
    contactName: user.contactName || '',
    phone: user.phone || '',
    email: user.email || ''
  }
  formErrors.value = {}
}

async function loadUsers() {
  const resp = await fetch('/api/admin/users', { credentials: 'include' })
  if (!resp.ok) {
    if (resp.status === 401) emit('logout')
    return
  }
  users.value = await resp.json()
}

async function saveUser() {
  if (!validateForm()) return
  savingUser.value = true
  try {
    const payload = {
      username: form.value.username,
      password: form.value.password,
      role: form.value.role,
      contactName: form.value.contactName,
      phone: form.value.phone,
      email: form.value.email
    }
    const url = isEditing.value ? `/api/admin/users/${form.value.id}` : '/api/admin/users'
    const method = isEditing.value ? 'PUT' : 'POST'
    const resp = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRF()
      },
      body: JSON.stringify(payload)
    })
    if (!resp.ok) {
      const msg = await readError(resp)
      toast.add({ title: '保存失败', description: msg, color: 'error', icon: 'i-lucide-x-circle' })
      if (resp.status === 401) emit('logout')
      return
    }
    toast.add({ title: isEditing.value ? '更新成功' : '创建成功', description: `用户 ${form.value.username} 已保存`, color: 'success', icon: 'i-lucide-check-circle' })
    await loadUsers()
    resetForm()
  } finally {
    savingUser.value = false
  }
}

function confirmDelete(user) {
  pendingDeleteUser.value = user
  showDeleteModal.value = true
}

async function executeDelete() {
  const user = pendingDeleteUser.value
  if (!user) return
  deletingUserId.value = user.id
  try {
    const resp = await fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRF-Token': getCSRF() }
    })
    if (!resp.ok) {
      const msg = await readError(resp)
      toast.add({ title: '删除失败', description: msg, color: 'error', icon: 'i-lucide-x-circle' })
      if (resp.status === 401) emit('logout')
      return
    }
    toast.add({ title: '删除成功', description: `用户 ${user.username} 已删除`, color: 'success', icon: 'i-lucide-check-circle' })
    await loadUsers()
  } finally {
    deletingUserId.value = null
    showDeleteModal.value = false
    pendingDeleteUser.value = null
  }
}

function downloadFile(id) {
  window.open(`/api/print-records/${id}/file`, '_blank')
}

async function loadPrintRecords() {
  const params = new URLSearchParams()
  if (printFilters.value.username) params.set('username', printFilters.value.username)
  if (printFilters.value.start) params.set('start', printFilters.value.start)
  if (printFilters.value.end) params.set('end', printFilters.value.end)
  const resp = await fetch(`/api/admin/print-records?${params.toString()}`, { credentials: 'include' })
  if (!resp.ok) {
    if (resp.status === 401) emit('logout')
    return
  }
  printRecords.value = await resp.json()
}

async function loadSettings() {
  const resp = await fetch('/api/admin/settings', { credentials: 'include' })
  if (!resp.ok) {
    if (resp.status === 401) emit('logout')
    return
  }
  const data = await resp.json()
  settings.value.retentionDays = String(data.retentionDays || 0)
  settings.value.allowedPrinterUris = Array.isArray(data.allowedPrinterUris) ? data.allowedPrinterUris : []
}

async function loadAdminPrinters() {
  loadingPrinters.value = true
  try {
    const resp = await fetch('/api/admin/printers', { credentials: 'include' })
    if (!resp.ok) {
      if (resp.status === 401) emit('logout')
      return
    }
    adminPrinters.value = await resp.json()
  } finally {
    loadingPrinters.value = false
  }
}

function isPrinterAllowed(uri) {
  if (settings.value.allowedPrinterUris.length === 0) return true
  return settings.value.allowedPrinterUris.includes(uri)
}

function togglePrinter(uri, checked) {
  const initial = settings.value.allowedPrinterUris.length === 0
    ? adminPrinters.value.map(p => p.uri)
    : settings.value.allowedPrinterUris
  const set = new Set(initial)
  if (checked) {
    set.add(uri)
  } else {
    set.delete(uri)
  }
  settings.value.allowedPrinterUris = Array.from(set)
}

function selectAllPrinters() {
  settings.value.allowedPrinterUris = adminPrinters.value.map(p => p.uri)
}

function clearAllowedPrinters() {
  settings.value.allowedPrinterUris = []
}

async function saveSettings() {
  savingSettings.value = true
  try {
    const payload = {
      retentionDays: parseInt(settings.value.retentionDays || '0', 10),
      allowedPrinterUris: settings.value.allowedPrinterUris
    }
    const resp = await fetch('/api/admin/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRF()
      },
      body: JSON.stringify(payload)
    })
    if (!resp.ok) {
      const msg = await readError(resp)
      toast.add({ title: '保存失败', description: msg, color: 'error', icon: 'i-lucide-x-circle' })
      if (resp.status === 401) emit('logout')
      return
    }
    toast.add({ title: '保存成功', description: '系统设置已更新', color: 'success', icon: 'i-lucide-check-circle' })
    await loadSettings()
  } finally {
    savingSettings.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadPrintRecords(), loadSettings(), loadAdminPrinters()])
})
</script>
